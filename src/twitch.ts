// src/twitch.ts — Intégration Twitch (OAuth & Démo instantanée)
import type { TwitchUser } from "./types";

export const DEMO_STREAMERS: TwitchUser[] = [
  {
    id: "twitch-streamer-1",
    login: "zerator",
    displayName: "ZeratoR",
    avatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/4256f157-ba71-4648-b4b1-e0c2f2560381-profile_image-150x150.png",
    isStreamer: true,
    role: "streamer",
  },
  {
    id: "twitch-streamer-2",
    login: "kamet0",
    displayName: "Kamet0",
    avatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/a171be99-dfd4-4a47-a7eb-944a957d3419-profile_image-150x150.png",
    isStreamer: true,
    role: "streamer",
  },
  {
    id: "twitch-streamer-3",
    login: "antoinedaniel",
    displayName: "AntoineDaniel",
    avatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/76378eeb-4a11-4770-98fe-897dbfc73ba0-profile_image-150x150.png",
    isStreamer: true,
    role: "streamer",
  },
  {
    id: "twitch-streamer-4",
    login: "pokimane",
    displayName: "Pokimane",
    avatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/60e0a30b-0442-4fcf-847e-2cfc6a0c0b9a-profile_image-150x150.png",
    isStreamer: true,
    role: "streamer",
  },
];

export const DEMO_VIEWERS: TwitchUser[] = [
  {
    id: "twitch-viewer-1",
    login: "speedkillz",
    displayName: "SpeedKillZ",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=SpeedKillZ",
    role: "sub",
  },
  {
    id: "twitch-viewer-2",
    login: "n3buladx",
    displayName: "N3bulaDx",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=N3bulaDx",
    role: "vip",
  },
  {
    id: "twitch-viewer-3",
    login: "xxdragonslayer99",
    displayName: "XxDragonSlayer99",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=DragonSlayer",
    role: "mod",
  },
  {
    id: "twitch-viewer-4",
    login: "progamerxd",
    displayName: "ProGamerXD",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=ProGamerXD",
    role: "viewer",
  },
];

type TwitchSessionRole = "streamer" | "viewer";

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
