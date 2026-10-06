/**
 * Small SVG time series (no chart library), same style as KpTrendChart.
 * Real samples joined by straight lines only between consecutive samples of
 * the same series: a time gap or a change of `group` (e.g. spacecraft) leaves
 * the line open. No smoothing, no interpolated samples. An optional second
 * series (same unit and axis) is drawn dashed.
 */
const W = 320;
const H = 116;
const PAD = { top: 8, right: 10, bottom: 18, left: 30 };
/** Default gap for 1-minute products; hourly series pass their own. */
const MAX_GAP_MS = 3 * 60_000;

const pad2 = (n: number) => String(n).padStart(2, "0");

export interface SeriesPoint {
  t: number;
  v: number;
  group: string;
}

export default function SeriesChart({
  points,
  windowHours,
  yMin,
  yMax,
  yTicks,
  zeroLine = false,
  zeroLabels,
  ariaLabel,
  maxGapMs = MAX_GAP_MS,
  secondaryPoints,
  domain,
  markLatest = true,
  tickEveryHours = 2,
}: {
  /** Sorted oldest first. */
  points: SeriesPoint[];
  windowHours: number;
  yMin: number;
  yMax: number;
  yTicks: number[];
  /** Neutral reference line at 0. */
  zeroLine?: boolean;
  /** Small labels just above / below the zero line (e.g. orientation). */
  zeroLabels?: { above: string; below: string };
  ariaLabel: string;
  /** Samples further apart than this are not joined. */
  maxGapMs?: number;
  /** Optional second series on the same axis, drawn dashed. */
  secondaryPoints?: SeriesPoint[];
  /** Explicit time domain [start, end] (ms); default: the last `windowHours` up to the last sample. */
  domain?: [number, number];
  /** Gold dot on the last sample (a "latest" value); off for forecasts. */
  markLatest?: boolean;
  /** Hour-label spacing (UTC hours divisible by this). */
  tickEveryHours?: number;
}) {
  if (points.length === 0) return null;
  const end = domain ? domain[1] : points[points.length - 1].t;
  const start = domain ? domain[0] : end - windowHours * 3_600_000;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - start) / (end - start || 1)) * innerW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * innerH;

  const runsOf = (series: SeriesPoint[]) => {
    const runs: string[] = [];
    let run: string[] = [];
    series.forEach((p, i) => {
      const prev = series[i - 1];
      if (prev && (p.t - prev.t > maxGapMs || p.group !== prev.group)) {
        runs.push(run.join(" "));
        run = [];
      }
      run.push(`${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`);
    });
    runs.push(run.join(" "));
    return runs;
  };
  const runs = runsOf(points);
  const secondaryRuns = secondaryPoints && secondaryPoints.length > 0 ? runsOf(secondaryPoints) : [];

  const ticks: number[] = [];
  for (let t = Math.ceil(start / 3_600_000) * 3_600_000; t <= end; t += 3_600_000) {
    if (new Date(t).getUTCHours() % tickEveryHours === 0) ticks.push(t);
  }
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={ariaLabel}>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} strokeWidth="1" className="stroke-line" />
          <text x={PAD.left - 5} y={y(v) + 3} textAnchor="end" fontSize="8" className="fill-fg-subtle font-mono">
            {v}
          </text>
        </g>
      ))}
      {zeroLine && (
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} strokeWidth="1" className="stroke-fg-subtle" />
      )}
      {zeroLabels && (
        <>
          <text x={W - PAD.right} y={y(0) - 3} textAnchor="end" fontSize="7" letterSpacing="0.6" className="fill-fg-subtle">
            {zeroLabels.above}
          </text>
          <text x={W - PAD.right} y={y(0) + 9} textAnchor="end" fontSize="7" letterSpacing="0.6" className="fill-fg-subtle">
            {zeroLabels.below}
          </text>
        </>
      )}
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={H - 5} textAnchor="middle" fontSize="8" className="fill-fg-subtle font-mono">
          {`${pad2(new Date(t).getUTCHours())}:00`}
        </text>
      ))}
      {runs.map((pts, i) =>
        pts.includes(" ") ? (
          <polyline key={i} points={pts} fill="none" className="stroke-cyan" strokeWidth="1.25" strokeLinejoin="round" />
        ) : (
          // A single isolated sample is still shown.
          <circle key={i} cx={pts.split(",")[0]} cy={pts.split(",")[1]} r="1" className="fill-cyan" />
        ),
      )}
      {secondaryRuns.map((pts, i) => (
        <polyline key={`s${i}`} points={pts} fill="none" className="stroke-fg-muted" strokeWidth="1.25" strokeDasharray="3 2" strokeLinejoin="round" />
      ))}
      {markLatest && <circle cx={x(last.t)} cy={y(last.v)} r="2.5" className="fill-gold" />}
    </svg>
  );
}
