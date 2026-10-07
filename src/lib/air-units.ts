/**
 * Display-only conversions for AIR. Observations keep the OpenSky SI values
 * (m, m/s); these only format them in aeronautical units for the panel.
 */
const METERS_PER_FOOT = 0.3048;
const METERS_PER_NM = 1852;

export const metersToFeet = (m: number) => m / METERS_PER_FOOT;
export const metersPerSecondToKnots = (mps: number) => (mps * 3600) / METERS_PER_NM;
export const metersPerSecondToFeetPerMinute = (mps: number) => (mps / METERS_PER_FOOT) * 60;
