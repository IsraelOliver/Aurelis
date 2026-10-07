import { gzipSync } from "node:zlib";
import type { CloudCoverFeed, CloudCoverObservation } from "@/types";
import {
  NOAA_GFS_CLOUDS_SOURCE,
  findTcdcRange,
  gfsCandidateRuns,
  gfsFieldId,
  gfsFileUrl,
  gfsNature,
  gfsStepFor,
  gfsValidAt,
  type GfsRun,
} from "./gfs-source";
import { CLOUD_NO_DATA, decodeGfsTcdc } from "./gfs-grib2";

/**
 * Server side of the GFS cloud layer (Node only). The browser never touches
 * the GRIB2 file: the server reads the step's .idx, requests ONLY the
 * "TCDC:entire atmosphere" bytes (HTTP Range, ~0.8 MB of a ~500 MB file),
 * decodes them (gfs-grib2.ts) and serves the grid as compact uint16.
 */

const REQUEST_TIMEOUT_MS = 30_000;
/** Decoded fields kept in memory (current + the ones a client may still show). */
const MAX_CACHED_FIELDS = 3;

export type GfsCloudField = {
  feed: CloudCoverFeed;
  /** Grid as served: uint16 little-endian, CloudCoverGridInfo layout. */
  body: Uint8Array;
  gzip: Uint8Array;
};

export type GfsCloudSelection = { run: GfsRun; forecastHour: number; range: { start: number; end: number; record: string } };

async function fetchIdx(run: GfsRun, forecastHour: number): Promise<string | null> {
  const res = await fetch(`${gfsFileUrl(run, forecastHour)}.idx`, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  // A step not published yet is a 404 on the public bucket (403 if listing were denied).
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`GFS .idx HTTP ${res.status}`);
  return res.text();
}

/**
 * Newest run whose step closest to now is published, and that step's TCDC
 * byte range. Reads one small .idx per run tried (newest first).
 */
export async function selectGfsCloudField(nowMs: number): Promise<GfsCloudSelection> {
  for (const run of gfsCandidateRuns(nowMs)) {
    const forecastHour = gfsStepFor(run, nowMs);
    const idx = await fetchIdx(run, forecastHour);
    if (idx !== null) return { run, forecastHour, range: findTcdcRange(idx, run, forecastHour) };
  }
  throw new Error("no GFS run with the needed hourly step published in the last 24 h");
}

/** Range download + strict decode of one field; checks it is exactly the requested run/step. */
async function loadField(selection: GfsCloudSelection): Promise<GfsCloudField> {
  const { run, forecastHour, range } = selection;
  const url = gfsFileUrl(run, forecastHour);
  const t0 = performance.now();
  const res = await fetch(url, {
    headers: { Range: `bytes=${range.start}-${range.end}` },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status !== 206) throw new Error(`GFS range request HTTP ${res.status} (expected 206)`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length !== range.end - range.start + 1) throw new Error(`GFS range: ${bytes.length} bytes received`);
  const t1 = performance.now();

  const field = decodeGfsTcdc(bytes);
  if (Date.parse(field.referenceTime) !== run.timeMs || field.forecastHour !== forecastHour) {
    throw new Error(`GFS field is ${field.referenceTime} f${field.forecastHour}, not the requested run/step`);
  }
  const t2 = performance.now();

  const n = field.tenths.length;
  const body = new Uint8Array(n * 2);
  const view = new DataView(body.buffer);
  let valid = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = field.tenths[i];
    view.setUint16(i * 2, v, true);
    if (v !== CLOUD_NO_DATA) {
      valid++;
      sum += v;
    }
  }

  const id = gfsFieldId(run, forecastHour);
  const ingestedAt = new Date().toISOString();
  const validAt = gfsValidAt(run, forecastHour);
  const fh3 = String(forecastHour).padStart(3, "0");
  const observation: CloudCoverObservation = {
    id: `${NOAA_GFS_CLOUDS_SOURCE.id}:${run.date}${run.cycle}:f${fh3}`,
    sourceId: NOAA_GFS_CLOUDS_SOURCE.id,
    nature: gfsNature(forecastHour),
    confidence: "unknown",
    validAt,
    ingestedAt,
    sourceRecordId: `gfs.${run.date}/${run.cycle} f${fh3} TCDC:entire atmosphere`,
    sourceUrl: url,
    data: {
      model: "NOAA GFS",
      field: "TCDC:entire atmosphere",
      description: "Total cloud cover, entire atmosphere",
      unit: "%",
      runTime: field.referenceTime,
      forecastHour,
      validAt,
      resolutionDeg: 0.25,
      width: field.width,
      height: field.height,
      validCells: valid,
      noDataCells: n - valid,
      meanPercent: valid > 0 ? Math.round(sum / valid) / 10 : null,
    },
  };
  const gzip = gzipSync(body);
  console.info(
    `[gfs-clouds] ${id}: TCDC ${(bytes.length / 1024).toFixed(0)} kB in ${(t1 - t0).toFixed(0)} ms, decode ${(t2 - t1).toFixed(0)} ms, grid ${(body.length / 1024).toFixed(0)} kB (gzip ${(gzip.length / 1024).toFixed(0)} kB)${field.outOfRange ? `, ${field.outOfRange} out-of-range values kept as no data` : ""}`,
  );
  return {
    feed: {
      source: NOAA_GFS_CLOUDS_SOURCE,
      observation,
      grid: {
        id,
        url: `/api/weather/clouds/grid?id=${id}`,
        encoding: "uint16le-tenths-percent",
        width: field.width,
        height: field.height,
        firstLatDeg: 90,
        firstLonDeg: 0,
        latStepDeg: -0.25,
        lonStepDeg: 0.25,
        noDataValue: 65535,
        byteLength: body.length,
      },
      metadata: { ingestedAt, checkedAt: ingestedAt },
    },
    body,
    gzip,
  };
}

// Module cache: a field (run + step) never changes once published.
const fields = new Map<string, GfsCloudField>();
const loading = new Map<string, Promise<GfsCloudField>>();

/** Decoded field for a selection, from memory or downloaded once (concurrent calls share it). */
export function getGfsCloudField(selection: GfsCloudSelection): Promise<GfsCloudField> {
  const id = gfsFieldId(selection.run, selection.forecastHour);
  const cached = fields.get(id);
  if (cached) return Promise.resolve(cached);
  let pending = loading.get(id);
  if (!pending) {
    pending = loadField(selection)
      .then((field) => {
        fields.set(id, field);
        while (fields.size > MAX_CACHED_FIELDS) fields.delete(fields.keys().next().value!);
        return field;
      })
      .finally(() => loading.delete(id));
    loading.set(id, pending);
  }
  return pending;
}

/** A field by run/step (grid route): from memory, else its .idx + range again. */
export async function getGfsCloudFieldById(run: GfsRun, forecastHour: number): Promise<GfsCloudField> {
  const cached = fields.get(gfsFieldId(run, forecastHour));
  if (cached) return cached;
  const idx = await fetchIdx(run, forecastHour);
  if (idx === null) throw new Error("GFS field not published");
  return getGfsCloudField({ run, forecastHour, range: findTcdcRange(idx, run, forecastHour) });
}
