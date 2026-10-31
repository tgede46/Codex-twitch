import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Server } from "socket.io";
import { GAMES, type GameId, type SessionState } from "../src/types.ts";
import { db, type SessionRow, type PlayerRow } from "./db.ts";
import type { SQLInputValue } from "node:sqlite";

// ----------------------------------------------------

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });

// --- Etats partagés (nécessaires pour le classage et le chrono) ---

const onlinePlayers = new Map<string, Set<string>>();
const gameTimers = new Map<string, ReturnType<typeof setInterval>>();
const rageTimers = new Map<string, ReturnType<typeof setTimeout>>();

const quizRounds = [
  { prompt: "Quelle planète est surnommée la planète rouge ?", options: ["Vénus", "Mars", "Jupiter", "Mercure"], target: "Mars" },
  { prompt: "Combien de côtés a un hexagone ?", options: ["5", "6", "7", "8"], target: "6" },
  { prompt: "Quel animal est le plus grand du monde ?", options: ["Girafe", "Éléphant", "Baleine bleue", "Requin blanc"], target: "Baleine bleue" },
  { prompt: "Quelle est la capitale du Japon ?", options: ["Séoul", "Tokyo", "Kyoto", "Pékin"], target: "Tokyo" },
  { prompt: "Combien font 9 × 7 ?", options: ["56", "63", "72", "79"], target: "63" },
];

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 5): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((byte) => codeAlphabet[byte % codeAlphabet.length])
    .join("");
}

// --- Helpers SQLite ---

function findSession(code: string): SessionRow | undefined {
  return db.prepare("SELECT * FROM sessions WHERE code = ?").get(code) as SessionRow | undefined;
}

function getPlayers(sessionCode: string): PlayerRow[] {
  return db.prepare("SELECT * FROM players WHERE session_code = ? ORDER BY score DESC, updated_at ASC").all(sessionCode) as unknown as PlayerRow[];
}

function getPlayer(sessionCode: string, id: string): PlayerRow | undefined {
  return db.prepare("SELECT * FROM players WHERE session_code = ? AND id = ?").get(sessionCode, id) as unknown as PlayerRow | undefined;
}

function upsertPlayer(id: string, sessionCode: string, nickname: string): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO players (id, session_code, nickname, score, last_attack, created_at, updated_at)
     VALUES (?, ?, ?, 0, 0, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       nickname = excluded.nickname,
       score = COALESCE(players.score, 0),
       last_attack = 0,
       updated_at = excluded.updated_at`
  ).run(...([id, sessionCode, nickname, now, now] as SQLInputValue[]));
}

function updatePlayerScore(sessionCode: string, id: string, score: number, updatedAt: number): void {
  db.prepare("UPDATE players SET score = ?, updated_at = ? WHERE session_code = ? AND id = ?").run(score, updatedAt, sessionCode, id);
}

function updatePlayerLastAttack(sessionCode: string, id: string, lastAttack: number): void {
  db.prepare("UPDATE players SET last_attack = ? WHERE session_code = ? AND id = ?").run(lastAttack, sessionCode, id);
}

function updateSession(code: string, updates: Partial<SessionRow>): void {
  const sets: string[] = [];
  const values: Array<SQLInputValue> = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null) continue;
    sets.push(`${key} = ?`);
    values.push(value as SQLInputValue);
  }
  if (sets.length === 0) return;
  values.push(code);
  db.prepare(`UPDATE sessions SET ${sets.join(", ")} WHERE code = ?`).run(...values);
}

function parseOptions(session: SessionRow): string[] {
  try {
    return JSON.parse(session.options);
  } catch {
    return [];
  }
}

// --- Publication des états ---

function publicState(session: SessionRow): SessionState {
  const players = getPlayers(session.code);
  const onlineCount = onlinePlayers.get(session.code)?.size ?? 0;
  const totalDamage = players.reduce((sum, p) => sum + p.score, 0);
  const topPlayers = players.slice(0, 5).map((p) => ({ id: p.id, nickname: p.nickname, score: p.score }));
  return {
    code: session.code,
    status: session.status as SessionState["status"],
    bossHp: session.boss_hp,
    bossMaxHp: session.boss_max_hp,
    playerCount: onlineCount,
    streamerParticipates: session.streamer_participates === 1,
    totalDamage,
    topPlayers,
    rageActive: session.rage_until > Date.now(),
    lastEvent: session.last_event,
    gameId: session.game_id as GameId,
    durationMinutes: session.duration_minutes,
    remainingSeconds: session.remaining_seconds,
    prompt: session.prompt,
    options: parseOptions(session),
    target: session.game_id === "quiz" ? "" : session.target,
  };
}

function publish(session: SessionRow): void {
  const state = publicState(session);
  io.to(session.code).emit("session:state", state);
  const players = getPlayers(session.code);
  for (const connected of io.sockets.sockets.values()) {
    if (connected.data.role !== "viewer" || connected.data.code !== session.code) continue;
    const rank = players.findIndex((p) => p.id === connected.data.playerId) + 1;
    connected.emit("viewer:rank", rank);
  }
}

// ----------------------------------------------------

io.on("connection", (socket) => {
  socket.on("session:create", (ack?: (result: unknown) => void) => {
    let code = randomCode();
    while (findSession(code) !== undefined) code = randomCode();
    const now = Date.now();
    const session: SessionRow = {
      code,
      host_token: crypto.randomUUID(),
      status: "waiting",
      game_id: "boss",
      duration_minutes: 5,
      remaining_seconds: 300,
      boss_hp: 1000,
      boss_max_hp: 1000,
      streamer_participates: 0,
      rage_until: 0,
      last_rage_at: 0,
      last_event: "",
      prompt: "Quelle planète est surnommée la planète rouge ?",
      options: JSON.stringify(["Vénus", "Mars", "Jupiter", "Mercure"]),
      target: "Mars",
      question_started_at: now,
      created_at: now,
      ended_at: null,
    };
    db.prepare("INSERT INTO sessions (code, host_token, status, game_id, duration_minutes, remaining_seconds, boss_hp, boss_max_hp, streamer_participates, rage_until, last_rage_at, last_event, prompt, options, target, question_started_at, created_at, ended_at) VALUES (@code, @host_token, @status, @game_id, @duration_minutes, @remaining_seconds, @boss_hp, @boss_max_hp, @streamer_participates, @rage_until, @last_rage_at, @last_event, @prompt, @options, @target, @question_started_at, @created_at, @ended_at)").run({
      code, host_token: session.host_token, status: "waiting", game_id: "boss", duration_minutes: 5, remaining_seconds: 300,
      boss_hp: 1000, boss_max_hp: 1000, streamer_participates: 0, rage_until: 0, last_rage_at: 0, last_event: "",
      prompt: "Quelle planète est surnommée la planète rouge ?", options: JSON.stringify(["Vénus", "Mars", "Jupiter", "Mercure"]),
      target: "Mars", question_started_at: now, created_at: now, ended_at: null,
    });
    socket.join(code);
    socket.data.role = "host";
    socket.data.code = code;
    socket.data.hostToken = session.host_token;
    ack?.({ ok: true, code, hostToken: session.host_token, state: publicState(session) });
    publish(session);
  });

  socket.on("host:join", ({ code, hostToken }: { code: string; hostToken: string }, ack?: (result: unknown) => void) => {
    const session = findSession(code);
    if (!session || session.host_token !== hostToken) {
      ack?.({ ok: false, error: "Session introuvable ou accès hôte invalide." });
      return;
    }
    socket.join(session.code);
    socket.data.role = "host";
    socket.data.code = session.code;
    socket.data.hostToken = hostToken;
    ack?.({ ok: true, state: publicState(session) });
    publish(session);
  });

  socket.on("overlay:join", ({ code }: { code: string }, ack?: (result: unknown) => void) => {
    const session = findSession(code);
    if (!session) {
      ack?.({ ok: false, error: "Cette session n'existe plus." });
      return;
    }
    socket.join(session.code);
    socket.data.role = "overlay";
    socket.data.code = session.code;
    ack?.({ ok: true, state: publicState(session) });
  });

  socket.on("viewer:join", ({ code, nickname, playerId }: { code: string; nickname: string; playerId?: string }, ack?: (result: unknown) => void) => {
    const session = findSession(code);
    if (!session || session.status === "ended") {
      ack?.({ ok: false, error: "Cette partie est terminée ou introuvable." });
      return;
    }
    const cleanNickname = typeof nickname === "string" ? nickname.trim().replace(/[^\p{L}\p{N}_ -]/gu, "").slice(0, 16) : "";
    if (!cleanNickname) {
      ack?.({ ok: false, error: "Entre un pseudo de 1 à 16 caractères." });
      return;
    }
    const id = playerId && /^[\\w-]{8,64}$/.test(playerId) ? playerId : crypto.randomUUID();
    upsertPlayer(id, session.code, cleanNickname);
    const online = onlinePlayers.get(session.code) ?? new Set<string>();
    onlinePlayers.set(session.code, online);
    online.add(id);
    socket.join(session.code);
    socket.data.role = "viewer";
    socket.data.code = session.code;
    socket.data.playerId = id;
    const rank = getPlayers(session.code).findIndex((p) => p.id === id) + 1;
    ack?.({ ok: true, playerId: id, rank, state: publicState(session) });
    publish(session);
  });

  socket.on("host:start", (ack?: (result: unknown) => void) => {
    const session = findSession(socket.data.code as string);
    if (!session || socket.data.role !== "host" || session.host_token !== socket.data.hostToken) {
      ack?.({ ok: false, error: "Action réservée au streamer." });
      return;
    }
    if (session.status !== "waiting") {
      ack?.({ ok: false, error: "La partie a déjà démarré." });
      return;
    }
    const gameName = GAMES.find((game) => game.id === session.game_id)?.name ?? "Jeu";
    updateSession(session.code, {
      status: "live",
      last_event: `${gameName} commence !`,
      remaining_seconds: session.duration_minutes * 60,
    });
    if (gameTimers.has(session.code)) clearInterval(gameTimers.get(session.code)!);
    const timer = setInterval(() => {
      const row = findSession(socket.data.code as string);
      if (!row || row.status !== "live") {
        if (row?.status === "ended" && gameTimers.has(row.code)) {
          clearInterval(gameTimers.get(row.code)!);
          gameTimers.delete(row.code);
        }
        return;
      }
      const next = row.remaining_seconds - 1;
      if (row.game_id === "jump") {
        updateSession(row.code, {
          target: next % 4 === 0 ? "Obstacle" : row.target,
          last_event: next % 4 === 0 ? "Obstacle ! Sautez maintenant !" : row.last_event,
        });
      } else if (row.game_id === "marble" && next % 5 === 0) {
        const target = Math.random() < 0.5 ? "Gauche" : "Droite";
        updateSession(row.code, { target, last_event: `Virage serré à ${target.toLowerCase()} !` });
      } else if (row.game_id === "arena" && next % 4 === 0) {
        const target = Math.random() < 0.5 ? "Pousser gauche" : "Pousser droite";
        updateSession(row.code, { target, last_event: `Poussée ! ${target} !` });
      }
      updateSession(row.code, { remaining_seconds: next });
      if (next <= 0) {
        updateSession(row.code, { status: "ended", remaining_seconds: 0, last_event: "Temps écoulé ! Voici le classement final." });
        if (gameTimers.has(row.code)) {
          clearInterval(gameTimers.get(row.code)!);
          gameTimers.delete(row.code);
        }
        rageTimers.delete(row.code);
      } else {
        publish(row);
      }
    }, 1000);
    gameTimers.set(session.code, timer);
    ack?.({ ok: true });
    publish(session);
  });

  socket.on("host:configure", ({ gameId, durationMinutes }: { gameId: GameId; durationMinutes: number }, ack?: (result: unknown) => void) => {
    const session = findSession(socket.data.code as string);
    if (!session || socket.data.role !== "host" || session.host_token !== socket.data.hostToken) {
      ack?.({ ok: false, error: "Action réservée au streamer." });
      return;
    }
    if (session.status !== "waiting") {
      ack?.({ ok: false, error: "La configuration est verrouillée après le lancement." });
      return;
    }
    if (!GAMES.some((game) => game.id === gameId) || ![3, 4, 5, 6, 7, 8, 9, 10].includes(durationMinutes)) {
      ack?.({ ok: false, error: "Choisis un jeu et une durée entre 3 et 10 minutes." });
      return;
    }
    updateSession(session.code, { game_id: gameId, duration_minutes: durationMinutes, remaining_seconds: durationMinutes * 60 });
    if (gameId === "quiz") {
      const question = quizRounds[Math.floor(Math.random() * quizRounds.length)];
      updateSession(session.code, { prompt: question.prompt, options: JSON.stringify(question.options), target: question.target, question_started_at: Date.now() });
    } else if (gameId === "jump") {
      updateSession(session.code, { prompt: "Sautez au-dessus des obstacles !", options: JSON.stringify(["SAUTER"]), target: "Course libre" });
    } else if (gameId === "marble") {
      updateSession(session.code, { prompt: "Guidez votre bille dans la course !", options: JSON.stringify(["Gauche", "Droite"]), target: "Gauche" });
    } else if (gameId === "arena") {
      updateSession(session.code, { prompt: "Poussez les adversaires hors de l'arène !", options: JSON.stringify(["Pousser gauche", "Pousser droite"]), target: "Pousser gauche" });
    } else {
      updateSession(session.code, { prompt: "Attaquez ensemble le golem violet !", options: JSON.stringify([]), target: "" });
    }
    const pool = GAMES.find((g) => g.id === gameId) ?? { id: "boss", name: "Boss Raid" };
    updateSession(session.code, { last_event: `Configuration : ${pool.name}, ${durationMinutes} min.` });
    publish(session);
    ack?.({ ok: true });
  });

  socket.on("game:action", ({ answer }: { answer?: string }, ack?: (result: unknown) => void) => {
    const session = findSession(socket.data.code as string);
    const player = getPlayer(session?.code as string, socket.data.playerId as string);
    if (!session || socket.data.role !== "viewer" || !player) {
      ack?.({ ok: false, error: "Rejoins la partie avant de jouer." });
      return;
    }
    if (session.status !== "live") {
      ack?.({ ok: false, error: "La partie n'a pas commencé." });
      return;
    }
    const now = Date.now();
    if (now - player.last_attack < 800) return ack?.({ ok: false, error: "Une seconde…" });
    updatePlayerLastAttack(session.code, player.id, now);
    let points = 10;
    if (session.game_id === "boss") {
      points = session.rage_until > now ? 20 : 10;
    } else if (session.game_id === "quiz") {
      if (!answer || !parseOptions(session).includes(answer)) return ack?.({ ok: false, error: "Choisis une réponse." });
      if (answer !== session.target) return ack?.({ ok: true, points: 0, correct: false });
      points = 100 + Math.max(0, 50 - Math.floor((now - session.question_started_at) / 1000) * 5);
    } else if (session.game_id === "jump") {
      if (answer !== "SAUTER") return ack?.({ ok: false, error: "Appuie sur Sauter pour franchir l'obstacle." });
      points = session.target === "Obstacle" ? 50 : 10;
    } else if (session.game_id === "marble") {
      if (!answer || !parseOptions(session).includes(answer)) return ack?.({ ok: false, error: "Choisis une direction." });
      points = answer === session.target ? 25 : 10;
    } else if (session.game_id === "arena") {
      if (!answer || !parseOptions(session).includes(answer)) return ack?.({ ok: false, error: "Choisis une poussée." });
      points = answer === session.target ? 30 : 15;
    }
    updatePlayerScore(session.code, player.id, player.score + points, now);
    if (session.game_id === "boss") {
      updateSession(session.code, { boss_hp: Math.max(0, session.boss_hp - points) });
    }
    if (session.game_id === "quiz" && answer === session.target) {
      const question = quizRounds[Math.floor(Math.random() * quizRounds.length)];
      updateSession(session.code, { prompt: question.prompt, options: JSON.stringify(question.options), target: question.target, question_started_at: now });
    }
    const lastEvent = points ? `${player.nickname} marque ${points} points !` : `${player.nickname} a tenté sa chance.`;
    updateSession(session.code, { last_event: lastEvent });
    if (session.game_id === "boss" && session.boss_hp === 0) {
      updateSession(session.code, { status: "ended", last_event: "Victoire ! La communauté a vaincu le boss." });
    }
    ack?.({ ok: true, points, correct: session.game_id === "quiz" ? answer === session.target : undefined });
    publish(session);
  });

  socket.on("game:attack", (ack?: (result: unknown) => void) => {
    const session = findSession(socket.data.code as string);
    const player = getPlayer(session?.code as string, socket.data.playerId as string);
    if (!session || socket.data.role !== "viewer" || !player) {
      ack?.({ ok: false, error: "Rejoins la partie avant d'attaquer." });
      return;
    }
    if (session.game_id !== "boss") {
      ack?.({ ok: false, error: "Utilise la commande adaptée au jeu en cours." });
      return;
    }
    if (session.status !== "live") {
      ack?.({ ok: false, error: "La partie n'a pas encore commencé." });
      return;
    }
    const now = Date.now();
    if (now - player.last_attack < 800) {
      ack?.({ ok: false, error: "Une seconde… ton attaque recharge." });
      return;
    }
    const damage = session.rage_until > now ? 20 : 10;
    updatePlayerLastAttack(session.code, player.id, now);
    updatePlayerScore(session.code, player.id, player.score + damage, now);
    if (session.game_id === "boss") {
      updateSession(session.code, { boss_hp: Math.max(0, session.boss_hp - damage) });
    }
    if (session.game_id === "boss" && session.boss_hp === 0) {
      updateSession(session.code, { status: "ended", last_event: "Victoire ! La communauté a vaincu le boss." });
    } else {
      updateSession(session.code, { last_event: `${player.nickname} inflige ${damage} dégâts !` });
    }
    ack?.({ ok: true, damage });
    publish(session);
  });

  socket.on("host:attack", (ack?: (result: unknown) => void) => {
    const session = findSession(socket.data.code as string);
    const player = getPlayer(session?.code as string, socket.data.playerId as string);
    if (!session || socket.data.role !== "host" || session.host_token !== socket.data.hostToken || !session.streamer_participates || !player) {
      ack?.({ ok: false, error: "Tu as choisi d'animer la partie." });
      return;
    }
    if (session.game_id !== "boss") {
      ack?.({ ok: false, error: "Le streamer anime ce jeu depuis le tableau de bord." });
      return;
    }
    if (session.status !== "live") {
      ack?.({ ok: false, error: "Lance la partie avant d'attaquer." });
      return;
    }
    const now = Date.now();
    if (now - player.last_attack < 800) {
      ack?.({ ok: false, error: "Une seconde… ton attaque recharge." });
      return;
    }
    const damage = session.rage_until > now ? 20 : 10;
    updatePlayerLastAttack(session.code, player.id, now);
    updatePlayerScore(session.code, player.id, player.score + damage, now);
    if (session.game_id === "boss") {
      updateSession(session.code, { boss_hp: Math.max(0, session.boss_hp - damage) });
    }
    if (session.boss_hp === 0) {
      updateSession(session.code, { status: "ended", last_event: "Victoire ! La communauté a vaincu le boss." });
    } else {
      updateSession(session.code, { last_event: `Streamer marque ${damage} points !` });
    }
    ack?.({ ok: true, damage });
    publish(session);
  });

  socket.on("host:rage", (ack?: (result: unknown) => void) => {
    const session = findSession(socket.data.code as string);
    if (!session || socket.data.role !== "host" || session.host_token !== socket.data.hostToken) {
      ack?.({ ok: false, error: "Action réservée au streamer." });
      return;
    }
    if (session.status !== "live") {
      ack?.({ ok: false, error: "Lance la partie avant l'événement." });
      return;
    }
    if (session.game_id !== "boss") {
      ack?.({ ok: false, error: "Cet événement est réservé au Boss Raid." });
      return;
    }
    const now = Date.now();
    if (session.rage_until > now || now - session.last_rage_at < 30_000) {
      ack?.({ ok: false, error: "La Rage du boss recharge encore." });
      return;
    }
    updateSession(session.code, {
      last_rage_at: now,
      rage_until: now + 10_000,
      last_event: "RAGE DU BOSS · Les viewers font double dégâts pendant 10 s !",
    });
    if (rageTimers.has(session.code)) clearTimeout(rageTimers.get(session.code)!);
    const rageTimer = setTimeout(() => {
      updateSession(session.code, { rage_until: 0, last_event: "La Rage du boss est terminée." });
      rageTimers.delete(session.code);
      publish(session);
    }, 10_000);
    rageTimers.set(session.code, rageTimer);
    ack?.({ ok: true });
    publish(session);
  });

  socket.on("host:end", (ack?: (result: unknown) => void) => {
    const session = findSession(socket.data.code as string);
    if (!session || socket.data.role !== "host" || session.host_token !== socket.data.hostToken) {
      ack?.({ ok: false, error: "Action réservée au streamer." });
      return;
    }
    updateSession(session.code, { status: "ended", last_event: "Partie terminée par le streamer." });
    if (gameTimers.has(session.code)) {
      clearInterval(gameTimers.get(session.code)!);
      gameTimers.delete(session.code);
    }
    ack?.({ ok: true });
    publish(session);
  });

  socket.on("disconnect", () => {
    const session = findSession(socket.data.code as string);
    if (session && socket.data.role === "viewer") {
      const online = onlinePlayers.get(session.code);
      if (online) {
        online.delete(socket.data.playerId as string);
        if (online.size === 0) onlinePlayers.delete(session.code);
      }
      publish(session);
    }
  });
});

// ----------------------------------------------------

const distPath = join(process.cwd(), "dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/.*/, (_req, res) => res.sendFile(join(distPath, "index.html")));
}

const port = Number(process.env.PORT ?? 3001);
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`CrowdRaid server listening on :${port}`);
});
