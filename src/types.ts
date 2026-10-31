export type PlayerScore = { id: string; nickname: string; score: number };
export type GameId = "jump" | "boss" | "quiz" | "marble" | "arena";
export const GAMES: { id: GameId; name: string; genre: string; description: string }[] = [
  { id: "jump", name: "Pixel Jump Royale", genre: "PLATFORMER · 2D", description: "Sautez ensemble au-dessus des obstacles." },
  { id: "boss", name: "Boss Raid", genre: "COOP · ACTION", description: "Unissez vos attaques pour terrasser le golem." },
  { id: "quiz", name: "Speed Quiz Show", genre: "QUIZ · VITESSE", description: "Répondez juste et vite aux questions du live." },
  { id: "marble", name: "Marble Fall 2D", genre: "COURSE · PHYSIQUE 2D", description: "Guidez votre bille dans une course à obstacles." },
  { id: "arena", name: "Arena Royale 2D", genre: "SUMO · COMPÉTITION 2D", description: "Poussez vos adversaires hors de l’arène." },
];

export type SessionState = {
  code: string;
  status: "waiting" | "live" | "ended";
  bossHp: number;
  bossMaxHp: number;
  playerCount: number;
  streamerParticipates: boolean;
  totalDamage: number;
  topPlayers: PlayerScore[];
  rageActive: boolean;
  lastEvent: string;
  gameId: GameId;
  durationMinutes: number;
  remainingSeconds: number;
  prompt: string;
  options: string[];
  target: string;
};

export type Ack<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };
