"use client";

import dynamic from "next/dynamic";
import type { EarthquakeFeed, IssFeed } from "@/types";

const WorldMap = dynamic(() => import("./WorldMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-[10px] tracking-[0.24em] text-fg-subtle">
      LOADING MAP
    </div>
  ),
});

export default function MapView({
  earthquakes,
  iss,
  selectedEntityId,
  onSelectEntity,
}: {
  earthquakes: EarthquakeFeed | null;
  iss: IssFeed | null;
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
}) {
  return (
    <div className="relative h-full w-full bg-base">
      <WorldMap
        earthquakes={earthquakes}
        iss={iss}
        selectedEntityId={selectedEntityId}
        onSelectEntity={onSelectEntity}
      />
    </div>
  );
}
