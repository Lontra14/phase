// Chess — Rogue Forge mode.
//
// Both players pick a deck: a Starter precon or a meta deck. Choose how many
// games and how many boosters per game. Before each game every player opens
// the boosters one at a time and plays a Chess minigame for each (the cards won
// and the cards left on the board join the collections), then deck building and
// a single game. The winner moves first in the next minigames, the loser plays
// first in the next game. Vs a friend the minigame runs in lockstep on both
// devices (only the inputs travel, peer to peer).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";

import { AI_DIFFICULTIES } from "../constants/ai";
import { fetchFreshTurnConfig, parseRoomCode } from "../network/connection";
import { createPeer } from "../network/transport";
import { useCardDataStore } from "../stores/cardDataStore";
import { useMultiplayerStore } from "../stores/multiplayerStore";
import { ForgeDeckBuilder } from "../progression/ForgeDeckBuilder";
import type { ProgData } from "../progression/data";
import { loadProgressionData, printImage } from "../progression/data";
import type { MatchSpec } from "../progression/launch";
import { deckSize, hostFriendMatchSpec, joinFriendMatchSpec, launchAiMatchSpec } from "../progression/launch";
import { makeRng } from "../progression/rng";
import type { Basics, PlayerState, Slot } from "../progression/run";
import { exportList } from "../progression/run";
import type { LinkPeer, LinkStatus } from "../progression/starterLink";
import type { StarterDeck } from "../progression/starterData";
import { loadStarterDecks } from "../progression/starterData";
import type { BoosterPlan, ChessRun, ChessSettings } from "../chess/chess";
import { PLAN_LABEL, applyChessResult, applyMinigame, autosaveChess, chessFormat, chessSetFor, createChess, decodeChess, encodeChess, forMatch, loadChessAutosave } from "../chess/chess";
import type { MetaDeck } from "../chess/chessData";
import { META_FORMATS, chessSets, enrichChessCards, loadMetaDecks, openChessBooster, prepareSets } from "../chess/chessData";
import { openChessLink } from "../chess/chessLink";
import type { ChessNet } from "../chess/minigame";
import { mountChess } from "../chess/minigame";
import "../progression/progression.css";
import { CardBackButton } from "../progression/CardBackPicker";
import { aiBackUrl, backUrlOf, loadCosmetics } from "../progression/cosmetics";
import { lobbyOpponent } from "../progression/cosmeticsLink";
import type { RoomMe, RoomState } from "../progression/room";
import { RoomPanel, RoomToasts, useAutoMatchRoom, useRoom } from "../progression/room";
import { DeckImportPanel, importReady } from "../progression/DeckImportPanel";
import type { ImportedDeck } from "../progression/deckImport";
import { importedDeck, isCommanderDeck } from "../progression/deckImport";

const SETTINGS_KEY = "phase-chess-settings";
const YOU_DECK = "Chess · You";
const AI_DECK = "Chess · AI";
const PIP: Record<string, string> = { W: "#f4ecd4", U: "#4a90d9", B: "#a487c4", R: "#d6503e", G: "#4fb277", C: "#b9b2a6" };
type AnyDeck = StarterDeck | MetaDeck;
const isMeta = (d: AnyDeck): d is MetaDeck => "format" in d;

function Centered({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8rem", padding: "3rem 1rem" }}>{children}</div>;
}

export function ChessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<ProgData | null>(null);
  const [starters, setStarters] = useState<StarterDeck[] | null>(null);
  const [metas, setMetas] = useState<MetaDeck[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [run, setRunState] = useState<ChessRun | null>(() => loadChessAutosave());
  const [error, setError] = useState<string | null>(() => {
    const st = location.state as { setupError?: string; deckRejected?: boolean; reason?: string } | null;
    if (st?.setupError) return st.setupError;
    if (st?.deckRejected) return `The host rejected your deck${st.reason ? `: ${st.reason}` : "."}`;
    return null;
  });
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "save" | "share">(null);
  const [whoFor, setWhoFor] = useState<ChessRun | null>(null);
  // Vs a friend: the mode room (opened before choosing anything, kept for the whole run).
  const [setupMe, setSetupMe] = useState<RoomMe | null>(null);
  const roomMe: RoomMe | null = run ? { name: run.players[run.me].name } : setupMe;
  const room = useRoom("chess", roomMe);
  const roomRun = (room.latest.run as { run?: ChessRun } | undefined)?.run;
  useEffect(() => {
    // The guest receives the run the host started and plays seat 2.
    if (room.room?.role !== "guest" || !roomRun || typeof roomRun.id !== "string") return;
    if (run && run.id === roomRun.id) return;
    setRun({ ...roomRun, me: 1 as Slot, pendingGameId: null, pendingResult: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.room?.role, roomRun]);

  const setRun = useCallback((next: ChessRun | null) => {
    setRunState(next);
    autosaveChess(next);
  }, []);
  const say = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2800);
  };

  useEffect(() => {
    void useCardDataStore.getState().warm();
    loadProgressionData()
      .then(async (d) => {
        const list = await loadStarterDecks(d);
        setData(d);
        setStarters(list);
        setMetas(await loadMetaDecks());
      })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    const onFocus = () => {
      const saved = loadChessAutosave();
      if (saved && run && saved.id === run.id && saved.pendingResult && !run.pendingResult) setRunState(saved);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [run]);

  const me = run ? run.players[run.me] : null;
  const updateMe = (patch: Partial<PlayerState>) => {
    if (!run) return;
    const players = run.players.slice() as [PlayerState, PlayerState];
    players[run.me] = { ...players[run.me], ...patch };
    setRun({ ...run, players });
  };

  let body: ReactNode;
  if (!data || !starters) {
    body = <Centered>{loadError ? <div className="pf-error">Could not load the cards: {loadError}</div> : <p className="pf-hint-pulse">Loading the decks…</p>}</Centered>;
  } else if (!run) {
    body = (
      <ChessSetup
        data={data}
        starters={starters}
        metas={metas}
        onStart={(settings, names, chosen) => {
          const next = createChess(data, settings, names, chosen);
          setRun(next);
          if (settings.mode === "friend" && room.room?.role === "host") room.send({ k: "run", run: next });
          else if (settings.mode === "friend") setSheet("share");
        }}
        onLoad={() => setSheet("save")}
        room={room}
        onMe={setSetupMe}
      />
    );
  } else if (run.phase === "minigame") {
    body = <ChessMini key={`${run.id}-${run.match}-${run.slot}`} run={run} data={data} setRun={setRun} onError={setError} />;
  } else if (run.phase === "build" && me) {
    const min = run.decks[run.me].size;
    body = (
      <ForgeDeckBuilder
        data={data}
        player={me}
        minDeck={min}
        title={`${me.name} · game ${run.match + 1}`}
        onChange={(main: number[], basics: Basics) => updateMe({ main, basics })}
        actions={
          <>
            {me.commander?.length ? <span className="pf-hint">👑 Commander: {me.commander.join(" & ")}</span> : null}
            <button type="button" className="pf-btn-mini" onClick={() => void navigator.clipboard?.writeText(exportList(me)).then(() => say("Deck list copied (main + sideboard)"))}>
              ⤓ Copy list
            </button>
            <button
              type="button"
              className="pf-btn small"
              onClick={() => {
                const n = deckSize(me);
                if (n < min) {
                  say(`Your deck needs at least ${min} cards — you have ${n}.`);
                  return;
                }
                setRun({ ...run, phase: "match" });
              }}
            >
              Ready ▸
            </button>
          </>
        }
      />
    );
  } else if (run.phase === "match") {
    body = <ChessMatch run={run} data={data} setRun={setRun} onError={setError} navigate={navigate} room={room} />;
  } else {
    body = <ChessEnd run={run} onNew={() => setRun(null)} />;
  }

  return (
    <div className="pf-root">
      <div className="pf-topbar">
        <button type="button" className="pf-btn-mini" onClick={() => navigate("/")}>
          ◂ Modes
        </button>
        <div className="pf-brand">
          Chess
          <small>Pay the 1 pt1</small>
        </div>
        {run && (
          <div className="pf-record">
            {run.players.map((p, i) => (
              <div key={i} className={`pf-rec${i === run.me ? " me" : ""}`}>
                <b>{p.name}</b>
                <i>
                  {p.wins}–{p.losses}
                </i>
              </div>
            ))}
          </div>
        )}
        {run && run.phase !== "done" && (
          <div className="pf-block">
            Game <b>{Math.min(run.match + 1, run.matches)}</b>/{run.matches}
            {run.phase === "minigame" ? (
              <>
                {" "}
                · booster <b>{run.slot + 1}</b>/{run.perMatch}
              </>
            ) : null}
          </div>
        )}
        <button type="button" className="pf-btn-mini" style={run ? undefined : { marginLeft: "auto" }} onClick={() => setSheet("save")}>
          ⛁ Save / Load
        </button>
      </div>
      <div className="pf-main">
        {error && (
          <div className="pf-stage" style={{ paddingBottom: 0 }}>
            <div className="pf-error" onClick={() => setError(null)} role="button" tabIndex={0}>
              {error} <span className="pf-hint">(click to dismiss)</span>
            </div>
          </div>
        )}
        {run && run.mode === "friend" && room.room && run.phase !== "done" && (
          <div className="pf-stage" style={{ paddingBottom: 0, paddingTop: "0.6rem" }}>
            <RoomPanel state={room} mode="chess" peerLabel={run.players[1 - run.me].name} />
          </div>
        )}
        {body}
      </div>
      {sheet && (
        <ChessSave
          run={run}
          share={sheet === "share"}
          onClose={() => setSheet(null)}
          onLoaded={(r) => {
            setSheet(null);
            setWhoFor(r);
          }}
          onAbandon={() => {
            setSheet(null);
            setRun(null);
          }}
          say={say}
        />
      )}
      {whoFor && (
        <div className="pf-modal" onClick={() => setWhoFor(null)}>
          <div className="pf-sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Who are you?</h2>
            <p style={{ textAlign: "center" }}>Pick the player whose deck you play on this device.</p>
            <div className="pf-who">
              {whoFor.players.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={p.kind === "ai"}
                  style={p.kind === "ai" ? { opacity: 0.45 } : undefined}
                  onClick={() => {
                    setRun({ ...whoFor, me: i as Slot, pendingGameId: null });
                    setWhoFor(null);
                    say(`Loaded — you are ${p.name}`);
                  }}
                >
                  <b>{p.name}</b>
                  <small>
                    {whoFor.decks[i].name} · {p.wins}–{p.losses}
                  </small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {toast && <div className="pf-toast">{toast}</div>}
      <RoomToasts />
    </div>
  );
}

// ── setup ───────────────────────────────────────────────────────────────────

function deckArt(data: ProgData, d: AnyDeck): string | undefined {
  if (!isMeta(d)) return d.face ? printImage(d.face, "art_crop") : undefined;
  // Commander decks: the commander is the cover.
  const commander = d.commanders?.[0];
  if (commander) {
    const name = commander.split(" // ")[0];
    const p = data.byName.get(commander)?.[0] ?? data.byName.get(name)?.[0];
    return p ? printImage(p, "art_crop") : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=art_crop`;
  }
  for (const c of d.cards) {
    const p = data.byName.get(c.name)?.[0];
    if (p && !/Land/.test(p.card.type)) return printImage(p, "art_crop");
  }
  return undefined;
}

function ChessSetup({
  data,
  starters,
  metas,
  onStart,
  onLoad,
  room,
  onMe,
}: {
  data: ProgData;
  starters: StarterDeck[];
  metas: MetaDeck[];
  onStart: (s: ChessSettings, names: [string, string], chosen: [AnyDeck, AnyDeck]) => void;
  onLoad: () => void;
  room: RoomState;
  onMe: (me: RoomMe | null) => void;
}) {
  const sets = useMemo(() => chessSets(data), [data]);
  const saved = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<ChessSettings & { names: [string, string] }>;
    } catch {
      return {};
    }
  }, []);
  const [s, setS] = useState<ChessSettings & { names: [string, string] }>({
    mode: saved.mode ?? "ai",
    difficulty: saved.difficulty ?? "Medium",
    startingLife: saved.startingLife ?? null,
    matches: saved.matches ?? 3,
    perMatch: saved.perMatch ?? 1,
    // Older settings chose the sets once for every game: now every game has its own (copied over).
    plan: !saved.plan || saved.plan === "pick" ? "each" : saved.plan,
    sets:
      saved.plan === "pick" && saved.sets?.length
        ? Array.from({ length: (saved.matches ?? 3) * (saved.perMatch ?? 1) }, (_, i) => saved.sets![i % (saved.perMatch ?? 1)] ?? saved.sets![0])
        : saved.sets?.length
          ? saved.sets
          : [sets[0]?.code ?? ""],
    names: saved.names ?? ["Player", "Forge AI"],
  });
  const [chosen, setChosen] = useState<[AnyDeck | null, AnyDeck | null]>([null, null]);
  const [slot, setSlot] = useState<0 | 1>(0);
  const [source, setSource] = useState<"starter" | "meta" | "list">("starter");
  // Rules: "commander" lists only commander decks and checks both before Start.
  const [commanderRules, setCommanderRules] = useState<boolean>(() => !!(saved as { commanderRules?: boolean }).commanderRules);
  const [imported, setImported] = useState<ImportedDeck | null>(null);
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(0);
  const set = (patch: Partial<typeof s>) => setS((prev) => ({ ...prev, ...patch }));
  useEffect(() => setPage(0), [query, format, source, year]);
  // Vs a friend in a room: each device picks only its own deck (chosen[0] = mine);
  // the other deck and name come from the room. Seat 1 is the host's, seat 2 the guest's.
  const inRoom = s.mode === "friend" && !!room.room;
  const mySeat: 0 | 1 = inRoom && room.room?.role === "guest" ? 1 : 0;
  const peerCustom = room.peer?.custom as StarterDeck | undefined;
  const findDeck = (id: string | null | undefined): AnyDeck | null =>
    id ? (peerCustom && peerCustom.id === id ? peerCustom : null) ?? starters.find((d) => d.id === id) ?? metas.find((d) => d.id === id) ?? null : null;
  const peerDeck = inRoom ? findDeck(room.peer?.deck) : null;
  const peerName = room.peer?.name?.trim() || (mySeat === 0 ? "Friend" : "Host");
  const shown: [AnyDeck | null, AnyDeck | null] = !inRoom ? chosen : mySeat === 0 ? [chosen[0], peerDeck] : [peerDeck, chosen[0]];
  const shownNames: [string, string] = !inRoom ? s.names : mySeat === 0 ? [s.names[0], peerName] : [peerName, s.names[0]];
  const myDeckId = chosen[0]?.id ?? null;
  useEffect(() => {
    const mine = chosen[0];
    onMe(inRoom ? { name: s.names[0].trim() || "Player", deck: myDeckId, ...(mine && !isMeta(mine) && mine.custom ? { custom: mine } : {}) } : null);
  }, [inRoom, s.names, myDeckId, onMe]);
  const years = useMemo(() => [...new Set(metas.filter((d) => !format || d.format === format).map((d) => (d.source === "today" ? "today" : String(d.year ?? ""))))].filter(Boolean).sort((a, b) => (a === "today" ? -1 : b === "today" ? 1 : Number(b) - Number(a))), [metas, format]);

  const list: AnyDeck[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (source === "list") return [];
    if (source === "meta" || commanderRules)
      return metas.filter(
        (d) =>
          (!commanderRules || !!d.commanderFormat) &&
          (!format || d.format === format) &&
          (!year || (year === "today" ? d.source === "today" : d.source === "history" && String(d.year) === year)) &&
          (!q || d.name.toLowerCase().includes(q) || (d.period ?? "").toLowerCase().includes(q) || (d.event ?? "").toLowerCase().includes(q)),
      );
    return starters.filter((d) => !q || d.name.toLowerCase().includes(q) || String(d.year).includes(q)).slice().reverse();
  }, [source, metas, starters, query, format, year, commanderRules]);
  const PAGE = 24;
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const pg = Math.min(page, pages - 1);

  const setsFor = s.plan === "each" ? s.matches * s.perMatch : s.plan === "pick" ? s.perMatch : s.plan === "one" ? 1 : 0;
  // Games / boosters changed: keep each game's chosen sets in place (new boosters copy the last one of their game).
  const reshape = (matches: number, perMatch: number) => {
    if (s.plan !== "each") return set({ matches, perMatch });
    const fallback = s.sets[0] ?? sets[0]?.code ?? "";
    const old = (g: number, k: number) => s.sets[g * s.perMatch + k];
    const next: string[] = [];
    for (let g = 0; g < matches; g++)
      for (let k = 0; k < perMatch; k++) {
        const gg = Math.min(g, s.matches - 1);
        next.push(old(gg, Math.min(k, s.perMatch - 1)) ?? old(0, Math.min(k, s.perMatch - 1)) ?? fallback);
      }
    set({ matches, perMatch, sets: next });
  };
  const pickSet = (i: number, code: string) => {
    const next = s.sets.slice();
    while (next.length < setsFor) next.push(next[next.length - 1] ?? sets[0]?.code ?? "");
    next[i] = code;
    set({ sets: next });
  };
  const linked = room.status === "connected";
  const rulesOk = !commanderRules || (isCommanderDeck(shown[0]) && isCommanderDeck(shown[1]));
  const canStart = rulesOk && (inRoom ? mySeat === 0 && !!chosen[0] && !!peerDeck && linked : !!chosen[0] && !!chosen[1]);
  const useImported = () => {
    if (!imported || !importReady(imported, commanderRules)) return;
    const d = importedDeck(imported, commanderRules);
    const next = chosen.slice() as [AnyDeck | null, AnyDeck | null];
    if (inRoom) next[0] = d;
    else {
      next[slot] = d;
      if (slot === 0 && !next[1]) setSlot(1);
    }
    setChosen(next);
  };
  const start = () => {
    if (!canStart) return;
    const settings: ChessSettings = { ...s, sets: Array.from({ length: Math.max(1, setsFor) }, (_, i) => s.sets[i] ?? s.sets[s.sets.length - 1] ?? sets[0]?.code ?? "") };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, names: s.names, commanderRules }));
    } catch {
      // ignore
    }
    if (inRoom) onStart(settings, [s.names[0].trim() || "Player", peerName], [chosen[0]!, peerDeck!]);
    else onStart(settings, [s.names[0].trim() || "Player", s.names[1].trim() || (s.mode === "ai" ? "Forge AI" : "Friend")], [chosen[0]!, chosen[1]!]);
  };
  const slotLabel = (i: 0 | 1) => shownNames[i] || (i === 0 ? "Player" : "Opponent");
  const guestWaiting = inRoom && mySeat === 1;

  return (
    <div className="pf-stage" style={{ maxWidth: 1240 }}>
      <div className="pf-eyebrow">Pay the 1 pt1</div>
      <h1 className="pf-title">Chess</h1>
      <p className="pf-sub">Pick a deck each. Before every game you open boosters and fight a Chess minigame for each one: the cards you win join your deck builder.</p>

      <div className="pf-room-row" style={{ justifyContent: "center", marginBottom: "0.8rem" }}>
        <button type="button" className={`pf-vchip${s.mode === "ai" ? " sel" : ""}`} onClick={() => set({ mode: "ai", names: [s.names[0], "Forge AI"] })}>
          Vs AI
        </button>
        <button type="button" className={`pf-vchip${s.mode === "friend" ? " sel" : ""}`} onClick={() => set({ mode: "friend", names: [s.names[0], "Friend"] })}>
          Vs a friend (online)
        </button>
      </div>
      {s.mode === "friend" && (
        <RoomPanel
          state={room}
          mode="chess"
          hint={
            !room.room
              ? undefined
              : mySeat === 0
                ? "You choose the games and the boosters; your friend picks their own deck on their device. Start when both decks are chosen."
                : "The host chooses the games and the boosters. Pick your deck below: the run starts on both devices when the host presses Start."
          }
        />
      )}

      {guestWaiting ? (
        <div className="pf-panel" style={{ maxWidth: 520, margin: "0 auto" }}>
          <label className="pf-field">
            <span>Your name</span>
            <input value={s.names[0]} maxLength={24} onChange={(e) => set({ names: [e.target.value, s.names[1]] })} />
          </label>
          <div style={{ marginTop: "0.8rem" }}>
            <CardBackButton label="Your card back" />
          </div>
        </div>
      ) : (
      <div className="pf-grid2" style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
        <div className="pf-panel">
          <div className="pf-fields">
            <label className="pf-field">
              <span>Your name</span>
              <input value={s.names[0]} maxLength={24} onChange={(e) => set({ names: [e.target.value, s.names[1]] })} />
            </label>
            {!inRoom && (
              <label className="pf-field">
                <span>{s.mode === "ai" ? "AI name" : "Friend's name"}</span>
                <input value={s.names[1]} maxLength={24} onChange={(e) => set({ names: [s.names[0], e.target.value] })} />
              </label>
            )}
            {s.mode === "ai" && (
              <label className="pf-field">
                <span>AI difficulty</span>
                <select value={s.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
                  {AI_DIFFICULTIES.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id.replace(/([a-z])([A-Z])/g, "$1 $2")}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="pf-field">
              <span>Starting life</span>
              <input type="number" min={1} max={999} placeholder="20" value={s.startingLife ?? ""} onChange={(e) => set({ startingLife: e.target.value ? Math.max(1, Number(e.target.value)) : null })} />
            </label>
          </div>
        </div>
        <div className="pf-panel">
          <div className="pf-fields">
            <label className="pf-field">
              <span>Games</span>
              <select value={s.matches} onChange={(e) => reshape(Number(e.target.value), s.perMatch)}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              <span>Boosters before each game</span>
              <select value={s.perMatch} onChange={(e) => reshape(s.matches, Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="pf-field" style={{ gridColumn: "1 / -1" }}>
              <span>Which boosters</span>
              <select value={s.plan} onChange={(e) => set({ plan: e.target.value as BoosterPlan })}>
                {(Object.keys(PLAN_LABEL) as BoosterPlan[]).filter((p) => p !== "pick").map((p) => (
                  <option key={p} value={p}>
                    {PLAN_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            {s.plan === "each"
              ? Array.from({ length: s.matches }, (_, g) => (
                  <div key={g} className="pf-setgame" style={{ gridColumn: "1 / -1" }}>
                    <div className="pf-setgame-head">
                      <span>Game {g + 1}</span>
                      {g === 0 && s.matches > 1 && (
                        <button
                          type="button"
                          className="pf-link"
                          onClick={() => {
                            const first = Array.from({ length: s.perMatch }, (_, k) => s.sets[k] ?? s.sets[s.sets.length - 1] ?? sets[0]?.code ?? "");
                            set({ sets: Array.from({ length: s.matches * s.perMatch }, (_, i) => first[i % s.perMatch]) });
                          }}
                        >
                          Copy to every game
                        </button>
                      )}
                    </div>
                    <div className="pf-setgame-row">
                      {Array.from({ length: s.perMatch }, (_, k) => {
                        const i = g * s.perMatch + k;
                        return (
                          <label key={k} className="pf-field">
                            <span>Booster {k + 1}</span>
                            <select value={s.sets[i] ?? s.sets[s.sets.length - 1] ?? ""} onChange={(e) => pickSet(i, e.target.value)}>
                              {sets.map((x) => (
                                <option key={x.code} value={x.code}>
                                  {x.name} ({x.year})
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))
              : Array.from({ length: setsFor }, (_, i) => (
                  <label key={i} className="pf-field">
                    <span>{s.plan === "one" ? "Set" : `Booster ${i + 1}`}</span>
                    <select value={s.sets[i] ?? s.sets[s.sets.length - 1] ?? ""} onChange={(e) => pickSet(i, e.target.value)}>
                      {sets.map((x) => (
                        <option key={x.code} value={x.code}>
                          {x.name} ({x.year})
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
          </div>
          <div className="pf-summary">
            <b>{s.matches}</b> games · <b>{s.matches * s.perMatch}</b> minigames per player. Each booster: 11 cards with its set's rarity ratio and a basic land.
          </div>
          <div style={{ marginTop: "0.8rem" }}>
            <CardBackButton label="Your card back" />
          </div>
        </div>
      </div>
      )}

      <div className="pf-chosen">
        {([0, 1] as const).map((i) => {
          const d = shown[i];
          const mine = !inRoom || i === mySeat;
          const active = inRoom ? i === mySeat : slot === i;
          return (
            <button key={i} type="button" className={`${active ? "active" : ""}${mine ? "" : " locked"}`} onClick={() => !inRoom && setSlot(i)}>
              <div className="thumb" style={{ backgroundImage: d && deckArt(data, d) ? `url("${deckArt(data, d)}")` : undefined }} />
              <div>
                <small>
                  {slotLabel(i)}'s deck {active ? "· choosing" : ""}
                </small>
                <b>{d?.name ?? (mine ? "Pick a deck below" : room.status === "connected" ? `${slotLabel(i)} is choosing…` : "Waiting for your friend…")}</b>
                {d && (
                  <small>
                    {isMeta(d)
                      ? `${d.format} · ${d.period ?? ""} · ${d.size} cards${d.commanderFormat ? " · commander" : ""}`
                      : `${d.type} · ${d.year}`}
                  </small>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="pf-deckbar">
        <div className="pf-seg" title="Commander: only commander decks, command zone and Commander rules">
          <button type="button" className={commanderRules ? "" : "sel"} onClick={() => setCommanderRules(false)}>
            Normal
          </button>
          <button
            type="button"
            className={commanderRules ? "sel" : ""}
            onClick={() => {
              setCommanderRules(true);
              if (source === "starter") setSource("meta");
            }}
          >
            👑 Commander
          </button>
        </div>
        {!commanderRules && (
          <button type="button" className={`pf-vchip${source === "starter" ? " sel" : ""}`} onClick={() => setSource("starter")}>
            Starter precons
          </button>
        )}
        <button type="button" className={`pf-vchip${source === "meta" ? " sel" : ""}`} onClick={() => setSource("meta")}>
          {commanderRules ? "Commander meta decks" : "Meta decks"}
        </button>
        <button type="button" className={`pf-vchip${source === "list" ? " sel" : ""}`} onClick={() => setSource("list")}>
          ✎ Your list
        </button>
        {source === "meta" && (
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="">All formats</option>
            {META_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
        {source === "meta" && (
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y === "today" ? "Today" : y}
              </option>
            ))}
          </select>
        )}
        {source !== "list" && <input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ minWidth: 200 }} />}
        <span className="pf-hint" style={{ marginLeft: "auto" }}>
          {source === "list" ? "" : `${list.length} decks`}
        </span>
        <button type="button" className="pf-btn secondary small" onClick={onLoad}>
          Load a save code
        </button>
        {guestWaiting ? (
          <span className="pf-hint-pulse">Waiting for {peerName} to start…</span>
        ) : (
          <button type="button" className="pf-btn small" disabled={!canStart} onClick={start}>
            Start ▸
          </button>
        )}
      </div>
      {commanderRules && !rulesOk && shown[0] && shown[1] && (
        <p className="pf-error">Commander rules: both decks must be commander decks (a commander meta deck or your own commander list).</p>
      )}
      {source === "list" && (
        <div className="pf-panel" style={{ marginBottom: "1rem" }}>
          <DeckImportPanel data={data} commander={commanderRules} slot={`chess-${commanderRules ? "cmd" : "std"}`} onDeck={setImported} />
          <div className="pf-import-use">
            <button type="button" className="pf-btn small" disabled={!importReady(imported, commanderRules)} onClick={useImported}>
              {inRoom ? "Use as my deck" : `Use for ${slotLabel(slot)}`}
            </button>
            {!inRoom && <span className="pf-hint">Pick the player above first (click their deck slot).</span>}
          </div>
        </div>
      )}
      {source === "meta" && (
        <p className="pf-hint">
          Today's top decks (MTGGoldfish) and the top archetypes of every year and season (MTGTop8{metas.some((d) => d.source === "history") ? "" : " — not downloaded yet: run the “Rogue Forge meta decks” workflow on GitHub"}). Commander decks play with real Commander rules (command zone) when both players pick one.
        </p>
      )}

      <div className="pf-deckgrid" style={source === "list" ? { display: "none" } : undefined}>
        {list.slice(pg * PAGE, pg * PAGE + PAGE).map((d) => {
          const art = deckArt(data, d);
          const sel = shown[0]?.id === d.id || shown[1]?.id === d.id;
          return (
            <button
              key={d.id}
              type="button"
              className={`pf-deck${sel ? " sel" : ""}`}
              onClick={() => {
                const next = chosen.slice() as [AnyDeck | null, AnyDeck | null];
                if (inRoom) {
                  next[0] = d;
                  setChosen(next);
                  return;
                }
                next[slot] = d;
                setChosen(next);
                if (slot === 0 && !next[1]) setSlot(1);
              }}
            >
              <div className="art" style={{ backgroundImage: art ? `url("${art}")` : undefined }} />
              <div className="pips">
                {(d.colors.length ? d.colors : ["C"]).map((c) => (
                  <i key={c} style={{ background: PIP[c] ?? PIP.C }} />
                ))}
              </div>
              <span className="tag">{isMeta(d) ? `${d.format}${d.source === "history" ? ` ${d.year}` : " · today"}` : d.year || "—"}</span>
              <div className="meta">
                <b>{d.name}</b>
                <small>{isMeta(d) ? (d.source === "history" ? `${d.period}${d.pct ? ` · ${d.pct}% of the meta` : ""}` : `${d.size} cards`) : d.type}</small>
              </div>
            </button>
          );
        })}
      </div>
      {pages > 1 && (
        <div className="pf-pager">
          <button type="button" className="pf-vchip" disabled={pg === 0} onClick={() => setPage(pg - 1)}>
            ‹ Prev
          </button>
          <span className="pf-hint">
            {pg + 1} / {pages}
          </span>
          <button type="button" className="pf-vchip" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}

// ── minigame ────────────────────────────────────────────────────────────────

function ChessMini({ run, data, setRun, onError }: { run: ChessRun; data: ProgData; setRun: (r: ChessRun) => void; onError: (e: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [link, setLink] = useState<LinkStatus | null>(null);
  const [waitHost, setWaitHost] = useState(false);
  const set = useMemo(() => chessSetFor(data, run), [data, run]);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    let alive = true;
    prepareSets(data, [set])
      .then(() => alive && setReady(true))
      .catch((err: unknown) => onError(err instanceof Error ? err.message : String(err)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, set]);

  useEffect(() => {
    if (!ready || !ref.current) return;
    const root = ref.current;
    let alive = true;
    let h: ReturnType<typeof mountChess> | null = null;
    let closeLink: (() => void) | null = null;
    const boosters = ([0, 1] as const).map((p) => openChessBooster(data, set, makeRng(run.seed, "chess-booster", run.match, run.slot, p)).booster) as [
      ReturnType<typeof openChessBooster>["booster"],
      ReturnType<typeof openChessBooster>["booster"],
    ];
    const myBack = loadCosmetics().back;
    const backs: [string | null, string | null] = [null, null];
    backs[run.me] = backUrlOf(myBack);
    if (run.mode === "ai") backs[(1 - run.me) as Slot] = aiBackUrl(myBack);
    const oppCos = run.mode === "friend" ? lobbyOpponent() : null;
    if (oppCos?.back) backs[(1 - run.me) as Slot] = oppCos.back;
    // Vs a friend the host's device opens both boosters and sends them: the two
    // devices then play with exactly the same cards (same faces, same stats).
    let net: ChessNet | undefined;
    let gotBoosters: ((b: typeof boosters) => void) | null = null;
    const hostBoosters = new Promise<typeof boosters>((resolve) => {
      gotBoosters = resolve;
    });
    let sendLink: ((m: unknown) => void) | null = null;
    if (run.mode === "friend") {
      let handler: ((m: unknown) => void) | null = null;
      const early: unknown[] = [];
      const l = openChessLink({
        runId: run.id,
        channel: `${run.match}-${run.slot}`,
        me: run.me,
        createPeer: (id, config) => createPeer(id, { config }) as unknown as LinkPeer,
        iceConfig: () => fetchFreshTurnConfig(),
        onMessage: (m) => {
          const msg = m as { k?: string; b?: typeof boosters } | null;
          if (msg && msg.k === "boosters" && Array.isArray(msg.b) && msg.b.length === 2) {
            gotBoosters?.(msg.b);
            return;
          }
          if (handler) handler(m);
          else early.push(m);
        },
        onStatus: setLink,
      });
      closeLink = () => l.close();
      sendLink = (m) => l.send(m);
      net = {
        send: (m) => l.send(m),
        onMessage: (cb) => {
          handler = cb;
          for (const m of early.splice(0)) cb(m);
        },
      };
    }
    const boostersReady =
      run.mode === "friend" && run.me === 1
        ? (setWaitHost(true), hostBoosters.then((b) => (setWaitHost(false), b)))
        : enrichChessCards(boosters).then(() => {
            if (run.mode === "friend") sendLink?.({ k: "boosters", b: boosters });
            return boosters;
          });
    void boostersReady.then((used) => {
      if (!alive) return;
      const names = new Map<string, string>();
      for (const b of used) for (const c of [...b.cards, b.land]) names.set(c.key, c.name);
      const title = `Game ${run.match + 1} · booster ${run.slot + 1} of ${run.perMatch} · ${set.name}`;
      h = mountChess(root, {
        boosters: used,
        names: [run.players[0].name, run.players[1].name],
        mode: run.mode === "ai" ? "ai" : "remote",
        me: run.me,
        first: run.miniFirst,
        seed: `${run.seed}|chess|${run.match}|${run.slot}`,
        title,
        curtain: false,
        net,
        backs,
      });
      void h.done.then((res) => {
        if (!alive) return;
        setRun(applyMinigame(data, runRef.current, res, set.code, names));
      });
    });
    return () => {
      alive = false;
      h?.destroy();
      closeLink?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, set, run.id, run.match, run.slot]);

  return (
    <div style={{ padding: "0.6rem" }}>
      {run.mode === "friend" && (
        <p className="pf-hint" style={{ textAlign: "center", margin: "0 0 0.4rem" }}>
          {link === "connected" ? `● Linked with ${run.players[1 - run.me].name}` : `○ Connecting to ${run.players[1 - run.me].name}… (they need this screen open too)`}
        </p>
      )}
      {!ready && <p className="pf-hint-pulse" style={{ textAlign: "center" }}>Opening the boosters…</p>}
      {ready && waitHost && (
        <p className="pf-hint-pulse" style={{ textAlign: "center" }}>
          Waiting for {run.players[0].name}'s device to open the boosters…
        </p>
      )}
      <div ref={ref} />
    </div>
  );
}

// ── the game ────────────────────────────────────────────────────────────────

function ChessMatch({
  run,
  data,
  setRun,
  onError,
  navigate,
  room,
}: {
  run: ChessRun;
  data: ProgData;
  setRun: (r: ChessRun) => void;
  onError: (e: string | null) => void;
  navigate: (to: string, opts?: { state?: unknown }) => void;
  room: RoomState;
}) {
  const me = run.players[run.me];
  const opp = run.players[(1 - run.me) as Slot];
  const hostingStatus = useMultiplayerStore((s) => s.hostingStatus);
  const hostGameCode = useMultiplayerStore((s) => s.hostGameCode);
  const cardStatus = useCardDataStore((s) => s.status);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualRoom, setManualRoom] = useState(false);
  // Vs a friend in a mode room: the game room opens and is joined by itself.
  const inRoom = run.mode === "friend" && !!room.room;
  const auto = useAutoMatchRoom({
    state: room,
    matchKey: `${run.id}:${run.match}`,
    enabled: inRoom && !run.pendingResult && !manualRoom && cardStatus !== "loading",
    host: async () => {
      setRun({ ...run, pendingGameId: "*" });
      await hostFriendMatchSpec(specOf(), data);
    },
    join: async (code) => {
      setRun({ ...run, pendingGameId: "*" });
      await joinFriendMatchSpec(specOf(), data, code, crypto.randomUUID(), navigate);
    },
    onError: (e) => onError(e),
  });

  if (run.pendingResult) {
    const won = run.pendingResult.myWins > run.pendingResult.oppWins;
    return (
      <div className="pf-stage">
        <div className="pf-eyebrow">Game {run.match + 1}</div>
        <div className={`pf-result ${won ? "win" : "loss"}`}>{won ? "Victory" : "Defeat"}</div>
        <div className="pf-row">
          <button type="button" className="pf-btn" onClick={() => setRun(applyChessResult(run, run.pendingResult!.myWins, run.pendingResult!.oppWins))}>
            Continue ▸
          </button>
        </div>
      </div>
    );
  }

  const spec = (): MatchSpec => specOf();
  function specOf(): MatchSpec {
    const format = chessFormat(run);
    return {
    me: forMatch(me, format),
    opp: forMatch(opp, format),
    format,
    difficulty: run.difficulty,
    startingLife: run.startingLife,
    matchType: "Bo1",
    first: run.nextFirst === null ? null : run.nextFirst === run.me ? "play" : "draw",
    hostFirst: run.nextFirst === null ? null : run.nextFirst === run.me ? 0 : 1,
    youDeck: YOU_DECK,
    aiDeck: AI_DECK,
    };
  }
  const format = chessFormat(run);
  const start = async (fn: () => Promise<unknown>, pending: string) => {
    if (busy) return;
    setBusy(true);
    onError(null);
    setRun({ ...run, pendingGameId: pending });
    try {
      await fn();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const loading = cardStatus === "loading";
  const starter = run.nextFirst === null ? "Decided at random." : `${run.players[run.nextFirst].name} lost the last game and plays first.`;

  return (
    <div className="pf-stage">
      <div className="pf-eyebrow">
        Game {run.match + 1} of {run.matches}
      </div>
      <h1 className="pf-title">To battle</h1>
      <div className="pf-panel" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="pf-versus">
          <div className="side">
            <b>{me.name}</b>
            <span>
              {deckSize(me)} cards · {me.wins}–{me.losses}
            </span>
          </div>
          <div className="x">VS</div>
          <div className="side">
            <b>{opp.name}</b>
            <span>
              {opp.kind === "ai" ? `${deckSize(opp)} cards · ` : ""}
              {opp.wins}–{opp.losses}
            </span>
          </div>
        </div>
        <p className="pf-hint" style={{ textAlign: "center", marginTop: "1rem" }}>
          Who starts: {starter}
          <br />
          Rules:{" "}
          {format === "Commander"
            ? "Commander — both commanders start in the command zone (commander tax, commander damage, 40 life unless you set another)."
            : format === "DuelCommander"
              ? "Duel Commander — commanders in the command zone, Duel Commander rules (20 life unless you set another)."
            : me.commander?.length || opp.commander?.length
              ? "Limited — only one deck has a commander, so it is shuffled into its deck."
              : "Limited (any cards, any number of copies)."}
        </p>
        {run.pendingGameId && hostingStatus === "idle" && !(inRoom && !manualRoom) && (
          <p className="pf-hint" style={{ textAlign: "center" }}>
            A game was started but no result came back. Play it again, or record the result by hand below.
          </p>
        )}
        {run.mode === "ai" ? (
          <div className="pf-row">
            <button type="button" className="pf-btn secondary small" onClick={() => setRun({ ...run, phase: "build" })}>
              ◂ Edit deck
            </button>
            <button
              type="button"
              className="pf-btn"
              disabled={busy || loading}
              onClick={() => {
                const gameId = crypto.randomUUID();
                void start(() => launchAiMatchSpec(spec(), data, gameId, navigate), gameId);
              }}
            >
              {loading ? "Loading cards…" : "Start the game ▸"}
            </button>
          </div>
        ) : inRoom && !manualRoom ? (
          <div style={{ marginTop: "1.2rem", textAlign: "center" }}>
            <p className="pf-hint-pulse">{auto.waiting}</p>
            {room.room?.role === "host" ? (
              <div className="pf-row">
                {auto.stuck && <span className="pf-hint">Your friend has not entered yet?</span>}
                <button type="button" className={auto.stuck ? "pf-btn small" : "pf-btn-mini"} onClick={auto.restart}>
                  ⟳ Open a new game room
                </button>
              </div>
            ) : (
              <div className="pf-row">
                <button type="button" className="pf-btn-mini" onClick={auto.retry}>
                  ⟳ Join again
                </button>
              </div>
            )}
            <div className="pf-row">
              <button type="button" className="pf-btn secondary small" onClick={() => setRun({ ...run, phase: "build" })}>
                ◂ Edit deck
              </button>
              <button
                type="button"
                className="pf-btn-mini"
                onClick={() => {
                  if (room.room?.role === "host") useMultiplayerStore.getState().cancelHosting();
                  setManualRoom(true);
                }}
              >
                Use a room code by hand
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: "1.2rem", display: "grid", gap: "1.2rem", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            <div>
              <div className="pf-field">
                <span>Host the room</span>
              </div>
              {hostingStatus !== "idle" ? (
                <div style={{ textAlign: "center" }}>
                  {hostGameCode ? (
                    <>
                      <button type="button" className="pf-code" onClick={() => void navigator.clipboard?.writeText(hostGameCode).catch(() => {})}>
                        {hostGameCode}
                      </button>
                      <p className="pf-hint">Tell {opp.name} this code. The game starts as soon as they join.</p>
                    </>
                  ) : (
                    <p className="pf-hint-pulse">Opening the room…</p>
                  )}
                  <button type="button" className="pf-btn secondary small" onClick={() => useMultiplayerStore.getState().cancelHosting()}>
                    Cancel room
                  </button>
                </div>
              ) : (
                <div className="pf-row" style={{ justifyContent: "flex-start", marginTop: "0.6rem" }}>
                  <button type="button" className="pf-btn" disabled={busy || loading} onClick={() => void start(() => hostFriendMatchSpec(spec(), data), "*")}>
                    Create room ▸
                  </button>
                </div>
              )}
            </div>
            {hostingStatus === "idle" && (
              <div>
                <div className="pf-field">
                  <span>Or join your friend's room</span>
                </div>
                <div className="pf-row" style={{ justifyContent: "flex-start", marginTop: "0.6rem" }}>
                  <input value={joinCode} maxLength={5} placeholder="CODE" style={{ width: 130, textTransform: "uppercase", letterSpacing: "0.3em", fontFamily: "Cinzel" }} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />
                  <button
                    type="button"
                    className="pf-btn secondary"
                    disabled={busy || loading}
                    onClick={() => {
                      const code = parseRoomCode(joinCode);
                      if (!code) {
                        onError("Enter the 5-character room code your friend sees.");
                        return;
                      }
                      const gameId = crypto.randomUUID();
                      void start(() => joinFriendMatchSpec(spec(), data, code, gameId, navigate), "*");
                    }}
                  >
                    Join ▸
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <div style={{ textAlign: "center", marginTop: "1.4rem" }}>
          {!manual ? (
            <button type="button" className="pf-btn-mini" onClick={() => setManual(true)}>
              Record the result by hand
            </button>
          ) : (
            <div className="pf-row">
              <button type="button" className="pf-btn small" onClick={() => setRun(applyChessResult(run, 1, 0))}>
                I won
              </button>
              <button type="button" className="pf-btn small secondary" onClick={() => setRun(applyChessResult(run, 0, 1))}>
                I lost
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChessEnd({ run, onNew }: { run: ChessRun; onNew: () => void }) {
  const [a, b] = run.players;
  const champion = a.wins === b.wins ? null : a.wins > b.wins ? a : b;
  return (
    <div className="pf-stage">
      <div className="pf-eyebrow">
        {run.history.length} games · {run.minis.length} minigames
      </div>
      <h1 className="pf-title">{champion ? `${champion.name} wins the Chess run` : "A perfect tie"}</h1>
      <p className="pf-sub">
        {a.name} {a.wins}–{a.losses} · {b.name} {b.wins}–{b.losses}
      </p>
      <div className="pf-panel" style={{ maxWidth: 560, margin: "0 auto" }}>
        <table className="pf-table">
          <thead>
            <tr>
              <th>Game</th>
              <th>Minigames</th>
              <th>Winner</th>
            </tr>
          </thead>
          <tbody>
            {run.history.map((h) => (
              <tr key={h.match}>
                <td>{h.match + 1}</td>
                <td>
                  {run.minis
                    .filter((m) => m.match === h.match)
                    .map((m) => `${m.set.toUpperCase()}: ${run.players[m.winner].name}`)
                    .join(" · ")}
                </td>
                <td>{run.players[h.winner].name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pf-row">
        <button type="button" className="pf-btn" onClick={onNew}>
          New Chess run ▸
        </button>
      </div>
    </div>
  );
}

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function ChessSave({
  run,
  share,
  onClose,
  onLoaded,
  onAbandon,
  say,
}: {
  run: ChessRun | null;
  share: boolean;
  onClose: () => void;
  onLoaded: (r: ChessRun) => void;
  onAbandon: () => void;
  say: (m: string) => void;
}) {
  const [code, setCode] = useState("");
  const [loadText, setLoadText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const me = run ? run.players[run.me] : null;
  const list = me ? exportList(me) : "";
  useEffect(() => {
    if (run) void encodeChess(run).then(setCode);
  }, [run]);
  const copy = (text: string, msg: string) => void navigator.clipboard?.writeText(text).then(() => say(msg)).catch(() => say("Copy failed — select and copy by hand"));
  return (
    <div className="pf-modal" onClick={onClose}>
      <div className="pf-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{share ? "Invite your friend" : "Save / Load"}</h2>
        {share && <p style={{ textAlign: "center" }}>Send this code to your friend: Chess → Save / Load → Load, then they pick their player. Keep the minigame screen open on both devices.</p>}
        {run && (
          <>
            <h3>Chess code</h3>
            <textarea readOnly value={code || "Encoding…"} />
            <div className="pf-row" style={{ marginTop: "0.6rem" }}>
              <button type="button" className="pf-btn small" disabled={!code} onClick={() => copy(code, "Code copied")}>
                Copy code
              </button>
              <button type="button" className="pf-btn secondary small" disabled={!code} onClick={() => download(`chess-game${run.match + 1}.txt`, code)}>
                Download .txt
              </button>
            </div>
          </>
        )}
        {!share && (
          <>
            {me && (
              <>
                <h3>My list · main + sideboard</h3>
                <textarea readOnly value={list} />
                <div className="pf-row" style={{ marginTop: "0.6rem" }}>
                  <button type="button" className="pf-btn small" onClick={() => copy(list, "List copied")}>
                    Copy my list
                  </button>
                </div>
              </>
            )}
            <h3>Load a Chess code</h3>
            <textarea placeholder="CHES1-…" value={loadText} onChange={(e) => setLoadText(e.target.value)} />
            <div className="pf-row" style={{ marginTop: "0.6rem" }}>
              <button
                type="button"
                className="pf-btn small"
                disabled={!loadText.trim()}
                onClick={() => {
                  setErr(null);
                  decodeChess(loadText)
                    .then(onLoaded)
                    .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
                }}
              >
                Load
              </button>
            </div>
            {run && (
              <>
                <h3>Start over</h3>
                <div className="pf-row" style={{ justifyContent: "flex-start" }}>
                  <button type="button" className="pf-btn danger small" onClick={() => window.confirm("Abandon this Chess run? Copy the code first if you may want it back.") && onAbandon()}>
                    Abandon
                  </button>
                </div>
              </>
            )}
          </>
        )}
        {err && <div className="pf-error">{err}</div>}
        <div className="pf-row">
          <button type="button" className="pf-btn secondary small" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
