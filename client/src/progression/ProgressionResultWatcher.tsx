// Mounted once at app level. When a Progression (Bo3) or Starter (Bo1) match
// finishes, it stores the final score in that mode's autosaved run so the mode
// page can pay out rewards when the player comes back.

import { useEffect } from "react";

import { useGameStore } from "../stores/gameStore";
import { useMultiplayerStore } from "../stores/multiplayerStore";
import { BACK_PRESETS, loadCosmetics, type SharedCosmetics } from "./cosmetics";
import { TABLE_COS_KEY, TABLE_NAMES_KEY } from "./launch";
import { CHESS_RUN_KEY, STARTER_AUTOSAVE_KEY } from "./run";

const RUN_KEYS = ["phase-progression-run", STARTER_AUTOSAVE_KEY, CHESS_RUN_KEY];

interface PendingRun {
  mode?: string;
  phase?: string;
  pendingGameId?: string | null;
  pendingResult?: unknown;
}

export function ProgressionResultWatcher(): null {
  useEffect(() => {
    const check = () => {
      const { gameState, waitingFor, gameId } = useGameStore.getState();
      if (!gameState || waitingFor?.type !== "GameOver") return;
      if (gameState.match_phase && gameState.match_phase !== "Completed") return;
      for (const key of RUN_KEYS) {
        let run: PendingRun | null = null;
        try {
          run = JSON.parse(localStorage.getItem(key) ?? "null") as PendingRun | null;
        } catch {
          run = null;
        }
        if (!run || run.phase !== "match" || !run.pendingGameId || run.pendingResult) continue;
        if (run.pendingGameId !== "*" && run.pendingGameId !== gameId) continue;
        const score = gameState.match_score;
        const myId = run.mode === "ai" ? 0 : (useMultiplayerStore.getState().activePlayerId ?? 0);
        let myWins: number;
        let oppWins: number;
        // The winner's seat (engine player id): tables of 3-4 seat every player as in the run.
        const winnerId = (waitingFor.data as { winner?: number | null }).winner ?? null;
        if (score && score.p0_wins + score.p1_wins > 0) {
          myWins = myId === 0 ? score.p0_wins : score.p1_wins;
          oppWins = myId === 0 ? score.p1_wins : score.p0_wins;
        } else {
          const winner = waitingFor.data.winner;
          if (winner == null) continue;
          myWins = winner === myId ? 1 : 0;
          oppWins = winner === myId ? 0 : 1;
        }
        if (myWins === oppWins) continue;
        try {
          localStorage.setItem(key, JSON.stringify({ ...run, pendingResult: { myWins, oppWins, ...(winnerId != null ? { winner: winnerId } : {}) } }));
        } catch {
          // ignore
        }
      }
    };
    check();
    return useGameStore.subscribe(check);
  }, []);

  // The players' names of the mode (run, table) instead of phase.rs's random ones.
  useEffect(() => {
    const apply = () => {
      const { gameState, gameId } = useGameStore.getState();
      if (!gameState) return;
      type StoredNames = { names?: string[]; gameId?: string | null; at?: number };
      let stored: StoredNames | null;
      try {
        stored = JSON.parse(localStorage.getItem(TABLE_NAMES_KEY) ?? "null") as StoredNames | null;
      } catch {
        stored = null;
      }
      if (!stored?.names?.length || Date.now() - (stored.at ?? 0) > 12 * 3600 * 1000) return;
      if (stored.gameId && stored.gameId !== "*" && stored.gameId !== gameId) return;
      const current = useMultiplayerStore.getState().playerNames as Map<number, string> | undefined;
      const next = new Map(current ?? []);
      let changed = false;
      stored.names.forEach((name: string, seat: number) => {
        if (name && next.get(seat) !== name) {
          next.set(seat, name);
          changed = true;
        }
      });
      if (changed) useMultiplayerStore.setState({ playerNames: next });
    };
    // Each opponent's own card back and lands (tables of 3-4): by player name, from
    // the room; the AIs each get a different preset. Read by rogue-forge-patch.js.
    let lastSeats = "";
    const applyCos = () => {
      const { gameState } = useGameStore.getState();
      if (!gameState) return;
      const names = useMultiplayerStore.getState().playerNames as Map<number, string> | undefined;
      if (!names?.size) return;
      type StoredCos = { cos?: Record<string, SharedCosmetics | undefined>; at?: number };
      let stored: StoredCos | null;
      try {
        stored = JSON.parse(localStorage.getItem(TABLE_COS_KEY) ?? "null") as StoredCos | null;
      } catch {
        stored = null;
      }
      if (stored && Date.now() - (stored.at ?? 0) > 12 * 3600 * 1000) stored = null;
      const vsAi = useGameStore.getState().gameMode === "ai" || useGameStore.getState().gameMode === "native-ai";
      // Online games without the room's list (Chess, two players) keep the direct swap (window.__rfOpp).
      if (!stored && !vsAi) {
        if (lastSeats) {
          lastSeats = "";
          delete (window as unknown as { __rfOppSeats?: unknown }).__rfOppSeats;
          window.dispatchEvent(new CustomEvent("rf-cosmetics"));
        }
        return;
      }
      const mine = loadCosmetics().back.id;
      const presets = BACK_PRESETS.filter((p) => p.id !== "classic" && p.id !== mine);
      const seats: Record<string, SharedCosmetics> = {};
      let k = 0;
      for (const [seat, name] of [...names.entries()].sort((a, b) => a[0] - b[0])) {
        const c = stored?.cos?.[name];
        seats[String(seat)] = c ?? { back: presets[k++ % presets.length]?.url ?? null, lands: {} };
      }
      const sig = JSON.stringify(seats);
      if (sig === lastSeats) return;
      lastSeats = sig;
      (window as unknown as { __rfOppSeats?: Record<string, SharedCosmetics> }).__rfOppSeats = seats;
      window.dispatchEvent(new CustomEvent("rf-cosmetics"));
    };
    const both = () => {
      apply();
      applyCos();
    };
    both();
    const a = useGameStore.subscribe(both);
    const b = useMultiplayerStore.subscribe(both);
    return () => {
      a();
      b();
    };
  }, []);
  return null;
}
