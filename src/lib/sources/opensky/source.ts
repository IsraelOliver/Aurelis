import type { IntelligenceSource } from "@/types";

/**
 * Static description of the OpenSky aircraft source and AIR policy constants
 * (no credentials here; safe to import in client code). Personal,
 * non-commercial, experimental integration (OpenSky REST API terms).
 */
export const OPENSKY_AIRCRAFT_SOURCE: IntelligenceSource = {
  id: "opensky-aircraft",
  name: "OpenSky Network — Aircraft States",
  provider: "OpenSky Network",
  category: "research",
  url: "https://opensky-network.org/",
  // No formal reliability methodology exists yet. Not an aviation authority.
  reliability: "unknown",
  description:
    "Aircraft state vectors (ADS-B, MLAT, ASTERIX, FLARM) aggregated by the OpenSky Network receiver network; coverage depends on receivers and aircraft transmissions.",
};

/** Global query: /states/all WITHOUT a bounding box (one request, never a tiling of boxes). */
export const OPENSKY_STATES_URL = "https://opensky-network.org/api/states/all";
export const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
export const OPENSKY_API_DOCS_URL = "https://openskynetwork.github.io/opensky-api/rest.html";

export const AIRCRAFT_ENTITY_PREFIX = "aircraft:icao24:";
/** Stable AURELIS id of an aircraft: its ICAO 24-bit address (never callsign or position). */
export const aircraftEntityId = (icao24: string) => `${AIRCRAFT_ENTITY_PREFIX}${icao24.toLowerCase()}`;

/**
 * API credits of one global /states/all request (OpenSky REST docs: "> 400 sq°
 * or global" → 4; confirmed on 2026-10-07 by X-Rate-Limit-Remaining). The
 * server also reports the cost it observes between consecutive requests.
 */
export const OPENSKY_GLOBAL_CREDITS = 4;

/** Global refresh while AIR is active (and the aircraft layer shown). AURELIS policy. */
export const AIR_POLL_MS = 30_000;

/**
 * Map positions are drawn this far behind the source timeline, so the display
 * time is almost always between two received positions (refresh 30 s +
 * request latency + position age). Visual only.
 */
export const AIR_VISUAL_DELAY_MS = 35_000;

/**
 * AURELIS policy: a position more than this old relative to the response time
 * (time − time_position) is not current enough to draw or interpolate. The
 * docs describe time_position as null without a position report in 15 s, but
 * real global responses contain much older positions (observed up to hours).
 */
export const AIR_MAX_POSITION_AGE_S = 60;

/** Automatic refresh pauses when the remaining credits cover only this many more refreshes. */
export const AIR_QUOTA_RESERVE_REFRESHES = 10;

/** OpenSky position_source codes (state vector index 16). */
export const POSITION_SOURCES = ["ADS-B", "ASTERIX", "MLAT", "FLARM"] as const;
