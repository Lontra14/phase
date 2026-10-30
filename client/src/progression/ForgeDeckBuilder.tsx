// Rogue Forge deck builder, ported from the roguelike's deck viewer:
// piles by mana value / colour / type / rarity, drag cards between piles,
// right-click (or drag) to the sideboard and back, grid view of the whole
// collection, stats + mana curve, basic land tray, ⚡ Auto-build.

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { autoBuild } from "./autobuild";
import type { ProgCard, ProgData, ProgPrint, Rarity } from "./data";
import { RARITY_COLOR, RARITY_LABEL, colorsOf, isLandCard, printImage } from "./data";
import type { Basic, Basics, PlayerState } from "./run";
import { BASICS } from "./run";

type GroupBy = "cmc" | "color" | "type" | "rarity";
type SortBy = "mv" | "alpha" | "acq";

interface Item {
  i: number;
  name: string;
  print: ProgPrint | null;
  card: ProgCard | null;
  rarity: Rarity;
}

interface Pile {
  key: string;
  label: string;
  items: number[];
}

const COLOR_CHIPS = [
  { k: "W", label: "White", sw: "#f4ecd4" },
  { k: "U", label: "Blue", sw: "#4a90d9" },
  { k: "B", label: "Black", sw: "#a487c4" },
  { k: "R", label: "Red", sw: "#d6503e" },
  { k: "G", label: "Green", sw: "#4fb277" },
  { k: "C", label: "Colorless", sw: "#b9b2a6" },
];
const TYPES = ["creature", "instant", "sorcery", "artifact", "enchantment", "planeswalker", "land"];
const COLOR_NAME: Record<string, string> = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
const BASIC_IMG = (b: Basic) => `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(b)}&format=image&version=normal`;

function typeLine(item: Item): string {
  return (item.card?.type ?? "").toLowerCase();
}
function mv(item: Item): number {
  return item.card?.cmc ?? 0;
}

function groupKey(item: Item, g: GroupBy): string {
  if (g === "cmc") return item.card && isLandCard(item.card) ? "Land" : String(Math.min(7, Math.round(mv(item))));
  if (g === "color") {
    const cols = item.card ? colorsOf(item.card) : [];
    if (!cols.length) return "Colorless";
    if (cols.length > 1) return "Multicolor";
    return COLOR_NAME[cols[0]] ?? cols[0];
  }
  if (g === "rarity") return RARITY_LABEL[item.rarity];
  const t = typeLine(item);
  for (const tp of ["creature", "land", "planeswalker", "instant", "sorcery", "artifact", "enchantment", "battle"]) {
    if (t.includes(tp)) return tp[0].toUpperCase() + tp.slice(1);
  }
  return "Other";
}

function groupRank(g: GroupBy): (a: string, b: string) => number {
  if (g === "cmc") return (a, b) => (a === "Land" ? 99 : Number(a)) - (b === "Land" ? 99 : Number(b));
  if (g === "rarity") {
    const o: Record<string, number> = { Mythic: 0, Rare: 1, Uncommon: 2, Common: 3, Special: 4, Bonus: 5 };
    return (a, b) => (o[a] ?? 9) - (o[b] ?? 9);
  }
  if (g === "color") {
    const o: Record<string, number> = { White: 0, Blue: 1, Black: 2, Red: 3, Green: 4, Multicolor: 5, Colorless: 6 };
    return (a, b) => (o[a] ?? 9) - (o[b] ?? 9);
  }
  return (a, b) => a.localeCompare(b);
}

function pileLabel(key: string, g: GroupBy): string {
  if (g !== "cmc" || key === "Land") return key;
  return key === "7" ? "7+ mana" : `${key} mana`;
}

interface Props {
  data: ProgData;
  player: PlayerState;
  onChange: (main: number[], basics: Basics) => void;
  title?: string;
  /** Extra buttons on the right of the header (Ready, Export…). */
  actions?: ReactNode;
  minDeck?: number;
}

export function ForgeDeckBuilder({ data, player, onChange, title = "Deck", actions, minDeck = 40 }: Props) {
  const pool = useMemo(() => player.pool ?? [], [player.pool]);
  const items = useMemo<Item[]>(
    () =>
      pool.map((o, i) => {
        const print = data.byKey.get(o.k) ?? null;
        return { i, name: o.n, print, card: print?.card ?? null, rarity: print?.rarity ?? "c" };
      }),
    [pool, data],
  );
  const mainSet = useMemo(() => new Set(player.main), [player.main]);

  const [groupBy, setGroupBy] = useState<GroupBy>("cmc");
  const [sortBy, setSortBy] = useState<SortBy>("mv");
  const [colors, setColors] = useState<Set<string>>(new Set());
  const [types, setTypes] = useState<Set<string>>(new Set());
  const [rarities, setRarities] = useState<Set<Rarity>>(new Set());
  const [view, setView] = useState<"piles" | "grid">("piles");
  const [landTray, setLandTray] = useState(player.main.length > 0);
  const [zoom, setZoom] = useState<Item | null>(null);
  const [piles, setPiles] = useState<Pile[]>([]);
  const [peek, setPeek] = useState<{ pile: number; idx: number } | null>(null);
  const [overPile, setOverPile] = useState<string | null>(null);

  const matches = (it: Item) => {
    if (colors.size) {
      const cols = it.card ? colorsOf(it.card) : [];
      if (![...colors].some((k) => (k === "C" ? cols.length === 0 : cols.includes(k)))) return false;
    }
    if (types.size && ![...types].some((t) => typeLine(it).includes(t))) return false;
    if (rarities.size && !rarities.has(it.rarity)) return false;
    return true;
  };

  const cmp = (a: Item, b: Item) => {
    if (sortBy === "alpha") return a.name.localeCompare(b.name);
    if (sortBy === "acq") return a.i - b.i;
    return mv(a) - mv(b) || a.name.localeCompare(b.name);
  };

  // Rebuild piles from the main deck whenever grouping, sorting, filters or the
  // deck's membership change. Manual drags only reorder until then.
  const filterKey = `${groupBy}|${sortBy}|${[...colors].join("")}|${[...types].join(",")}|${[...rarities].join("")}`;
  const lastKey = useRef<string>("");
  useEffect(() => {
    const visible = items.filter((it) => mainSet.has(it.i) && matches(it));
    setPiles((prev) => {
      if (lastKey.current === filterKey && prev.length) {
        // Keep the user's arrangement; drop removed cards, append new ones to their group.
        const present = new Set(visible.map((it) => it.i));
        const placed = new Set<number>();
        const next = prev.map((p) => ({ ...p, items: p.items.filter((i) => present.has(i) && !placed.has(i) && placed.add(i)) }));
        for (const it of visible) {
          if (placed.has(it.i)) continue;
          const key = groupKey(it, groupBy);
          let pile = next.find((p) => p.key === key);
          if (!pile) {
            pile = { key, label: pileLabel(key, groupBy), items: [] };
            next.push(pile);
            next.sort((a, b) => groupRank(groupBy)(a.key, b.key));
          }
          pile.items.push(it.i);
        }
        return next.filter((p) => p.items.length > 0);
      }
      lastKey.current = filterKey;
      const groups = new Map<string, Item[]>();
      for (const it of visible) {
        const key = groupKey(it, groupBy);
        const arr = groups.get(key);
        if (arr) arr.push(it);
        else groups.set(key, [it]);
      }
      return [...groups.keys()]
        .sort(groupRank(groupBy))
        .map((key) => ({ key, label: pileLabel(key, groupBy), items: groups.get(key)!.sort(cmp).map((it) => it.i) }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, mainSet, filterKey]);

  const setMain = (next: number[]) => onChange([...new Set(next)].sort((a, b) => a - b), player.basics);
  const toSide = (i: number) => setMain(player.main.filter((m) => m !== i));
  const toMain = (i: number) => setMain([...player.main, i]);
  const setBasic = (b: Basic, d: number) => onChange(player.main, { ...player.basics, [b]: Math.max(0, (player.basics[b] ?? 0) + d) });

  const basicsTotal = BASICS.reduce((t, b) => t + (player.basics[b] ?? 0), 0) + (player.basics.Wastes ?? 0);
  const mainCount = player.main.length;
  const total = mainCount + basicsTotal;

  // ── stats ──
  const stats = useMemo(() => {
    const s = {
      colors: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 } as Record<string, number>,
      rar: {} as Record<string, number>,
      types: {} as Record<string, number>,
      curve: [0, 0, 0, 0, 0, 0, 0, 0],
      creatures: 0,
      lands: basicsTotal,
    };
    for (const i of player.main) {
      const it = items[i];
      if (!it) continue;
      const cols = it.card ? colorsOf(it.card) : [];
      if (cols.length) cols.forEach((c) => (s.colors[c] += 1));
      else s.colors.C += 1;
      s.rar[it.rarity] = (s.rar[it.rarity] ?? 0) + 1;
      for (const t of TYPES) if (typeLine(it).includes(t)) s.types[t] = (s.types[t] ?? 0) + 1;
      if (it.card && isLandCard(it.card)) s.lands += 1;
      else s.curve[Math.min(7, Math.round(mv(it)))] += 1;
    }
    return s;
  }, [player.main, items, basicsTotal]);
  const curveMax = Math.max(1, ...stats.curve);

  // ── drag & drop ──
  const drag = useRef<{ i: number; from: "main" | "side"; ghost: HTMLDivElement | null; moved: boolean; sx: number; sy: number } | null>(null);
  const startDrag = (e: ReactPointerEvent, it: Item, from: "main" | "side") => {
    if (e.button !== 0) return;
    e.preventDefault();
    drag.current = { i: it.i, from, ghost: null, moved: false, sx: e.clientX, sy: e.clientY };
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (!d.moved && Math.abs(ev.clientX - d.sx) + Math.abs(ev.clientY - d.sy) > 6) {
        d.moved = true;
        const g = document.createElement("div");
        g.className = "pf-ghost";
        const src = printImage(it.print, "normal");
        if (src) g.style.backgroundImage = `url("${src}")`;
        else g.textContent = it.name;
        document.body.appendChild(g);
        d.ghost = g;
      }
      if (d.moved && d.ghost) {
        d.ghost.style.left = `${ev.clientX - 70}px`;
        d.ghost.style.top = `${ev.clientY - 30}px`;
        const target = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest("[data-drop]") as HTMLElement | null;
        setOverPile(target?.dataset.drop ?? null);
      }
    };
    const up = (ev: PointerEvent) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      const d = drag.current;
      drag.current = null;
      setOverPile(null);
      if (!d) return;
      d.ghost?.remove();
      if (!d.moved) {
        setZoom(it);
        return;
      }
      const target = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest("[data-drop]") as HTMLElement | null;
      const drop = target?.dataset.drop;
      if (!drop) return;
      if (drop === "side") {
        if (d.from === "main") toSide(d.i);
        return;
      }
      const pileIdx = Number(drop.slice(5));
      if (d.from === "side") {
        toMain(d.i);
        return;
      }
      // Reorder within / across piles (visual arrangement only).
      setPiles((prev) => {
        const next = prev.map((p) => ({ ...p, items: p.items.filter((x) => x !== d.i) }));
        const pile = next[pileIdx];
        if (!pile) return prev;
        let at = pile.items.length;
        const body = target?.querySelectorAll(".pf-pile-card");
        if (body) {
          for (let k = 0; k < body.length; k++) {
            const r = (body[k] as HTMLElement).getBoundingClientRect();
            if (ev.clientY < r.top + 40) {
              at = k;
              break;
            }
          }
        }
        pile.items.splice(at, 0, d.i);
        return next;
      });
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  const sideItems = items.filter((it) => !mainSet.has(it.i) && matches(it)).sort(cmp);
  const gridItems = items.filter(matches).sort(cmp);

  const toggle = <T,>(set: Set<T>, v: T, apply: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    apply(next);
  };

  const runAuto = () => {
    const built = autoBuild(pool, data);
    onChange(built.main, built.basics);
    setLandTray(true);
  };

  return (
    <div className="pf-viewer">
      <div className="pf-viewer-head">
        <h2>
          {title} — {mainCount} cards{basicsTotal ? ` + ${basicsTotal} basics = ${total}` : ""}
          <span className={total >= minDeck ? "pf-ok" : "pf-warn"}>{total >= minDeck ? " ✓" : ` (min ${minDeck})`}</span>
        </h2>
        <div className="pf-head-actions">{actions}</div>
      </div>
      <div className="pf-vctrl">
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
          <option value="cmc">Group: Mana value</option>
          <option value="color">Group: Color</option>
          <option value="type">Group: Type</option>
          <option value="rarity">Group: Rarity</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
          <option value="mv">Sort: Mana cost</option>
          <option value="alpha">Sort: A → Z</option>
          <option value="acq">Sort: Acquired</option>
        </select>
        {COLOR_CHIPS.map((c) => (
          <button key={c.k} type="button" title={c.label} className={`pf-vchip${colors.has(c.k) ? " sel" : ""}`} onClick={() => toggle(colors, c.k, setColors)}>
            <span className="sw" style={{ background: c.sw }} />
            {c.k}
          </button>
        ))}
        {TYPES.map((t) => (
          <button key={t} type="button" title={t} className={`pf-vchip${types.has(t) ? " sel" : ""}`} onClick={() => toggle(types, t, setTypes)}>
            {t.slice(0, 3).replace(/^\w/, (m) => m.toUpperCase())}
          </button>
        ))}
        {(["c", "u", "r", "m"] as Rarity[]).map((r) => (
          <button key={r} type="button" title={RARITY_LABEL[r]} className={`pf-vchip${rarities.has(r) ? " sel" : ""}`} onClick={() => toggle(rarities, r, setRarities)}>
            <span className="sw" style={{ background: RARITY_COLOR[r] }} />
            {r.toUpperCase()}
          </button>
        ))}
        <button type="button" className="pf-vchip" onClick={() => setView(view === "piles" ? "grid" : "piles")}>
          {view === "piles" ? "▤ Collection grid" : "▦ Deck piles"}
        </button>
        <button
          type="button"
          className="pf-vchip"
          onClick={() => {
            setColors(new Set());
            setTypes(new Set());
            setRarities(new Set());
          }}
        >
          Reset
        </button>
        <button type="button" className={`pf-vchip${landTray ? " sel" : ""}`} onClick={() => setLandTray(!landTray)}>
          ✚ Add land
        </button>
        <button type="button" className="pf-vchip" title="Pick a playable 40-card deck from your collection" onClick={runAuto}>
          ⚡ Auto-build
        </button>
        <button type="button" className="pf-vchip" title="Move every card to the sideboard" onClick={() => onChange([], { ...player.basics, Plains: 0, Island: 0, Swamp: 0, Mountain: 0, Forest: 0, Wastes: 0 })}>
          Clear
        </button>
      </div>
      <div className="pf-vbody">
        <div className="pf-vstats">
          <h3>Deck</h3>
          <div className="row"><span>Cards</span><span>{total}</span></div>
          <div className="row"><span>Lands</span><span>{stats.lands}</span></div>
          <div className="row"><span>Collection</span><span>{pool.length}</span></div>
          <h3>Colors</h3>
          {COLOR_CHIPS.map((c) => (
            <div className="row" key={c.k}><span>{c.label}</span><span>{stats.colors[c.k]}</span></div>
          ))}
          <h3>Rarity</h3>
          {(["m", "r", "u", "c", "s", "b"] as Rarity[]).filter((r) => stats.rar[r]).map((r) => (
            <div className="row" key={r}><span style={{ color: RARITY_COLOR[r] }}>{RARITY_LABEL[r]}</span><span>{stats.rar[r]}</span></div>
          ))}
          <h3>Types</h3>
          {Object.keys(stats.types).length === 0 ? <div className="row"><span>—</span><span /></div> : null}
          {TYPES.filter((t) => stats.types[t]).map((t) => (
            <div className="row" key={t}><span style={{ textTransform: "capitalize" }}>{t}</span><span>{stats.types[t]}</span></div>
          ))}
          <h3>Mana curve</h3>
          {stats.curve.map((n, k) => (
            <div key={k}>
              <div className="row"><span>{k === 7 ? "7+" : k} mana</span><span>{n}</span></div>
              <div className="bar"><i style={{ width: `${Math.round((n / curveMax) * 100)}%` }} /></div>
            </div>
          ))}
        </div>

        <div className="pf-varea">
          {landTray && (
            <div className="pf-land-tray">
              <div className="lt-head">
                <span>⛰ Basic lands</span>
                <span className="lt-sub">free and unlimited</span>
              </div>
              <div className="lt-cards">
                {BASICS.map((b) => (
                  <div key={b} className={`lt-card${player.basics[b] ? " has" : ""}`}>
                    <div className="lt-img">
                      <img loading="lazy" src={BASIC_IMG(b)} alt={b} />
                      {player.basics[b] ? <span className="lt-q">×{player.basics[b]}</span> : null}
                    </div>
                    <div className="lt-ctl">
                      <button type="button" onClick={() => setBasic(b, -1)}>−</button>
                      <b>{b}</b>
                      <button type="button" onClick={() => setBasic(b, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === "grid" ? (
            <>
              <p className="pf-hint">Whole collection. Click a card to move it in or out of the deck (gold = in the deck); right-click to zoom.</p>
              <div className="pf-vgrid">
                {gridItems.map((it) => (
                  <div
                    key={it.i}
                    className={`pf-vcard${mainSet.has(it.i) ? " in" : ""}`}
                    onClick={() => (mainSet.has(it.i) ? toSide(it.i) : toMain(it.i))}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setZoom(it);
                    }}
                  >
                    {it.print ? <img loading="lazy" src={printImage(it.print, "normal")} alt={it.name} /> : <div className="ph">{it.name}</div>}
                    <span className="rb" style={{ background: RARITY_COLOR[it.rarity] }} />
                  </div>
                ))}
              </div>
              {!gridItems.length && <p className="pf-hint">No cards match these filters.</p>}
            </>
          ) : (
            <div className="pf-piles">
              {piles.map((pile, pi) => (
                <div className="pf-pile" key={pile.key}>
                  <div className="pf-pile-head">
                    <span>{pile.label}</span>
                    <span>{pile.items.length}</span>
                  </div>
                  <div
                    className={`pf-pile-body${overPile === `pile:${pi}` ? " over" : ""}`}
                    data-drop={`pile:${pi}`}
                    onPointerMove={(e) => {
                      if (drag.current?.moved) return;
                      const r = e.currentTarget.getBoundingClientRect();
                      const idx = Math.max(0, Math.min(pile.items.length - 1, Math.floor((e.clientY - r.top) / 40)));
                      if (!peek || peek.pile !== pi || peek.idx !== idx) setPeek({ pile: pi, idx });
                    }}
                    onPointerLeave={() => setPeek(null)}
                  >
                    {pile.items.map((i, k) => {
                      const it = items[i];
                      if (!it) return null;
                      return (
                        <div
                          key={i}
                          className={`pf-pile-card${peek && peek.pile === pi && peek.idx === k ? " peek" : ""}`}
                          onPointerDown={(e) => startDrag(e, it, "main")}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            toSide(i);
                          }}
                        >
                          {it.print ? <img loading="lazy" src={printImage(it.print, "normal")} alt={it.name} draggable={false} /> : <div className="pf-pile-ph">{it.name}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!piles.length && (
                <p className="pf-hint">
                  The deck is empty. Drag cards in from the sideboard, right-click them there, use the collection grid or press ⚡ Auto-build.
                </p>
              )}
            </div>
          )}
        </div>

        <div className={`pf-vside${overPile === "side" ? " over" : ""}`} data-drop="side">
          <div className="pf-vside-head">
            <span>Sideboard</span>
            <span>{sideItems.length}</span>
          </div>
          {!sideItems.length && <p className="pf-hint">Right-click a deck card to set it aside here. Right-click one here (or drag it) to put it in the deck.</p>}
          {sideItems.map((it) => (
            <div
              key={it.i}
              className="pf-vside-card"
              title="Right-click: add to deck · Click: zoom"
              onPointerDown={(e) => startDrag(e, it, "side")}
              onContextMenu={(e) => {
                e.preventDefault();
                toMain(it.i);
              }}
            >
              {it.print ? <img loading="lazy" src={printImage(it.print, "art_crop")} alt="" draggable={false} /> : <i />}
              <span>{it.name}</span>
              <em style={{ background: RARITY_COLOR[it.rarity] }} />
            </div>
          ))}
        </div>
      </div>

      {zoom && (
        <div className="pf-modal" onClick={() => setZoom(null)}>
          <div className="pf-zoom" onClick={(e) => e.stopPropagation()}>
            {zoom.print ? <img src={printImage(zoom.print, "large")} alt={zoom.name} /> : <div className="pf-zoom-ph">{zoom.name}</div>}
            <div className="pf-zoom-meta">
              <b>{zoom.name}</b>
              <span style={{ color: RARITY_COLOR[zoom.rarity] }}>
                {RARITY_LABEL[zoom.rarity]}
                {zoom.print?.set ? ` · ${zoom.print.set.name} (${zoom.print.set.year})` : zoom.print ? " · The List" : ""}
              </span>
              <div className="pf-zoom-btns">
                {mainSet.has(zoom.i) ? (
                  <button type="button" className="pf-btn secondary" onClick={() => { toSide(zoom.i); setZoom(null); }}>To sideboard</button>
                ) : (
                  <button type="button" className="pf-btn" onClick={() => { toMain(zoom.i); setZoom(null); }}>Add to deck</button>
                )}
                <button type="button" className="pf-btn secondary" onClick={() => setZoom(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
