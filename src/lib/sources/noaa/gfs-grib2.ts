/**
 * Minimal GRIB2 decoder for ONE known field: NOAA GFS 0.25° "TCDC:entire
 * atmosphere" (total cloud cover, %), as published on NOAA Open Data (AWS).
 * Not a general GRIB2 decoder. Every assumption below was confirmed on the
 * real file and is checked on each message; anything else is rejected
 * (never interpreted by approximation):
 * - one GRIB2 message (edition 2, discipline 0), sections 1, 3, 4, 5, 6, 7;
 * - grid template 3.0: 1440 × 721 regular lat/lon, 90°N → 90°S, 0° → 359.75°E,
 *   0.25° steps, scanning mode 0 (west → east, north → south, rows contiguous);
 * - product template 4.0: category 6 / parameter 1 (total cloud cover, %),
 *   first surface type 10 (entire atmosphere), forecast time in hours;
 * - data representation 5.3 (complex packing, spatial differencing order 2),
 *   no missing-value management, no bitmap (section 6 indicator 255).
 * Values are returned exactly as packed, in tenths of a percent when the
 * scaling is a multiple of 0.1 (checked): no rounding of real precision.
 */

/** Grid value meaning "no value" (never 0, never clear sky). */
export const CLOUD_NO_DATA = 0xffff;

export const GFS_GRID_WIDTH = 1440;
export const GFS_GRID_HEIGHT = 721;

export type GfsTcdcField = {
  /** Model reference (run) time, UTC ISO. */
  referenceTime: string;
  forecastHour: number;
  width: number;
  height: number;
  /** Row-major, row 0 = 90°N, column 0 = 0°E; tenths of a percent (0–1000) or CLOUD_NO_DATA. */
  tenths: Uint16Array;
  /** Decoded values outside 0–100 % (stored as CLOUD_NO_DATA, never clamped). */
  outOfRange: number;
  /** GRIB2 code table 1.4 / 4.3 values kept for provenance. */
  generatingProcess: number;
};

class GribError extends Error {}

const fail = (message: string): never => {
  throw new GribError(`GRIB2 TCDC: ${message}`);
};

/** Sign-magnitude integer (GRIB2 convention for signed values) of `n` octets. */
function signMagnitude(b: Uint8Array, at: number, n: number): number {
  let v = 0;
  for (let k = 0; k < n; k++) v = v * 256 + b[at + k];
  const sign = 2 ** (8 * n - 1);
  return v >= sign ? -(v - sign) : v;
}

const u16 = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
const u32 = (b: Uint8Array, at: number) => ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];

/** Reads unsigned big-endian bit fields (MSB first). */
class BitReader {
  private bit: number;
  private readonly b: Uint8Array;
  private readonly endByte: number;
  constructor(b: Uint8Array, byteOffset: number, endByte: number) {
    this.b = b;
    this.bit = byteOffset * 8;
    this.endByte = endByte;
  }
  read(n: number): number {
    if (n === 0) return 0;
    if (this.bit + n > this.endByte * 8) fail("payload truncated");
    let v = 0;
    for (let k = 0; k < n; k++) {
      const p = this.bit + k;
      v = v * 2 + ((this.b[p >> 3] >> (7 - (p & 7))) & 1);
    }
    this.bit += n;
    return v;
  }
  alignToByte(): void {
    this.bit = Math.ceil(this.bit / 8) * 8;
  }
}

export function decodeGfsTcdc(bytes: Uint8Array): GfsTcdcField {
  const b = bytes;
  if (b.length < 16 || String.fromCharCode(b[0], b[1], b[2], b[3]) !== "GRIB") fail("not a GRIB message");
  if (b[7] !== 2) fail(`edition ${b[7]} (expected 2)`);
  if (b[6] !== 0) fail(`discipline ${b[6]} (expected 0, meteorological)`);
  const total = Number(new DataView(b.buffer, b.byteOffset, b.byteLength).getBigUint64(8));
  if (total !== b.length) fail(`message length ${total} ≠ received ${b.length} bytes`);
  if (String.fromCharCode(b[total - 4], b[total - 3], b[total - 2], b[total - 1]) !== "7777") fail("missing end section");

  // Sections, each exactly once (one field per message).
  const at: Partial<Record<number, number>> = {};
  for (let p = 16; p < total - 4; ) {
    const len = u32(b, p);
    const num = b[p + 4];
    if (len < 5 || p + len > total - 4) fail(`section ${num} length ${len} out of bounds`);
    if (num < 1 || num > 7) fail(`unexpected section ${num}`);
    if (at[num] !== undefined) fail(`section ${num} repeated (more than one field)`);
    at[num] = p;
    p += len;
  }
  for (const n of [1, 3, 4, 5, 6, 7]) if (at[n] === undefined) fail(`section ${n} missing`);
  const s1 = at[1]!, s3 = at[3]!, s4 = at[4]!, s5 = at[5]!, s6 = at[6]!, s7 = at[7]!;

  // Section 1: reference time (significance 1 = start of forecast).
  if (b[s1 + 11] !== 1) fail(`reference time significance ${b[s1 + 11]} (expected 1)`);
  const ref = Date.UTC(u16(b, s1 + 12), b[s1 + 14] - 1, b[s1 + 15], b[s1 + 16], b[s1 + 17], b[s1 + 18]);
  if (!Number.isFinite(ref)) fail("invalid reference time");

  // Section 3: grid template 3.0, exact GFS 0.25° global grid.
  if (b[s3 + 5] !== 0 || b[s3 + 10] !== 0) fail("unsupported grid definition source/list");
  if (u16(b, s3 + 12) !== 0) fail(`grid template ${u16(b, s3 + 12)} (expected 3.0)`);
  const ni = u32(b, s3 + 30);
  const nj = u32(b, s3 + 34);
  const npts = u32(b, s3 + 6);
  if (ni !== GFS_GRID_WIDTH || nj !== GFS_GRID_HEIGHT || npts !== ni * nj) fail(`grid ${ni}×${nj} (${npts} points)`);
  const basicAngle = u32(b, s3 + 38);
  if (basicAngle !== 0 && basicAngle !== 0xffffffff) fail("non-default basic angle");
  const grid = [
    signMagnitude(b, s3 + 46, 4), // La1 (µdeg)
    u32(b, s3 + 50), // Lo1
    signMagnitude(b, s3 + 55, 4), // La2
    u32(b, s3 + 59), // Lo2
    u32(b, s3 + 63), // Di
    u32(b, s3 + 67), // Dj
  ];
  if (grid.join() !== [90e6, 0, -90e6, 359.75e6, 250000, 250000].join()) fail(`grid geometry ${grid.join()}`);
  if (b[s3 + 71] !== 0) fail(`scanning mode ${b[s3 + 71]} (expected 0)`);

  // Section 4: product template 4.0, total cloud cover, entire atmosphere, hours.
  if (u16(b, s4 + 5) !== 0) fail("unexpected vertical coordinate values");
  if (u16(b, s4 + 7) !== 0) fail(`product template ${u16(b, s4 + 7)} (expected 4.0, instantaneous)`);
  if (b[s4 + 9] !== 6 || b[s4 + 10] !== 1) fail(`parameter ${b[s4 + 9]}/${b[s4 + 10]} (expected 6/1 total cloud cover, %)`);
  if (b[s4 + 17] !== 1) fail(`time unit ${b[s4 + 17]} (expected hours)`);
  if (b[s4 + 22] !== 10) fail(`surface type ${b[s4 + 22]} (expected 10, entire atmosphere)`);
  const forecastHour = u32(b, s4 + 18);

  // Section 5: data representation 5.3.
  if (u32(b, s5 + 5) !== npts) fail("data point count mismatch");
  if (u16(b, s5 + 9) !== 3) fail(`data representation ${u16(b, s5 + 9)} (expected 5.3)`);
  const view5 = new DataView(b.buffer, b.byteOffset + s5, 49);
  const R = view5.getFloat32(11);
  const E = signMagnitude(b, s5 + 15, 2);
  const D = signMagnitude(b, s5 + 17, 2);
  const nbits = b[s5 + 19];
  if (b[s5 + 20] !== 0) fail("original field type is not floating point");
  if (b[s5 + 21] !== 1) fail(`group splitting method ${b[s5 + 21]}`);
  if (b[s5 + 22] !== 0) fail(`missing value management ${b[s5 + 22]} not supported`);
  const ng = u32(b, s5 + 31);
  const widthRef = b[s5 + 35];
  const widthBits = b[s5 + 36];
  const lenRef = u32(b, s5 + 37);
  const lenIncr = b[s5 + 41];
  const lastLen = u32(b, s5 + 42);
  const lenBits = b[s5 + 46];
  if (b[s5 + 47] !== 2) fail(`spatial differencing order ${b[s5 + 47]} (expected 2)`);
  const sdOctets = b[s5 + 48];
  if (sdOctets < 1 || sdOctets > 4) fail(`spatial differencing octets ${sdOctets}`);
  if (nbits > 31 || widthBits > 31 || lenBits > 31 || ng < 1 || ng > npts) fail("packing parameters out of range");

  // Section 6: no bitmap.
  if (b[s6 + 5] !== 255) fail(`bitmap indicator ${b[s6 + 5]} not supported`);

  // Section 7: complex packing with spatial differencing (order 2).
  const s7end = s7 + u32(b, s7);
  let o = s7 + 5;
  const ival1 = signMagnitude(b, o, sdOctets);
  const ival2 = signMagnitude(b, o + sdOctets, sdOctets);
  const minsd = signMagnitude(b, o + 2 * sdOctets, sdOctets);
  o += 3 * sdOctets;
  const bits = new BitReader(b, o, s7end);
  const refs = new Int32Array(ng);
  for (let g = 0; g < ng; g++) refs[g] = bits.read(nbits);
  bits.alignToByte();
  const widths = new Uint8Array(ng);
  for (let g = 0; g < ng; g++) {
    const w = widthRef + bits.read(widthBits);
    if (w > 31) fail("group width out of range");
    widths[g] = w;
  }
  bits.alignToByte();
  const lengths = new Uint32Array(ng);
  let sum = 0;
  for (let g = 0; g < ng; g++) {
    lengths[g] = g === ng - 1 ? lastLen : lenRef + lenIncr * bits.read(lenBits);
    if (g === ng - 1) bits.read(lenBits); // the last scaled length is present but replaced
    sum += lengths[g];
  }
  if (sum !== npts) fail(`group lengths sum ${sum} ≠ ${npts}`);
  bits.alignToByte();
  const packed = new Int32Array(npts);
  let i = 0;
  for (let g = 0; g < ng; g++) {
    const w = widths[g];
    for (let k = 0; k < lengths[g]; k++) packed[i++] = refs[g] + bits.read(w);
  }

  // Undo second-order spatial differencing.
  packed[0] = ival1;
  packed[1] = ival2;
  for (let k = 2; k < npts; k++) packed[k] = packed[k] + minsd + 2 * packed[k - 1] - packed[k - 2];

  // Y = (R + X·2^E) / 10^D, kept exactly in tenths of a percent.
  const binScale = 2 ** E;
  const decScale = 10 ** D;
  const tenths = new Uint16Array(npts);
  let outOfRange = 0;
  for (let k = 0; k < npts; k++) {
    const y = (R + packed[k] * binScale) / decScale;
    const t = Math.round(y * 10);
    if (Math.abs(y * 10 - t) > 1e-6) fail("value precision finer than 0.1 % (unexpected scaling)");
    if (t < 0 || t > 1000) {
      tenths[k] = CLOUD_NO_DATA;
      outOfRange++;
    } else tenths[k] = t;
  }

  return {
    referenceTime: new Date(ref).toISOString(),
    forecastHour,
    width: ni,
    height: nj,
    tenths,
    outOfRange,
    generatingProcess: b[s4 + 11],
  };
}
