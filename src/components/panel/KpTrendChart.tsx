import type { PlanetaryKpObservation } from "@/types";

/**
 * Small SVG trend of estimated Kp (no chart library). Samples are joined by
 * straight lines only between consecutive minutes; a missing stretch leaves a
 * gap instead of drawing a line through it. No smoothing, no interpolated samples.
 */
const W = 320;
const H = 128;
const PAD = { top: 8, right: 10, bottom: 18, left: 18 };
const KP_MAX = 9;
/** Samples further apart than this are not joined (the product is 1-minute). */
const MAX_GAP_MS = 3 * 60_000;
/** NOAA G scale: G1 starts at Kp 5. Reference only, not an alert. */
const G1_KP = 5;

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function KpTrendChart({
  observations,
  windowHours,
}: {
  /** Sorted oldest first. */
  observations: PlanetaryKpObservation[];
  windowHours: number;
}) {
  const points = observations
    .map((o) => ({ t: Date.parse(o.observedAt ?? ""), kp: o.data.estimatedKp }))
    .filter((p) => Number.isFinite(p.t));
  if (points.length === 0) return null;

  const end = points[points.length - 1].t;
  const start = end - windowHours * 3_600_000;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - start) / (end - start)) * innerW;
  const y = (kp: number) => PAD.top + (1 - kp / KP_MAX) * innerH;

  const runs: string[] = [];
  let run: string[] = [];
  points.forEach((p, i) => {
    if (i > 0 && p.t - points[i - 1].t > MAX_GAP_MS) {
      runs.push(run.join(" "));
      run = [];
    }
    run.push(`${x(p.t).toFixed(1)},${y(p.kp).toFixed(1)}`);
  });
  runs.push(run.join(" "));

  // Hour marks every 2 h (UTC), inside the window.
  const ticks: number[] = [];
  const firstHour = Math.ceil(start / 3_600_000) * 3_600_000;
  for (let t = firstHour; t <= end; t += 3_600_000) {
    if (new Date(t).getUTCHours() % 2 === 0) ticks.push(t);
  }

  const last = points[points.length - 1];
  const min = Math.min(...points.map((p) => p.kp));
  const max = Math.max(...points.map((p) => p.kp));

  return (
    <figure className="mt-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Estimated Kp over the last ${windowHours} hours: ${points.length} samples, from ${min} to ${max}; latest ${last.kp}.`}
      >
        {[0, 3, 6, 9].map((kp) => (
          <g key={kp}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(kp)} y2={y(kp)} strokeWidth="1" className="stroke-line" />
            <text x={PAD.left - 5} y={y(kp) + 3} textAnchor="end" fontSize="8" className="fill-fg-subtle font-mono">
              {kp}
            </text>
          </g>
        ))}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(G1_KP)}
          y2={y(G1_KP)}
          className="stroke-fg-subtle"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <text x={W - PAD.right} y={y(G1_KP) - 3} textAnchor="end" fontSize="7.5" letterSpacing="0.6" className="fill-fg-subtle">
          G1 THRESHOLD · Kp 5
        </text>
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - 5} textAnchor="middle" fontSize="8" className="fill-fg-subtle font-mono">
            {`${pad2(new Date(t).getUTCHours())}:00`}
          </text>
        ))}
        {runs.map((pts, i) => (
          <polyline key={i} points={pts} fill="none" className="stroke-data" strokeWidth="1.25" strokeLinejoin="round" />
        ))}
        <circle cx={x(last.t)} cy={y(last.kp)} r="2.5" className="fill-accent" />
      </svg>
      <figcaption className="mt-1 text-[11px] leading-snug text-fg-subtle">
        Last {windowHours} h, 1-minute estimates, times UTC. Dashed line: reference threshold from
        NOAA G scale; not an AURELIS alert.
      </figcaption>
    </figure>
  );
}
