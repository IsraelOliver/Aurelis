import { fetchOpenMeteoPoint } from "@/lib/sources/open-meteo/forecast";
import { parseQueryCoordinate } from "@/lib/sources/open-meteo/source";

/**
 * Point weather (Open-Meteo Forecast API, Best Match) in the AURELIS model:
 * current model estimate + next 24 hourly values for ?lat=&lon=.
 *
 * No server cache: coordinates are arbitrary (an in-memory cache keyed by
 * clicked points would grow without bound), and one active point polled every
 * 10 min is a low volume. Only the validated coordinate reaches the upstream URL.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const point = parseQueryCoordinate(params.get("lat"), params.get("lon"));
  if (!point) {
    return Response.json({ error: "lat/lon must be finite WGS84 coordinates" }, { status: 400 });
  }
  try {
    return Response.json(await fetchOpenMeteoPoint(point.latitude, point.longitude), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("[api/weather/forecast] Open-Meteo unavailable:", error);
    return Response.json({ error: "Open-Meteo forecast unavailable" }, { status: 502 });
  }
}
