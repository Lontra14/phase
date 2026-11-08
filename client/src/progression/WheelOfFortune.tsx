// The winner's wheel — dressed like the Wheel of Fortune card (red and gold,
// the card's art on the hub). One equal slice per rarity present in the
// block's opened pool; the landing slice is pre-rolled from the run seed.

import { useEffect, useRef, useState } from "react";

import type { Rarity } from "./data";
import { RARITY_COLOR, RARITY_LABEL } from "./data";

const HUB_ART = "https://api.scryfall.com/cards/named?exact=Wheel%20of%20Fortune&format=image&version=art_crop";

function point(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [r * Math.sin(rad), -r * Math.cos(rad)];
}

function slicePath(r: number, a0: number, a1: number): string {
  if (a1 - a0 >= 359.99) return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`;
  const [x0, y0] = point(r, a0);
  const [x1, y1] = point(r, a1);
  return `M 0 0 L ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1} Z`;
}

interface Props {
  wheel: Rarity[];
  landing: Rarity;
  spun: boolean;
  onSpun: () => void;
}

export function WheelOfFortune({ wheel, landing, spun, onSpun }: Props) {
  const n = Math.max(1, wheel.length);
  const a = 360 / n;
  const k = Math.max(0, wheel.indexOf(landing));
  const jitter = (((k * 37) % 10) - 5) * a * 0.06;
  const finalAngle = 360 * 7 + (360 - (k * a + a / 2)) + jitter;
  const [angle, setAngle] = useState(spun ? finalAngle : 0);
  const [spinning, setSpinning] = useState(false);
  const done = useRef(spun);

  useEffect(() => {
    if (spun) setAngle(finalAngle);
  }, [spun, finalAngle]);

  const spin = () => {
    if (spinning || done.current) return;
    setSpinning(true);
    setAngle(finalAngle);
  };

  return (
    <div>
      <div className="pf-wheel-wrap">
        <div className="pf-wheel-pointer" />
        <svg
          className="pf-wheel"
          viewBox="-112 -112 224 224"
          style={{ transform: `rotate(${angle}deg)`, transitionDuration: spun && !spinning ? "0s" : undefined }}
          onTransitionEnd={() => {
            if (!spinning) return;
            setSpinning(false);
            done.current = true;
            onSpun();
          }}
        >
          <defs>
            <radialGradient id="pf-wheel-shade" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="scale(104)">
              <stop offset="0.25" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.38" />
            </radialGradient>
          </defs>
          <circle r="110" fill="#5b1410" stroke="#c9a24b" strokeWidth="3" />
          {wheel.map((r, i) => (
            <path key={r} d={slicePath(100, i * a, (i + 1) * a)} fill={RARITY_COLOR[r]} stroke="#2a0806" strokeWidth="1.4" />
          ))}
          <circle r="100" fill="url(#pf-wheel-shade)" />
          {wheel.map((r, i) => {
            const mid = i * a + a / 2;
            const [x, y] = point(70, mid);
            return (
              <text
                key={`t-${r}`}
                x={x}
                y={y}
                fill="#1b0f08"
                fontFamily="Cinzel, serif"
                fontWeight={800}
                fontSize={n > 4 ? 9 : 11}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${mid} ${x} ${y})`}
                letterSpacing="1"
              >
                {RARITY_LABEL[r].toUpperCase()}
              </text>
            );
          })}
          {Array.from({ length: 24 }, (_, i) => {
            const [x, y] = point(105, i * 15);
            return <circle key={`b-${i}`} cx={x} cy={y} r="2.6" fill={i % 2 ? "#ecca7e" : "#fff3d0"} />;
          })}
        </svg>
        <div className="pf-wheel-hub">
          <img src={HUB_ART} alt="Wheel of Fortune" />
        </div>
      </div>
      {!spun && (
        <div className="pf-row">
          <button type="button" className="pf-btn" onClick={spin} disabled={spinning}>
            {spinning ? "Spinning…" : "Spin the wheel ⟳"}
          </button>
        </div>
      )}
      {spun && (
        <div className="pf-landed" style={{ color: RARITY_COLOR[landing] }}>
          {RARITY_LABEL[landing]}!
        </div>
      )}
    </div>
  );
}
