import type { EvidenceNature, IntelligenceSource } from "@/types";

/** Static description of the GFS cloud cover source; safe to import in client code. */
export const NOAA_GFS_CLOUDS_SOURCE: IntelligenceSource = {
  id: "noaa-gfs-clouds",
  name: "NOAA GFS — Total Cloud Cover",
  provider: "NOAA / NCEP (National Centers for Environmental Prediction)",
  category: "government",
  url: "https://www.emc.ncep.noaa.gov/emc/pages/numerical_forecast_systems/gfs.php",
  // No formal reliability methodology exists yet.
  reliability: "unknown",
  description:
    "Total cloud cover (entire atmosphere, %) from the Global Forecast System weather model, 0.25° global grid. Model output, not a satellite observation.",
};

/** NOAA Open Data Dissemination (NODD) on AWS: public bucket, no account or key. */
export const GFS_BUCKET_URL = "https://noaa-gfs-bdp-pds.s3.amazonaws.com";
export const GFS_REGISTRY_URL = "https://registry.opendata.aws/noaa-gfs-bdp-pds/";

/** Cycles 00/06/12/18Z. */
export const GFS_CYCLE_HOURS = 6;
/** The 0.25° files are hourly up to f120 (3-hourly after). */
export const GFS_MAX_HOURLY_STEP = 120;
/** Runs tried, newest first, before giving up (24 h). */
export const GFS_RUN_LOOKBACK = 4;

const HOUR_MS = 3_600_000;
const pad2 = (n: number) => String(n).padStart(2, "0");

export type GfsRun = { /** YYYYMMDD */ date: string; /** "00" | "06" | "12" | "18" */ cycle: string; timeMs: number };

export function gfsRunAt(timeMs: number): GfsRun {
  const d = new Date(timeMs);
  return {
    date: `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`,
    cycle: pad2(d.getUTCHours()),
    timeMs,
  };
}

/** Run times at or before `nowMs`, newest first (whether published or not). */
export function gfsCandidateRuns(nowMs: number, count = GFS_RUN_LOOKBACK): GfsRun[] {
  const latest = Math.floor(nowMs / (GFS_CYCLE_HOURS * HOUR_MS)) * GFS_CYCLE_HOURS * HOUR_MS;
  return Array.from({ length: count }, (_, k) => gfsRunAt(latest - k * GFS_CYCLE_HOURS * HOUR_MS));
}

/**
 * Hourly step of `run` whose valid time is closest to `nowMs` (at most 30 min
 * away while within f000–f120). One real model step: never a blend of two.
 */
export function gfsStepFor(run: GfsRun, nowMs: number): number {
  const h = Math.round((nowMs - run.timeMs) / HOUR_MS);
  return Math.min(Math.max(h, 0), GFS_MAX_HOURLY_STEP);
}

/** f000 is the model's initial state (analysis-based): estimated. Later steps: forecast. */
export const gfsNature = (forecastHour: number): EvidenceNature => (forecastHour === 0 ? "estimated" : "forecast");

export const gfsValidAt = (run: GfsRun, forecastHour: number) =>
  new Date(run.timeMs + forecastHour * HOUR_MS).toISOString();

/** Official object URL of the 0.25° GRIB2 file (the .idx sits next to it). */
export const gfsFileUrl = (run: GfsRun, forecastHour: number) =>
  `${GFS_BUCKET_URL}/gfs.${run.date}/${run.cycle}/atmos/gfs.t${run.cycle}z.pgrb2.0p25.f${String(forecastHour).padStart(3, "0")}`;

/** Stable id of one field: run + step, e.g. "2026100612-f008". */
export const gfsFieldId = (run: GfsRun, forecastHour: number) =>
  `${run.date}${run.cycle}-f${String(forecastHour).padStart(3, "0")}`;

/** Strict inverse of gfsFieldId (cycle 00/06/12/18, hourly step ≤ f120); null otherwise. */
export function parseGfsFieldId(id: string): { run: GfsRun; forecastHour: number } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(00|06|12|18)-f(\d{3})$/.exec(id);
  if (!m) return null;
  const timeMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]));
  const run = gfsRunAt(timeMs);
  const forecastHour = Number(m[5]);
  if (run.date !== `${m[1]}${m[2]}${m[3]}` || forecastHour > GFS_MAX_HOURLY_STEP) return null;
  return { run, forecastHour };
}

/**
 * Byte range of "TCDC:entire atmosphere" for this run/step in a GFS .idx
 * (wgrib2 inventory: "n:offset:d=YYYYMMDDHH:VAR:LEVEL:TIME:"). Exactly one
 * matching record is required, with this run's date and the instantaneous
 * time label ("anl" at f000, "N hour fcst" after; never "N-M hour ave").
 * The end is the next record's offset − 1 (the field is never the last one).
 */
export function findTcdcRange(idx: string, run: GfsRun, forecastHour: number): { start: number; end: number; record: string } {
  const lines = idx.split("\n").map((l) => l.trim()).filter(Boolean);
  const time = forecastHour === 0 ? "anl" : `${forecastHour} hour fcst`;
  const wanted = `:d=${run.date}${run.cycle}:TCDC:entire atmosphere:${time}:`;
  const hits = lines.map((l, i) => [l, i] as const).filter(([l]) => l.endsWith(wanted) && /^\d+:\d+:/.test(l));
  if (hits.length !== 1) throw new Error(`GFS .idx: ${hits.length} records for ${wanted}`);
  const [record, i] = hits[0];
  const next = lines[i + 1];
  if (!next) throw new Error("GFS .idx: TCDC is the last record (end unknown)");
  const start = Number(record.split(":")[1]);
  const end = Number(next.split(":")[1]) - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end <= start) {
    throw new Error("GFS .idx: invalid byte offsets");
  }
  return { start, end, record };
}
