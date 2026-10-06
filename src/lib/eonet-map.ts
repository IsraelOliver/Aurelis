import type { Feature, FeatureCollection, Point, Polygon, Position } from "geojson";
import type { EonetEventObservation } from "@/types";

/**
 * Map features for EONET events: only the LATEST geometry of each event (by
 * date), as published. No tracks or connected history, no buffers, no
 * centroids. Rendering-only transformation: polygon rings crossing ±180° are
 * unwrapped (consecutive longitudes kept within 180° of each other, e.g.
 * 179 → -179 becomes 179 → 181) so no edge spans the planet; the stored
 * EONET coordinates are not modified.
 */
export interface EonetFeatureProps {
  entityId: string;
}

/** Copy of a ring with continuous longitudes (no jump larger than 180°). */
export function unwrapRing(ring: Position[]): Position[] {
  const out: Position[] = [];
  let offset = 0;
  ring.forEach((p, i) => {
    if (i > 0) {
      const delta = p[0] + offset - out[i - 1][0];
      if (delta > 180) offset -= 360;
      else if (delta < -180) offset += 360;
    }
    out.push([p[0] + offset, p[1]]);
  });
  return out;
}

export function eonetMapFeatures(
  observations: EonetEventObservation[],
): FeatureCollection<Point | Polygon, EonetFeatureProps> {
  const features: Feature<Point | Polygon, EonetFeatureProps>[] = [];
  for (const o of observations) {
    if (!o.entityId) continue;
    const g = o.data.geometries[o.data.latestGeometryIndex];
    if (!g) continue;
    features.push(
      g.type === "Point"
        ? { type: "Feature", geometry: { type: "Point", coordinates: g.coordinates as Position }, properties: { entityId: o.entityId } }
        : {
            type: "Feature",
            geometry: { type: "Polygon", coordinates: (g.coordinates as Position[][]).map(unwrapRing) },
            properties: { entityId: o.entityId },
          },
    );
  }
  return { type: "FeatureCollection", features };
}
