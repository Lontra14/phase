// The march of time between blocks: a gold marker slides along the run's
// timeline while the big year counts up to the next block.

import { useEffect, useState } from "react";

import { yearsLabel } from "./run";

interface Props {
  blocks: [number, number][];
  from: number;
  to: number;
}

export function Timeline({ blocks, from, to }: Props) {
  const [pos, setPos] = useState(from);
  const startYear = blocks[Math.min(from, blocks.length - 1)][0];
  const endYear = blocks[Math.min(to, blocks.length - 1)][0];
  const [year, setYear] = useState(startYear);

  useEffect(() => {
    const t = window.setTimeout(() => setPos(to), 250);
    let raf = 0;
    const t0 = performance.now() + 250;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / 2200));
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setYear(Math.round(startYear + (endYear - startYear) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [to, startYear, endYear]);

  const n = blocks.length;
  const pct = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const labelEvery = Math.max(1, Math.ceil(n / 10));

  return (
    <div>
      <div className="pf-bigyear">{year}</div>
      <div className="pf-timeline">
        <div className="pf-tl-track" />
        <div className="pf-tl-fill" style={{ width: `${pct(pos)}%` }} />
        {blocks.map((b, i) => (
          <div key={i}>
            <div className={`pf-tl-tick${i <= pos ? " past" : ""}`} style={{ left: `${pct(i)}%` }} />
            {(i % labelEvery === 0 || i === n - 1 || i === to) && (
              <div className="pf-tl-label" style={{ left: `${pct(i)}%`, color: i === to ? "var(--gold-bright)" : undefined }}>
                {yearsLabel(b)}
              </div>
            )}
          </div>
        ))}
        <div className="pf-tl-marker" style={{ left: `${pct(pos)}%` }} />
      </div>
    </div>
  );
}
