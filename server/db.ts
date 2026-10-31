// server/db.ts — SQLite storage for CrowdRaid sessions et joueurs.
// Remplace Les Maps en mémoire (sessions / players) par une base persistée.
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const dataDir = join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(join(dataDir, "crowdraid.db"));
db.exec("PRAGMA journal_mode = WAL");

// --- Types des lignes de la base ---

export interface SessionRow {
  code: string;
  host_token: string;
  status: string;
  game_id: string;
  duration_minutes: number;
  remaining_seconds: number;
  boss_hp: number;
  boss_max_hp: number;
  streamer_participates: number;
  rage_until: number;
  last_rage_at: number;
  last_event: string;
  prompt: string;
  options: string;
  target: string;
  question_started_at: number;
  created_at: number;
  ended_at: number | null;
}

export interface PlayerRow {
  id: string;
  session_code: string;
  nickname: string;
  avatar?: string;
  badge?: string;
  score: number;
  last_attack: number;
  created_at: number;
  updated_at: number;
}

// ----------------------------------------------------

export function initSchema() {
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (
    code           TEXT PRIMARY KEY,
    host_token     TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'waiting',
    game_id        TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    remaining_seconds INTEGER NOT NULL,
    boss_hp        INTEGER NOT NULL DEFAULT 1000,
    boss_max_hp    INTEGER NOT NULL DEFAULT 1000,
    streamer_participates INTEGER NOT NULL DEFAULT 0,
    rage_until     INTEGER NOT NULL DEFAULT 0,
    last_rage_at   INTEGER NOT NULL DEFAULT 0,
    last_event     TEXT NOT NULL DEFAULT '',
    prompt         TEXT NOT NULL DEFAULT '',
    options        TEXT NOT NULL DEFAULT '[]',
    target         TEXT NOT NULL DEFAULT '',
    question_started_at INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL,
    ended_at        INTEGER
  );
  CREATE TABLE IF NOT EXISTS players (
    id            TEXT PRIMARY KEY,
    session_code  TEXT NOT NULL,
    nickname      TEXT NOT NULL,
    avatar        TEXT NOT NULL DEFAULT '',
    badge         TEXT NOT NULL DEFAULT '',
    score         INTEGER NOT NULL DEFAULT 0,
    last_attack   INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    FOREIGN KEY (session_code) REFERENCES sessions(code) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_players_session ON players(session_code);`);

  try {
    db.exec("ALTER TABLE players ADD COLUMN avatar TEXT DEFAULT ''");
  } catch {}
  try {
    db.exec("ALTER TABLE players ADD COLUMN badge TEXT DEFAULT ''");
  } catch {}
}

// --- Helpers de lecture / écriture ---

export function findSession(code: string): SessionRow | undefined {
  return db.prepare("SELECT * FROM sessions WHERE code = ?").get(code) as SessionRow | undefined;
}

export function getPlayers(sessionCode: string): PlayerRow[] {
  return db.prepare("SELECT * FROM players WHERE session_code = ? ORDER BY score DESC, updated_at ASC").all(sessionCode) as unknown as PlayerRow[];
}

export function getPlayer(sessionCode: string, id: string): PlayerRow | undefined {
  return db.prepare("SELECT * FROM players WHERE session_code = ? AND id = ?").get(sessionCode, id) as unknown as PlayerRow | undefined;
}

export function upsertPlayer(id: string, sessionCode: string, nickname: string, avatar = "", badge = ""): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO players (id, session_code, nickname, avatar, badge, score, last_attack, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       nickname = excluded.nickname,
       avatar = CASE WHEN excluded.avatar != '' THEN excluded.avatar ELSE players.avatar END,
       badge = CASE WHEN excluded.badge != '' THEN excluded.badge ELSE players.badge END,
       score = COALESCE(players.score, 0),
       last_attack = 0,
       updated_at = excluded.updated_at`
  ).run(...([id, sessionCode, nickname, avatar, badge, now, now] as SQLInputValue[]));
}

export function updatePlayerScore(sessionCode: string, id: string, score: number, updatedAt: number): void {
  db.prepare("UPDATE players SET score = ?, updated_at = ? WHERE session_code = ? AND id = ?")
    .run(...([score, updatedAt, sessionCode, id] as SQLInputValue[]));
}

export function updatePlayerLastAttack(sessionCode: string, id: string, lastAttack: number): void {
  db.prepare("UPDATE players SET last_attack = ? WHERE session_code = ? AND id = ?")
    .run(...([lastAttack, sessionCode, id] as SQLInputValue[]));
}

export function updateSession(code: string, updates: Partial<SessionRow>): void {
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

export function deleteSession(code: string): void {
  db.prepare("DELETE FROM sessions WHERE code = ?").run(...([code] as SQLInputValue[]));
}

export function listSessions(): SessionRow[] {
  return db.prepare("SELECT * FROM sessions ORDER BY created_at DESC").all() as unknown as SessionRow[];
}

export function getHostSessionsHistory(hostToken?: string) {
  let sessions: SessionRow[];
  if (hostToken) {
    sessions = db.prepare("SELECT * FROM sessions WHERE host_token = ? ORDER BY created_at DESC LIMIT 30").all(hostToken) as unknown as SessionRow[];
  } else {
    sessions = db.prepare("SELECT * FROM sessions ORDER BY created_at DESC LIMIT 30").all() as unknown as SessionRow[];
  }
  return sessions.map((session) => {
    const players = getPlayers(session.code);
    const playerCount = players.length;
    const totalScore = players.reduce((sum, p) => sum + (p.score || 0), 0);
    const top3 = players.slice(0, 3).map((p) => ({ nickname: p.nickname, score: p.score }));
    return {
      code: session.code,
      gameId: session.game_id,
      createdAt: session.created_at,
      endedAt: session.ended_at,
      status: session.status,
      durationMinutes: session.duration_minutes,
      playerCount,
      totalScore,
      top3,
    };
  });
}

export function getViewerSessionsHistory(playerIds: string[]) {
  if (!playerIds || playerIds.length === 0) return [];
  const placeholders = playerIds.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT p.id as player_id, p.nickname, p.score, p.session_code, s.game_id, s.status, s.created_at
     FROM players p
     JOIN sessions s ON p.session_code = s.code
     WHERE p.id IN (${placeholders})
     ORDER BY s.created_at DESC LIMIT 50`
  ).all(...(playerIds as SQLInputValue[])) as Array<{
    player_id: string;
    nickname: string;
    score: number;
    session_code: string;
    game_id: string;
    status: string;
    created_at: number;
  }>;

  return rows.map((row) => {
    const sessionPlayers = getPlayers(row.session_code);
    const rank = sessionPlayers.findIndex((p) => p.id === row.player_id) + 1;
    return {
      sessionCode: row.session_code,
      gameId: row.game_id,
      date: row.created_at,
      nickname: row.nickname,
      score: row.score,
      rank: rank > 0 ? rank : 1,
      totalPlayers: sessionPlayers.length,
      status: row.status,
    };
  });
}

// Initialise le schéma à l'import du module.
initSchema();

