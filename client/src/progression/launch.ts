// Start a Progression Bo3: write the decks into the saved-deck library and open
// the stock phase.rs match (vs AI) or the P2P room (vs a friend), exactly like
// MatchLab does. The match is always Limited (40-card minimum, any number of
// copies, unlimited sideboard) and best of three; the rest of the collection is
// the sideboard.

import type { FormatConfig, GameFormat } from "../adapter/types";
import { ACTIVE_DECK_KEY, stampDeckMeta, writeSavedDeckData } from "../constants/storage";
import { savedDeckCatalogId } from "../services/deckCatalog";
import { expandParsedDeck, type DeckEntry, type ParsedDeck } from "../services/deckParser";
import { canAttemptNativeEngine } from "../services/nativeEngine";
import { withSavedDeckLibrary } from "../services/savedDeckTransaction";
import { attemptSavedDeckWrite } from "../services/savedDeckWriteFailure";
import { saveActiveGame, useGameStore } from "../stores/gameStore";
import { FORMAT_DEFAULTS, useMultiplayerStore, type HostingSettings } from "../stores/multiplayerStore";
import { type CardArtOverride, usePreferencesStore } from "../stores/preferencesStore";
import { loadScryfallData, resolveOracleIdSync } from "../services/scryfall";
import type { SelectableAiDifficulty } from "../constants/ai";
import type { ProgData } from "./data";
import type { PlayerState, RunState } from "./run";
import { mainNames, sideboardNames } from "./run";
import { opponentCollection } from "./flow";
import { setP2PFirstPlayerHint } from "./firstPlayerHint";

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
  // Commander decks play without a sideboard (the rest of the collection stays out).
  const deck: ParsedDeck = { main: entries(mainNames(p), data, keys), sideboard: p.commander?.length ? [] : entries(sideboardNames(p), data, keys) };
  if (p.commander?.length) deck.commander = p.commander.slice();
  return deck;
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

type Navigate = (to: string, opts?: { state?: unknown }) => void;

function dashed(id: string): string {
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

/** The friend's collection as far as this device can rebuild it (for art only). */
async function opponentStandIn(run: RunState, data: ProgData): Promise<PlayerState> {
  const opp = run.players[(1 - run.me) as 0 | 1];
  if (opp.pool?.length) return opp;
  try {
    return { ...opp, pool: await opponentCollection(data, run), main: [] };
  } catch (err) {
    console.warn("[progression] could not rebuild the opponent's printings", err);
    return { ...opp, pool: [], main: [] };
  }
}

/**
 * Also pin each card's art to its printing through phase.rs's own art
 * overrides (keyed by oracle id) — a fallback for when the patch is missing.
 */
export async function pinPrintings(players: PlayerState[], data: ProgData): Promise<void> {
  try {
    if (!(await loadScryfallData())) return;
  } catch {
    return;
  }
  const pins: Record<string, CardArtOverride> = {};
  for (const p of players) {
    const pool = p.pool ?? [];
    const order = [...p.main, ...pool.map((_, i) => i).filter((i) => !p.main.includes(i))];
    for (const i of order) {
      const owned = pool[i];
      const print = owned ? data.byKey.get(owned.k) : undefined;
      if (!print) continue;
      const ref = print.set ? print : data.byName.get(print.card.name)?.[0];
      if (!ref?.set || ref.id.length !== 32) continue;
      const oracle = resolveOracleIdSync(owned.n) ?? resolveOracleIdSync(print.card.name);
      if (!oracle || pins[oracle]) continue;
      pins[oracle] = { scryfallId: dashed(ref.id), setCode: ref.set.code, collectorNumber: ref.cn };
    }
  }
  if (Object.keys(pins).length) {
    usePreferencesStore.setState((s) => ({ artOverrides: { ...s.artOverrides, ...pins } }));
  }
}

/**
 * In-game art: the list of (card name, Scryfall printing id) the Rogue Forge
 * patch (public/rogue-forge-patch.js) uses to swap phase.rs's default images
 * for the exact printings. First entry wins per card; the caller lists its own
 * main deck first, then the rest of its collection, then the opponent's.
 */
export const ART_PINS_KEY = "rogue-forge-pins";

export function writeArtPins(players: PlayerState[], data: ProgData): void {
  const out: [string, string][] = [];
  for (const p of players) {
    const pool = p.pool ?? [];
    const order = [...p.main, ...pool.map((_, i) => i).filter((i) => !p.main.includes(i))];
    for (const i of order) {
      const owned = pool[i];
      const print = owned ? data.byKey.get(owned.k) : undefined;
      if (owned && print && print.id.length === 32) out.push([owned.n, dashed(print.id)]);
    }
    // Starter: the precon's own basic lands (they live in the tray, not in the pool).
    for (const [name, id] of Object.entries(p.landArt ?? {})) if (id) out.push([name, id]);
  }
  try {
    localStorage.setItem(ART_PINS_KEY, JSON.stringify(out));
  } catch {
    // Storage full: the game falls back to phase.rs art overrides.
  }
}

/** One match of a mode (Progression Bo3, Starter Bo1). */
export interface MatchSpec {
  me: PlayerState;
  /** The opponent as far as this device knows it (AI: real; friend: rebuilt). */
  opp: PlayerState;
  difficulty: string;
  startingLife: number | null;
  matchType: "Bo1" | "Bo3";
  /** Vs AI: whether I play or draw first (omit = random). */
  first?: "play" | "draw" | null;
  /** Vs a friend, host side: player index that starts (0 = host; omit = random). */
  hostFirst?: number | null;
  youDeck?: string;
  aiDeck?: string;
  /** Rules of the game: Limited (default; any cards, any copies), a commander format (command zone, commander rules) or a multiplayer variant. */
  format?: "Limited" | "Commander" | "DuelCommander" | "Freeform" | "TwoHeadedGiant" | "Archenemy" | "Planechase";
  /** Test match tables: seats in all (2 when absent). */
  players?: number;
  /** Test match tables: the AI players (vs AI: every opponent; online: the seats no friend takes). */
  aiSeats?: TableSeat[];
}

export interface TableSeat {
  player: PlayerState;
  difficulty: string;
}

/**
 * The rules sent to the engine. No format legality anywhere (friendly games
 * with any cards): commander games use Freeform Commander (command zone,
 * commander damage, any card pool, no singleton or deck-size rule), the modes'
 * other games Freeform (no deck minimum). Progression (no format given) keeps
 * Limited for its best-of-three sideboard; its decks always have 40 cards.
 * (The engine refuses a built-in format with a changed deck-size rule, so the
 * formats are switched instead.)
 */
function engineFormat(f: MatchSpec["format"]): GameFormat {
  if (f === "Commander" || f === "DuelCommander") return "FreeformCommander";
  // Multiplayer variants (no card-pool legality; the engine fixes their deck minimum).
  if (f === "TwoHeadedGiant" || f === "Archenemy" || f === "Planechase") return f;
  return f === "Limited" || f === "Freeform" ? "Freeform" : "Limited";
}

/** The deck sent to the engine: Bo1 games in the free formats play without a sideboard. */
function engineDeck(spec: MatchSpec, p: PlayerState, data: ProgData): ParsedDeck {
  const deck = deckOf(p, data);
  if (engineFormat(spec.format) !== "Limited") deck.sideboard = [];
  return deck;
}

function matchConfig(spec: Pick<MatchSpec, "format" | "startingLife" | "players">): FormatConfig {
  const fmt = engineFormat(spec.format);
  const base = FORMAT_DEFAULTS[fmt] ?? FORMAT_DEFAULTS.Limited;
  if (!base) throw new Error(`${fmt} format is not available in this build.`);
  const life = spec.startingLife ?? (spec.format === "DuelCommander" ? 20 : null);
  return {
    ...base,
    max_players: Math.max(base.min_players, spec.players ?? 2),
    ...(life ? { starting_life: life } : {}),
  };
}

async function prepareArt(spec: MatchSpec, data: ProgData): Promise<void> {
  const all = [spec.me, spec.opp, ...(spec.aiSeats ?? []).map((a) => a.player)];
  writeArtPins(all, data);
  await pinPrintings(all, data);
}

/** The minimum deck size the engine requires in this game's format (multiplayer variants: 60). */
export function engineDeckMinimum(format: MatchSpec["format"]): number {
  const base = FORMAT_DEFAULTS[engineFormat(format)];
  const rule = base?.deck_size;
  return rule ? rule.data : 0;
}

/** Vs AI. `gameId` is what the result watcher listens for (autosave it before calling). */
export async function launchAiMatchSpec(spec: MatchSpec, data: ProgData, gameId: string, navigate: Navigate): Promise<void> {
  const youDeck = spec.youDeck ?? PROG_YOU_DECK;
  const aiDeck = spec.aiDeck ?? PROG_AI_DECK;
  // Every AI opponent (Test match tables: up to 3), each with its own saved deck.
  const ais: TableSeat[] = spec.aiSeats?.length ? spec.aiSeats : [{ player: spec.opp, difficulty: spec.difficulty }];
  const aiName = (i: number) => (i === 0 ? aiDeck : `${aiDeck} ${i + 1}`);
  await prepareArt(spec, data);
  await saveDecks([[youDeck, engineDeck(spec, spec.me, data)], ...ais.map((a, i): [string, ParsedDeck] => [aiName(i), engineDeck(spec, a.player, data)])]);
  localStorage.setItem(ACTIVE_DECK_KEY, youDeck);
  const difficulty = (ais[0]?.difficulty ?? spec.difficulty) as SelectableAiDifficulty;
  const prefs = usePreferencesStore.getState();
  prefs.ensureAiSeatCount(ais.length);
  ais.forEach((a, i) => {
    prefs.setAiSeatDifficulty(i, a.difficulty as SelectableAiDifficulty);
    prefs.setAiSeatDeckId(i, savedDeckCatalogId(aiName(i)));
  });
  const aiSeats = ais.map((a, i) => ({ difficulty: a.difficulty as SelectableAiDifficulty, deckId: savedDeckCatalogId(aiName(i)) }));
  const config = matchConfig({ ...spec, players: ais.length + 1 });
  if (!canAttemptNativeEngine(prefs.nativeEngineEnabled) || spec.first) {
    saveActiveGame({ id: gameId, mode: "ai", difficulty, aiSeats, formatConfig: config });
  }
  useGameStore.setState({ gameId });
  const firstParam = spec.first ? `&first=${spec.first}` : "";
  navigate(
    `/game/${gameId}?mode=ai&difficulty=${difficulty}&format=${engineFormat(spec.format)}&players=${ais.length + 1}&match=${spec.matchType.toLowerCase()}${firstParam}`,
    { state: { formatConfig: config } },
  );
}

/** Vs a friend, host side: opens a pure-P2P room; the room code appears in the multiplayer store. */
export async function hostFriendMatchSpec(spec: MatchSpec, data: ProgData): Promise<boolean> {
  const youDeck = spec.youDeck ?? PROG_YOU_DECK;
  const deck = engineDeck(spec, spec.me, data);
  await prepareArt(spec, data);
  await saveDecks([[youDeck, deck]]);
  localStorage.setItem(ACTIVE_DECK_KEY, youDeck);
  setP2PFirstPlayerHint(spec.hostFirst ?? null);
  const mp = useMultiplayerStore.getState();
  const settings: HostingSettings = {
    displayName: spec.me.name || mp.displayName || "Host",
    public: false,
    password: "",
    timerSeconds: null,
    formatConfig: matchConfig(spec),
    matchType: spec.matchType,
    loopDetection: { type: "Interactive" },
    // Test match tables: the seats no friend takes are played by the AI, after the friends' seats.
    aiSeats: (spec.aiSeats ?? []).map((a, i) => ({
      seatIndex: (spec.players ?? 2) - (spec.aiSeats?.length ?? 0) + i,
      difficulty: a.difficulty,
      deckName: null,
      deck: { type: "DeckList" as const, data: expandParsedDeck(engineDeck(spec, a.player, data)) },
    })),
    startWhenFull: true,
    roomName: null,
    ranked: false,
  };
  return mp.startP2PHostingSession(settings, expandParsedDeck(deck), { brokerUrl: null });
}

/** Vs a friend, guest side. */
export async function joinFriendMatchSpec(spec: MatchSpec, data: ProgData, code: string, gameId: string, navigate: Navigate): Promise<void> {
  const youDeck = spec.youDeck ?? PROG_YOU_DECK;
  await prepareArt(spec, data);
  await saveDecks([[youDeck, engineDeck(spec, spec.me, data)]]);
  localStorage.setItem(ACTIVE_DECK_KEY, youDeck);
  useGameStore.setState({ gameId });
  navigate(`/game/${gameId}?mode=p2p-join&code=${code}`);
}

// ── Progression (Bo3) ───────────────────────────────────────────────────────

async function progressionSpec(run: RunState, data: ProgData): Promise<MatchSpec> {
  return {
    me: run.players[run.me],
    opp: await opponentStandIn(run, data),
    difficulty: run.difficulty,
    startingLife: run.startingLife,
    matchType: "Bo3",
  };
}

export async function launchAiMatch(run: RunState, data: ProgData, gameId: string, navigate: Navigate): Promise<void> {
  await launchAiMatchSpec(await progressionSpec(run, data), data, gameId, navigate);
}

export async function hostFriendMatch(run: RunState, data: ProgData): Promise<boolean> {
  return hostFriendMatchSpec(await progressionSpec(run, data), data);
}

export async function joinFriendMatch(run: RunState, data: ProgData, code: string, gameId: string, navigate: Navigate): Promise<void> {
  await joinFriendMatchSpec(await progressionSpec(run, data), data, code, gameId, navigate);
}
