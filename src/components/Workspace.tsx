"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EarthquakeFeed, IssFeed, PlanetaryKpFeed, SourceSyncState } from "@/types";
import {
  ISS_SYNC,
  NOAA_KP_SYNC,
  USGS_SYNC,
  aggregateHealth,
  deriveHealth,
  type SyncConfig,
} from "@/lib/source-health";
import { USGS_EARTHQUAKES_SOURCE } from "@/lib/sources/usgs/source";
import { ISS_ENTITY_ID, WTIA_ISS_SOURCE } from "@/lib/sources/wtia/source";
import { NOAA_SWPC_KP_SOURCE } from "@/lib/sources/noaa/source";
import { appendTrailPoint, trailToSegments, type TrailPoint } from "@/lib/iss-trail";
import Topbar from "@/components/layout/Topbar";
import Sidebar from "@/components/layout/Sidebar";
import StatusBar from "@/components/layout/StatusBar";
import MapView from "@/components/map/MapView";
import EarthquakePanel from "@/components/panel/EarthquakePanel";
import IssPanel from "@/components/panel/IssPanel";
import SpaceWeatherPanel from "@/components/panel/SpaceWeatherPanel";
import { useSourceSync, type SourceSync } from "./useSourceSync";

/** Display clock for relative times and freshness; never triggers a fetch. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function toSyncState(
  sourceId: string,
  sync: SourceSync<{ metadata: { ingestedAt: string } }>,
  config: SyncConfig,
  now: number,
): SourceSyncState & { snapshotAgeMs: number | null } {
  const snapshotAgeMs =
    sync.ageAtReceiptMs !== undefined && sync.receivedAtMs !== undefined
      ? sync.ageAtReceiptMs + Math.max(0, now - sync.receivedAtMs)
      : null;
  return {
    sourceId,
    health: deriveHealth({
      hasSnapshot: sync.snapshot !== null,
      attempted: sync.attempted,
      lastAttemptFailed: sync.lastAttemptFailed,
      snapshotAgeMs,
      freshnessWindowMs: config.freshnessWindowMs,
    }),
    lastAttemptAt: sync.lastAttemptAt,
    lastSuccessAt: sync.lastSuccessAt,
    lastIngestedAt: sync.snapshot?.metadata.ingestedAt,
    snapshotAgeMs,
  };
}

/**
 * What the single right-hand panel shows: a selected Entity (map data) or a
 * domain view of global, non-geographic data (no Entity, nothing on the map).
 */
export type PanelTarget =
  | { type: "entity"; entityId: string }
  | { type: "domain"; domain: "space" };

/** Clears an entity target when that entity left its source; domain targets are kept. */
const pruneEntity =
  (stillExists: (entityId: string) => boolean, owns: (entityId: string) => boolean) =>
  (target: PanelTarget | null): PanelTarget | null =>
    target?.type === "entity" && owns(target.entityId) && !stillExists(target.entityId)
      ? null
      : target;

const noop = () => {};

/**
 * Client shell that owns the data state shared by topbar, map, sidebar,
 * panel and status bar. Each source syncs independently and has its own
 * SourceHealth; only the latest snapshot of each is kept (no history). The
 * one exception is the ISS recent tracked path: a bounded in-memory list of
 * received positions (see lib/iss-trail.ts), never persisted.
 * Entity selection is keyed by Entity ID, never by Observation ID: it survives
 * updates of the same entity and is cleared when the entity leaves its source.
 */
export default function Workspace() {
  const [panelTarget, setPanelTarget] = useState<PanelTarget | null>(null);
  const selectedEntityId = panelTarget?.type === "entity" ? panelTarget.entityId : null;
  const selectEntity = useCallback((entityId: string) => {
    setPanelTarget({ type: "entity", entityId });
  }, []);

  const onUsgsSnapshot = useCallback((feed: EarthquakeFeed) => {
    setPanelTarget(
      pruneEntity(
        (id) => feed.entities.some((e) => e.id === id),
        (id) => id.startsWith("earthquake:"),
      ),
    );
  }, []);
  const [issTrail, setIssTrail] = useState<TrailPoint[]>([]);
  const onIssSnapshot = useCallback((feed: IssFeed) => {
    setPanelTarget(
      pruneEntity(
        (id) => feed.entities.some((e) => e.id === id),
        (id) => id === ISS_ENTITY_ID,
      ),
    );
    // Only received positions extend the path; failed polls add nothing.
    const observation = feed.observations.find((o) => o.entityId === ISS_ENTITY_ID);
    if (observation?.location && observation.observedAt) {
      const point = {
        lon: observation.location.longitude,
        lat: observation.location.latitude,
        t: Date.parse(observation.observedAt),
        altitudeKm: observation.data.altitudeKm,
      };
      setIssTrail((trail) => appendTrailPoint(trail, point));
    }
  }, []);
  const issTrailSegments = useMemo(() => trailToSegments(issTrail), [issTrail]);

  const usgs = useSourceSync<EarthquakeFeed>(
    "/api/earthquakes",
    USGS_SYNC.pollIntervalMs,
    "Earthquake",
    onUsgsSnapshot,
  );
  const iss = useSourceSync<IssFeed>(
    "/api/space/iss",
    ISS_SYNC.pollIntervalMs,
    "ISS",
    onIssSnapshot,
  );
  // Global index, no entity: only feeds the SPACE domain panel.
  const kp = useSourceSync<PlanetaryKpFeed>(
    "/api/space/weather/kp",
    NOAA_KP_SYNC.pollIntervalMs,
    "NOAA SWPC Kp",
    noop,
  );
  const now = useNow(1000);

  const usgsState = toSyncState(USGS_EARTHQUAKES_SOURCE.id, usgs, USGS_SYNC, now);
  const issState = toSyncState(WTIA_ISS_SOURCE.id, iss, ISS_SYNC, now);
  const kpState = toSyncState(NOAA_SWPC_KP_SOURCE.id, kp, NOAA_KP_SYNC, now);
  const globalHealth = aggregateHealth([usgsState.health, issState.health, kpState.health]);

  const sources = [
    { id: USGS_EARTHQUAKES_SOURCE.id, name: USGS_EARTHQUAKES_SOURCE.name, state: usgsState },
    { id: WTIA_ISS_SOURCE.id, name: WTIA_ISS_SOURCE.name, state: issState },
    { id: NOAA_SWPC_KP_SOURCE.id, name: NOAA_SWPC_KP_SOURCE.name, state: kpState },
  ];
  const sourceSummary = sources
    .map((s) => `${s.name}: ${s.state.health.toUpperCase()}`)
    .join(" · ");

  useEffect(() => {
    if (!panelTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelTarget(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panelTarget]);

  // At most one panel: a domain view, or the selected entity (which belongs to exactly one source).
  let panel: React.ReactNode = null;
  const close = () => setPanelTarget(null);
  if (panelTarget?.type === "domain") {
    panel = <SpaceWeatherPanel feed={kp.snapshot} sourceHealth={kpState.health} onClose={close} />;
  } else if (selectedEntityId === ISS_ENTITY_ID && iss.snapshot) {
    const entity = iss.snapshot.entities.find((e) => e.id === selectedEntityId);
    const observation = iss.snapshot.observations.find((o) => o.entityId === selectedEntityId);
    if (entity && observation) {
      panel = (
        <IssPanel
          key={entity.id}
          entity={entity}
          observation={observation}
          trail={{ points: issTrail.length, since: issTrail[0]?.t }}
          source={iss.snapshot.source}
          sourceHealth={issState.health}
          onClose={close}
        />
      );
    }
  } else if (selectedEntityId && usgs.snapshot) {
    const entity = usgs.snapshot.entities.find((e) => e.id === selectedEntityId);
    const observation = usgs.snapshot.observations.find((o) => o.entityId === selectedEntityId);
    if (entity && observation) {
      panel = (
        <EarthquakePanel
          key={entity.id}
          entity={entity}
          observation={observation}
          source={usgs.snapshot.source}
          sourceHealth={usgsState.health}
          onClose={close}
        />
      );
    }
  }

  return (
    <>
      <Topbar health={globalHealth} sourceSummary={sourceSummary} />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          activeDomain={panelTarget?.type === "domain" ? panelTarget.domain : null}
          onOpenDomain={(domain) => setPanelTarget({ type: "domain", domain })}
          sources={sources.map((s) => ({
            id: s.id,
            name: s.name,
            health: s.state.health,
            ageMs: s.state.snapshotAgeMs,
          }))}
        />
        <main className="relative min-w-0 flex-1">
          <MapView
            earthquakes={usgs.snapshot}
            iss={iss.snapshot}
            issTrail={issTrailSegments}
            issPositions={issTrail}
            selectedEntityId={panel ? selectedEntityId : null}
            onSelectEntity={selectEntity}
          />
        </main>
        {panel}
      </div>
      <StatusBar
        sourceCount={[usgs.snapshot, iss.snapshot, kp.snapshot].filter(Boolean).length}
        // Kp creates no Entity: only earthquakes and the ISS count.
        entityCount={
          (usgs.snapshot?.entities.length ?? 0) + (iss.snapshot?.entities.length ?? 0)
        }
        health={globalHealth}
      />
    </>
  );
}
