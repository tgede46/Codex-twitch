import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Server } from "socket.io";
import { GAMES, type GameId, type SessionState } from "../src/types.ts";

type Player = { id: string; nickname: string; score: number; lastAttack: number; scoreUpdatedAt: number };
type Session = {
  code: string;
  hostToken: string;
  status: SessionState["status"];
  bossHp: number;
  players: Map<string, Player>;
  onlinePlayers: Set<string>;
  streamerParticipates: boolean;
  rageUntil: number;
  lastRageAt: number;
  lastEvent: string;
  gameId: GameId;
  durationMinutes: number;
  remainingSeconds: number;
  prompt: string;
  options: string[];
  target: string;
  questionStartedAt: number;
  gameTimer?: ReturnType<typeof setInterval>;
  rageTimer?: ReturnType<typeof setTimeout>;
};
const quizRounds = [
  { prompt: "Quelle planète est surnommée la planète rouge ?", options: ["Vénus", "Mars", "Jupiter", "Mercure"], target: "Mars" },
  { prompt: "Combien de côtés a un hexagone ?", options: ["5", "6", "7", "8"], target: "6" },
  { prompt: "Quel animal est le plus grand du monde ?", options: ["Girafe", "Éléphant", "Baleine bleue", "Requin blanc"], target: "Baleine bleue" },
  { prompt: "Quelle est la capitale du Japon ?", options: ["Séoul", "Tokyo", "Kyoto", "Pékin"], target: "Tokyo" },
  { prompt: "Combien font 9 × 7 ?", options: ["56", "63", "72", "79"], target: "63" },
];

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });
const sessions = new Map<string, Session>();
const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 5) {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((byte) => codeAlphabet[byte % codeAlphabet.length])
    .join("");
}

function publicState(session: Session): SessionState {
  const players = [...session.players.values()].sort((a, b) => b.score - a.score || a.scoreUpdatedAt - b.scoreUpdatedAt);
  return {
    code: session.code,
    status: session.status,
    bossHp: session.bossHp,
    bossMaxHp: 1000,
    playerCount: session.onlinePlayers.size,
    streamerParticipates: session.streamerParticipates,
    totalDamage: players.reduce((sum, player) => sum + player.score, 0),
    topPlayers: players.slice(0, 5).map(({ id, nickname, score }) => ({ id, nickname, score })),
    rageActive: session.rageUntil > Date.now(),
    lastEvent: session.lastEvent,
    gameId: session.gameId,
    durationMinutes: session.durationMinutes,
    remainingSeconds: session.remainingSeconds,
    prompt: session.prompt,
    options: session.options,
    target: session.gameId === "quiz" ? "" : session.target,
  };
}

function publish(session: Session) {
  const ranked = [...session.players.values()].sort((a, b) => b.score - a.score || a.scoreUpdatedAt - b.scoreUpdatedAt);
  io.to(session.code).emit("session:state", publicState(session));
  for (const connected of io.sockets.sockets.values()) {
    if (connected.data.role !== "viewer" || connected.data.code !== session.code) continue;
    connected.emit("viewer:rank", ranked.findIndex((player) => player.id === connected.data.playerId) + 1);
  }
}

function findSession(code: unknown) {
  return typeof code === "string" ? sessions.get(code.toUpperCase()) : undefined;
}

io.on("connection", (socket) => {
  socket.on("session:create", (ack?: (result: unknown) => void) => {
    let code = randomCode();
    while (sessions.has(code)) code = randomCode();
    const session: Session = {
      code,
      hostToken: crypto.randomUUID(),
      status: "waiting",
      bossHp: 1000,
      players: new Map(),
      onlinePlayers: new Set(),
      streamerParticipates: false,
      rageUntil: 0,
      lastRageAt: 0,
      lastEvent: "",
      gameId: "boss",
      durationMinutes: 5,
      remainingSeconds: 300,
      prompt: "Quelle planète est surnommée la planète rouge ?",
      options: ["Vénus", "Mars", "Jupiter", "Mercure"],
      target: "Mars",
      questionStartedAt: Date.now(),
    };
    sessions.set(code, session);
    socket.join(code);
    socket.data.role = "host";
    socket.data.code = code;
    socket.data.hostToken = session.hostToken;
    ack?.({ ok: true, code, hostToken: session.hostToken, state: publicState(session) });
    publish(session);
  });

  socket.on("host:join", ({ code, hostToken }: { code: string; hostToken: string }, ack?: (result: unknown) => void) => {
    const session = findSession(code);
    if (!session || session.hostToken !== hostToken) {
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
      ack?.({ ok: false, error: "Cette session n’existe plus." });
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
    const id = playerId && /^[\w-]{8,64}$/.test(playerId) ? playerId : crypto.randomUUID();
    const player = session.players.get(id) ?? { id, nickname: cleanNickname, score: 0, lastAttack: 0, scoreUpdatedAt: Date.now() };
    player.nickname = cleanNickname;
    session.players.set(id, player);
    session.onlinePlayers.add(id);
    socket.join(session.code);
    socket.data.role = "viewer";
    socket.data.code = session.code;
    socket.data.playerId = id;
    const rank = [...session.players.values()].sort((a, b) => b.score - a.score || a.scoreUpdatedAt - b.scoreUpdatedAt).findIndex((entry) => entry.id === id) + 1;
    ack?.({ ok: true, playerId: id, rank, state: publicState(session) });
    publish(session);
  });

  socket.on("host:start", (ack?: (result: unknown) => void) => {
    const session = findSession(socket.data.code);
    if (!session || socket.data.role !== "host" || session.hostToken !== socket.data.hostToken) {
      ack?.({ ok: false, error: "Action réservée au streamer." });
      return;
    }
    if (session.status !== "waiting") {
      ack?.({ ok: false, error: "La partie a déjà démarré." });
      return;
    }
    session.status = "live";
    session.lastEvent = `${GAMES.find((game) => game.id === session.gameId)?.name ?? "Jeu"} commence !`;
    session.remainingSeconds = session.durationMinutes * 60;
    if (session.gameTimer) clearInterval(session.gameTimer);
    session.gameTimer = setInterval(() => {
      if (session.status !== "live") {
        if (session.status === "ended" && session.gameTimer) clearInterval(session.gameTimer);
        return;
      }
      session.remainingSeconds = Math.max(0, session.remainingSeconds - 1);
      if (session.gameId === "jump") {
        session.target = session.remainingSeconds % 4 === 0 ? "Obstacle" : "Course libre";
        if (session.target === "Obstacle") session.lastEvent = "Obstacle ! Sautez maintenant !";
      } else if (session.gameId === "marble" && session.remainingSeconds % 5 === 0) {
        session.target = Math.random() < 0.5 ? "Gauche" : "Droite";
        session.lastEvent = `Virage serré à ${session.target.toLowerCase()} !`;
      } else if (session.gameId === "arena" && session.remainingSeconds % 4 === 0) {
        session.target = Math.random() < 0.5 ? "Pousser gauche" : "Pousser droite";
        session.lastEvent = `Poussée ! ${session.target} !`;
      }
      if (!session.remainingSeconds) {
        session.status = "ended";
        session.lastEvent = "Temps écoulé ! Voici le classement final.";
        clearInterval(session.gameTimer);
      }
      publish(session);
    }, 1000);
    ack?.({ ok: true });
    publish(session);
  });

  socket.on("host:configure", ({ gameId, durationMinutes }: { gameId: GameId; durationMinutes: number }, ack?: (result: unknown) => void) => {
    const session = findSession(socket.data.code);
    if (!session || socket.data.role !== "host" || session.hostToken !== socket.data.hostToken) return ack?.({ ok: false, error: "Action réservée au streamer." });
    if (session.status !== "waiting") return ack?.({ ok: false, error: "La configuration est verrouillée après le lancement." });
    if (!GAMES.some((game) => game.id === gameId) || ![3, 4, 5, 6, 7, 8, 9, 10].includes(durationMinutes)) return ack?.({ ok: false, error: "Choisis un jeu et une durée entre 3 et 10 minutes." });
    session.gameId = gameId;
    session.durationMinutes = durationMinutes;
    session.remainingSeconds = durationMinutes * 60;
    if (gameId === "quiz") {
      const question = quizRounds[Math.floor(Math.random() * quizRounds.length)];
      session.prompt = question.prompt;
      session.options = question.options;
      session.target = question.target;
      session.questionStartedAt = Date.now();
    } else if (gameId === "jump") {
      session.prompt = "Sautez au-dessus des obstacles !";
      session.options = ["SAUTER"];
      session.target = "Course libre";
    } else if (gameId === "marble") {
      session.prompt = "Guidez votre bille dans la course !";
      session.options = ["Gauche", "Droite"];
      session.target = "Gauche";
    } else if (gameId === "arena") {
      session.prompt = "Poussez les adversaires hors de l’arène !";
      session.options = ["Pousser gauche", "Pousser droite"];
      session.target = session.options[Math.floor(Math.random() * session.options.length)];
    } else {
      session.prompt = "Attaquez ensemble le golem violet !";
      session.options = [];
      session.target = "";
    }
    session.lastEvent = `Configuration : ${GAMES.find((game) => game.id === gameId)?.name}, ${durationMinutes} min.`;
    publish(session);
    ack?.({ ok: true });
  });

  socket.on("game:action", ({ answer }: { answer?: string }, ack?: (result: unknown) => void) => {
    const session = findSession(socket.data.code);
    const player = session?.players.get(socket.data.playerId);
    if (!session || socket.data.role !== "viewer" || !player) return ack?.({ ok: false, error: "Rejoins la partie avant de jouer." });
    if (session.status !== "live") return ack?.({ ok: false, error: "La partie n’a pas commencé." });
    const now = Date.now();
    if (now - player.lastAttack < 800) return ack?.({ ok: false, error: "Une seconde…" });
    player.lastAttack = now;
    let points = 10;
    if (session.gameId === "boss") {
      points = session.rageUntil > now ? 20 : 10;
    } else if (session.gameId === "quiz") {
      if (!answer || !session.options.includes(answer)) return ack?.({ ok: false, error: "Choisis une réponse." });
      if (answer !== session.target) return ack?.({ ok: true, points: 0, correct: false });
      points = 100 + Math.max(0, 50 - Math.floor((now - session.questionStartedAt) / 1000) * 5);
    } else if (session.gameId === "jump") {
      if (answer !== "SAUTER") return ack?.({ ok: false, error: "Appuie sur Sauter pour franchir l’obstacle." });
      points = session.target === "Obstacle" ? 50 : 10;
    } else if (session.gameId === "marble") {
      if (!answer || !session.options.includes(answer)) return ack?.({ ok: false, error: "Choisis une direction." });
      points = answer === session.target ? 25 : 10;
    } else if (session.gameId === "arena") {
      if (!answer || !session.options.includes(answer)) return ack?.({ ok: false, error: "Choisis une poussée." });
      points = answer === session.target ? 30 : 15;
    }
    const correct = session.gameId === "quiz" ? answer === session.target : session.gameId === "jump" ? session.target === "Obstacle" : session.gameId === "marble" || session.gameId === "arena" ? answer === session.target : undefined;
    player.score += points;
    player.scoreUpdatedAt = now;
    if (session.gameId === "quiz" && correct) {
      const question = quizRounds[Math.floor(Math.random() * quizRounds.length)];
      session.prompt = question.prompt;
      session.options = question.options;
      session.target = question.target;
      session.questionStartedAt = now;
    }
    if (session.gameId === "boss") session.bossHp = Math.max(0, session.bossHp - points);
    session.lastEvent = points ? `${player.nickname} marque ${points} points !` : `${player.nickname} a tenté sa chance.`;
    if (session.gameId === "boss" && session.bossHp === 0) {
      session.status = "ended";
      session.lastEvent = "Victoire ! La communauté a vaincu le boss.";
      if (session.gameTimer) clearInterval(session.gameTimer);
    }
    ack?.({ ok: true, points, correct });
    publish(session);
  });

  socket.on("host:participation", ({ enabled }: { enabled: boolean }, ack?: (result: unknown) => void) => {
    const session = findSession(socket.data.code);
    if (!session || socket.data.role !== "host" || session.hostToken !== socket.data.hostToken) {
      ack?.({ ok: false, error: "Action réservée au streamer." });
      return;
    }
    if (session.status !== "waiting") {
      ack?.({ ok: false, error: "Choisis ton rôle avant de lancer la partie." });
      return;
    }
    session.streamerParticipates = Boolean(enabled);
    if (session.streamerParticipates) {
      session.players.set("streamer", session.players.get("streamer") ?? {
        id: "streamer", nickname: "Streamer", score: 0, lastAttack: 0, scoreUpdatedAt: Date.now(),
      });
    } else {
      session.players.delete("streamer");
    }
    ack?.({ ok: true });
    publish(session);
  });

  socket.on("game:attack", (ack?: (result: unknown) => void) => {
    const session = findSession(socket.data.code);
    const player = session?.players.get(socket.data.playerId);
    if (!session || socket.data.role !== "viewer" || !player) {
      ack?.({ ok: false, error: "Rejoins la partie avant d’attaquer." });
      return;
    }
    if (session.gameId !== "boss") {
      ack?.({ ok: false, error: "Utilise la commande adaptée au jeu en cours." });
      return;
    }
    if (session.status !== "live") {
      ack?.({ ok: false, error: "La partie n’a pas encore commencé." });
      return;
    }
    const now = Date.now();
    if (now - player.lastAttack < 800) {
      ack?.({ ok: false, error: "Une seconde… ton attaque recharge." });
      return;
    }
    const damage = session.gameId === "boss" && session.rageUntil > now ? 20 : session.gameId === "boss" ? 10 : 20;
    player.lastAttack = now;
    player.score += damage;
    player.scoreUpdatedAt = now;
    if (session.gameId === "boss") session.bossHp = Math.max(0, session.bossHp - damage);
    if (session.gameId === "boss" && session.bossHp === 0) {
      session.status = "ended";
      session.lastEvent = "Victoire ! La communauté a vaincu le boss.";
    } else {
      session.lastEvent = `${player.nickname} inflige ${damage} dégâts !`;
    }
    ack?.({ ok: true, damage });
    publish(session);
  });

  socket.on("host:attack", (ack?: (result: unknown) => void) => {
    const session = findSession(socket.data.code);
    const player = session?.players.get("streamer");
    if (!session || socket.data.role !== "host" || session.hostToken !== socket.data.hostToken || !session.streamerParticipates || !player) {
      ack?.({ ok: false, error: "Tu as choisi d’animer la partie." });
      return;
    }
    if (session.gameId !== "boss") {
      ack?.({ ok: false, error: "Le streamer anime ce jeu depuis le tableau de bord." });
      return;
    }
    if (session.status !== "live") {
      ack?.({ ok: false, error: "Lance la partie avant d’attaquer." });
      return;
    }
    const now = Date.now();
    if (now - player.lastAttack < 800) {
      ack?.({ ok: false, error: "Une seconde… ton attaque recharge." });
      return;
    }
    const damage = session.rageUntil > now ? 20 : 10;
    player.lastAttack = now;
    player.score += damage;
    player.scoreUpdatedAt = now;
    session.bossHp = Math.max(0, session.bossHp - damage);
    if (session.bossHp === 0) {
      session.status = "ended";
      session.lastEvent = "Victoire ! La communauté a vaincu le boss.";
    } else {
      session.lastEvent = `Streamer marque ${damage} points !`;
    }
    ack?.({ ok: true, damage });
    publish(session);
  });

  socket.on("host:rage", (ack?: (result: unknown) => void) => {
    const session = findSession(socket.data.code);
    if (!session || socket.data.role !== "host" || session.hostToken !== socket.data.hostToken) {
      ack?.({ ok: false, error: "Action réservée au streamer." });
      return;
    }
    const now = Date.now();
    if (session.status !== "live") {
      ack?.({ ok: false, error: "Lance la partie avant l’événement." });
      return;
    }
    if (session.gameId !== "boss") {
      ack?.({ ok: false, error: "Cet événement est réservé au Boss Raid." });
      return;
    }
    if (session.rageUntil > now || now - session.lastRageAt < 30_000) {
      ack?.({ ok: false, error: "La Rage du boss recharge encore." });
      return;
    }
    session.lastRageAt = now;
    session.rageUntil = now + 10_000;
    session.lastEvent = "RAGE DU BOSS · Les viewers font double dégâts pendant 10 s !";
    if (session.rageTimer) clearTimeout(session.rageTimer);
    session.rageTimer = setTimeout(() => {
      session.rageUntil = 0;
      session.lastEvent = "La Rage du boss est terminée.";
      publish(session);
    }, 10_000);
    ack?.({ ok: true });
    publish(session);
  });

  socket.on("host:end", (ack?: (result: unknown) => void) => {
    const session = findSession(socket.data.code);
    if (!session || socket.data.role !== "host" || session.hostToken !== socket.data.hostToken) {
      ack?.({ ok: false, error: "Action réservée au streamer." });
      return;
    }
    session.status = "ended";
    if (session.gameTimer) clearInterval(session.gameTimer);
    session.lastEvent = "Partie terminée par le streamer.";
    ack?.({ ok: true });
    publish(session);
  });

  socket.on("disconnect", () => {
    const session = findSession(socket.data.code);
    if (session && socket.data.role === "viewer") {
      session.onlinePlayers.delete(socket.data.playerId);
      publish(session);
    }
  });
});

const distPath = join(process.cwd(), "dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/.*/, (_req, res) => res.sendFile(join(distPath, "index.html")));
}

const port = Number(process.env.PORT ?? 3001);
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`CrowdRaid server listening on :${port}`);
});
