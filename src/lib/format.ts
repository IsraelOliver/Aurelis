/** Display helpers. Native APIs only; times always shown in UTC. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-05T01:18:50.392Z" → { date: "05 Oct 2026", time: "01:18:50 UTC" } */
export function formatUtc(iso: string | undefined): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`,
  };
}

/** -0.4325 → "0.4325° S" */
export function formatLatitude(lat: number): string {
  return `${Math.abs(lat).toFixed(4)}° ${lat < 0 ? "S" : "N"}`;
}

/** -19.965 → "19.9650° W" */
export function formatLongitude(lon: number): string {
  return `${Math.abs(lon).toFixed(4)}° ${lon < 0 ? "W" : "E"}`;
}

/** Magnitude as reported (no rounding), or null when not reported. */
export function formatMagnitude(magnitude: number | null): string | null {
  return magnitude === null ? null : String(magnitude);
}

/** Depth as reported, in km. */
export function formatDepthKm(depthKm: number): string {
  return `${depthKm} km`;
}

/** Elapsed time for sync/health display: "34s ago", "2m ago", "1h ago". */
export function formatAgo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
