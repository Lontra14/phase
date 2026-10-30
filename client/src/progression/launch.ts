// Start a Progression Bo3: write the decks into the saved-deck library and open
// the stock phase.rs match (vs AI) or the P2P room (vs a friend), exactly like
// MatchLab does. The match is always Limited (40-card minimum, any number of
// copies, unlimited sideboard) and best of three; the rest of the collection is
// the sideboard.

import type { FormatConfig } from "../adapter/types";
import { ACTIVE_DECK_KEY, stampDeckMeta, writeSavedDeckData } from "../constants/storage";
import { savedDeckCatalogId } from "../services/deckCatalog";
import { expandParsedDeck, type DeckEntry, type ParsedDeck } from "../services/deckParser";
import { canAttemptNativeEngine } from "../services/nativeEngine";
import { withSavedDeckLibrary } from "../services/savedDeckTransaction";
import { attemptSavedDeckWrite } from "../services/savedDeckWriteFailure";
import { saveActiveGame, useGameStore } from "../stores/gameStore";
import { FORMAT_DEFAULTS, useMultiplayerStore, type HostingSettings } from "../stores/multiplayerStore";
import { usePreferencesStore } from "../stores/preferencesStore";
import type { SelectableAiDifficulty } from "../constants/ai";
import type { ProgData } from "./data";
import type { PlayerState, RunState } from "./run";
import { mainNames, sideboardNames } from "./run";

export const PROG_YOU_DECK = "Progression · You";
export const PROG_AI_DECK = "Progression · AI";

function entries(names: string[], data: ProgData | null, keys: Map<string, string>): DeckEntry[] {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => {
    const key = keys.get(name);
    const print = key && data ? data.byKey.get(key) : undefined;
    return print && print.set
      ? { name, count, sourcePrinting: { setCode: print.set.code, collectorNumber: print.cn } }
      : { name, count };
  });
}

export function deckOf(p: PlayerState, data: ProgData | null): ParsedDeck {
  const keys = new Map<string, string>();
  for (const o of p.pool ?? []) if (!keys.has(o.n)) keys.set(o.n, o.k);
  return { main: entries(mainNames(p), data, keys), sideboard: entries(sideboardNames(p), data, keys) };
}

export function deckSize(p: PlayerState): number {
  return mainNames(p).length;
}

async function saveDecks(decks: [string, ParsedDeck][]): Promise<void> {
  const saved = await attemptSavedDeckWrite("import", () =>
    withSavedDeckLibrary((txn) => {
      for (const [name, deck] of decks) {
        writeSavedDeckData(txn, name, JSON.stringify(deck));
        stampDeckMeta(txn, name);
      }
      return true;
    }),
  );
  if (!saved.ok) throw new Error("Could not save the decks in this browser (storage blocked?).");
}

function formatConfig(run: RunState): FormatConfig {
  const base = FORMAT_DEFAULTS.Limited;
  if (!base) throw new Error("Limited format is not available in this build.");
  return { ...base, max_players: 2, ...(run.startingLife ? { starting_life: run.startingLife } : {}) };
}

type Navigate = (to: string, opts?: { state?: unknown }) => void;

/** Vs AI. `gameId` is what the result watcher listens for (autosave it before calling). */
export async function launchAiMatch(run: RunState, data: ProgData, gameId: string, navigate: Navigate): Promise<void> {
  const me = run.players[run.me];
  const ai = run.players[(1 - run.me) as 0 | 1];
  await saveDecks([
    [PROG_YOU_DECK, deckOf(me, data)],
    [PROG_AI_DECK, deckOf(ai, data)],
  ]);
  localStorage.setItem(ACTIVE_DECK_KEY, PROG_YOU_DECK);
  const difficulty = run.difficulty as SelectableAiDifficulty;
  const prefs = usePreferencesStore.getState();
  prefs.ensureAiSeatCount(1);
  prefs.setAiSeatDifficulty(0, difficulty);
  prefs.setAiSeatDeckId(0, savedDeckCatalogId(PROG_AI_DECK));
  const aiSeats = [{ difficulty, deckId: savedDeckCatalogId(PROG_AI_DECK) }];
  const config = formatConfig(run);
  if (!canAttemptNativeEngine(prefs.nativeEngineEnabled)) {
    saveActiveGame({ id: gameId, mode: "ai", difficulty, aiSeats, formatConfig: config });
  }
  useGameStore.setState({ gameId });
  navigate(`/game/${gameId}?mode=ai&difficulty=${run.difficulty}&format=Limited&players=2&match=bo3`, {
    state: { formatConfig: config },
  });
}

/** Vs a friend, host side: opens a pure-P2P Bo3 room; the room code appears in the multiplayer store. */
export async function hostFriendMatch(run: RunState, data: ProgData): Promise<boolean> {
  const me = run.players[run.me];
  const deck = deckOf(me, data);
  await saveDecks([[PROG_YOU_DECK, deck]]);
  localStorage.setItem(ACTIVE_DECK_KEY, PROG_YOU_DECK);
  const mp = useMultiplayerStore.getState();
  const settings: HostingSettings = {
    displayName: me.name || mp.displayName || "Host",
    public: false,
    password: "",
    timerSeconds: null,
    formatConfig: formatConfig(run),
    matchType: "Bo3",
    loopDetection: { type: "Interactive" },
    aiSeats: [],
    startWhenFull: true,
    roomName: null,
    ranked: false,
  };
  return mp.startP2PHostingSession(settings, expandParsedDeck(deck), { brokerUrl: null });
}

/** Vs a friend, guest side. */
export async function joinFriendMatch(run: RunState, data: ProgData, code: string, gameId: string, navigate: Navigate): Promise<void> {
  await saveDecks([[PROG_YOU_DECK, deckOf(run.players[run.me], data)]]);
  localStorage.setItem(ACTIVE_DECK_KEY, PROG_YOU_DECK);
  useGameStore.setState({ gameId });
  navigate(`/game/${gameId}?mode=p2p-join&code=${code}`);
}
