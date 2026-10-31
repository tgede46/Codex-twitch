// src/twitch.ts — Intégration Twitch (OAuth & Démo instantanée)
import type { TwitchUser } from "./types";

export const DEMO_STREAMERS: TwitchUser[] = [
  {
    id: "twitch-streamer-1",
    login: "raidmaster",
    displayName: "RaidMaster",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=RaidMaster",
    isStreamer: true,
    role: "streamer",
  },
  {
    id: "twitch-streamer-2",
    login: "pixelqueen",
    displayName: "PixelQueen",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=PixelQueen",
    isStreamer: true,
    role: "streamer",
  },
  {
    id: "twitch-streamer-3",
    login: "bosscaller",
    displayName: "BossCaller",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=BossCaller",
    isStreamer: true,
    role: "streamer",
  },
  {
    id: "twitch-streamer-4",
    login: "chatcaptain",
    displayName: "ChatCaptain",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=ChatCaptain",
    isStreamer: true,
    role: "streamer",
  },
];

export const DEMO_VIEWERS: TwitchUser[] = [
  {
    id: "twitch-viewer-1",
    login: "raidrookie",
    displayName: "RaidRookie",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=RaidRookie",
    role: "sub",
  },
  {
    id: "twitch-viewer-2",
    login: "pixelpilot",
    displayName: "PixelPilot",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=PixelPilot",
    role: "vip",
  },
  {
    id: "twitch-viewer-3",
    login: "modscout",
    displayName: "ModScout",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=ModScout",
    role: "mod",
  },
  {
    id: "twitch-viewer-4",
    login: "chatplayer",
    displayName: "ChatPlayer",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=ChatPlayer",
    role: "viewer",
  },
];

export type TwitchSessionRole = "streamer" | "viewer";

function twitchUserKey(role: TwitchSessionRole): string {
  return `crowdraid:twitch_user:${role}`;
}

export function getSavedTwitchUser(role: TwitchSessionRole = "viewer"): TwitchUser | null {
  try {
    const raw = localStorage.getItem(twitchUserKey(role));
    const user = raw ? (JSON.parse(raw) as TwitchUser) : null;
    return user?.isStreamer === (role === "streamer") ? user : null;
  } catch {
    return null;
  }
}

export function saveTwitchUser(user: TwitchUser | null, role: TwitchSessionRole = "viewer"): void {
  try {
    if (user) {
      localStorage.setItem(twitchUserKey(role), JSON.stringify(user));
    } else {
      localStorage.removeItem(twitchUserKey(role));
    }
  } catch {
    // Ignore storage errors
  }
}

export function createCustomTwitchUser(displayName: string, isStreamer = false, role: TwitchUser["role"] = "viewer"): TwitchUser {
  const clean = displayName.trim().replace(/[^\w-]/g, "") || "Raider";
  return {
    id: `custom-${Date.now()}-${clean.toLowerCase()}`,
    login: clean.toLowerCase(),
    displayName: clean,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(clean)}`,
    isStreamer,
    role: isStreamer ? "streamer" : role,
  };
}

export function buildTwitchOAuthUrl(clientId: string, redirectUri: string): string {
  const scopes = encodeURIComponent("user:read:email");
  return `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scopes}`;
}

export function parseTwitchHashToken(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get("access_token");
}

export function beginTwitchLogin(role: TwitchSessionRole): void {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/api/twitch/login?role=${role}&returnTo=${encodeURIComponent(returnTo)}`);
}

export async function loadAuthenticatedTwitchUser(role: TwitchSessionRole): Promise<TwitchUser | null> {
  try {
    const response = await fetch(`/api/twitch/me?role=${role}`, { credentials: "same-origin" });
    if (!response.ok) return null;
    const payload = await response.json() as { user?: TwitchUser };
    const user = payload.user;
    if (!user || user.isStreamer !== (role === "streamer")) return null;
    return user;
  } catch {
    return null;
  }
}

export async function logoutTwitchUser(role: TwitchSessionRole): Promise<void> {
  await fetch(`/api/twitch/logout?role=${role}`, { method: "POST", credentials: "same-origin" }).catch(() => undefined);
}
