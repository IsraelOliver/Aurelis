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

/** RTSW product page (both RTSW feeds). */
const RTSW_PAGE = "https://www.swpc.noaa.gov/products/real-time-solar-wind";

/** NOAA SWPC RTSW plasma: independent feed and health (spacecraft can differ from the mag feed). */
export const NOAA_SWPC_RTSW_WIND_SOURCE: IntelligenceSource = {
  id: "noaa-swpc-rtsw-wind",
  name: "NOAA SWPC — Real-Time Solar Wind Plasma",
  provider: "NOAA Space Weather Prediction Center",
  category: "government",
  url: RTSW_PAGE,
  // No formal reliability methodology exists yet.
  reliability: "unknown",
  description: "In situ solar wind plasma (proton speed, density, temperature) from spacecraft upstream of Earth, 1-minute samples.",
};

/** NOAA SWPC RTSW magnetic field: independent feed and health. */
export const NOAA_SWPC_RTSW_MAG_SOURCE: IntelligenceSource = {
  id: "noaa-swpc-rtsw-mag",
  name: "NOAA SWPC — Real-Time Solar Wind Magnetic Field",
  provider: "NOAA Space Weather Prediction Center",
  category: "government",
  url: RTSW_PAGE,
  reliability: "unknown",
  description: "In situ interplanetary magnetic field (GSM components, Bt) from spacecraft upstream of Earth, 1-minute samples.",
};

/** 2026 replacement RTSW products (SCN 26-21); public, no authentication. */
export const NOAA_SWPC_RTSW_WIND_URL = "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json";
export const NOAA_SWPC_RTSW_MAG_URL = "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json";

/**
 * NOAA SWPC GOES X-ray (primary): flux series and the latest-event file are
 * one operational product, one source and one health.
 */
export const NOAA_SWPC_GOES_XRAY_SOURCE: IntelligenceSource = {
  id: "noaa-swpc-goes-xray",
  name: "NOAA SWPC — GOES X-ray Flux",
  provider: "NOAA Space Weather Prediction Center",
  category: "government",
  url: "https://www.swpc.noaa.gov/products/goes-x-ray-flux",
  // No formal reliability methodology exists yet.
  reliability: "unknown",
  description: "GOES XRS full-Sun X-ray flux (1-minute, primary satellite) and the latest X-ray event.",
};

/** Primary operational feed (public, no authentication). */
export const NOAA_SWPC_GOES_XRAY_FLUX_URL = "https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json";
export const NOAA_SWPC_GOES_XRAY_FLARE_URL = "https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json";
