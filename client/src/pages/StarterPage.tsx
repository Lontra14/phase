// Starter — Pay the 1 pt1 mode.
//
// Every player picks a precon (60-card decks, or official Commander precons with
// Commander rules, or their own list). A grid of boosters (any set, any
// product) is at stake. Tables of 2 to 4 (AIs and friends online; at 4,
// everyone for themselves or two teams). Game 1 right away (look at your deck
// first), single games: every loser picks a colour and gets a card from The
// List, the winner spins a wheel of their deck's rarities and adds another copy
// of one card. Then the winner opens a booster from the grid, then the others
// in seat order after them, deck building, next game. When the grid is empty a
// last game decides.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";

import { AI_DIFFICULTIES } from "../constants/ai";
import { fetchFreshTurnConfig, parseRoomCode } from "../network/connection";
import { createPeer } from "../network/transport";
import { useCardDataStore } from "../stores/cardDataStore";
import { useMultiplayerStore } from "../stores/multiplayerStore";
import { CardZoom } from "../progression/CardZoom";
import { ForgeDeckBuilder } from "../progression/ForgeDeckBuilder";
import { PackOpening, packColors } from "../progression/PackOpening";
import { WheelOfFortune } from "../progression/WheelOfFortune";
import type { ProgData, ProgPrint } from "../progression/data";
import { RARITY_LABEL, loadProgressionData, printImage, resolveSupport } from "../progression/data";
import type { MatchSpec } from "../progression/launch";
import { deckSize, hostFriendMatchSpec, joinFriendMatchSpec, launchAiMatchSpec, roomCosmetics } from "../progression/launch";
import type { Pack } from "../progression/packs";
import { PRODUCT_LABEL } from "../progression/packs";
import type { Basics, PlayerState, Slot } from "../progression/run";
import { exportList, sameSide, sideLead, sideName } from "../progression/run";
import type { StarterRun, StarterSettings } from "../progression/starter";
import {
  COLOR_LABEL,
  LIST_COLORS,
  aiTakePack,
  applyStarterResult,
  autosaveStarter,
  claimStarterReward,
  createStarter,
  decodeStarter,
  encodeStarter,
  gridSet,
  listCardFor,
  loadStarterAutosave,
  foldStarterBasics,
  opponentStandIn,
  packsLeft,
  starterFormat,
  starterTableFormat,
  starterTeams,
  starterWinner,
  picker,
  takePack,
  totalGames,
} from "../progression/starter";
import type { LinkPeer, LinkPick, LinkState, LinkStatus, StarterLink } from "../progression/starterLink";
import { openStarterLink } from "../progression/starterLink";
import type { StarterDeck } from "../progression/starterData";
import { loadDeckWarnings, loadStarterDecks } from "../progression/starterData";
import "../progression/progression.css";
import { forMatch } from "../chess/chess";
import { DeckImportPanel, importReady } from "../progression/DeckImportPanel";
import type { ImportedDeck } from "../progression/deckImport";
import { importedDeck, isCommanderDeck } from "../progression/deckImport";
import type { RoomMe } from "../progression/room";
import { RoomPanel, RoomToasts, useAutoMatchRoom } from "../progression/room";
import type { HubPlayer, HubState } from "../progression/roomHub";
import { useRoomHub } from "../progression/roomHub";

const SETTINGS_KEY = "phase-starter-settings";
/** Decks per gallery page. */
const PAGE = 24;

/** Page numbers around the current one (0-based); -1 marks a gap. */
function pagerItems(page: number, pages: number): number[] {
  const out: number[] = [];
  for (let n = 0; n < pages; n++) {
    if (n === 0 || n === pages - 1 || Math.abs(n - page) <= 2) out.push(n);
    else if (out[out.length - 1] !== -1) out.push(-1);
  }
  return out;
}

const PIP: Record<string, string> = { W: "#f4ecd4", U: "#4a90d9", B: "#a487c4", R: "#d6503e", G: "#4fb277", C: "#b9b2a6" };
const YOU_DECK = "Starter · You";
const AI_DECK = "Starter · AI";

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function Centered({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8rem", padding: "3rem 1rem" }}>{children}</div>;
}

/** The players I face (everyone else at the table). */
const othersOf = (run: StarterRun) => run.players.map((p, i) => ({ p, i })).filter((x) => x.i !== run.me);

/** The run the host sent to the room, with the seat of every friend's device. */
interface RoomRun {
  run?: StarterRun;
  seats?: Record<string, number>;
}

export function StarterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<ProgData | null>(null);
  const [decks, setDecks] = useState<StarterDeck[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [run, setRunState] = useState<StarterRun | null>(() => loadStarterAutosave());
  const [error, setError] = useState<string | null>(() => {
    const st = location.state as { setupError?: string; deckRejected?: boolean; reason?: string } | null;
    if (st?.setupError) return st.setupError;
    if (st?.deckRejected) return `The host rejected your deck${st.reason ? `: ${st.reason}` : "."}`;
    return null;
  });
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "save" | "share">(null);
  const [whoFor, setWhoFor] = useState<StarterRun | null>(null);
  const [listReady, setListReady] = useState(false);
  // Vs friends: the mode room (opened before choosing anything, kept for the whole run; up to 4 players).
  const [setupMe, setSetupMe] = useState<RoomMe | null>(null);
  const roomMe: RoomMe | null = run ? { name: run.players[run.me].name } : setupMe;
  const room = useRoomHub("starter", roomMe);
  const roomRun = room.latest.run as RoomRun | undefined;
  useEffect(() => {
    const r = roomRun?.run;
    if (room.room?.role !== "guest" || !r || typeof r.id !== "string") return;
    if (run && run.id === r.id) return;
    const seat = roomRun?.seats?.[room.myId] ?? (r.players.length === 2 ? 1 : undefined);
    if (seat === undefined || !r.players[seat]) return;
    setRun({ ...r, me: seat as Slot, pendingGameId: null, pendingResult: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.room?.role, roomRun, room.myId]);

  const setRun = useCallback((next: StarterRun | null) => {
    setRunState(next);
    autosaveStarter(next);
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
        setDecks(list);
        // The List rewards only offer cards the engine supports.
        void resolveSupport(d.list.map((p) => p.card.name)).then(() => setListReady(true));
      })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, []);

  // Older runs kept the precon's basic lands in the collection: move them to the tray.
  useEffect(() => {
    if (!data || !run) return;
    const folded = foldStarterBasics(data, run);
    if (folded) setRun(folded);
  }, [data, run, setRun]);

  useEffect(() => {
    const onFocus = () => {
      const saved = loadStarterAutosave();
      if (saved && run && saved.id === run.id && saved.pendingResult && !run.pendingResult) setRunState(saved);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [run]);

  const me = run ? run.players[run.me] : null;
  const updateMe = (patch: Partial<PlayerState>) => {
    if (!run) return;
    const players = run.players.slice();
    players[run.me] = { ...players[run.me], ...patch };
    setRun({ ...run, players });
  };

  // Commander decks: 99 cards + the commander; imported lists shorter than 60 keep their own size.
  const starterMin = Math.min(me?.commander?.length ? 100 - me.commander.length : 60, run?.startSize?.[run.me] ?? 60);
  let body: ReactNode;
  if (!data || !decks) {
    body = <Centered>{loadError ? <div className="pf-error">Could not load the decks: {loadError}</div> : <p className="pf-hint-pulse">Loading the precons…</p>}</Centered>;
  } else if (!run) {
    body = (
      <StarterSetup
        data={data}
        decks={decks}
        onStart={(settings, names, chosen, kinds, seats) => {
          const next = createStarter(data, settings, names, chosen, kinds);
          setRun(next);
          if (settings.mode === "friend" && room.room?.role === "host") room.send({ k: "run", run: next, seats });
          else if (settings.mode === "friend") setSheet("share");
        }}
        onLoad={() => setSheet("save")}
        room={room}
        onMe={setSetupMe}
      />
    );
  } else if (run.phase === "preview" && me) {
    body = (
      <ForgeDeckBuilder
        data={data}
        player={me}
        readOnly
        minDeck={starterMin}
        title={`${me.name} · your deck`}
        onChange={() => undefined}
        actions={
          <button type="button" className="pf-btn small" onClick={() => setRun({ ...run, phase: "match" })}>
            To battle ▸
          </button>
        }
      />
    );
  } else if (run.phase === "build" && me) {
    body = (
      <ForgeDeckBuilder
        data={data}
        player={me}
        minDeck={starterMin}
        title={`${me.name} · game ${run.game + 1}`}
        onChange={(main: number[], basics: Basics) => updateMe({ main, basics })}
        actions={
          <>
            <button
              type="button"
              className="pf-btn-mini"
              onClick={() => void navigator.clipboard?.writeText(exportList(me)).then(() => say("Deck list copied (main + sideboard)"))}
            >
              ⤓ Copy list
            </button>
            <button
              type="button"
              className="pf-btn small"
              onClick={() => {
                const n = deckSize(me);
                if (n < starterMin) {
                  say(`${me.commander?.length ? `Commander decks need ${starterMin} cards plus the commander` : `Starter decks need at least ${starterMin} cards`} — you have ${n}.`);
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
    body = <StarterMatch run={run} data={data} setRun={setRun} onError={setError} navigate={navigate} room={room} />;
  } else if (run.phase === "reward") {
    body = listReady ? (
      <StarterReward run={run} data={data} setRun={setRun} />
    ) : (
      <Centered>
        <p className="pf-hint-pulse">Preparing The List…</p>
      </Centered>
    );
  } else if (run.phase === "packs") {
    body = <StarterPacks run={run} data={data} setRun={setRun} say={say} onError={setError} room={room} />;
  } else {
    body = <StarterEnd run={run} onNew={() => setRun(null)} />;
  }

  return (
    <div className="pf-root">
      <div className="pf-topbar">
        <button type="button" className="pf-btn-mini" onClick={() => navigate("/")}>
          ◂ Modes
        </button>
        <div className="pf-brand">
          Starter
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
            Game <b>{Math.min(run.game + 1, totalGames(run))}</b>/{totalGames(run)} · <b>{packsLeft(run)}</b> boosters left
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
            <RoomPanel state={room} mode="starter" peerLabel={othersOf(run).filter((x) => x.p.kind === "human").map((x) => x.p.name).join(", ") || "your friends"} />
          </div>
        )}
        {body}
      </div>
      {sheet && (
        <StarterSave
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
                    {p.wins}–{p.losses} · {p.pool?.length ?? 0} cards
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

// ── setup: deck gallery ─────────────────────────────────────────────────────

// ── setup: deck gallery ─────────────────────────────────────────────────────

function DeckTile({ deck, selected, warning, onClick }: { deck: StarterDeck; selected: boolean; warning: string[] | undefined; onClick: () => void }) {
  return (
    <button type="button" className={`pf-deck${selected ? " sel" : ""}`} onClick={onClick} title={warning?.length ? `May not work: ${warning.join(", ")}` : deck.name}>
      <div className="art" style={{ backgroundImage: deck.face ? `url("${printImage(deck.face, "art_crop")}")` : undefined }} />
      <div className="pips">
        {(deck.colors.length ? deck.colors : ["C"]).map((c) => (
          <i key={c} style={{ background: PIP[c] }} />
        ))}
      </div>
      {warning && warning.length > 0 && <span className="warn">⚠ {warning.length}</span>}
      <span className="tag">{deck.year || "—"}</span>
      <div className="meta">
        <b>{deck.name}</b>
        <small>{deck.type}</small>
      </div>
    </button>
  );
}

type SeatKind = "ai" | "friend";
interface StarterSetupState extends StarterSettings {
  names: [string, string];
  players: number;
  /** Seats 2..4 online: a friend or an AI. */
  seatKinds: SeatKind[];
  teams: boolean;
}

/** A friend's deck as their device announced it in the room. */
function hubDeck(p: HubPlayer | undefined, decks: StarterDeck[]): StarterDeck | null {
  if (!p?.deck) return null;
  const custom = p.custom as StarterDeck | undefined;
  return (custom && custom.id === p.deck ? custom : null) ?? decks.find((d) => d.id === p.deck) ?? null;
}

function StarterSetup({
  data,
  decks,
  onStart,
  onLoad,
  room,
  onMe,
}: {
  data: ProgData;
  decks: StarterDeck[];
  onStart: (s: StarterSettings & { teams?: boolean }, names: string[], chosen: StarterDeck[], kinds: ("human" | "ai")[], seats: Record<string, number>) => void;
  onLoad: () => void;
  room: HubState;
  onMe: (me: RoomMe | null) => void;
}) {
  const saved = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<StarterSetupState & { commanderRules: boolean }>;
    } catch {
      return {};
    }
  }, []);
  const [s, setS] = useState<StarterSetupState>({
    mode: saved.mode ?? "ai",
    difficulty: saved.difficulty ?? "Medium",
    startingLife: saved.startingLife ?? null,
    packs: saved.packs ?? 6,
    names: saved.names ?? ["Player", "Forge AI"],
    players: saved.players ?? 2,
    seatKinds: Array.isArray(saved.seatKinds) && saved.seatKinds.length >= 3 ? saved.seatKinds : ["friend", "friend", "friend"],
    teams: !!saved.teams,
  });
  const [chosen, setChosen] = useState<(StarterDeck | null)[]>([null, null, null, null]);
  const [slot, setSlot] = useState(0);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [color, setColor] = useState("");
  const [hideWarn, setHideWarn] = useState(false);
  const [source, setSource] = useState<"precon" | "list">("precon");
  const [commanderRules, setCommanderRules] = useState<boolean>(() => !!saved.commanderRules);
  const [imported, setImported] = useState<ImportedDeck | null>(null);
  const [warnings, setWarnings] = useState<Map<string, string[]>>(new Map());
  const [peek, setPeek] = useState<ProgPrint | null>(null);

  useEffect(() => {
    void loadDeckWarnings().then(setWarnings);
  }, []);

  // Normal rules: the 60-card precons; Commander rules: the official Commander precons.
  const pool = useMemo(() => decks.filter((d) => isCommanderDeck(d) === commanderRules), [decks, commanderRules]);
  const types = useMemo(() => [...new Set(pool.map((d) => d.type))].sort(), [pool]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool
      .filter((d) => (!q || d.name.toLowerCase().includes(q) || String(d.year).includes(q) || (d.commanders ?? []).some((c) => c.toLowerCase().includes(q))) && (!type || d.type === type))
      .filter((d) => !color || (color === "C" ? d.colors.length === 0 : d.colors.includes(color)))
      .filter((d) => !hideWarn || !warnings.get(d.id)?.length)
      .slice()
      .reverse();
  }, [pool, query, type, color, hideWarn, warnings]);
  useEffect(() => {
    if (!pool.length) setSource("list");
  }, [pool.length]);
  const [pageRaw, setPage] = useState(0);
  useEffect(() => setPage(0), [query, type, color, hideWarn, commanderRules]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const page = Math.min(pageRaw, pages - 1);
  const goPage = (n: number) => {
    setPage(n);
    document.querySelector(".pf-deckbar")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  // Online: each friend picks their own deck on their device; the host picks its own and the AIs'.
  const inRoom = s.mode === "friend" && !!room.room;
  const guestWaiting = inRoom && room.room?.role === "guest";
  const friendsIn = room.players.filter((p) => p.id !== "host");
  const hostName = room.players.find((p) => p.id === "host")?.name?.trim() || "Host";
  const linked = room.status === "connected";
  const players = guestWaiting ? 1 : s.players;
  // Teams: seats 1+2 against 3+4 in a free-for-all game.
  const teams = s.players === 4 && s.teams;
  // Seat kinds: 0 = me; then AI, a friend in the room, or (no room) a friend whose deck I pick.
  const kindAt = (i: number): "me" | "ai" | "friend" | "local" => {
    if (i === 0) return "me";
    if (s.mode === "ai") return "ai";
    const k = s.seatKinds[i - 1] ?? "friend";
    return k === "ai" ? "ai" : inRoom ? "friend" : "local";
  };
  const friendAt = (i: number) => friendsIn[Array.from({ length: i }, (_, j) => kindAt(j)).filter((k) => k === "friend").length];
  const aiName = (n: number) => {
    const base = s.names[1].trim() || "Forge AI";
    return n === 0 ? base : `${base} ${n + 1}`;
  };
  const nameAt = (i: number): string => {
    const k = kindAt(i);
    if (k === "me") return s.names[0].trim() || "You";
    if (k === "ai") return aiName(Array.from({ length: i }, (_, j) => kindAt(j)).filter((x) => x === "ai").length);
    if (k === "friend") return friendAt(i)?.name?.trim() || `Friend ${i + 1}`;
    return i === 1 ? s.names[1].trim() || "Player 2" : `Player ${i + 1}`;
  };
  const deckAt = (i: number): StarterDeck | null => (kindAt(i) === "friend" ? hubDeck(friendAt(i), decks) : chosen[i] ?? null);
  const pickable = (i: number) => kindAt(i) !== "friend";
  const seatsIdx = Array.from({ length: players }, (_, i) => i);
  const friendSeats = seatsIdx.filter((i) => kindAt(i) === "friend").length;

  const myDeckId = chosen[0]?.id ?? null;
  useEffect(() => {
    onMe(inRoom ? { name: s.names[0].trim() || "Player", deck: myDeckId, ...(chosen[0]?.custom ? { custom: chosen[0] } : {}) } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inRoom, s.names, myDeckId, onMe]);
  const rulesOk = !commanderRules || seatsIdx.every((i) => !deckAt(i) || isCommanderDeck(deckAt(i)));
  const allDecks = seatsIdx.every((i) => !!deckAt(i));
  const canStart = !guestWaiting && rulesOk && allDecks && (!inRoom || (linked && friendsIn.length >= friendSeats));

  const nextSlot = (from: number, next: (StarterDeck | null)[]) => {
    for (let k = 1; k <= players; k++) {
      const i = (from + k) % players;
      if (pickable(i) && !next[i]) return i;
    }
    return from;
  };
  const place = (d: StarterDeck) => {
    const next = chosen.slice();
    const at = guestWaiting ? 0 : pickable(slot) ? slot : 0;
    next[at] = d;
    setChosen(next);
    if (!guestWaiting) setSlot(nextSlot(at, next));
  };
  const useImported = () => {
    if (!imported || !importReady(imported, commanderRules)) return;
    place(importedDeck(imported, commanderRules));
  };
  const random = () => {
    const list = shown.length ? shown : pool;
    if (list.length) place(list[Math.floor(Math.random() * list.length)]);
  };
  const set = (patch: Partial<StarterSetupState>) => setS((cur) => ({ ...cur, ...patch }));
  const start = () => {
    if (!canStart) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, commanderRules }));
    } catch {
      // ignore
    }
    const { names: _n, players: _p, seatKinds: _k, teams: _t, ...settings } = s;
    const names = seatsIdx.map(nameAt);
    const kinds = seatsIdx.map((i) => (kindAt(i) === "ai" ? ("ai" as const) : ("human" as const)));
    const seats: Record<string, number> = {};
    for (const i of seatsIdx) if (kindAt(i) === "friend" && friendAt(i)) seats[friendAt(i)!.id] = i;
    // A table with no friend is a game vs AI (it needs no room).
    const mode = kinds.some((k, i) => i > 0 && k === "human") ? "friend" : "ai";
    onStart({ ...settings, mode, teams }, names, seatsIdx.map((i) => deckAt(i)!), kinds, seats);
  };

  const n = Math.max(2, s.players);
  const packsRounded = Math.max(n, Math.round(s.packs / n) * n);

  return (
    <div className="pf-stage" style={{ maxWidth: 1320 }}>
      <div className="pf-eyebrow">Pay the 1 pt1</div>
      <h1 className="pf-title">Starter</h1>
      <p className="pf-sub">
        Precons and a pile of boosters at stake, for 2 to 4 players. After every game the winner opens a booster first, then the others in turn — until the pile is gone and
        one last game decides.
      </p>
      {s.mode === "friend" && (
        <RoomPanel
          state={room}
          mode="starter"
          peerLabel={friendsIn.map((p) => p.name).join(", ") || "your friends"}
          hint={
            !room.room
              ? undefined
              : guestWaiting
                ? "The host chooses the table and the boosters at stake. Pick your deck below: the run starts on every device when the host presses Start."
                : `You choose the table, the boosters and the AIs' decks; every friend picks their own deck on their device. ${friendsIn.length} friend${friendsIn.length === 1 ? "" : "s"} in the room.`
          }
        />
      )}
      {guestWaiting ? (
        <div className="pf-panel" style={{ maxWidth: 520, margin: "0 auto 1.2rem" }}>
          <div className="pf-seg" style={{ marginBottom: "0.8rem" }}>
            <button type="button" onClick={() => set({ mode: "ai" })}>
              Vs AI
            </button>
            <button type="button" className="sel">
              Vs friends (online)
            </button>
          </div>
          <label className="pf-field">
            <span>Your name</span>
            <input value={s.names[0]} maxLength={24} onChange={(e) => set({ names: [e.target.value, s.names[1]] })} />
          </label>
          <div className="pf-hub-list" style={{ marginTop: "0.8rem" }}>
            {room.players.map((p) => (
              <div key={p.id}>
                <span className={`pf-room-dot${p.deck ? " on" : ""}`} />
                <span>
                  {p.name}
                  {p.id === "host" ? " (host)" : p.id === room.myId ? " (you)" : ""}
                  {p.deck ? " · deck chosen" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="pf-grid2" style={{ marginBottom: "1.2rem" }}>
          <div className="pf-panel">
            <div className="pf-field">
              <span>Opponents</span>
              <div className="pf-seg">
                <button type="button" className={s.mode === "ai" ? "sel" : ""} onClick={() => set({ mode: "ai" })}>
                  Vs AI
                </button>
                <button type="button" className={s.mode === "friend" ? "sel" : ""} onClick={() => set({ mode: "friend" })}>
                  Vs friends (online)
                </button>
              </div>
            </div>
            <div className="pf-fields" style={{ marginTop: "1rem" }}>
              <label className="pf-field">
                <span>Your name</span>
                <input value={s.names[0]} maxLength={24} onChange={(e) => set({ names: [e.target.value, s.names[1]] })} />
              </label>
              <label className="pf-field">
                <span>Players</span>
                <select value={s.players} onChange={(e) => set({ players: Number(e.target.value) })}>
                  {[2, 3, 4].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              {seatsIdx.some((i) => kindAt(i) === "ai") && (
                <>
                  <label className="pf-field">
                    <span>AI name</span>
                    <input value={s.names[1]} maxLength={24} onChange={(e) => set({ names: [s.names[0], e.target.value] })} />
                  </label>
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
                </>
              )}
              {s.mode === "friend" && !inRoom && (
                <label className="pf-field">
                  <span>Friend's name</span>
                  <input value={s.names[1]} maxLength={24} onChange={(e) => set({ names: [s.names[0], e.target.value] })} />
                </label>
              )}
            </div>
            {s.players === 4 && (
              <div className="pf-field" style={{ marginTop: "0.9rem" }}>
                <span>Table of 4</span>
                <div className="pf-seg">
                  <button type="button" className={!teams ? "sel" : ""} onClick={() => set({ teams: false })}>
                    Free for all
                  </button>
                  <button type="button" className={teams ? "sel" : ""} onClick={() => set({ teams: true })}>
                    Teams 2 vs 2
                  </button>
                </div>
                {teams && (
                  <small className="pf-hint">
                    Seats 1+2 against 3+4 in a free-for-all game: don't attack your teammate (the AI doesn't know about teams). When the other team is out, the survivor of the
                    winning team takes the game (the teammate concedes, or record the result by hand).
                  </small>
                )}
              </div>
            )}
            {s.mode === "friend" && (
              <div className="pf-seats" style={{ marginTop: "0.9rem" }}>
                {seatsIdx.slice(1).map((i) => (
                  <div key={i} className="pf-seat">
                    <div className="pf-seat-head">
                      <b>Seat {i + 1}</b>
                      {teams && <span className="pf-hint">{i === 1 ? "your teammate" : "opponent team"}</span>}
                      {<div className="pf-seg">
                        <button type="button" className={s.seatKinds[i - 1] !== "ai" ? "sel" : ""} onClick={() => set({ seatKinds: s.seatKinds.map((x, j) => (j === i - 1 ? "friend" : x)) })}>
                          Friend
                        </button>
                        <button type="button" className={s.seatKinds[i - 1] === "ai" ? "sel" : ""} onClick={() => set({ seatKinds: s.seatKinds.map((x, j) => (j === i - 1 ? "ai" : x)) })}>
                          AI
                        </button>
                      </div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="pf-panel">
            <div className="pf-fields">
              <label className="pf-field">
                <span>Boosters at stake</span>
                <select value={s.packs} onChange={(e) => set({ packs: Number(e.target.value) })}>
                  {[2, 3, 4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 24].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pf-field">
                <span>Starting life</span>
                <input type="number" min={1} max={999} placeholder={commanderRules ? "40" : "20"} value={s.startingLife ?? ""} onChange={(e) => set({ startingLife: e.target.value ? Math.max(1, Number(e.target.value)) : null })} />
              </label>
            </div>
            <div className="pf-summary">
              <b>{packsRounded}</b> boosters{packsRounded !== s.packs ? ` (a multiple of ${n} players)` : ""} → <b>{packsRounded / n + 1}</b> games: one before each round of boosters, then a last one.
              {n === 2 ? " Game 1 starts at random, later games the loser chooses." : " Game 1 starts at random, later games the player after the winner starts."}
              {teams && " Teams: seats 1+2 against 3+4."}
              {s.mode === "friend" && !inRoom && <> Open a room above, or start now and send your friend the save code.</>}
            </div>
          </div>
        </div>
      )}

      <div className="pf-chosen">
        {seatsIdx.map((i) => {
          const d = guestWaiting ? chosen[0] : deckAt(i);
          const mine = guestWaiting || pickable(i);
          const active = guestWaiting || slot === i;
          const label = guestWaiting ? s.names[0] || "You" : nameAt(i);
          const friend = !guestWaiting && kindAt(i) === "friend" ? friendAt(i) : undefined;
          return (
            <button key={i} type="button" className={`${active && mine ? "active" : ""}${mine ? "" : " locked"}`} onClick={() => mine && !guestWaiting && setSlot(i)}>
              <div className="thumb" style={{ backgroundImage: d?.face ? `url("${printImage(d.face, "art_crop")}")` : undefined }} />
              <div>
                <small>
                  {label}'s deck{teams && !guestWaiting ? ` · team ${i < 2 ? "A" : "B"}` : ""} {active && mine ? "· choosing" : ""}
                </small>
                <b>{d?.name ?? (mine ? "Pick a deck below" : friend ? `${label} is choosing…` : linked ? "Waiting for a friend to join…" : "Waiting for your friends…")}</b>
                {d && (d.partial ?? warnings.get(d.id))?.length ? (
                  <small style={{ color: "#f2b49f" }}>⚠ May not work: {(d.partial ?? warnings.get(d.id))!.join(", ")}</small>
                ) : d ? (
                  <small>
                    {d.type} · {d.year}
                  </small>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="pf-deckbar">
        <div className="pf-seg" title="Commander: official Commander precons or your own commander lists, command zone and commander rules">
          <button type="button" className={commanderRules ? "" : "sel"} onClick={() => setCommanderRules(false)}>
            Normal
          </button>
          <button type="button" className={commanderRules ? "sel" : ""} onClick={() => setCommanderRules(true)}>
            👑 Commander
          </button>
        </div>
        {pool.length > 0 && (
          <button type="button" className={`pf-vchip${source === "precon" ? " sel" : ""}`} onClick={() => setSource("precon")}>
            {commanderRules ? "Commander precons" : "Precons"}
          </button>
        )}
        <button type="button" className={`pf-vchip${source === "list" ? " sel" : ""}`} onClick={() => setSource("list")}>
          ✎ Your list
        </button>
        {source === "precon" && (
          <>
            <input placeholder={commanderRules ? "Search name, commander or year…" : "Search name or year…"} value={query} onChange={(e) => setQuery(e.target.value)} style={{ minWidth: 220 }} />
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All products</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {["W", "U", "B", "R", "G", "C"].map((c) => (
              <button key={c} type="button" className={`pf-vchip${color === c ? " sel" : ""}`} onClick={() => setColor(color === c ? "" : c)}>
                <span className="sw" style={{ background: PIP[c] }} />
                {c}
              </button>
            ))}
            <label className="pf-check" style={{ marginTop: 0 }}>
              <input type="checkbox" checked={hideWarn} onChange={(e) => setHideWarn(e.target.checked)} />
              <span>Only fully working decks</span>
            </label>
            <button type="button" className="pf-vchip" onClick={random}>
              🎲 Random
            </button>
          </>
        )}
        <span className="pf-hint" style={{ marginLeft: "auto" }}>
          {source === "precon" ? `${shown.length} decks` : ""}
        </span>
        <button type="button" className="pf-btn secondary small" onClick={onLoad}>
          Load a save code
        </button>
        {guestWaiting ? (
          <span className="pf-hint-pulse">Waiting for {hostName} to start…</span>
        ) : (
          <button type="button" className="pf-btn small" disabled={!canStart} onClick={start}>
            Start ▸
          </button>
        )}
      </div>

      {commanderRules && !rulesOk && <p className="pf-error">Commander rules: every deck must be a commander deck.</p>}
      {source === "list" && (
        <div className="pf-panel" style={{ marginBottom: "1rem" }}>
          <DeckImportPanel data={data} commander={commanderRules} slot={`starter-${commanderRules ? "cmd" : "std"}`} onDeck={setImported} />
          <div className="pf-import-use">
            <button type="button" className="pf-btn small" disabled={!importReady(imported, commanderRules)} onClick={useImported}>
              {guestWaiting ? "Use as my deck" : `Use for ${nameAt(pickable(slot) ? slot : 0)}`}
            </button>
            {!guestWaiting && players > 1 && <span className="pf-hint">Pick the player above first (click their deck slot).</span>}
          </div>
        </div>
      )}
      <div className="pf-deckgrid" style={source === "list" ? { display: "none" } : undefined}>
        {shown.slice(page * PAGE, page * PAGE + PAGE).map((d) => (
          <div
            key={d.id}
            onContextMenu={(e) => {
              e.preventDefault();
              if (d.face) setPeek(d.face);
            }}
          >
            <DeckTile deck={d} selected={seatsIdx.some((i) => (guestWaiting ? chosen[0] : deckAt(i))?.id === d.id)} warning={warnings.get(d.id)} onClick={() => place(d)} />
          </div>
        ))}
      </div>
      {pages > 1 && source === "precon" && (
        <div className="pf-pager">
          <button type="button" className="pf-vchip" disabled={page === 0} onClick={() => goPage(page - 1)}>
            ‹ Prev
          </button>
          {pagerItems(page, pages).map((v, i) =>
            v < 0 ? (
              <span key={`gap${i}`} className="gap">
                …
              </span>
            ) : (
              <button key={v} type="button" className={`pf-vchip${v === page ? " sel" : ""}`} onClick={() => goPage(v)}>
                {v + 1}
              </button>
            ),
          )}
          <button type="button" className="pf-vchip" disabled={page >= pages - 1} onClick={() => goPage(page + 1)}>
            Next ›
          </button>
        </div>
      )}
      {peek && <CardZoom print={peek} onClose={() => setPeek(null)} />}
    </div>
  );
}

// ── match ───────────────────────────────────────────────────────────────────

function StarterMatch({
  run,
  data,
  setRun,
  onError,
  navigate,
  room,
}: {
  run: StarterRun;
  data: ProgData;
  setRun: (r: StarterRun) => void;
  onError: (e: string | null) => void;
  navigate: (to: string, opts?: { state?: unknown }) => void;
  room: HubState;
}) {
  const me = run.players[run.me];
  const others = othersOf(run);
  const duel = run.players.length === 2;
  const opp = others[0].p;
  const hostingStatus = useMultiplayerStore((s) => s.hostingStatus);
  const hostGameCode = useMultiplayerStore((s) => s.hostGameCode);
  const cardStatus = useCardDataStore((s) => s.status);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const teams = starterTeams(run);
  // Two players: the loser of the last game chooses who starts.
  const iLost = duel && run.game > 0 && run.lastWinner !== null && run.lastWinner !== run.me;
  const loserName = duel && run.lastWinner !== null ? run.players[run.lastWinner === 0 ? 1 : 0].name : "";
  // Vs friends in a mode room: the loser's choice of who starts travels over the
  // room, then the game room opens and is joined by itself (friends one after the
  // other, so that every device keeps its seat of the run).
  const [manualRoom, setManualRoom] = useState(false);
  const inRoom = run.mode === "friend" && !!room.room;
  const matchKey = `${run.id}:${run.game}`;
  const firstMsg = room.latest.first as { key?: string; seat?: Slot } | undefined;
  useEffect(() => {
    if (!firstMsg || firstMsg.key !== matchKey || typeof firstMsg.seat !== "number" || !run.players[firstMsg.seat] || run.nextFirst === firstMsg.seat) return;
    setRun({ ...run, nextFirst: firstMsg.seat });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstMsg?.key, firstMsg?.seat, matchKey]);
  const chooseFirst = (seat: Slot) => {
    setRun({ ...run, nextFirst: seat });
    if (inRoom) room.send({ k: "first", key: matchKey, seat, fwd: true });
  };
  const needsChoice = duel && run.game > 0 && run.lastWinner !== null && run.nextFirst === null;
  const friendOrder = run.players.slice(0, run.me).filter((p) => p.kind === "human").length;
  const auto = useAutoMatchRoom({
    state: room,
    matchKey,
    enabled: inRoom && !run.pendingResult && !manualRoom && !needsChoice && cardStatus !== "loading",
    host: async () => {
      setRun({ ...run, pendingGameId: "*" });
      await hostFriendMatchSpec(specOf(), data);
    },
    join: async (code) => {
      setRun({ ...run, pendingGameId: "*" });
      await joinFriendMatchSpec(specOf(), data, code, crypto.randomUUID(), navigate);
    },
    onError: (e) => onError(e),
    seat: run.me === 0 ? undefined : friendOrder,
  });

  const claim = async (winner: Slot | null) => {
    setBusy(true);
    try {
      setRun(await applyStarterResult(data, run, winner));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const sides = [...new Set(run.players.map((_, i) => sideLead(run, i)))];

  if (run.pendingResult) {
    const winner = starterWinner(run);
    const won = winner !== null && sameSide(run, winner, run.me);
    return (
      <div className="pf-stage">
        <div className="pf-eyebrow">Game {run.game + 1}</div>
        <div className={`pf-result ${won ? "win" : "loss"}`}>{won ? "Victory" : "Defeat"}</div>
        {winner !== null && !duel && <p className="pf-sub">{sideName(run, winner)} won.</p>}
        <div className="pf-row">
          <button type="button" className="pf-btn" disabled={busy} onClick={() => void claim(winner)}>
            Continue ▸
          </button>
        </div>
      </div>
    );
  }

  const spec = (): MatchSpec => specOf();
  function specOf(): MatchSpec {
    const deckRules = starterFormat(run);
    const firstOther = others[0].i;
    // The AI seats are played on the host's device (or in the game vs AI), each at its own seat.
    const ownsTable = run.mode === "ai" || run.me === 0;
    return {
      me: forMatch(me, deckRules),
      opp: forMatch(opponentStandIn(data, run, firstOther), deckRules),
      format: starterTableFormat(run),
      difficulty: run.difficulty,
      startingLife: run.startingLife,
      matchType: "Bo1",
      first: duel && run.nextFirst !== null ? (run.nextFirst === run.me ? "play" : "draw") : null,
      // The host's device is seat 0 of the game: every seat keeps its number.
      hostFirst: run.nextFirst === null ? null : duel ? (run.nextFirst === run.me ? 0 : 1) : run.nextFirst,
      youDeck: YOU_DECK,
      aiDeck: AI_DECK,
      players: run.players.length,
      tableNames: run.players.map((p) => p.name),
      tableCos: roomCosmetics(room.players),
      aiSeats: ownsTable
        ? others.filter((x) => x.p.kind === "ai").map((x) => ({ player: forMatch(x.p, deckRules), difficulty: run.difficulty, seatIndex: x.i }))
        : [],
    };
  }
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
  const starterLabel = run.nextFirst === null ? "Random" : `${run.players[run.nextFirst]?.name ?? "?"} plays first`;
  const canHost = duel || run.me === 0;

  return (
    <div className="pf-stage">
      <div className="pf-eyebrow">
        Game {run.game + 1} of {totalGames(run)}
        {packsLeft(run) === 0 ? " · last game" : ""}
      </div>
      <h1 className="pf-title">To battle</h1>
      <div className="pf-panel" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="pf-versus">
          <div className="side">
            <b>{teams ? sideName(run, run.me) : me.name}</b>
            <span>
              {deckSize(me)} cards · {me.wins}–{me.losses}
            </span>
          </div>
          <div className="x">VS</div>
          <div className="side">
            {others
              .filter((x) => !sameSide(run, x.i, run.me))
              .map((x) => (
                <div key={x.i}>
                  <b>{x.p.name}</b>
                  <span>
                    {" "}
                    {x.p.kind === "ai" ? `AI · ${deckSize(x.p)} cards · ` : ""}
                    {x.p.wins}–{x.p.losses}
                  </span>
                </div>
              ))}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <div className="pf-field" style={{ alignItems: "center" }}>
            <span>Who starts</span>
          </div>
          {run.game === 0 ? (
            <p className="pf-hint">Game 1: decided at random.</p>
          ) : !duel ? (
            <p className="pf-hint">{run.nextFirst === null ? "Random." : `${starterLabel} (the player after the last winner).`}</p>
          ) : iLost || run.mode === "friend" ? (
            <>
              <p className="pf-hint">
                {iLost
                  ? `You lost the last game: you choose.${run.mode === "friend" && !inRoom ? " Whoever creates the room applies this choice." : ""}`
                  : inRoom
                    ? `${loserName} lost the last game and chooses.`
                    : `${loserName} lost the last game and chooses. Whoever creates the room applies the choice — set what they say.`}
              </p>
              <div className="pf-first">
                <button type="button" disabled={inRoom && !iLost} className={`pf-btn small ${run.nextFirst === run.me ? "" : "secondary"}`} onClick={() => chooseFirst(run.me)}>
                  {me.name} plays first
                </button>
                <button type="button" disabled={inRoom && !iLost} className={`pf-btn small ${run.nextFirst === others[0].i ? "" : "secondary"}`} onClick={() => chooseFirst(others[0].i)}>
                  {opp.name} plays first
                </button>
              </div>
            </>
          ) : (
            <p className="pf-hint">{starterLabel}</p>
          )}
        </div>

        {run.pendingGameId && hostingStatus === "idle" && !(inRoom && !manualRoom) && (
          <p className="pf-hint" style={{ textAlign: "center", marginTop: "1rem" }}>
            A game was started but no result came back. Play it again, or record the result by hand below.
          </p>
        )}

        {run.mode === "ai" ? (
          <div className="pf-row">
            {run.game > 0 && (
              <button type="button" className="pf-btn secondary small" onClick={() => setRun({ ...run, phase: "build" })}>
                ◂ Edit deck
              </button>
            )}
            <button
              type="button"
              className="pf-btn"
              disabled={busy || loading || (iLost && run.nextFirst === null)}
              onClick={() => {
                const gameId = crypto.randomUUID();
                void start(() => launchAiMatchSpec(spec(), data, gameId, navigate), gameId);
              }}
            >
              {loading ? "Loading cards…" : iLost && run.nextFirst === null ? "Choose who starts" : "Start the game ▸"}
            </button>
          </div>
        ) : inRoom && !manualRoom ? (
          <div style={{ marginTop: "1.2rem", textAlign: "center" }}>
            <p className="pf-hint-pulse">{needsChoice ? `Waiting for ${iLost ? "your" : `${loserName}'s`} choice of who starts…` : auto.waiting}</p>
            {room.room?.role === "host" ? (
              <div className="pf-row">
                {auto.stuck && <span className="pf-hint">Someone has not entered yet?</span>}
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
              {run.game > 0 && (
                <button type="button" className="pf-btn secondary small" onClick={() => setRun({ ...run, phase: "build" })}>
                  ◂ Edit deck
                </button>
              )}
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
            {canHost && (
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
                        <p className="pf-hint">
                          Tell {others.filter((x) => x.p.kind === "human").map((x) => x.p.name).join(", ") || opp.name} this code{duel ? "" : " (friends enter in seat order)"}. The game starts as soon as every seat is taken.
                        </p>
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
            )}
            {hostingStatus === "idle" && (duel || run.me !== 0) && (
              <div>
                <div className="pf-field">
                  <span>{duel ? "Or join your friend's room" : "Join the host's room"}</span>
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
                {friendOrder > 1 && <p className="pf-hint">Join after the friends in the seats before yours, so that everyone keeps their seat.</p>}
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
              {sides.map((lead) => (
                <button key={lead} type="button" className={`pf-btn small ${sameSide(run, lead, run.me) ? "" : "secondary"}`} disabled={busy} onClick={() => void claim(lead)}>
                  {sameSide(run, lead, run.me) ? (teams ? "We won" : "I won") : duel ? "I lost" : `${sideName(run, lead)} won`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── rewards ─────────────────────────────────────────────────────────────────

function StarterReward({ run, data, setRun }: { run: StarterRun; data: ProgData; setRun: (r: StarterRun) => void }) {
  const me = run.players[run.me];
  const r = me.reward;
  const [picked, setPicked] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [zoom, setZoom] = useState<ProgPrint | null>(null);
  const toPacks = () => setRun({ ...run, phase: "packs" });

  // What the AIs got (friends take theirs on their own devices).
  const oppNote = (() => {
    const notes = othersOf(run)
      .filter((x) => x.p.kind === "ai" && x.p.reward)
      .map(({ p: opp }) => {
        const o = opp.reward!;
        if (o.kind === "list") return `${opp.name} chose ${COLOR_LABEL[o.color ?? "C"]} and got ${o.list?.[0]?.n ?? "a card"} from The List.`;
        const card = o.picked ? data.byKey.get(o.picked)?.card.name : null;
        return `${opp.name} spun ${o.rarity ? RARITY_LABEL[o.rarity] : "the wheel"}${card ? ` and added a copy of ${card}` : ""}.`;
      });
    return notes.length ? notes.join(" ") : null;
  })();

  if (!r) {
    return (
      <Centered>
        <button type="button" className="pf-btn" onClick={toPacks}>
          To the boosters ▸
        </button>
      </Centered>
    );
  }

  if (r.kind === "list") {
    const card = r.done && r.color ? listCardFor(data, run, run.me, r.color) : null;
    return (
      <div className="pf-stage">
        <div className="pf-eyebrow">Defeat · consolation</div>
        <h1 className="pf-title">{r.done ? "From The List" : "Choose a colour"}</h1>
        {!r.done ? (
          <>
            <p className="pf-sub">You get one random card of that colour that was on The List.</p>
            <div className="pf-colors">
              {LIST_COLORS.map((c) => (
                <button key={c} type="button" style={{ background: PIP[c] }} onClick={() => setRun(claimStarterReward(data, run, c))}>
                  {COLOR_LABEL[c]}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="pf-listcards">
              {card ? (
                <div className={`pf-dealt${flipped ? " up" : ""}`}>
                  <div className={`pf-flip r${flipped ? " up" : ""}`} onClick={() => (flipped ? setZoom(card) : setFlipped(true))}>
                    <div className="face back">
                      <div className="pf-listback">
                        <i>✦</i>
                        <b>THE LIST</b>
                      </div>
                    </div>
                    <div className="face front">
                      <img src={printImage(card, "normal")} alt={card.card.name} />
                    </div>
                    <div className="burst" />
                  </div>
                  <div className="tag" style={{ color: "#c9b6ff" }}>{card.card.name}</div>
                </div>
              ) : (
                <p className="pf-hint">No playable List card of that colour — nothing this time.</p>
              )}
            </div>
            {oppNote && <p className="pf-hint" style={{ textAlign: "center" }}>{oppNote}</p>}
            <div className="pf-row">
              <button type="button" className="pf-btn" disabled={Boolean(card) && !flipped} onClick={toPacks}>
                {card && !flipped ? "Click the card to reveal it" : "To the boosters ▸"}
              </button>
            </div>
          </>
        )}
        {zoom && <CardZoom print={zoom} onClose={() => setZoom(null)} />}
      </div>
    );
  }

  const choices = (r.choices ?? []).map((k) => data.byKey.get(k)).filter((p): p is ProgPrint => Boolean(p));
  return (
    <div className="pf-stage">
      <div className="pf-eyebrow">Victory</div>
      <h1 className="pf-title">Wheel of Fortune</h1>
      <p className="pf-sub">One slice for every rarity in the deck you played. Wherever it stops, add one more copy of a card of that rarity.</p>
      <WheelOfFortune
        wheel={r.wheel ?? ["c"]}
        landing={r.rarity ?? "c"}
        spun={Boolean(r.spun) || r.done}
        onSpun={() => {
          const players = run.players.slice();
          players[run.me] = { ...me, reward: { ...r, spun: true } };
          setRun({ ...run, players });
        }}
      />
      {(r.spun || r.done) && (
        <>
          {r.done ? (
            <p className="pf-sub" style={{ marginTop: "1rem" }}>Added a copy of {data.byKey.get(r.picked ?? "")?.card.name ?? "a card"} to your deck.</p>
          ) : (
            <>
              <p className="pf-sub" style={{ marginTop: "1rem" }}>Pick the card to copy. Right-click to zoom.</p>
              <div className="pf-cardgrid">
                {choices.map((p) => (
                  <div
                    key={p.key}
                    className={`pf-gcard pick${picked === p.key ? " sel" : ""}`}
                    onClick={() => setPicked(p.key)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setZoom(p);
                    }}
                    title={p.card.name}
                  >
                    <img loading="lazy" src={printImage(p, "normal")} alt={p.card.name} />
                  </div>
                ))}
              </div>
            </>
          )}
          {oppNote && <p className="pf-hint" style={{ textAlign: "center" }}>{oppNote}</p>}
          <div className="pf-row">
            {r.done ? (
              <button type="button" className="pf-btn" onClick={toPacks}>
                To the boosters ▸
              </button>
            ) : (
              <button type="button" className="pf-btn" disabled={!picked && choices.length > 0} onClick={() => setRun(claimStarterReward(data, run, picked ?? ""))}>
                {choices.length === 0 ? "Continue ▸" : picked ? `Copy ${data.byKey.get(picked)?.card.name ?? "it"} ▸` : "Choose a card"}
              </button>
            )}
          </div>
        </>
      )}
      {zoom && <CardZoom print={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

// ── the booster grid ────────────────────────────────────────────────────────

function StarterPacks({
  run,
  data,
  setRun,
  say,
  onError,
  room,
}: {
  run: StarterRun;
  data: ProgData;
  setRun: (r: StarterRun) => void;
  say: (m: string) => void;
  onError: (e: string | null) => void;
  room: HubState;
}) {
  const [opening, setOpening] = useState<Pack | null>(null);
  const [busy, setBusy] = useState(false);
  const turn = picker(run);
  const myTurn = turn === run.me;
  const turnPlayer = turn === null ? null : run.players[turn];
  const humans = othersOf(run).filter((x) => x.p.kind === "human");
  const friend = humans.length > 0;
  const inRoom = run.mode === "friend" && !!room.room;
  // The AIs pick on the device that owns the table (the host, or the game vs AI): everyone else receives their picks.
  const aiAuthority = run.mode === "ai" || run.me === 0 || !inRoom;
  const aiTurn = turn !== null && turn !== run.me && turnPlayer?.kind === "ai";

  // Vs friends: every device tells the others its picks at once (through the room;
  // two players without a room: the direct link).
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("connecting");
  const [direct, setDirect] = useState<LinkState | null>(null);
  const [manual, setManual] = useState(false);
  const [skipSync, setSkipSync] = useState(false);
  const [slowLink, setSlowLink] = useState(false);
  const link = useRef<StarterLink | null>(null);
  const useDirect = friend && !inRoom && run.players.length === 2;
  useEffect(() => {
    if (!useDirect) return;
    const l = openStarterLink({
      runId: run.id,
      me: run.me as 0 | 1,
      createPeer: (id, config) => createPeer(id, { config }) as unknown as LinkPeer,
      iceConfig: () => fetchFreshTurnConfig(),
      onState: setDirect,
      onStatus: setLinkStatus,
    });
    link.current = l;
    return () => {
      l.close();
      link.current = null;
    };
  }, [useDirect, run.id, run.me]);
  useEffect(() => {
    if (!friend) return;
    const slow = window.setTimeout(() => setSlowLink(true), 20000);
    return () => window.clearTimeout(slow);
  }, [friend]);
  const picks: LinkPick[] = run.grid.flatMap((g, i) => (g.taker === null ? [] : [{ i, slot: g.taker, round: g.round }]));
  const picksSig = JSON.stringify(picks);
  const roomStatus = room.status;
  const roomSend = room.send;
  useEffect(() => {
    if (useDirect) link.current?.send({ run: run.id, game: run.game, picks });
    else if (inRoom) roomSend({ k: `picks${run.me}`, fwd: true, run: run.id, game: run.game, picks });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picksSig, linkStatus, roomStatus, run.id, run.game, useDirect, inRoom]);
  // What every other player's device knows.
  const remotes: LinkState[] = useDirect
    ? direct
      ? [direct]
      : []
    : humans
        .map((x) => room.latest[`picks${x.i}`] as unknown as LinkState | undefined)
        .filter((st): st is LinkState => !!st && st.run === run.id && Array.isArray(st.picks));
  const remoteSig = JSON.stringify(remotes.map((r) => r.picks));
  // Their picks: open the same (seeded) boosters into their collections here.
  useEffect(() => {
    if (!remotes.length || busy || opening) return;
    const seen = new Set<number>();
    const missing = remotes.flatMap((r) => r.picks).filter((p) => run.grid[p.i] && run.grid[p.i].taker === null && !seen.has(p.i) && (seen.add(p.i), true));
    if (!missing.length) return;
    let cancelled = false;
    setBusy(true);
    (async () => {
      let r = run;
      for (const p of missing) {
        r = (await takePack(data, r, p.i, p.slot)).run;
        if (p.round !== null) r.grid[p.i].round = p.round;
      }
      if (cancelled) return;
      setRun(r);
      const last = missing.filter((p) => p.slot !== run.me).pop();
      if (last) say(`${run.players[last.slot]?.name ?? "?"} took booster #${last.i + 1}`);
    })()
      .catch((err: unknown) => onError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteSig, run.grid, opening]);
  const waitingOther = turn !== null && turn !== run.me && !manual && (turnPlayer?.kind === "human" ? friend : !aiAuthority);
  const synced =
    !friend || skipSync || (remotes.length >= (useDirect ? 1 : humans.length) && remotes.every((r) => picks.every((p) => r.picks.some((q) => q.i === p.i))));

  // An AI picks on its own (after my booster animation, if any).
  useEffect(() => {
    if (!aiTurn || !aiAuthority || opening || turn === null) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      setBusy(true);
      aiTakePack(data, run, turn)
        .then((res) => {
          if (cancelled) return;
          say(`${run.players[turn].name} took booster #${res.index + 1}`);
          setRun(res.run);
        })
        .catch((err: unknown) => onError(err instanceof Error ? err.message : String(err)))
        .finally(() => setBusy(false));
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiTurn, aiAuthority, run.grid, opening]);

  const take = async (i: number) => {
    if (busy || turn === null) return;
    if (aiTurn && aiAuthority) return;
    setBusy(true);
    try {
      const res = await takePack(data, run, i, turn);
      setRun(res.run);
      if (myTurn && res.pack) setOpening(res.pack);
      else if (res.pack) say(`Marked: ${run.players[turn].name} took booster #${i + 1}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (opening) {
    return (
      <div className="pf-stage">
        <div className="pf-eyebrow">{opening.kind ? PRODUCT_LABEL[opening.kind] : "Booster"}</div>
        <h1 className="pf-title">{opening.set.name}</h1>
        <PackOpening packs={[opening]} onDone={() => setOpening(null)} />
      </div>
    );
  }

  const winnerName = run.lastWinner === null ? "" : run.players[run.lastWinner].name;
  const turnName = turnPlayer?.name ?? "";
  const linkOk = inRoom ? room.status === "connected" : linkStatus === "connected";
  const message =
    turn === null
      ? "Every booster of this round is open."
      : myTurn
        ? "Your pick — choose a booster and open it."
        : aiTurn || waitingOther
          ? `${turnName} is choosing…`
          : `Click the booster ${turnName} took.`;
  const order = Array.from({ length: run.players.length }, (_, k) => run.players[((run.lastWinner ?? 0) + k) % run.players.length].name);

  return (
    <div className="pf-stage" style={{ maxWidth: 1240 }}>
      <div className="pf-eyebrow">
        Boosters at stake · {run.players.length === 2 ? `${winnerName} picks first` : `order: ${order.join(" → ")}`}
        {friend && <span className={`pf-link ${linkOk ? "connected" : "connecting"}`}>{linkOk ? "● linked" : "○ linking…"}</span>}
      </div>
      <h1 className="pf-title">{message}</h1>
      <p className="pf-sub">The same grid stays for the whole run. Collector Boosters glow.</p>
      <div className={`pf-packwrap${waitingOther ? " waiting" : ""}`}>
        {waitingOther && (
          <div className="pf-waitveil">
            <div className="box">
              <div className="hourglass">⏳</div>
              <b>Waiting for {turnName}</b>
              <span>{linkOk ? "Their booster disappears from the grid as soon as it is chosen." : "Connecting… (the other players need this screen open too)"}</span>
              {(slowLink || !linkOk) && turnPlayer?.kind === "human" && (
                <button type="button" className="pf-btn-mini" onClick={() => setManual(true)}>
                  Can't connect? Mark their booster by hand
                </button>
              )}
            </div>
          </div>
        )}
        <div className="pf-packgrid">
          {run.grid.map((gp, i) => {
            const set = gridSet(data, gp);
            const taken = gp.taker !== null;
            return (
              <button
                key={i}
                type="button"
                className={`pf-packtile${gp.kind === "collector" ? " special" : ""}${taken ? " taken" : ""}`}
                style={packColors(gp.set)}
                disabled={taken || busy || turn === null || (aiTurn && aiAuthority) || waitingOther}
                onClick={() => void take(i)}
              >
                <div className="wrap">
                  <span className="num">#{i + 1}</span>
                  <div className="kind">{PRODUCT_LABEL[gp.kind]}</div>
                  <div className="set">{set?.name ?? gp.set.toUpperCase()}</div>
                  <div className="yr">{set?.year ?? ""}</div>
                </div>
                {taken && <span className="owner">{run.players[gp.taker!]?.name}</span>}
              </button>
            );
          })}
        </div>
      </div>
      {turn === null && (
        <div className="pf-row">
          {!synced && (
            <span className="pf-hint">
              Sending your picks to the others…{" "}
              <button type="button" className="pf-btn-mini" onClick={() => setSkipSync(true)}>
                Continue anyway
              </button>
            </span>
          )}
          <button type="button" className="pf-btn" disabled={!synced} onClick={() => setRun({ ...run, phase: "build" })}>
            Deck building ▸
          </button>
        </div>
      )}
    </div>
  );
}

// ── end ─────────────────────────────────────────────────────────────────────

function StarterEnd({ run, onNew }: { run: StarterRun; onNew: () => void }) {
  const sides = [...new Set(run.players.map((_, i) => sideLead(run, i)))]
    .map((lead) => ({ lead, name: sideName(run, lead), wins: run.players[lead].wins, losses: run.players[lead].losses }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  const champion = sides.length > 1 && sides[0].wins > sides[1].wins ? sides[0] : null;
  return (
    <div className="pf-stage">
      <div className="pf-eyebrow">{run.history.length} games</div>
      <h1 className="pf-title">{champion ? `${champion.name} win${starterTeams(run) ? "" : "s"} the Starter` : "A perfect tie"}</h1>
      <p className="pf-sub">{sides.map((x) => `${x.name} ${x.wins}–${x.losses}`).join(" · ")}</p>
      <div className="pf-panel" style={{ maxWidth: 520, margin: "0 auto" }}>
        <table className="pf-table">
          <thead>
            <tr>
              <th>Game</th>
              <th>Winner</th>
            </tr>
          </thead>
          <tbody>
            {run.history.map((h) => (
              <tr key={h.game}>
                <td>{h.game + 1}</td>
                <td>{h.winner === null ? "—" : sideName(run, h.winner)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pf-row">
        <button type="button" className="pf-btn" onClick={onNew}>
          New Starter ▸
        </button>
      </div>
    </div>
  );
}

// ── save / load ─────────────────────────────────────────────────────────────

function StarterSave({
  run,
  share,
  onClose,
  onLoaded,
  onAbandon,
  say,
}: {
  run: StarterRun | null;
  share: boolean;
  onClose: () => void;
  onLoaded: (r: StarterRun) => void;
  onAbandon: () => void;
  say: (m: string) => void;
}) {
  const [code, setCode] = useState("");
  const [loadText, setLoadText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const me = run ? run.players[run.me] : null;
  const list = me ? exportList(me) : "";
  useEffect(() => {
    if (run) void encodeStarter(run).then(setCode);
  }, [run]);
  const copy = (text: string, msg: string) => void navigator.clipboard?.writeText(text).then(() => say(msg)).catch(() => say("Copy failed — select and copy by hand"));
  return (
    <div className="pf-modal" onClick={onClose}>
      <div className="pf-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{share ? "Invite your friend" : "Save / Load"}</h2>
        {share && <p style={{ textAlign: "center" }}>Send this code to your friend: Starter → Save / Load → Load, then they pick their name.</p>}
        {run && (
          <>
            <h3>Starter code</h3>
            <textarea readOnly value={code || "Encoding…"} />
            <div className="pf-row" style={{ marginTop: "0.6rem" }}>
              <button type="button" className="pf-btn small" disabled={!code} onClick={() => copy(code, "Code copied")}>
                Copy code
              </button>
              <button type="button" className="pf-btn secondary small" disabled={!code} onClick={() => download(`starter-game${run.game + 1}.txt`, code)}>
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
            <h3>Load a Starter code</h3>
            <textarea placeholder="STAR1-…" value={loadText} onChange={(e) => setLoadText(e.target.value)} />
            <div className="pf-row" style={{ marginTop: "0.6rem" }}>
              <button
                type="button"
                className="pf-btn small"
                disabled={!loadText.trim()}
                onClick={() => {
                  setErr(null);
                  decodeStarter(loadText)
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
                  <button type="button" className="pf-btn danger small" onClick={() => window.confirm("Abandon this Starter? Copy the code first if you may want it back.") && onAbandon()}>
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
