"use client";

import { useState } from "react";
import type { YearRow } from "@/lib/solar";

interface Props {
  data: YearRow[];
  totalCost: number;
  paybackYears: number | null;
  format: (n: number) => string;
  formatCompact: (n: number) => string;
}

const W = 640;
const H = 260;
const PAD = { top: 16, right: 12, bottom: 28, left: 56 };

export default function CashflowChart({ data, totalCost, paybackYears, format, formatCompact }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return null;

  const values = [-totalCost, ...data.map((d) => d.cumulative)];
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / data.length;
  const barW = Math.max(2, band * 0.7);
  const y = (v: number) => PAD.top + ((max - v) / span) * innerH;
  const zeroY = y(0);

  const ticks = [max, max / 2, 0, min / 2, min].filter((v, i, a) => a.findIndex((t) => Math.abs(t - v) < span * 0.08) === i);
  const labelEvery = data.length > 15 ? 5 : data.length > 8 ? 2 : 1;
  const active = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="mb-2 flex min-h-6 flex-wrap items-baseline justify-between gap-x-4 text-sm">
        {active ? (
          <>
            <span className="font-medium">Year {active.year}</span>
            <span className="text-muted">
              Saved {format(active.savings)} · Position{" "}
              <span className={active.cumulative >= 0 ? "text-positive font-semibold" : "text-negative font-semibold"}>
                {format(active.cumulative)}
              </span>
            </span>
          </>
        ) : (
          <span className="text-muted">
            Hover or tap a bar to see the cash position for that year.
            {paybackYears !== null && paybackYears > 0 && ` Break-even in year ${Math.ceil(paybackYears)}.`}
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label="Cumulative cash flow by year"
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-grid" strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
              {formatCompact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + i * band + (band - barW) / 2;
          const top = Math.min(y(d.cumulative), zeroY);
          const h = Math.max(1, Math.abs(y(d.cumulative) - zeroY));
          const positive = d.cumulative >= 0;
          return (
            <g key={d.year} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} onTouchStart={() => setHover(i)}>
              <rect x={PAD.left + i * band} y={PAD.top} width={band} height={innerH} fill="transparent" />
              <rect
                x={x}
                y={top}
                width={barW}
                height={h}
                rx={Math.min(3, barW / 3)}
                className={positive ? "fill-positive" : "fill-negative"}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
              {(d.year === 1 || d.year % labelEvery === 0) && (
                <text x={PAD.left + i * band + band / 2} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">
                  {d.year}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={zeroY} y2={zeroY} className="stroke-axis" />
      </svg>
    </div>
  );
}
