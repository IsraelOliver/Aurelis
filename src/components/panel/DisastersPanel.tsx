import type { EarthquakeFeed, EonetFeed, SourceHealth } from "@/types";
import { DEFAULT_LAYER_VISIBILITY, type MapLayerVisibility } from "@/lib/map-layers";
import { EMPTY, Note, PanelShell, Row, Section } from "./primitives";

const count = new Intl.NumberFormat("en-US");

/** Map toggle, same look as SHOW ON MAP / HIDE AURORA. */
function LayerToggle({
  visible,
  disabled,
  onClick,
  showLabel,
  hideLabel,
}: {
  visible: boolean;
  disabled: boolean;
  onClick: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={visible}
      className={`h-7 rounded border px-3 text-[10px] font-medium tracking-[0.2em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        visible
          ? "border-gold/60 text-gold hover:border-gold"
          : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
      }`}
    >
      {visible ? hideLabel : showLabel}
    </button>
  );
}

/**
 * DISASTERS domain panel: a minimal summary (no filters) with one map toggle
 * per dataset. Counts are the DATA that exists in the loaded snapshots, not
 * what is drawn; toggles change map visibility only. EONET counts are events
 * open in EONET (earthquakes excluded, USGS covers them), not a complete
 * hazard catalog.
 */
export default function DisastersPanel({
  earthquakes,
  earthquakesHealth,
  eonet,
  eonetHealth,
  layerVisibility,
  onSetLayers,
  onClose,
}: {
  earthquakes: EarthquakeFeed | null;
  earthquakesHealth: SourceHealth;
  eonet: EonetFeed | null;
  eonetHealth: SourceHealth;
  layerVisibility: MapLayerVisibility;
  onSetLayers: (next: Partial<MapLayerVisibility>) => void;
  onClose: () => void;
}) {
  const byCategory = new Map<string, number>();
  for (const o of eonet?.observations ?? []) {
    for (const c of o.data.categories) byCategory.set(c.title, (byCategory.get(c.title) ?? 0) + 1);
  }
  const anyVisible = layerVisibility.earthquakes || layerVisibility.eonet;

  return (
    <PanelShell eyebrow="DISASTERS" title="Disasters" onClose={onClose}>
      <Section title="EARTHQUAKES · 24H">
        <div className="flex items-center gap-3 py-1.5">
          <span className="font-mono text-[22px] leading-none text-fg">
            {earthquakes ? count.format(earthquakes.entities.length) : EMPTY}
          </span>
          <span className="ml-auto">
            <LayerToggle
              visible={layerVisibility.earthquakes}
              disabled={!earthquakes}
              onClick={() => onSetLayers({ earthquakes: !layerVisibility.earthquakes })}
              showLabel="SHOW EARTHQUAKES"
              hideLabel="HIDE EARTHQUAKES"
            />
          </span>
        </div>
        <Row label="SOURCE">
          USGS Earthquakes
          <Note>{earthquakesHealth.toUpperCase()} · M2.5+, past 24 hours.</Note>
        </Row>
      </Section>

      <Section title="EONET OPEN EVENTS">
        <div className="flex items-center gap-3 py-1.5">
          <span className="font-mono text-[22px] leading-none text-fg">
            {eonet ? count.format(eonet.entities.length) : EMPTY}
          </span>
          <span className="ml-auto">
            <LayerToggle
              visible={layerVisibility.eonet}
              disabled={!eonet}
              onClick={() => onSetLayers({ eonet: !layerVisibility.eonet })}
              showLabel="SHOW EONET ON MAP"
              hideLabel="HIDE EONET"
            />
          </span>
        </div>
        {byCategory.size > 0 && (
          <Note>
            {[...byCategory.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([title, n]) => `${title} ${count.format(n)}`)
              .join(" · ")}
          </Note>
        )}
        <Row label="SOURCE">
          NASA EONET
          <Note>{eonetHealth.toUpperCase()}</Note>
        </Row>
        <Note>
          EONET counts reflect events currently open in EONET, not a complete catalog of all natural
          hazards. Earthquakes come from USGS only.
        </Note>
      </Section>

      <div className="border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={() =>
            onSetLayers(
              anyVisible
                ? { earthquakes: false, eonet: false }
                : { earthquakes: DEFAULT_LAYER_VISIBILITY.earthquakes, eonet: DEFAULT_LAYER_VISIBILITY.eonet },
            )
          }
          className="text-[10px] font-medium tracking-[0.2em] text-fg-subtle transition-colors hover:text-fg"
        >
          {anyVisible ? "HIDE ALL" : "SHOW DEFAULT"}
        </button>
        <Note>Map visibility only; data keeps syncing.</Note>
      </div>
    </PanelShell>
  );
}
