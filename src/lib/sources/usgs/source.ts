import type { IntelligenceSource } from "@/types";

/** Static description of the USGS source; safe to import in client code. */
export const USGS_EARTHQUAKES_SOURCE: IntelligenceSource = {
  id: "usgs-earthquakes",
  name: "USGS Earthquakes",
  provider: "U.S. Geological Survey",
  category: "government",
  url: "https://earthquake.usgs.gov/earthquakes/feed/",
  // No formal reliability methodology exists yet; being a government agency is not one.
  reliability: "unknown",
  description: "USGS real-time earthquake feed, magnitude 2.5+, past day.",
};
