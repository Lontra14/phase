// Every ready-made deck of the app as a decklist to paste: the Starter precons
// and the meta decks (today's and every year's, commander decks included). Used
// by the Test match to pick a deck for any seat.

import { loadMetaDecks, type MetaDeck } from "../chess/chessData";
import type { ProgData } from "./data";
import { loadStarterDecks } from "./starterData";

export interface CatalogDeck {
  id: string;
  /** Section of the picker ("Starter precons", "Standard · today", "Modern 2012"…). */
  group: string;
  name: string;
  /** Short line under the name (product, season, % of the meta…). */
  detail: string;
  colors: string[];
  commander: boolean;
  /** The decklist, ready for the list box (commander decks with a Commander section). */
  text: string;
}

function metaText(d: MetaDeck): string {
  const commanders = d.commanderFormat ? (d.commanders ?? []) : [];
  const left = new Map(commanders.map((n) => [n, 1]));
  const lines: string[] = [];
  for (const c of d.cards) {
    let count = c.count;
    if (left.get(c.name)) {
      count -= 1;
      left.set(c.name, 0);
    }
    if (count > 0) lines.push(`${count} ${c.name}`);
  }
  return commanders.length ? ["Commander", ...commanders.map((n) => `1 ${n}`), "", "Deck", ...lines].join("\n") : lines.join("\n");
}

let catalog: Promise<CatalogDeck[]> | null = null;

/** All the decks (loaded once). */
export function loadDeckCatalog(data: ProgData): Promise<CatalogDeck[]> {
  if (!catalog) {
    catalog = (async () => {
      const out: CatalogDeck[] = [];
      try {
        const starters = await loadStarterDecks(data);
        const line = (key: string, count: number) => {
          const p = data.byKey.get(key);
          // The precon's own printing travels as "(SET) number".
          return p ? (p.set && p.cn ? `${count} ${p.card.name} (${p.set.code.toUpperCase()}) ${p.cn}` : `${count} ${p.card.name}`) : "";
        };
        for (const d of starters.slice().reverse()) {
          const lines = d.cards.map((c) => line(c.key, c.count)).filter(Boolean);
          const cmd = d.commanderFormat && d.commanders?.length ? (d.commanderKeys ?? []).map((k) => line(k, 1)).filter(Boolean) : [];
          out.push({
            id: `starter:${d.id}`,
            group: cmd.length ? "Commander precons" : "Starter precons",
            name: d.name,
            detail: `${cmd.length ? `${d.commanders!.join(" & ")} · ` : ""}${d.type} · ${d.year}`,
            colors: d.colors,
            commander: cmd.length > 0,
            text: cmd.length ? ["Commander", ...cmd, "", "Deck", ...lines].join("\n") : lines.join("\n"),
          });
        }
      } catch {
        // no precons: the meta decks still load
      }
      try {
        const metas = await loadMetaDecks();
        for (const d of metas) {
          const when = d.source === "today" ? "today" : String(d.year ?? "");
          out.push({
            id: `meta:${d.id}`,
            group: `${d.format} · ${when}`,
            name: d.name,
            detail: d.source === "history" ? `${d.period ?? ""}${d.pct ? ` · ${d.pct}% of the meta` : ""}` : `${d.size} cards`,
            colors: d.colors,
            commander: !!d.commanderFormat,
            text: metaText(d),
          });
        }
      } catch {
        // offline: the precons are enough
      }
      return out;
    })();
  }
  return catalog;
}
