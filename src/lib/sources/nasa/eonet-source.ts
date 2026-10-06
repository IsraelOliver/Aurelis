import type { IntelligenceSource } from "@/types";

/** Static description of the NASA EONET source; safe to import in client code. */
export const NASA_EONET_SOURCE: IntelligenceSource = {
  id: "nasa-eonet",
  name: "NASA EONET",
  provider: "NASA — Earth Observatory Natural Event Tracker (EONET)",
  category: "government",
  url: "https://eonet.gsfc.nasa.gov/",
  // No formal reliability methodology exists yet (being NASA does not set it).
  reliability: "unknown",
  description:
    "Curated natural events (open in EONET) aggregated from upstream sources; approximate extents, for visualization and general information.",
};

export const NASA_EONET_EVENTS_URL = "https://eonet.gsfc.nasa.gov/api/v3/events";

/** Deterministic AURELIS id of an EONET event entity. */
export const eonetEntityId = (eonetId: string) => `disaster:eonet:${eonetId}`;
export const EONET_ENTITY_PREFIX = "disaster:eonet:";
