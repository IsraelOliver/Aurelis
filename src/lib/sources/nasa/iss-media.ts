import { ISS_ENTITY_ID } from "@/lib/sources/wtia/source";

/**
 * Official external media associated with the ISS entity.
 * Not a telemetry source: it is not polled, has no SourceHealth and is not
 * counted in SOURCES/ENTITIES. AURELIS does not host or relay the video; it
 * only embeds NASA's official YouTube player, loaded on user action.
 */
export interface IssMediaSource {
  id: string;
  /** Entity this media belongs to. */
  entityId: string;
  /** Title as published by the provider (kept for provenance; not shown as a claim). */
  title: string;
  provider: "NASA";
  platform: "youtube";
  videoId: string;
  watchUrl: string;
  embedUrl: string;
  /** Official channel that publishes the stream. */
  sourceUrl: string;
  note?: string;
}

/**
 * Verified 2026-10-05: NASA channel (@NASA, UCLA_DiR1FfKNvjuUpBHmylQ),
 * live and embeddable. NASA's description: external camera on the Harmony
 * module; when unavailable, a loop of recorded Earth views is shown with the
 * caption "Previously Recorded".
 */
export const NASA_ISS_STREAM: IssMediaSource = {
  id: "nasa-iss-hd-views",
  entityId: ISS_ENTITY_ID,
  title:
    "Live High-Definition Views from the International Space Station (Official NASA Stream)",
  provider: "NASA",
  platform: "youtube",
  videoId: "awQzjn72bI0",
  watchUrl: "https://www.youtube.com/watch?v=awQzjn72bI0",
  // Privacy-enhanced domain; no autoplay; related videos limited to the same channel.
  embedUrl: "https://www.youtube-nocookie.com/embed/awQzjn72bI0?rel=0",
  sourceUrl: "https://www.youtube.com/@NASA",
  note: "External camera on the station's Harmony module, per NASA.",
};
