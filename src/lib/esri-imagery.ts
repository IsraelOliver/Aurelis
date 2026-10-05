/**
 * Esri World Imagery for the SATELLITE basemap. Esri is a basemap provider
 * (visual infrastructure), not an IntelligenceSource: it is not counted in
 * SOURCES and has no SourceHealth.
 *
 * Official, authenticated method: the ArcGIS Basemap Styles service (v2),
 * style "arcgis/imagery", requested with the ArcGIS API key. Only its raster
 * World Imagery source (tile URL + data attribution, exactly as returned) is
 * used, added under the AURELIS layers; the Esri style is never applied with
 * setStyle(). The key comes from NEXT_PUBLIC_ARCGIS_API_KEY (.env.local); it
 * is used by the browser by design and protected by the credential's
 * referrer restrictions, not by hiding it.
 */

const BASEMAP_STYLES_URL =
  "https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/imagery";

export const ARCGIS_API_KEY = process.env.NEXT_PUBLIC_ARCGIS_API_KEY ?? "";

export interface EsriImagerySource {
  tiles: string[];
  tileSize: number;
  maxzoom?: number;
  /** "Powered by Esri" (required Esri attribution) + data attribution from the service. */
  attribution: string;
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Fetches the imagery raster source from the official Basemap Styles service. */
export async function fetchEsriImagerySource(signal?: AbortSignal): Promise<EsriImagerySource> {
  if (!ARCGIS_API_KEY) throw new Error("ArcGIS API key is not configured");
  const response = await fetch(
    `${BASEMAP_STYLES_URL}?token=${encodeURIComponent(ARCGIS_API_KEY)}`,
    { signal },
  );
  if (!response.ok) throw new Error(`Basemap Styles service responded ${response.status}`);
  const style: unknown = await response.json();
  const sources =
    typeof style === "object" && style !== null && "sources" in style
      ? (style as { sources: Record<string, Record<string, unknown>> }).sources
      : {};
  const raster = Object.values(sources).find(
    (s) =>
      s.type === "raster" &&
      Array.isArray(s.tiles) &&
      s.tiles.every((t) => typeof t === "string" && t.startsWith("https://")),
  );
  if (!raster) throw new Error("No raster imagery source in arcgis/imagery style");

  const dataAttribution =
    typeof raster.attribution === "string" ? escapeHtml(raster.attribution) : "Esri";
  return {
    tiles: raster.tiles as string[],
    tileSize: typeof raster.tileSize === "number" ? raster.tileSize : 256,
    maxzoom: typeof raster.maxzoom === "number" ? raster.maxzoom : undefined,
    attribution: `Powered by <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a> · ${dataAttribution}`,
  };
}
