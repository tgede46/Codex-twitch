export type PlayerScore = { id: string; nickname: string; score: number };

export type SessionState = {
  code: string;
  status: "waiting" | "live" | "ended";
  bossHp: number;
  bossMaxHp: number;
  playerCount: number;
  totalDamage: number;
  topPlayers: PlayerScore[];
  rageActive: boolean;
  lastEvent: string;
};

export type Ack<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };
