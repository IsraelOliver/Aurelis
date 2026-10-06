import type { EarthquakeFeed, EonetFeed, SourceHealth } from "@/types";
import { DEFAULT_LAYER_VISIBILITY, type MapLayerVisibility } from "@/lib/map-layers";
import {
  DEFAULT_EONET_FILTERS,
  RECENCY_OPTIONS,
  isDefaultEonetFilters,
  type EonetViewFilters,
} from "@/lib/eonet-filters";
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

/** Compact option chip (filters); gold-free: a selection of view, not an action. */
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-6 rounded border px-2 text-[9.5px] font-medium tracking-[0.16em] transition-colors ${
        active ? "border-line-strong bg-deep text-fg" : "border-line text-fg-subtle hover:text-fg-muted"
      }`}
    >
      {children}
    </button>
  );
}

/** Above this many categories the chips become a select. */
const MAX_CATEGORY_CHIPS = 6;

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
  eonetFilters,
  onSetEonetFilters,
  eonetInViewCount,
  eonetCategories,
  onClose,
}: {
  earthquakes: EarthquakeFeed | null;
  earthquakesHealth: SourceHealth;
  eonet: EonetFeed | null;
  eonetHealth: SourceHealth;
  layerVisibility: MapLayerVisibility;
  onSetLayers: (next: Partial<MapLayerVisibility>) => void;
  /** EONET view filters (visualization only; never change the ingested data). */
  eonetFilters: EonetViewFilters;
  onSetEonetFilters: (next: EonetViewFilters) => void;
  /** Ingested events that pass the current filters (drawn when the layer is visible). */
  eonetInViewCount: number;
  /** Categories present in the snapshot, with total counts. */
  eonetCategories: { id: string; title: string; count: number }[];
  onClose: () => void;
}) {
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
        {eonet && (
          <div className="mt-1 flex flex-col gap-2">
            <Row label="MAP VIEW">
              <span className="font-mono">
                {count.format(eonetInViewCount)} OF {count.format(eonet.entities.length)}
              </span>
              {eonetInViewCount === 0 && <Note>No EONET events match the current map filters.</Note>}
              {!layerVisibility.eonet && <Note>Layer hidden; filters apply when shown.</Note>}
            </Row>
            <div>
              <p className="mb-1 text-[10px] font-medium tracking-[0.18em] text-fg-subtle">RECENCY</p>
              <div className="flex flex-wrap gap-1">
                {RECENCY_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    active={eonetFilters.recency === o.value}
                    onClick={() => onSetEonetFilters({ ...eonetFilters, recency: o.value })}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
              <Note>
                By each event&apos;s latest EONET geometry date (often 00:00Z); not when it started or
                whether it is active. ALL OPEN: every event open in EONET.
              </Note>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-medium tracking-[0.18em] text-fg-subtle">CATEGORY</p>
              {eonetCategories.length <= MAX_CATEGORY_CHIPS ? (
                <div className="flex flex-wrap gap-1">
                  <Chip
                    active={eonetFilters.categoryId === null}
                    onClick={() => onSetEonetFilters({ ...eonetFilters, categoryId: null })}
                  >
                    ALL
                  </Chip>
                  {eonetCategories.map((c) => (
                    <Chip
                      key={c.id}
                      active={eonetFilters.categoryId === c.id}
                      onClick={() => onSetEonetFilters({ ...eonetFilters, categoryId: c.id })}
                    >
                      {c.title.toUpperCase()} <span className="font-mono tracking-normal">{count.format(c.count)}</span>
                    </Chip>
                  ))}
                </div>
              ) : (
                <select
                  value={eonetFilters.categoryId ?? ""}
                  onChange={(e) => onSetEonetFilters({ ...eonetFilters, categoryId: e.target.value || null })}
                  className="h-7 w-full rounded border border-line bg-surface px-2 text-[11px] text-fg"
                >
                  <option value="">All categories</option>
                  {eonetCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({count.format(c.count)})
                    </option>
                  ))}
                </select>
              )}
            </div>
            {!isDefaultEonetFilters(eonetFilters) && (
              <button
                type="button"
                onClick={() => onSetEonetFilters(DEFAULT_EONET_FILTERS)}
                className="self-start text-[10px] font-medium tracking-[0.2em] text-fg-subtle transition-colors hover:text-fg"
              >
                RESET FILTERS
              </button>
            )}
          </div>
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
