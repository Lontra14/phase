// MatchLab — Rogue Forge test bench.
//
// One screen, two decks, one button: paste your list and the opponent's list
// (or pick a test deck for either side), choose the AI and the rules, start.
// Everything after Start is the stock phase.rs vs-AI game: this page only
// writes the two decks into the saved-deck library (fixed names, overwritten
// each time), pins AI seat 0 to the opponent deck and navigates exactly like
// GameSetupPage.handleStartAI.
//
// "Vs a friend" reuses phase.rs's own peer-to-peer play (PeerJS, no server):
// the host gets a 5-character room code, the friend opens MatchLab, pastes
// their own deck and joins with that code. Hosting goes through the same
// pre-game lobby as phase.rs's Multiplayer page (startP2PHostingSession, no
// lobby broker): the room waits here, starts by itself once the friend is
// seated, and the global useHostingSession hook then opens the match.
//
// Deep link (used by the Rogue Forge roguelike to hand a battle over):
//   /#you=<b64url decklist>&opp=<b64url decklist>&life=20&ai=Medium&format=Freeform&first=play&auto=1
// Any key may be omitted; `auto=1` starts the match as soon as the card DB is ready.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import type { FormatConfig, GameFormat } from "../adapter/types";
import { getSharedAdapter } from "../adapter/wasm-adapter";
import { parseRoomCode } from "../network/connection";
import { ScreenChrome } from "../components/chrome/ScreenChrome";
import { menuButtonClass } from "../components/menu/buttonStyles";
import { MenuParticles } from "../components/menu/MenuParticles";
import { MenuPanel, MenuShell } from "../components/menu/MenuShell";
import { AI_DIFFICULTIES, type SelectableAiDifficulty } from "../constants/ai";
import { ACTIVE_DECK_KEY, stampDeckMeta, writeSavedDeckData } from "../constants/storage";
import { canonicalizeDeckNames, deckCardNames } from "../services/canonicalCardNames";
import { savedDeckCatalogId } from "../services/deckCatalog";
import { detectAndParseDeck, expandParsedDeck, parsedDeckHasCards, totalCards, type ParsedDeck } from "../services/deckParser";
import { canAttemptNativeEngine } from "../services/nativeEngine";
import { withSavedDeckLibrary } from "../services/savedDeckTransaction";
import { attemptSavedDeckWrite } from "../services/savedDeckWriteFailure";
import { useCardDataStore } from "../stores/cardDataStore";
import { saveActiveGame, useGameStore } from "../stores/gameStore";
import { FORMAT_DEFAULTS, useMultiplayerStore, type HostingSettings } from "../stores/multiplayerStore";
import { usePreferencesStore } from "../stores/preferencesStore";

const YOU_DECK = "MatchLab · You";
const OPP_DECK = "MatchLab · Opponent";
const DRAFT_KEY = "phase-matchlab-draft";
const CUSTOM = "__custom__";

/** Permissive formats first: roguelike pools are rarely constructed-legal. */
const LAB_FORMATS: GameFormat[] = ["Freeform", "Limited", "Standard", "Pioneer", "Modern", "Legacy", "Pauper"];
const FIRST_OPTIONS = [
  { id: "random", label: "Random" },
  { id: "play", label: "You play first" },
  { id: "draw", label: "You draw first" },
] as const;
type FirstPlayer = (typeof FIRST_OPTIONS)[number]["id"];

/** Test-deck sources shipped with phase.rs under /public/feeds. */
const TEST_FEEDS = [
  { url: "/feeds/starter-decks.json", group: "Starter", limit: 99 },
  { url: "/feeds/mtggoldfish-pauper.json", group: "Pauper meta", limit: 6 },
  { url: "/feeds/mtggoldfish-standard.json", group: "Standard meta", limit: 6 },
];

interface TestDeck {
  id: string;
  group: string;
  name: string;
  text: string;
}

interface SideState {
  pick: string;
  text: string;
}

interface SideCheck {
  cards: number;
  unknown: string[];
  deck: ParsedDeck | null;
}

interface LabDraft {
  you: SideState;
  opp: SideState;
  format: GameFormat;
  difficulty: SelectableAiDifficulty;
  life: number | null;
  first: FirstPlayer;
  mode: "ai" | "friend";
}

function entriesToText(main: { count: number; name: string }[], side: { count: number; name: string }[] = []): string {
  const lines = main.map((e) => `${e.count} ${e.name}`);
  if (side.length) lines.push("", "Sideboard", ...side.map((e) => `${e.count} ${e.name}`));
  return lines.join("\n");
}

async function loadTestDecks(): Promise<TestDeck[]> {
  const out: TestDeck[] = [];
  for (const feed of TEST_FEEDS) {
    try {
      const res = await fetch(feed.url);
      if (!res.ok) continue;
      const json = (await res.json()) as { decks?: { name: string; main?: { count: number; name: string }[]; sideboard?: { count: number; name: string }[] }[] };
      for (const d of (json.decks ?? []).slice(0, feed.limit)) {
        if (!d.main?.length) continue;
        out.push({ id: `${feed.group}:${d.name}`, group: feed.group, name: d.name, text: entriesToText(d.main, d.sideboard ?? []) });
      }
    } catch {
      // A missing feed just shortens the list.
    }
  }
  return out;
}

/** base64url (UTF-8) <-> text, for the #you= / #opp= deep link. */
function decodeB64Url(value: string): string {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function readHash(): Partial<LabDraft> & { auto?: boolean } {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return {};
  const p = new URLSearchParams(hash);
  const out: Partial<LabDraft> & { auto?: boolean } = {};
  try {
    const you = p.get("you");
    const opp = p.get("opp");
    if (you) out.you = { pick: CUSTOM, text: decodeB64Url(you) };
    if (opp) out.opp = { pick: CUSTOM, text: decodeB64Url(opp) };
  } catch {
    // Malformed link: fall back to the saved draft.
  }
  const life = Number(p.get("life"));
  if (Number.isFinite(life) && life > 0) out.life = Math.round(life);
  const ai = p.get("ai");
  if (ai && AI_DIFFICULTIES.some((d) => d.id === ai)) out.difficulty = ai as SelectableAiDifficulty;
  const format = p.get("format");
  if (format && (LAB_FORMATS as string[]).includes(format)) out.format = format as GameFormat;
  const first = p.get("first");
  if (first && FIRST_OPTIONS.some((f) => f.id === first)) out.first = first as FirstPlayer;
  out.auto = p.get("auto") === "1";
  return out;
}

function loadDraft(): LabDraft {
  const base: LabDraft = {
    you: { pick: CUSTOM, text: "" },
    opp: { pick: CUSTOM, text: "" },
    format: "Freeform",
    difficulty: "Medium",
    life: null,
    first: "random",
    mode: "ai",
  };
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) Object.assign(base, JSON.parse(raw) as Partial<LabDraft>);
  } catch {
    // Corrupt draft: start clean.
  }
  return base;
}

async function checkSide(text: string): Promise<SideCheck> {
  if (!text.trim()) return { cards: 0, unknown: [], deck: null };
  const parsed = detectAndParseDeck(text);
  if (!parsedDeckHasCards(parsed)) return { cards: 0, unknown: [], deck: null };
  const deck = await canonicalizeDeckNames(parsed);
  const names = [...new Set(deckCardNames(deck))];
  const answers = await getSharedAdapter().canonicalCardNames(names);
  const unknown = names.filter((_, i) => answers[i] == null);
  return { cards: totalCards(deck.main), unknown, deck };
}

export function MatchLabPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const cardStatus = useCardDataStore((s) => s.status);
  // Read the deep link once; it wins over the saved draft.
  const [fromHash] = useState(readHash);
  const [draft, setDraft] = useState<LabDraft>(() => {
    const d = loadDraft();
    const h = fromHash;
    return {
      you: h.you ?? d.you,
      opp: h.opp ?? d.opp,
      format: h.format ?? d.format,
      difficulty: h.difficulty ?? d.difficulty,
      life: h.life ?? d.life,
      first: h.first ?? d.first,
      mode: h.opp ? "ai" : d.mode,
    };
  });
  const [testDecks, setTestDecks] = useState<TestDeck[]>([]);
  const [checks, setChecks] = useState<{ you: SideCheck | null; opp: SideCheck | null }>({ you: null, opp: null });
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  // The match screen sends players back here (as /setup or /multiplayer) with the reason.
  const [error, setError] = useState<string | null>(() => {
    const st = location.state as { setupError?: string; deckRejected?: boolean; reason?: string } | null;
    if (st?.setupError) return st.setupError;
    if (st?.deckRejected) return `Your deck was rejected by the host${st.reason ? `: ${st.reason}` : "."}`;
    return null;
  });
  const autoStarted = useRef(false);
  const hostingStatus = useMultiplayerStore((s) => s.hostingStatus);
  const hostGameCode = useMultiplayerStore((s) => s.hostGameCode);
  const playerSlots = useMultiplayerStore((s) => s.playerSlots);
  const hosting = hostingStatus !== "idle";

  useEffect(() => {
    // Deep links land here directly, so warm the card DB like every deck page does.
    void useCardDataStore.getState().warm();
    void loadTestDecks().then(setTestDecks);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Storage full/blocked: the draft is a convenience only.
    }
  }, [draft]);

  const groups = useMemo(() => {
    const map = new Map<string, TestDeck[]>();
    for (const d of testDecks) map.set(d.group, [...(map.get(d.group) ?? []), d]);
    return [...map.entries()];
  }, [testDecks]);

  const setSide = (side: "you" | "opp", next: Partial<SideState>) => {
    setDraft((d) => ({ ...d, [side]: { ...d[side], ...next } }));
    setChecks((c) => ({ ...c, [side]: null }));
    setError(null);
  };

  const pickTestDeck = (side: "you" | "opp", id: string) => {
    if (id === CUSTOM) return setSide(side, { pick: CUSTOM });
    const deck = testDecks.find((d) => d.id === id);
    if (deck) setSide(side, { pick: id, text: deck.text });
  };

  const validate = useCallback(async () => {
    const [you, opp] = await Promise.all([checkSide(draft.you.text), checkSide(draft.opp.text)]);
    setChecks({ you, opp });
    return { you, opp };
  }, [draft.you.text, draft.opp.text]);

  const start = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { you, opp } = await validate();
      if (!you.deck || !opp.deck) {
        setError("Both decks need at least one card.");
        return;
      }
      if (you.unknown.length || opp.unknown.length) {
        setError("Some card names are not recognised — fix or remove them (listed under each deck).");
        return;
      }
      const saved = await attemptSavedDeckWrite("import", () =>
        withSavedDeckLibrary((txn) => {
          writeSavedDeckData(txn, YOU_DECK, JSON.stringify(you.deck));
          stampDeckMeta(txn, YOU_DECK);
          writeSavedDeckData(txn, OPP_DECK, JSON.stringify(opp.deck));
          stampDeckMeta(txn, OPP_DECK);
          return true;
        }),
      );
      if (!saved.ok) {
        setError("Could not save the decks in this browser (storage blocked?).");
        return;
      }
      localStorage.setItem(ACTIVE_DECK_KEY, YOU_DECK);

      const base = FORMAT_DEFAULTS[draft.format];
      if (!base) {
        setError(`Format ${draft.format} is not available in this build.`);
        return;
      }
      const formatConfig: FormatConfig = draft.life ? { ...base, starting_life: draft.life } : base;

      const prefs = usePreferencesStore.getState();
      prefs.ensureAiSeatCount(1);
      prefs.setAiSeatDifficulty(0, draft.difficulty);
      prefs.setAiSeatDeckId(0, savedDeckCatalogId(OPP_DECK));
      const aiSeats = [{ difficulty: draft.difficulty, deckId: savedDeckCatalogId(OPP_DECK) }];

      const gameId = crypto.randomUUID();
      // Same resume-pointer rule as GameSetupPage.handleStartAI.
      if (!canAttemptNativeEngine(prefs.nativeEngineEnabled) || draft.first !== "random") {
        saveActiveGame({ id: gameId, mode: "ai", difficulty: draft.difficulty, aiSeats, formatConfig });
      }
      useGameStore.setState({ gameId });
      const firstParam = draft.first !== "random" ? `&first=${draft.first}` : "";
      navigate(
        `/game/${gameId}?mode=ai&difficulty=${draft.difficulty}&format=${draft.format}&players=2&match=bo1${firstParam}`,
        { state: { formatConfig } },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [busy, draft, navigate, validate]);

  /** Friend mode: only your deck is needed — it becomes the active deck for the P2P game. */
  const startFriend = useCallback(
    async (role: "host" | "join") => {
      if (busy) return;
      setError(null);
      const code = role === "join" ? parseRoomCode(joinCode) : null;
      if (role === "join" && !code) {
        setError("Enter the 5-character room code your friend sees on their screen.");
        return;
      }
      setBusy(true);
      try {
        const you = await checkSide(draft.you.text);
        setChecks((c) => ({ ...c, you }));
        if (!you.deck) {
          setError("Paste your deck (or pick a test deck) first.");
          return;
        }
        if (you.unknown.length) {
          setError("Some card names are not recognised — fix or remove them (listed under your deck).");
          return;
        }
        const saved = await attemptSavedDeckWrite("import", () =>
          withSavedDeckLibrary((txn) => {
            writeSavedDeckData(txn, YOU_DECK, JSON.stringify(you.deck));
            stampDeckMeta(txn, YOU_DECK);
            return true;
          }),
        );
        if (!saved.ok) {
          setError("Could not save your deck in this browser (storage blocked?).");
          return;
        }
        localStorage.setItem(ACTIVE_DECK_KEY, YOU_DECK);
        if (role === "join") {
          const gameId = crypto.randomUUID();
          useGameStore.setState({ gameId });
          // Same route as MultiplayerPage.navigateDirectP2PJoin: the host's room sets the rules.
          navigate(`/game/${gameId}?mode=p2p-join&code=${code}`);
          return;
        }
        const base = FORMAT_DEFAULTS[draft.format];
        if (!base) {
          setError(`Format ${draft.format} is not available in this build.`);
          return;
        }
        const formatConfig: FormatConfig = {
          ...base,
          max_players: 2,
          ...(draft.life ? { starting_life: draft.life } : {}),
        };
        const mp = useMultiplayerStore.getState();
        const settings: HostingSettings = {
          displayName: mp.displayName || "Host",
          public: false,
          password: "",
          timerSeconds: null,
          formatConfig,
          matchType: "Bo1",
          loopDetection: { type: "Interactive" },
          aiSeats: [],
          startWhenFull: true,
          roomName: null,
          ranked: false,
        };
        // Pure PeerJS room shared by code (brokerUrl null = never listed on the
        // phase.rs lobby servers). The room code shows on this page; the match
        // opens by itself when the friend joins.
        const ok = await mp.startP2PHostingSession(settings, expandParsedDeck(you.deck), { brokerUrl: null });
        if (!ok && useMultiplayerStore.getState().hostingStatus === "idle") {
          setError("Could not open the room. Check your connection and try again.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [busy, draft, joinCode, navigate],
  );

  // Deep link with auto=1: start once the card database is warm.
  useEffect(() => {
    if (!fromHash.auto || autoStarted.current || cardStatus !== "ready" || draft.mode !== "ai") return;
    if (!draft.you.text.trim() || !draft.opp.text.trim()) return;
    autoStarted.current = true;
    void start();
  }, [cardStatus, draft.mode, draft.you.text, draft.opp.text, fromHash.auto, start]);

  const swap = () => {
    setDraft((d) => ({ ...d, you: d.opp, opp: d.you }));
    setChecks((c) => ({ you: c.opp, opp: c.you }));
  };

  const cardDataLoading = cardStatus === "loading";
  const canStart = !busy && !cardDataLoading && Boolean(draft.you.text.trim()) && Boolean(draft.opp.text.trim());

  const sidePanel = (side: "you" | "opp", title: string, subtitle: string) => {
    const state = draft[side];
    const check = checks[side];
    return (
      <MenuPanel className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-amber-200/80">{subtitle}</div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
        </div>
        <label className="flex flex-col gap-1 text-sm text-white/70">
          Test deck
          <select
            className="rounded-[8px] border border-white/12 bg-slate-950/80 px-3 py-2 text-white"
            value={state.pick}
            onChange={(e) => pickTestDeck(side, e.target.value)}
          >
            <option value={CUSTOM}>Custom — paste a list</option>
            {groups.map(([group, decks]) => (
              <optgroup key={group} label={group}>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <textarea
          className="min-h-[260px] flex-1 resize-y rounded-[8px] border border-white/12 bg-slate-950/70 p-3 font-mono text-[13px] leading-5 text-white/90"
          spellCheck={false}
          placeholder={"4 Lightning Bolt\n4 Goblin Guide\n16 Mountain\n\nSideboard\n2 Smash to Smithereens"}
          value={state.text}
          onChange={(e) => setSide(side, { text: e.target.value, pick: CUSTOM })}
        />
        <div className="min-h-[1.5rem] text-sm">
          {check && check.deck && (
            <span className={check.unknown.length ? "text-red-300" : "text-emerald-300"}>
              {check.cards} cards in main deck{check.unknown.length ? ` · ${check.unknown.length} unknown` : " · all cards recognised"}
            </span>
          )}
          {check && !check.deck && <span className="text-red-300">No cards found.</span>}
          {check && check.unknown.length > 0 && (
            <div className="mt-1 text-xs text-red-200/90">Unknown: {check.unknown.join(", ")}</div>
          )}
        </div>
      </MenuPanel>
    );
  };

  const field = "rounded-[8px] border border-white/12 bg-slate-950/80 px-3 py-2 text-white";

  return (
    <div className="menu-scene relative flex min-h-screen flex-col overflow-hidden">
      <MenuParticles />
      <ScreenChrome />
      <div className="menu-scene__vignette" />
      <div className="menu-scene__haze" />

      <MenuShell
        title="Test a match"
        layout="stacked"
      >
        <div className="flex flex-col gap-4">
          <div className="flex gap-2" role="tablist" aria-label="Opponent">
            {(["ai", "friend"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={draft.mode === m}
                className={menuButtonClass({ tone: draft.mode === m ? "amber" : "neutral", size: "md" })}
                onClick={() => {
                  setDraft((d) => ({ ...d, mode: m }));
                  setError(null);
                }}
              >
                {m === "ai" ? "Vs AI" : "Vs a friend (online)"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4 lg:flex-row">
            {sidePanel("you", "Your deck", "Player")}
            {draft.mode === "ai" ? (
              sidePanel("opp", "Opponent deck", "AI")
            ) : (
              <MenuPanel className="flex min-w-0 flex-1 flex-col gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-amber-200/80">Online · peer to peer</div>
                  <h2 className="text-xl font-semibold text-white">Play a friend</h2>
                  <p className="mt-1 text-sm text-white/65">
                    Each player opens this page and pastes their own deck. One hosts and reads out the room code, the other joins with it.
                    Keep the page in the foreground while you wait.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-semibold text-white/85">1 · Host</div>
                  {hosting ? (
                    <div className="flex flex-col gap-3 rounded-[10px] border border-emerald-400/30 bg-emerald-950/30 p-4">
                      {hostingStatus === "connecting" || !hostGameCode ? (
                        <div className="text-sm text-white/75">Opening the room…</div>
                      ) : (
                        <>
                          <div className="text-xs uppercase tracking-[0.18em] text-emerald-200/80">Room code</div>
                          <button
                            type="button"
                            title="Copy"
                            className="self-start font-mono text-4xl font-bold tracking-[0.35em] text-emerald-300"
                            onClick={() => void navigator.clipboard?.writeText(hostGameCode).catch(() => {})}
                          >
                            {hostGameCode}
                          </button>
                          <div className="text-sm text-white/75">
                            Waiting for your friend… ({playerSlots.filter((p) => p.kind.type !== "WaitingHuman").length || 1}/2)
                            <br />
                            <span className="text-xs text-white/55">The match starts by itself as soon as they join. Keep this page open.</span>
                          </div>
                        </>
                      )}
                      <button
                        type="button"
                        className={menuButtonClass({ tone: "neutral", size: "md" })}
                        onClick={() => useMultiplayerStore.getState().cancelHosting()}
                      >
                        Cancel room
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-white/55">Uses the format and starting life below.</p>
                      <button
                        type="button"
                        className={menuButtonClass({ tone: "amber", size: "lg", disabled: busy || cardDataLoading })}
                        disabled={busy || cardDataLoading}
                        onClick={() => void startFriend("host")}
                      >
                        {cardDataLoading ? "Loading cards…" : "Create room ▸"}
                      </button>
                    </>
                  )}
                </div>
                {!hosting && (
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-semibold text-white/85">2 · Join</div>
                  <div className="flex gap-2">
                    <input
                      className={`${field} w-36 font-mono uppercase tracking-[0.3em]`}
                      maxLength={5}
                      placeholder="CODE"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void startFriend("join");
                      }}
                    />
                    <button
                      type="button"
                      className={menuButtonClass({ tone: "blue", size: "md", disabled: busy || cardDataLoading })}
                      disabled={busy || cardDataLoading}
                      onClick={() => void startFriend("join")}
                    >
                      Join room
                    </button>
                  </div>
                </div>
                )}
              </MenuPanel>
            )}
          </div>

          <MenuPanel className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm text-white/70">
              Format
              <select className={field} value={draft.format} onChange={(e) => setDraft((d) => ({ ...d, format: e.target.value as GameFormat }))}>
                {LAB_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            {draft.mode === "ai" && (
            <label className="flex flex-col gap-1 text-sm text-white/70">
              AI difficulty
              <select
                className={field}
                value={draft.difficulty}
                onChange={(e) => setDraft((d) => ({ ...d, difficulty: e.target.value as SelectableAiDifficulty }))}
              >
                {AI_DIFFICULTIES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id.replace(/([a-z])([A-Z])/g, "$1 $2")}
                  </option>
                ))}
              </select>
            </label>
            )}
            <label className="flex flex-col gap-1 text-sm text-white/70">
              Starting life
              <input
                className={`${field} w-28`}
                type="number"
                min={1}
                max={999}
                placeholder="default"
                value={draft.life ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, life: e.target.value ? Math.max(1, Number(e.target.value)) : null }))}
              />
            </label>
            {draft.mode === "ai" && (
            <label className="flex flex-col gap-1 text-sm text-white/70">
              Who starts
              <select className={field} value={draft.first} onChange={(e) => setDraft((d) => ({ ...d, first: e.target.value as FirstPlayer }))}>
                {FIRST_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            )}

            {draft.mode === "ai" && (
            <div className="ml-auto flex flex-wrap gap-2">
              <button type="button" className={menuButtonClass({ tone: "neutral", size: "md" })} onClick={swap}>
                ⇄ Swap decks
              </button>
              <button
                type="button"
                className={menuButtonClass({ tone: "slate", size: "md", disabled: busy || cardDataLoading })}
                disabled={busy || cardDataLoading}
                onClick={() => {
                  validate().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
                }}
              >
                Check lists
              </button>
              <button
                type="button"
                className={menuButtonClass({ tone: "amber", size: "lg", disabled: !canStart })}
                disabled={!canStart}
                onClick={() => void start()}
              >
                {busy ? "Starting…" : cardDataLoading ? "Loading cards…" : "Start match ▸"}
              </button>
            </div>
            )}
          </MenuPanel>

          {error && <div className="rounded-[8px] border border-red-400/30 bg-red-950/50 px-4 py-3 text-sm text-red-100">{error}</div>}
        </div>
      </MenuShell>
    </div>
  );
}

