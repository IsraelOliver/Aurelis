"use client";

import { useCallback, useEffect, useState } from "react";
import type { EarthquakeFeed, IssFeed, SourceSyncState } from "@/types";
import {
  ISS_SYNC,
  USGS_SYNC,
  aggregateHealth,
  deriveHealth,
  type SyncConfig,
} from "@/lib/source-health";
import { USGS_EARTHQUAKES_SOURCE } from "@/lib/sources/usgs/source";
import { ISS_ENTITY_ID, WTIA_ISS_SOURCE } from "@/lib/sources/wtia/source";
import Topbar from "@/components/layout/Topbar";
import Sidebar from "@/components/layout/Sidebar";
import StatusBar from "@/components/layout/StatusBar";
import MapView from "@/components/map/MapView";
import EarthquakePanel from "@/components/panel/EarthquakePanel";
import IssPanel from "@/components/panel/IssPanel";
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
 * Client shell that owns the data state shared by topbar, map, sidebar,
 * panel and status bar. Each source syncs independently and has its own
 * SourceHealth; only the latest snapshot of each is kept (no history).
 * Selection is keyed by Entity ID, never by Observation ID: it survives
 * updates of the same entity and is cleared when the entity leaves its source.
 */
export default function Workspace() {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const onUsgsSnapshot = useCallback((feed: EarthquakeFeed) => {
    setSelectedEntityId((id) =>
      id?.startsWith("earthquake:") && !feed.entities.some((e) => e.id === id) ? null : id,
    );
  }, []);
  const onIssSnapshot = useCallback((feed: IssFeed) => {
    setSelectedEntityId((id) =>
      id === ISS_ENTITY_ID && !feed.entities.some((e) => e.id === id) ? null : id,
    );
  }, []);

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
  const now = useNow(1000);

  const usgsState = toSyncState(USGS_EARTHQUAKES_SOURCE.id, usgs, USGS_SYNC, now);
  const issState = toSyncState(WTIA_ISS_SOURCE.id, iss, ISS_SYNC, now);
  const globalHealth = aggregateHealth([usgsState.health, issState.health]);

  const sources = [
    { id: USGS_EARTHQUAKES_SOURCE.id, name: USGS_EARTHQUAKES_SOURCE.name, state: usgsState },
    { id: WTIA_ISS_SOURCE.id, name: WTIA_ISS_SOURCE.name, state: issState },
  ];
  const sourceSummary = sources
    .map((s) => `${s.name}: ${s.state.health.toUpperCase()}`)
    .join(" · ");

  useEffect(() => {
    if (!selectedEntityId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedEntityId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEntityId]);

  // At most one panel: the selected entity belongs to exactly one source.
  let panel: React.ReactNode = null;
  const close = () => setSelectedEntityId(null);
  if (selectedEntityId === ISS_ENTITY_ID && iss.snapshot) {
    const entity = iss.snapshot.entities.find((e) => e.id === selectedEntityId);
    const observation = iss.snapshot.observations.find((o) => o.entityId === selectedEntityId);
    if (entity && observation) {
      panel = (
        <IssPanel
          key={entity.id}
          entity={entity}
          observation={observation}
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
            selectedEntityId={panel ? selectedEntityId : null}
            onSelectEntity={setSelectedEntityId}
          />
        </main>
        {panel}
      </div>
      <StatusBar
        sourceCount={[usgs.snapshot, iss.snapshot].filter(Boolean).length}
        entityCount={
          (usgs.snapshot?.entities.length ?? 0) + (iss.snapshot?.entities.length ?? 0)
        }
        health={globalHealth}
      />
    </>
  );
}
