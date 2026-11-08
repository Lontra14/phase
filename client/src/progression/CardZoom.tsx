// Big card view with ⟳ Flip for double-faced cards (as in the Rogue Forge
// roguelike): click the card or the button to turn it over. Split/adventure
// cards also carry "A // B" names but have no back image — the button hides
// itself when the back fails to load. Esc or a click outside closes it.

import { useEffect, useState, type ReactNode } from "react";

import type { ProgPrint } from "./data";
import { RARITY_COLOR, RARITY_LABEL, maybeDoubleFaced, printImage } from "./data";

interface Props {
  print: ProgPrint | null;
  name?: string;
  onClose: () => void;
  children?: ReactNode;
}

export function CardZoom({ print, name, onClose, children }: Props) {
  const label = name ?? print?.card.name ?? "";
  const [back, setBack] = useState(false);
  const [noBack, setNoBack] = useState(!maybeDoubleFaced(print?.card.name ?? label));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const flip = () => {
    if (!noBack) setBack((b) => !b);
  };

  return (
    <div className="pf-modal" onClick={onClose}>
      <button type="button" className="pf-zoom-x" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      <div className="pf-zoom" onClick={(e) => e.stopPropagation()}>
        <div className={`pf-zoom-card${noBack ? "" : " flippable"}`}>
          {print ? (
            <img
              key={back ? "back" : "front"}
              src={printImage(print, "large", back ? "back" : "front")}
              alt={label}
              onClick={flip}
              onError={() => {
                if (back) {
                  setBack(false);
                  setNoBack(true);
                }
              }}
            />
          ) : (
            <div className="pf-zoom-ph">{label}</div>
          )}
          {!noBack && print && (
            <button type="button" className="pf-flipbtn" onClick={flip}>
              ⟳ Flip card
            </button>
          )}
        </div>
        <div className="pf-zoom-meta">
          <b>{label}</b>
          {print && (
            <span style={{ color: RARITY_COLOR[print.rarity] }}>
              {print.set ? `${RARITY_LABEL[print.rarity]} · ${print.set.name} (${print.set.year})` : "The List"}
            </span>
          )}
          {children && <div className="pf-zoom-btns">{children}</div>}
        </div>
      </div>
    </div>
  );
}
