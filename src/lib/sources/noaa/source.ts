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

/** NOAA SWPC OVATION aurora forecast: same provider as Kp, independent product and health. */
export const NOAA_SWPC_OVATION_SOURCE: IntelligenceSource = {
  id: "noaa-swpc-ovation",
  name: "NOAA SWPC — OVATION Aurora",
  provider: "NOAA Space Weather Prediction Center",
  category: "government",
  url: "https://www.swpc.noaa.gov/products/aurora-30-minute-forecast",
  // No formal reliability methodology exists yet.
  reliability: "unknown",
  description: "OVATION model short-term (30–90 min) forecast of aurora location and intensity, 1° global grid.",
};

/** Official JSON product (public, no authentication). */
export const NOAA_SWPC_OVATION_URL = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";
