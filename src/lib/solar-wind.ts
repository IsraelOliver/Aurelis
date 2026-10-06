/**
 * Bz orientation, as physically defined (GSM): negative = southward, positive
 * = northward. A description of the measurement, not an alert or a level.
 */
export function bzOrientation(bzGsmNt: number): "SOUTHWARD" | "NORTHWARD" | "ZERO" {
  return bzGsmNt < 0 ? "SOUTHWARD" : bzGsmNt > 0 ? "NORTHWARD" : "ZERO";
}
