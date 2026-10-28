import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Server } from "socket.io";
import type { SessionState } from "../src/types.ts";

type Player = { id: string; nickname: string; score: number; lastAttack: number; scoreUpdatedAt: number };
type Session = {
  code: string;
  hostToken: string;
  status: SessionState["status"];
  bossHp: number;
  players: Map<string, Player>;
  onlinePlayers: Set<string>;
  rageUntil: number;
  lastRageAt: number;
  lastEvent: string;
  rageTimer?: ReturnType<typeof setTimeout>;
};

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
    totalDamage: players.reduce((sum, player) => sum + player.score, 0),
    topPlayers: players.slice(0, 5).map(({ id, nickname, score }) => ({ id, nickname, score })),
    rageActive: session.rageUntil > Date.now(),
    lastEvent: session.lastEvent,
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
      rageUntil: 0,
      lastRageAt: 0,
      lastEvent: "",
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
    session.lastEvent = "La partie commence !";
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
    if (session.status !== "live") {
      ack?.({ ok: false, error: "La partie n’a pas encore commencé." });
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
      session.lastEvent = `${player.nickname} inflige ${damage} dégâts !`;
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
