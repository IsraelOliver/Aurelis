import type { IntelligenceSource } from "@/types";

/** Static description of the Where The ISS At? source; safe to import in client code. */
export const WTIA_ISS_SOURCE: IntelligenceSource = {
  id: "wtia-iss",
  name: "Where The ISS At?",
  provider: "Where The ISS At?",
  category: "open-data",
  url: "https://wheretheiss.at/w/developer",
  // No formal reliability methodology exists yet.
  reliability: "unknown",
  description: "Computed current position of the International Space Station (NORAD 25544).",
};

/** Deterministic AURELIS id of the ISS entity. */
export const ISS_ENTITY_ID = "space:norad:25544";
