import type { AirTrafficFeed } from "@/types";
import { AIR_QUOTA_RESERVE_REFRESHES } from "./sources/opensky/source";

/**
 * AIR quota/activity policy (pure). Polling happens only while AIR is active:
 * the AIR panel or a selected aircraft is open AND aircraft are shown.
 */
export const isAirActive = (airDomainOpen: boolean, aircraftVisible: boolean) => airDomainOpen && aircraftVisible;

/**
 * Remaining OpenSky credits cover at most AIR_QUOTA_RESERVE_REFRESHES more
 * refreshes: automatic refresh pauses (an explicit single refresh stays possible).
 * Unknown remaining credits never pause.
 */
export const isAirQuotaLow = (feed: AirTrafficFeed | null) =>
  feed !== null &&
  feed.metadata.creditsRemaining !== null &&
  feed.metadata.creditsRemaining <= feed.metadata.creditsPerRequest * AIR_QUOTA_RESERVE_REFRESHES;
