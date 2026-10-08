import type { GoesXrayFeed, SourceHealth } from "@/types";
import { XRAY_CLASS_THRESHOLDS, logPosition, powerOfTen, scientific } from "@/lib/xray";
import { EMPTY, Note, Row, Section, Time } from "./primitives";
import { FeedNotice, Tag } from "./SolarWindSections";

const W = 320;
const H = 136;
const PAD = { top: 12, right: 16, bottom: 18, left: 30 };
/** The product is 1-minute; longer gaps stay open. */
const MAX_GAP_MS = 3 * 60_000;
const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * GOES 0.1–0.8 nm flux on a log10 axis (SVG, no library). The log transform
 * is for drawing only; values stay in W/m². Straight segments between
 * consecutive samples; gaps and satellite changes stay open. Class letters
 * mark the NOAA/SWPC decade bands (reference, not alerts). The latest
 * official event is marked at its peak time when it falls in the window.
 */
function XrayChart({ feed }: { feed: GoesXrayFeed }) {
  const pts = feed.flux.map((o) => ({ t: Date.parse(o.observedAt!), v: o.data.fluxWattsPerM2, sat: o.data.satellite }));
  if (pts.length === 0) return null;
  const values = pts.map((p) => p.v);
  const minExp = Math.min(-8, Math.floor(Math.log10(Math.min(...values))));
  const maxExp = Math.max(-3, Math.ceil(Math.log10(Math.max(...values))));
  const end = pts[pts.length - 1].t;
  const start = end - feed.metadata.windowHours * 3_600_000;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - start) / (end - start || 1)) * innerW;
  const y = (v: number) => PAD.top + (1 - (logPosition(v, minExp, maxExp) ?? 0)) * innerH;

  const runs: string[] = [];
  let run: string[] = [];
  pts.forEach((p, i) => {
    const prev = pts[i - 1];
    if (prev && (p.t - prev.t > MAX_GAP_MS || p.sat !== prev.sat)) {
      runs.push(run.join(" "));
      run = [];
    }
    run.push(`${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`);
  });
  runs.push(run.join(" "));

  const decades: number[] = [];
  for (let e = minExp; e <= maxExp; e++) decades.push(e);
  // Letter in the middle of each class band: A below 1e-7, then B, C, M, X.
  const bands = [{ letter: "A", from: 10 ** minExp }, ...XRAY_CLASS_THRESHOLDS].map((b, i, all) => ({
    letter: b.letter,
    mid: Math.sqrt(b.from * (all[i + 1]?.from ?? 10 ** maxExp)),
  }));
  const ticks: number[] = [];
  for (let t = Math.ceil(start / 3_600_000) * 3_600_000; t <= end; t += 3_600_000) {
    if (new Date(t).getUTCHours() % 2 === 0) ticks.push(t);
  }
  const last = pts[pts.length - 1];
  const flare = feed.latestFlare?.data;
  const flareT = flare ? Date.parse(flare.peakTime) : NaN;
  const flareInWindow = flare && flareT >= start && flareT <= end;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`GOES 0.1–0.8 nm X-ray flux over the last ${feed.metadata.windowHours} hours, log scale, W/m²; latest ${scientific(last.v)}.`}
    >
      {decades.map((e) => (
        <g key={e}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(10 ** e)} y2={y(10 ** e)} strokeWidth="1" className="stroke-line" />
          <text x={PAD.left - 4} y={y(10 ** e) + 3} textAnchor="end" fontSize="7.5" className="fill-fg-subtle font-mono">
            {powerOfTen(e)}
          </text>
        </g>
      ))}
      {bands.map((b) => (
        <text key={b.letter} x={W - PAD.right + 9} y={y(b.mid) + 3} textAnchor="middle" fontSize="8" className="fill-fg-subtle font-mono">
          {b.letter}
        </text>
      ))}
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={H - 5} textAnchor="middle" fontSize="8" className="fill-fg-subtle font-mono">
          {`${pad2(new Date(t).getUTCHours())}:00`}
        </text>
      ))}
      {flareInWindow && (
        <g>
          <line x1={x(flareT)} x2={x(flareT)} y1={PAD.top} y2={PAD.top + innerH} strokeWidth="1" strokeDasharray="2 2" className="stroke-fg-subtle" />
          <text x={x(flareT)} y={PAD.top - 3} textAnchor="middle" fontSize="7.5" className="fill-fg-muted font-mono">
            {flare.flareClass}
          </text>
        </g>
      )}
      {runs.map((p, i) =>
        p.includes(" ") ? (
          <polyline key={i} points={p} fill="none" className="stroke-data" strokeWidth="1.25" strokeLinejoin="round" />
        ) : (
          <circle key={i} cx={p.split(",")[0]} cy={p.split(",")[1]} r="1" className="fill-data" />
        ),
      )}
      <circle cx={x(last.t)} cy={y(last.v)} r="2.5" className="fill-accent" />
    </svg>
  );
}

export default function XraySection({ feed, health }: { feed: GoesXrayFeed | null; health: SourceHealth }) {
  const latest = feed?.flux.find((o) => o.id === feed.latestFluxId) ?? null;
  const flare = feed?.latestFlare ?? null;

  return (
    <Section title="SOLAR X-RAY">
      <FeedNotice label="GOES X-RAY" health={health} />
      <div className="flex items-baseline gap-2 py-1.5">
        <span className="font-mono text-[20px] leading-none text-accent">
          {latest ? scientific(latest.data.fluxWattsPerM2) : EMPTY}
        </span>
        <span className="text-[11px] text-fg-muted">W/m²</span>
        <span className="ml-auto">
          <Tag>OBSERVED</Tag>
        </span>
      </div>
      <Note>
        GOES measures full-Sun X-ray flux (0.1–0.8 nm shown). Solar flares are classified A, B, C, M and
        X by peak flux in the 0.1–0.8 nm band.
      </Note>
      {feed && feed.flux.length > 0 && (
        <figure className="mt-2">
          <XrayChart feed={feed} />
          <figcaption className="mt-1 text-[11px] leading-snug text-fg-subtle">
            W/m², log scale · last {feed.metadata.windowHours} h, 1-minute samples, UTC · letters: NOAA class bands
          </figcaption>
        </figure>
      )}
      <dl className="mt-2">
        <Row label="SATELLITE">
          <span className="font-mono">{latest ? `GOES-${latest.data.satellite}` : EMPTY}</span>
          <Note>SWPC primary X-ray satellite (can change).</Note>
        </Row>
        <Row label="MEASURED">
          <Time iso={latest?.observedAt} />
        </Row>
        <Row label="LATEST EVENT">
          {flare ? (
            <>
              <span className="font-mono text-fg">{flare.data.flareClass}</span>
              <span className="ml-2 align-middle">
                <Tag>REPORTED</Tag>
              </span>
              <Note>Latest X-ray event detected or entered by SWPC; class at its maximum.</Note>
            </>
          ) : feed?.metadata.flareProduct === "unavailable" ? (
            <>
              {EMPTY}
              <Note>Event product unavailable.</Note>
            </>
          ) : (
            <>
              {EMPTY}
              <Note>No X-ray event in product.</Note>
            </>
          )}
        </Row>
        {flare && (
          <>
            <Row label="BEGIN">
              <Time iso={flare.data.beginTime} />
            </Row>
            <Row label="PEAK">
              <Time iso={flare.data.peakTime} />
              {flare.data.peakFluxWattsPerM2 !== undefined && (
                <Note>{scientific(flare.data.peakFluxWattsPerM2)} W/m²</Note>
              )}
            </Row>
            <Row label="END">
              {flare.data.endTime ? <Time iso={flare.data.endTime} /> : (
                <>
                  {EMPTY}
                  <Note>Not reported yet.</Note>
                </>
              )}
            </Row>
            <Row label="EVENT SATELLITE">
              <span className="font-mono">GOES-{flare.data.satellite}</span>
            </Row>
          </>
        )}
        <Row label="INGESTED">
          <Time iso={feed?.metadata.ingestedAt} />
        </Row>
        <Row label="SOURCE">{feed?.source.name ?? EMPTY}</Row>
        <Row label="NATURE">
          {latest ? "OBSERVED (flux)" : EMPTY}
          {flare && <Note>Event: REPORTED.</Note>}
        </Row>
        <Row label="AURELIS CONFIDENCE">{latest ? "UNKNOWN" : EMPTY}</Row>
      </dl>
    </Section>
  );
}
