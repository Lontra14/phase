// Mounted once at app level. When a Progression (Bo3) or Starter (Bo1) match
// finishes, it stores the final score in that mode's autosaved run so the mode
// page can pay out rewards when the player comes back.

import { useEffect } from "react";

import { useGameStore } from "../stores/gameStore";
import { useMultiplayerStore } from "../stores/multiplayerStore";
import { TABLE_NAMES_KEY } from "./launch";
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
    apply();
    const a = useGameStore.subscribe(apply);
    const b = useMultiplayerStore.subscribe(apply);
    return () => {
      a();
      b();
    };
  }, []);
  return null;
}
