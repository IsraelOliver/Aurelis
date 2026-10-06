/**
 * GOES X-ray display helpers (client-safe, pure). Rendering math only: the
 * raw W/m² values are never changed.
 */

/**
 * NOAA/SWPC flare class thresholds on the peak 0.1–0.8 nm flux (W/m²):
 * A < 1e-7 ≤ B < 1e-6 ≤ C < 1e-5 ≤ M < 1e-4 ≤ X. Used for chart reference
 * bands and explanations only, never to name a flare from instantaneous flux.
 */
export const XRAY_CLASS_THRESHOLDS = [
  { letter: "B", from: 1e-7 },
  { letter: "C", from: 1e-6 },
  { letter: "M", from: 1e-5 },
  { letter: "X", from: 1e-4 },
] as const;

/** Letter of the decade band a flux falls in (reference only; not an event class). */
export function xrayClassBand(fluxWattsPerM2: number): "A" | "B" | "C" | "M" | "X" {
  let letter: "A" | "B" | "C" | "M" | "X" = "A";
  for (const t of XRAY_CLASS_THRESHOLDS) if (fluxWattsPerM2 >= t.from) letter = t.letter;
  return letter;
}

/**
 * Position of a flux on a log10 axis spanning [10^minExp, 10^maxExp], as a
 * fraction 0 (bottom) … 1 (top). Only for drawing; values ≤ 0 have no position.
 */
export function logPosition(fluxWattsPerM2: number, minExp: number, maxExp: number): number | null {
  if (!(fluxWattsPerM2 > 0)) return null;
  return (Math.log10(fluxWattsPerM2) - minExp) / (maxExp - minExp);
}

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};

/** 10^-6 → "10⁻⁶". */
export function powerOfTen(exp: number): string {
  return `10${String(exp).replace(/[-0-9]/g, (c) => SUPERSCRIPT[c])}`;
}

/** 1.774e-6 → "1.77 × 10⁻⁶" (display only). */
export function scientific(value: number, digits = 2): string {
  let exp = Math.floor(Math.log10(value));
  let mantissa = Number((value / 10 ** exp).toFixed(digits));
  if (mantissa >= 10) {
    // Rounding reached the next decade (e.g. 9.999e-7 → 1.00 × 10⁻⁶).
    mantissa /= 10;
    exp += 1;
  }
  return `${mantissa.toFixed(digits)} × ${powerOfTen(exp)}`;
}
