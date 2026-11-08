import { useEffect, useRef, useState } from "react";

import type { ProgData } from "./data";
import { printImage } from "./data";
import type { ImportedDeck } from "./deckImport";
import { importDeckList } from "./deckImport";

const DRAFT_KEY = "pt1-import-draft";

function loadDraft(slot: string): string {
  try {
    return (JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as Record<string, string>)[slot] ?? "";
  } catch {
    return "";
  }
}
function saveDraft(slot: string, text: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as Record<string, string>;
    all[slot] = text;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
  } catch {
    // a draft is a convenience only
  }
}

/** Is the imported list usable (all cards known; commander rules respected when asked)? */
export function importReady(d: ImportedDeck | null, commander: boolean): boolean {
  return !!d && d.size > 0 && !d.unknown.length && (!commander || !d.issues.length);
}

/**
 * Paste a decklist: it is read as you type (newest printing for cards without a
 * set, basics to the tray, unknown cards and cards that may not work listed).
 * `onDeck` receives the list whenever it changes (null while empty).
 */
export function DeckImportPanel({
  data,
  commander,
  slot,
  text: controlled,
  onText,
  onDeck,
  compact,
  placeholder,
}: {
  data: ProgData;
  commander: boolean;
  /** Remembers the pasted text per slot (localStorage). */
  slot: string;
  text?: string;
  onText?: (t: string) => void;
  onDeck: (d: ImportedDeck | null) => void;
  compact?: boolean;
  placeholder?: string;
}) {
  const [own, setOwn] = useState(() => loadDraft(slot));
  const text = controlled ?? own;
  const [pick, setPick] = useState<string[]>([]);
  const [deck, setDeck] = useState<ImportedDeck | null>(null);
  const [busy, setBusy] = useState(false);
  const cb = useRef(onDeck);
  cb.current = onDeck;

  useEffect(() => {
    let alive = true;
    setBusy(true);
    const t = window.setTimeout(() => {
      importDeckList(data, text, { commander, pick })
        .then((d) => {
          if (!alive) return;
          setDeck(d);
          cb.current(d);
        })
        .catch(() => {
          if (!alive) return;
          setDeck(null);
          cb.current(null);
        })
        .finally(() => alive && setBusy(false));
    }, 450);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [data, text, commander, pick]);

  const setText = (t: string) => {
    if (onText) onText(t);
    if (controlled === undefined) setOwn(t);
    saveDraft(slot, t);
  };
  // The commander picker stays visible once used, so the choice can be changed.
  const needPick = commander && deck && deck.candidates.length > 0 && (!deck.commanders.length || pick.length > 0);
  const ok = importReady(deck, commander);

  return (
    <div className="pf-import">
      <textarea
        className="pf-import-text"
        spellCheck={false}
        style={compact ? { minHeight: 180 } : undefined}
        placeholder={placeholder ?? (commander ? "Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring\n1 Arcane Signet\n…\n10 Forest" : "4 Lightning Bolt\n4 Goblin Guide (ZEN) 126\n…\n20 Mountain\n\nSideboard\n2 Smash to Smithereens")}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="pf-hint" style={{ margin: "0.3rem 0 0" }}>
        Any format (MTGA, MTGO, Moxfield, “4 Card name”). Cards without a set get their newest printing; basic lands go to the basic-land tray.
        {commander ? " Commander: put the commander under a “Commander” line, or choose it below." : ""}
      </p>
      {needPick && (
        <label className="pf-field" style={{ marginTop: "0.5rem" }}>
          <span>Commander</span>
          <select value={pick[0] ?? ""} onChange={(e) => setPick(e.target.value ? [e.target.value] : [])}>
            <option value="">Choose…</option>
            {deck!.candidates.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      {commander && deck && pick.length > 0 && (deck.pairs[pick[0]]?.length ?? 0) > 0 && (
        <label className="pf-field" style={{ marginTop: "0.5rem" }}>
          <span>Second commander (optional)</span>
          <select value={pick[1] ?? ""} onChange={(e) => setPick(e.target.value ? [pick[0], e.target.value] : [pick[0]])}>
            <option value="">None</option>
            {(deck.pairs[pick[0]] ?? []).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="pf-import-status">
        {busy && text.trim() ? (
          <span className="pf-hint-pulse">Reading the list…</span>
        ) : !deck ? (
          text.trim() ? <span className="pf-bad">No cards found.</span> : null
        ) : (
          <>
            <div className="pf-import-head">
              {deck.face && <img src={printImage(deck.face, "art_crop")} alt="" />}
              <div>
                <b className={ok ? "pf-good" : "pf-bad"}>
                  {ok ? "✓ " : "✕ "}
                  {deck.size} cards{deck.commanders.length ? ` + commander ${deck.commanders.join(" & ")}` : ""}
                </b>
                {deck.unknown.length > 0 && <small className="pf-bad">Not recognised (fix or remove): {deck.unknown.join(", ")}</small>}
              </div>
            </div>
            {commander && deck.issues.map((i) => (
              <small key={i} className="pf-bad">
                • {i}
              </small>
            ))}
            {deck.partial.length > 0 && (
              <small style={{ color: "#f2b49f" }}>⚠ May not work as usual: {deck.partial.join(", ")}</small>
            )}
          </>
        )}
      </div>
    </div>
  );
}
