// Mounted once at app level. When a Progression (Bo3) or Starter (Bo1) match
// finishes, it stores the final score in that mode's autosaved run so the mode
// page can pay out rewards when the player comes back.

import { useEffect } from "react";

import { useGameStore } from "../stores/gameStore";
import { useMultiplayerStore } from "../stores/multiplayerStore";
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
          localStorage.setItem(key, JSON.stringify({ ...run, pendingResult: { myWins, oppWins } }));
        } catch {
          // ignore
        }
      }
    };
    check();
    return useGameStore.subscribe(check);
  }, []);
  return null;
}
