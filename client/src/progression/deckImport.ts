// Your own decklist, in every mode (Chess, Starter, Test match) instead of a
// listed deck. Any common text format (MTGA, MTGO, Moxfield, "4 Card Name").
//  - a card with set + collector number keeps that printing; otherwise the
//    newest printing in the index is used;
//  - basic lands go to the usual basic-land tray (foldBasics), with the art of
//    the printing the list names;
//  - cards the rules engine does not know block the list; cards it only
//    partly implements are listed as "may not work";
//  - Commander: one or two commanders (a "Commander" section of the list, or
//    picked from the cards the engine accepts as commanders). No format legality
//    (deck size, singleton, colours, banned cards): friendly games, any cards.

import { detectAndParseDeck, type DeckEntry } from "../services/deckParser";
import type { ProgData, ProgPrint } from "./data";
import { ensureExtraCards, extraPrint, newestPrintByName, resolveSupport, supportOf } from "./data";
import { getCardFaceData } from "../services/engineRuntime";
import type { Owned } from "./run";
import type { StarterDeck } from "./starterData";

export interface ImportedDeck {
  id: string;
  name: string;
  /** Main deck (basic lands included, commanders excluded). */
  owned: Owned[];
  commanders: string[];
  /** Legendary cards of the list that could lead it. */
  candidates: string[];
  /** For each possible first commander, the cards that can join it (partner, background…). */
  pairs: Record<string, string[]>;
  colors: string[];
  face: ProgPrint | null;
  /** Names the rules engine does not know (the list cannot be used). */
  unknown: string[];
  /** Cards the engine only partly implements. */
  partial: string[];
  /** Commander problems (the list cannot be used as a commander deck). */
  issues: string[];
  /** Main-deck card count (basics included, commanders excluded). */
  size: number;
}

const BASIC_RE = /^(Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest|Wastes)$/i;

// Legendary creatures (and Backgrounds) only: the rules engine refuses any other commander.
const isCommanderType = (type: string) => (/Legendary/.test(type.split("//")[0]) && /Creature/.test(type.split("//")[0])) || /\bBackground\b/.test(type);
const PARTNER_KINDS = ["Partner", "PartnerWith", "FriendsForever", "ChooseABackground", "DoctorsCompanion", "CharacterSelect"];
const kwName = (k: unknown): string => (typeof k === "string" ? k : k && typeof k === "object" ? Object.keys(k as object)[0] ?? "" : "");

interface CommanderInfo {
  ok: boolean;
  background: boolean;
  kind: string | null;
  type: string;
}
/**
 * Whether a card can lead a commander deck, as the rules engine decides it (its
 * `is_commander`: legendary creatures, vehicles, backgrounds, "can be your
 * commander"…), and how it can pair (partner, background, friends forever…).
 */
async function commanderInfo(name: string, type: string): Promise<CommanderInfo> {
  type EngineFace = { is_commander?: boolean; keywords?: unknown[] } | null;
  let face: EngineFace = null;
  try {
    face = (await getCardFaceData(name)) as EngineFace;
  } catch {
    face = null;
  }
  const kws = (face?.keywords ?? []).map(kwName);
  const background = /\bBackground\b/.test(type) && !/Creature/.test(type.split("//")[0]);
  // The engine sends `is_commander` only when true; legendary creatures always qualify.
  const ok = face?.is_commander === true || (isCommanderType(type) && !background);
  return { ok, background, kind: PARTNER_KINDS.find((k) => kws.includes(k)) ?? null, type };
}

/** The cards that can be the second commander next to `first`. */
function partnersOf(first: CommanderInfo, all: Map<string, CommanderInfo>, self: string): string[] {
  const out: string[] = [];
  for (const [n, c] of all) {
    if (n === self || !c.ok) continue;
    const fits =
      (first.kind === "ChooseABackground" && c.background) ||
      (first.background && c.kind === "ChooseABackground") ||
      (!c.background && first.kind !== null && first.kind !== "ChooseABackground" && first.kind !== "DoctorsCompanion" && c.kind === first.kind) ||
      (first.kind === "DoctorsCompanion" && /\bDoctor\b/.test(c.type)) ||
      (/\bDoctor\b/.test(first.type) && c.kind === "DoctorsCompanion");
    if (fits) out.push(n);
  }
  return out;
}

function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/**
 * Read a decklist. `commander`: check it as a commander deck; `pick` names the
 * commander(s) when the list has no Commander section.
 */
export async function importDeckList(data: ProgData, text: string, opts: { commander: boolean; pick?: string[]; name?: string }): Promise<ImportedDeck | null> {
  if (!text.trim()) return null;
  const parsed = detectAndParseDeck(text);
  const main: DeckEntry[] = parsed.main.slice();
  const listed = (parsed.commander ?? []).slice();
  if (!main.length && !listed.length) return null;

  const names = [...new Set([...main.map((e) => e.name), ...listed, ...(opts.pick ?? [])])];
  await resolveSupport(names);
  const canon = (n: string) => supportOf(n)?.canonical ?? null;
  const unknown = names.filter((n) => !canon(n));
  const partial = names.filter((n) => canon(n) && !supportOf(n)?.full && !BASIC_RE.test(n));

  // Printings: from the index, else Scryfall's (Commander-only cards, Secret Lair…).
  // Each line keeps its own printing (two lines of the same card can name two sets).
  const printOf = new Map<string, ProgPrint | null>();
  const lineKey = (e: DeckEntry) => `${e.name}|${e.sourcePrinting?.setCode ?? ""}|${e.sourcePrinting?.collectorNumber ?? ""}`;
  const missing: string[] = [];
  for (const e of main) {
    const lk = lineKey(e);
    if (printOf.has(lk) || !canon(e.name)) continue;
    const sp = e.sourcePrinting;
    const p = newestPrintByName(data, e.name, sp?.setCode, sp?.collectorNumber) ?? newestPrintByName(data, canon(e.name)!);
    printOf.set(lk, p ?? null);
    if (!printOf.has(e.name) || !printOf.get(e.name)) printOf.set(e.name, p ?? null);
    if (!p) missing.push(e.name);
  }
  for (const n of [...listed, ...(opts.pick ?? [])]) if (canon(n) && !printOf.get(n)) {
    const p = newestPrintByName(data, n) ?? newestPrintByName(data, canon(n)!);
    printOf.set(n, p ?? null);
    if (!p) missing.push(n);
  }
  if (missing.length) {
    await ensureExtraCards(missing);
    for (const n of new Set(missing)) {
      const p = extraPrint(n) ?? extraPrint(canon(n)!) ?? null;
      for (const k of printOf.keys()) if ((k === n || k.startsWith(`${n}|`)) && !printOf.get(k)) printOf.set(k, p);
    }
  }

  const typeOf = (n: string) => printOf.get(n)?.card.type ?? "";
  // Commander candidates: only what the rules engine accepts (asked for the legendary
  // cards, the listed commanders and the cards outside the index).
  const info = new Map<string, CommanderInfo>();
  for (const n of [...new Set([...listed, ...(opts.pick ?? []), ...main.map((e) => e.name)])]) {
    const c = canon(n);
    if (!c) continue;
    const t = typeOf(n);
    if (!/Legendary|Background/.test(t) && t && !listed.includes(n) && !(opts.pick ?? []).includes(n)) continue;
    info.set(n, await commanderInfo(c, t));
  }
  const candidates = [...info.entries()].filter(([, c]) => c.ok && !c.background).map(([n]) => n);
  const pairs: Record<string, string[]> = {};
  for (const n of candidates) {
    const p = partnersOf(info.get(n)!, info, n);
    if (p.length) pairs[n] = p;
  }

  // Commanders: the list's Commander section, else the player's pick.
  let commanders: string[] = [];
  if (opts.commander) commanders = (listed.length ? listed : opts.pick ?? []).filter((n) => canon(n)).slice(0, 2);
  const left = new Map(commanders.map((n) => [n.toLowerCase(), 1]));

  const owned: Owned[] = [];
  const counts = new Map<string, number>();
  for (const e of main) {
    const c = canon(e.name);
    if (!c) continue;
    let count = e.count;
    const k = e.name.toLowerCase();
    if (left.get(k)) {
      // The commander is in the command zone, not in the deck.
      count -= 1;
      left.set(k, 0);
    }
    if (count <= 0) continue;
    const p = printOf.get(lineKey(e)) ?? printOf.get(e.name);
    for (let i = 0; i < count; i++) owned.push({ k: p?.key ?? `name:${c}`, n: c });
    counts.set(c, (counts.get(c) ?? 0) + count);
  }

  const issues: string[] = [];
  if (opts.commander) {
    if (!commanders.length) issues.push(candidates.length ? "Choose the commander." : "No legendary creature in the list to be its commander.");
    // Games use Freeform Commander: any card that can be cast may lead a deck (the
    // picker still offers only real commanders); a land cannot.
    if (commanders[0] && /\bLand\b/.test(typeOf(commanders[0]).split("//")[0])) issues.push(`${commanders[0]} is a land: it can't be a commander.`);
    if (commanders[1] && !(pairs[commanders[0]] ?? []).includes(commanders[1])) issues.push(`${commanders[0]} and ${commanders[1]} can't be commanders together (they need Partner, a Background…).`);
  }

  const colorSet = new Set<string>();
  for (const n of [...commanders, ...counts.keys()]) for (const c of printOf.get(n)?.card.colors ?? data.byName.get(n)?.[0]?.card.colors ?? "") if ("WUBRG".includes(c)) colorSet.add(c);
  const face =
    (commanders[0] ? printOf.get(commanders[0]) : null) ??
    owned.map((o) => data.byKey.get(o.k)).find((p) => p && !/Land/.test(p.card.type)) ??
    null;
  const firstLine = text.split(/\r?\n/).find((l) => /^(name|deck)\s*[:=]/i.test(l.trim()));
  const name = opts.name || (firstLine ? firstLine.split(/[:=]/).slice(1).join(":").trim() : "") || (commanders.length ? commanders.join(" & ") : "Your list");
  return {
    id: `custom:${hash(JSON.stringify([owned, commanders]))}`,
    name,
    owned,
    commanders,
    candidates,
    pairs,
    colors: ["W", "U", "B", "R", "G"].filter((c) => colorSet.has(c)),
    face,
    unknown,
    partial,
    issues,
    size: owned.length,
  };
}

/** The imported list as a deck of the mode pages (Starter precon shape). */
export function importedDeck(d: ImportedDeck, commander: boolean): StarterDeck {
  const keys = new Map<string, number>();
  for (const o of d.owned) keys.set(o.k, (keys.get(o.k) ?? 0) + 1);
  return {
    id: d.id,
    code: "custom",
    name: d.name,
    type: commander ? "Your commander deck" : "Your list",
    date: "",
    year: new Date().getFullYear(),
    cards: [...keys.entries()].map(([key, count]) => ({ key, count })),
    colors: d.colors,
    face: d.face,
    custom: true,
    owned: d.owned,
    ...(commander && d.commanders.length ? { commanders: d.commanders, commanderFormat: "Commander" as const } : {}),
    partial: d.partial,
  };
}

/** Whether a listed deck can play by Commander rules. */
export function isCommanderDeck(d: { commanders?: string[]; commanderFormat?: string } | null | undefined): boolean {
  return !!d && !!d.commanderFormat;
}
