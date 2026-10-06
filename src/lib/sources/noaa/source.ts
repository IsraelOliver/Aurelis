import type { IntelligenceSource } from "@/types";

/** Static description of the NOAA SWPC planetary Kp source; safe to import in client code. */
export const NOAA_SWPC_KP_SOURCE: IntelligenceSource = {
  id: "noaa-swpc-kp",
  name: "NOAA SWPC — Planetary Kp",
  provider: "NOAA Space Weather Prediction Center",
  category: "government",
  url: "https://www.swpc.noaa.gov/products/planetary-k-index",
  // No formal reliability methodology exists yet (being NOAA does not set it).
  reliability: "unknown",
  description: "Near-real-time estimated planetary Kp index, 1-minute samples.",
};

/** Official JSON product (public, no authentication). */
export const NOAA_SWPC_KP_URL = "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";
