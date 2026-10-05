"use client";

import { useCallback, useEffect, useState } from "react";
import type { EarthquakeFeed, SourceSyncState } from "@/types";
import { deriveHealth } from "@/lib/source-health";
import { USGS_EARTHQUAKES_SOURCE } from "@/lib/sources/usgs/source";
import Topbar from "@/components/layout/Topbar";
import Sidebar from "@/components/layout/Sidebar";
import StatusBar from "@/components/layout/StatusBar";
import MapView from "@/components/map/MapView";
import IntelligencePanel from "@/components/panel/IntelligencePanel";
import { useEarthquakeSync } from "./useEarthquakeSync";

/** Display clock for relative times and freshness; never triggers a fetch. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Client shell that owns the data state shared by topbar, map, sidebar,
 * panel and status bar. Shows only the latest snapshot (no history).
 * Selection is keyed by Entity ID, never by Observation ID, so it survives
 * USGS updates of the same event and is cleared when the entity leaves.
 */
export default function Workspace() {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const onSnapshot = useCallback((feed: EarthquakeFeed) => {
    setSelectedEntityId((id) =>
      id && feed.entities.some((e) => e.id === id) ? id : null,
    );
  }, []);

  const sync = useEarthquakeSync(onSnapshot);
  const now = useNow(1000);
  const snapshot = sync.snapshot;

  const snapshotAgeMs =
    sync.ageAtReceiptMs !== undefined && sync.receivedAtMs !== undefined
      ? sync.ageAtReceiptMs + Math.max(0, now - sync.receivedAtMs)
      : null;

  const syncState: SourceSyncState = {
    sourceId: USGS_EARTHQUAKES_SOURCE.id,
    health: deriveHealth({
      hasSnapshot: snapshot !== null,
      attempted: sync.attempted,
      lastAttemptFailed: sync.lastAttemptFailed,
      snapshotAgeMs,
    }),
    lastAttemptAt: sync.lastAttemptAt,
    lastSuccessAt: sync.lastSuccessAt,
    lastIngestedAt: snapshot?.metadata.ingestedAt,
  };

  useEffect(() => {
    if (!selectedEntityId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedEntityId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEntityId]);

  const selectedEntity = snapshot?.entities.find((e) => e.id === selectedEntityId);
  const selectedObservation = snapshot?.observations.find(
    (o) => o.entityId === selectedEntityId,
  );

  return (
    <>
      <Topbar health={syncState.health} />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          sources={[
            {
              id: USGS_EARTHQUAKES_SOURCE.id,
              name: USGS_EARTHQUAKES_SOURCE.name,
              health: syncState.health,
              ageMs: snapshotAgeMs,
            },
          ]}
        />
        <main className="relative min-w-0 flex-1">
          <MapView
            earthquakes={snapshot}
            selectedEntityId={selectedEntity ? selectedEntity.id : null}
            onSelectEntity={setSelectedEntityId}
          />
        </main>
        {snapshot && selectedEntity && selectedObservation && (
          <IntelligencePanel
            key={selectedEntity.id}
            entity={selectedEntity}
            observation={selectedObservation}
            source={snapshot.source}
            onClose={() => setSelectedEntityId(null)}
          />
        )}
      </div>
      <StatusBar
        sourceCount={snapshot ? 1 : 0}
        entityCount={snapshot?.entities.length ?? 0}
        health={syncState.health}
      />
    </>
  );
}
