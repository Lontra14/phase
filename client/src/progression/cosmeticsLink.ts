// Online games: the two devices swap their cosmetics (card back + basic land arts)
// over a small side channel keyed by the room code, so each player sees the
// opponent's choices on the opponent's cards. Nothing about the game travels here.
//
// Three sources, best first:
//  1. what the opponent sent over this game's side channel (cached per room code
//     in sessionStorage, so a reload keeps it);
//  2. what the opponent sent in the mode lobby (Chess/Starter/Progression rooms,
//     localStorage "rogue-forge-opp-cosmetics", see rememberLobbyOpponent);
//  3. nothing: the opponent's cards keep the classic back.
// Games vs the AI give the AI a preset back different from yours.

import { useEffect } from "react";

import { openChessLink } from "../chess/chessLink";
import { fetchFreshTurnConfig } from "../network/connection";
import { createPeer } from "../network/transport";
import type { SharedCosmetics } from "./cosmetics";
import { aiBackUrl, loadCosmetics, setOpponentCosmetics, sharedCosmetics } from "./cosmetics";
import type { LinkPeer } from "./starterLink";

const LOBBY_OPP_KEY = "rogue-forge-opp-cosmetics";
const LOBBY_OPP_MAX_AGE = 12 * 60 * 60 * 1000;

function clean(c: Partial<SharedCosmetics> | null | undefined): SharedCosmetics | null {
  if (!c || typeof c !== "object") return null;
  const lands: Record<string, string> = {};
  if (c.lands && typeof c.lands === "object") for (const [k, v] of Object.entries(c.lands)) if (typeof v === "string") lands[k] = v;
  return { back: typeof c.back === "string" ? c.back : null, lands };
}

/** The mode lobby received the opponent's cosmetics: keep them for the next games. */
export function rememberLobbyOpponent(c: Partial<SharedCosmetics> | null): void {
  const v = clean(c);
  try {
    if (v) localStorage.setItem(LOBBY_OPP_KEY, JSON.stringify({ at: Date.now(), c: v }));
    else localStorage.removeItem(LOBBY_OPP_KEY);
  } catch {
    // storage full: the in-game side channel still works
  }
}

/** The opponent's cosmetics received in the last mode room (if recent). */
export function lobbyOpponent(): SharedCosmetics | null {
  try {
    const v = JSON.parse(localStorage.getItem(LOBBY_OPP_KEY) ?? "null") as { at?: number; c?: SharedCosmetics } | null;
    if (v && v.c && typeof v.at === "number" && Date.now() - v.at < LOBBY_OPP_MAX_AGE) return clean(v.c);
  } catch {
    // ignore
  }
  return null;
}

function cached(code: string): SharedCosmetics | null {
  try {
    return clean(JSON.parse(sessionStorage.getItem(`rf-opp-cos-${code}`) ?? "null"));
  } catch {
    return null;
  }
}

function cache(code: string, c: SharedCosmetics): void {
  try {
    sessionStorage.setItem(`rf-opp-cos-${code}`, JSON.stringify(c));
  } catch {
    // ignore
  }
}

/** Swap cosmetics for the P2P game with this room code (host = seat 0, guest = seat 1). */
export function useCosmeticsLink(role: "host" | "guest" | "ai" | null, code: string | null | undefined): void {
  useEffect(() => {
    if (role === "ai") {
      setOpponentCosmetics({ back: aiBackUrl(loadCosmetics().back), lands: {} });
      const onMine = () => setOpponentCosmetics({ back: aiBackUrl(loadCosmetics().back), lands: {} });
      window.addEventListener("rf-cosmetics-mine", onMine);
      return () => {
        window.removeEventListener("rf-cosmetics-mine", onMine);
        setOpponentCosmetics(null);
      };
    }
    if (!role || !code) {
      setOpponentCosmetics(null);
      return;
    }
    setOpponentCosmetics(cached(code) ?? lobbyOpponent());
    let sentOnce = false;
    const link = openChessLink({
      runId: `cos${code}`,
      channel: "x",
      me: role === "host" ? 0 : 1,
      createPeer: (id, config) => createPeer(id, { config }) as unknown as LinkPeer,
      iceConfig: () => fetchFreshTurnConfig(),
      onMessage: (m) => {
        const msg = m as { k?: string; c?: SharedCosmetics };
        const c = msg && msg.k === "cos" ? clean(msg.c) : null;
        if (!c) return;
        cache(code, c);
        rememberLobbyOpponent(c);
        setOpponentCosmetics(c);
      },
      onStatus: () => {},
    });
    const send = () => {
      link.send({ k: "cos", c: sharedCosmetics() });
      sentOnce = true;
    };
    send();
    // A later change (the player picks another back mid-game) is sent again.
    const onChange = () => {
      if (sentOnce) send();
    };
    window.addEventListener("rf-cosmetics-mine", onChange);
    return () => {
      window.removeEventListener("rf-cosmetics-mine", onChange);
      link.close();
      setOpponentCosmetics(null);
    };
  }, [role, code]);
}
