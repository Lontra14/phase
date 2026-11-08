import { useEffect, useMemo, useState } from "react";

import type { ProgData } from "./data";
import type { CatalogDeck } from "./deckCatalog";
import { loadDeckCatalog } from "./deckCatalog";

const PIP: Record<string, string> = { W: "#f4ecd4", U: "#4a90d9", B: "#a487c4", R: "#d6503e", G: "#4fb277", C: "#b9b2a6" };

/** Search every ready-made deck (precons, meta decks of every year) and pick one. */
export function DeckCatalogPicker({ data, commander, onPick, label = "Ready-made deck" }: { data: ProgData; commander: boolean; onPick: (d: CatalogDeck) => void; label?: string }) {
  const [all, setAll] = useState<CatalogDeck[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  useEffect(() => {
    void loadDeckCatalog(data).then(setAll);
  }, [data]);
  const decks = useMemo(() => all.filter((d) => !commander || d.commander), [all, commander]);
  const groups = useMemo(() => [...new Set(decks.map((d) => d.group))], [decks]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decks.filter((d) => (!group || d.group === group) && (!q || `${d.name} ${d.group} ${d.detail}`.toLowerCase().includes(q))).slice(0, 60);
  }, [decks, group, query]);

  if (!open)
    return (
      <button type="button" className="pf-btn secondary small" onClick={() => setOpen(true)} disabled={!decks.length}>
        {decks.length ? `☰ ${label} (${decks.length})` : "Loading the decks…"}
      </button>
    );
  return (
    <div className="pf-catalog">
      <div className="pf-catalog-bar">
        <input autoFocus placeholder="Search name, format, year…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">All ({decks.length})</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <button type="button" className="pf-btn-mini" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <div className="pf-catalog-list">
        {shown.map((d) => (
          <button
            key={d.id}
            type="button"
            className="pf-catalog-item"
            onClick={() => {
              onPick(d);
              setOpen(false);
            }}
          >
            <span className="pips">
              {(d.colors.length ? d.colors : ["C"]).map((c) => (
                <i key={c} style={{ background: PIP[c] ?? PIP.C }} />
              ))}
            </span>
            <span className="txt">
              <b>{d.name}</b>
              <small>
                {d.group}
                {d.detail ? ` · ${d.detail}` : ""}
              </small>
            </span>
          </button>
        ))}
        {!shown.length && <p className="pf-hint">No deck matches.</p>}
      </div>
    </div>
  );
}
