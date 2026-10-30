// Booster opening: the pack floats, tear the top off, cards are dealt face down
// and flip one by one (rares glow gold, mythics burst orange).

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { CARD_BACK_URL } from "../services/scryfall";
import { RARITY_COLOR, RARITY_LABEL, printImage } from "./data";
import type { Pack } from "./packs";

function packColors(code: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) % 360;
  return { ["--pk1" as string]: `hsl(${h} 55% 22%)`, ["--pk2" as string]: `hsl(${(h + 40) % 360} 62% 42%)` } as CSSProperties;
}

interface Props {
  packs: Pack[];
  onDone: () => void;
}

export function PackOpening({ packs, onDone }: Props) {
  const [idx, setIdx] = useState(0);
  const [stage, setStage] = useState<"sealed" | "tearing" | "torn" | "revealed">("sealed");
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const timers = useRef<number[]>([]);
  const pack = packs[idx];

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const tear = () => {
    if (stage !== "sealed") return;
    setStage("tearing");
    later(450, () => setStage("torn"));
    later(1050, () => {
      setStage("revealed");
      // Commons and uncommons flip on their own; rares and up wait for a click.
      pack.cards.forEach((c, i) => {
        if (c.rarity === "c" || c.rarity === "u") later(500 + i * 110, () => setFlipped((f) => new Set(f).add(i)));
      });
    });
  };

  const flipAll = () => setFlipped(new Set(pack.cards.map((_, i) => i)));

  const next = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (idx + 1 >= packs.length) {
      onDone();
      return;
    }
    setIdx(idx + 1);
    setStage("sealed");
    setFlipped(new Set());
  };

  if (!pack) return null;
  const allUp = flipped.size >= pack.cards.length;

  return (
    <div className="pf-opening">
      <div className="pf-progress-dots" aria-label={`Pack ${idx + 1} of ${packs.length}`}>
        {packs.map((_, i) => (
          <i key={i} className={i < idx ? "done" : i === idx ? "cur" : ""} />
        ))}
      </div>

      {stage !== "revealed" ? (
        <>
          <div className="pf-pack-stage">
            <div
              className={`pf-booster${stage === "tearing" ? " tearing" : ""}${stage === "torn" ? " torn" : ""}`}
              style={packColors(pack.set.code)}
              onClick={tear}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") tear();
              }}
              aria-label={`Open a ${pack.set.name} booster`}
            >
              <div className="wrap">
                <div className="crimp top" />
                <div className="tearline" />
                <div className="label">
                  <div className="set">{pack.set.name}</div>
                  <div className="yr">{pack.set.year}</div>
                  <div className="cnt">{pack.cards.length} cards</div>
                </div>
                <div className="seal">{pack.set.code.toUpperCase().slice(0, 3)}</div>
                <div className="crimp bot" />
              </div>
              <div className="flap" />
            </div>
          </div>
          <div className="pf-hint-pulse">{stage === "sealed" ? "Click the pack to tear it open" : "…"}</div>
        </>
      ) : (
        <>
          <div className="pf-reveal">
            {pack.cards.map((c, i) => {
              const up = flipped.has(i);
              return (
                <div key={`${idx}-${i}`} className={`pf-dealt${up ? " up" : ""}`} style={{ animationDelay: `${i * 70}ms` }}>
                  <div
                    className={`pf-flip ${c.rarity}${up ? " up" : ""}`}
                    onClick={() => setFlipped((f) => new Set(f).add(i))}
                    title={up ? c.card.name : "Click to flip"}
                  >
                    <div className="face back">
                      <img src={CARD_BACK_URL} alt="" />
                    </div>
                    <div className="face front">
                      {c.id ? <img src={printImage(c, "normal")} alt={c.card.name} /> : <div className="ph">{c.card.name}</div>}
                    </div>
                    <div className="burst" />
                  </div>
                  <div className="tag" style={{ color: RARITY_COLOR[c.rarity] }}>
                    {c.set ? RARITY_LABEL[c.rarity] : "The List"}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pf-row">
            {!allUp && (
              <button type="button" className="pf-btn secondary small" onClick={flipAll}>
                Reveal all
              </button>
            )}
            <button type="button" className="pf-btn" onClick={next} disabled={!allUp}>
              {idx + 1 >= packs.length ? "See your pool ▸" : "Next pack ▸"}
            </button>
          </div>
        </>
      )}
      <button type="button" className="pf-btn-mini" onClick={onDone}>
        Skip — open everything
      </button>
    </div>
  );
}
