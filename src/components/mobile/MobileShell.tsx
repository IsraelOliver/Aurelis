"use client";

import { useState } from "react";
import type { GlobalHealth } from "@/types";
import type { CategoryId } from "@/lib/categories";
import type { DomainId } from "@/components/Workspace";
import type { SidebarSource } from "@/components/layout/Sidebar";
import MobileTabBar, { type MobileTab } from "./MobileTabBar";
import MobileMapHeader from "./MobileMapHeader";
import LayersMenu from "./LayersMenu";
import SourceStatusSheet from "./SourceStatusSheet";
import MobileSettings from "./MobileSettings";

const titleCase = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);

/**
 * The phone app shell (Tailwind `phone`: below md, or short below lg):
 * presentation only. Workspace keeps the core — data hooks, selection,
 * domain, SMILEY conversation — and the single map; this shell adds the
 * phone's navigation (tab bar), the map toolbar with its Layers stack, and
 * the Sources sheet. SMILEY (SmileyDock) and the context sheet (PanelDock)
 * are shared docks that take their phone form (`phone`). Nothing here
 * renders on tablets or desktop.
 */
export default function MobileShell({
  tab,
  onTab,
  health,
  sources,
  sourceCount,
  entityCount,
  activeDomain,
  domainCounts,
  onWorld,
  onDomain,
}: {
  tab: MobileTab;
  onTab: (tab: MobileTab) => void;
  health: GlobalHealth;
  sources: SidebarSource[];
  sourceCount: number;
  entityCount: number;
  activeDomain: DomainId | null;
  domainCounts: Partial<Record<CategoryId, string>>;
  onWorld: () => void;
  onDomain: (domain: DomainId) => void;
}) {
  const [layersOpen, setLayersOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const closeLayers = () => setLayersOpen(false);

  return (
    <>
      {/* Outside tap folds the Layers stack (it consumes the tap: the map does not also react). Above the
          context sheet (z-30), below the map header (z-35) that carries the stack. */}
      {layersOpen && <div className="fixed inset-0 z-[34] not-phone:hidden" aria-hidden="true" onPointerDown={closeLayers} />}
      <MobileMapHeader
        health={health}
        domainLabel={activeDomain ? titleCase(activeDomain) : null}
        onOpenStatus={() => {
          closeLayers();
          setSourcesOpen(true);
        }}
        layersOpen={layersOpen}
        onToggleLayers={() => setLayersOpen((o) => !o)}
      >
        <LayersMenu
          open={layersOpen}
          onClose={closeLayers}
          activeDomain={activeDomain}
          counts={domainCounts}
          onWorld={onWorld}
          onDomain={onDomain}
        />
      </MobileMapHeader>
      {tab === "settings" && (
        <MobileSettings
          health={health}
          sources={sources}
          sourceCount={sourceCount}
          entityCount={entityCount}
          onOpenSources={() => setSourcesOpen(true)}
        />
      )}
      <MobileTabBar
        tab={tab}
        onTab={(t) => {
          closeLayers();
          setSourcesOpen(false);
          onTab(t);
        }}
      />
      <SourceStatusSheet
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
        health={health}
        sources={sources}
        sourceCount={sourceCount}
        entityCount={entityCount}
      />
    </>
  );
}
