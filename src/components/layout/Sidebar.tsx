import { CATEGORIES } from "@/lib/categories";
import { formatAgo } from "@/lib/format";
import type { SourceHealth } from "@/types";
import CategoryIcon from "./CategoryIcon";

export interface SidebarSource {
  id: string;
  name: string;
  health: SourceHealth;
  /** Age of the shown snapshot (from ingestedAt); null when there is none. */
  ageMs: number | null;
}

/**
 * Layer list. Categories are not wired to filters yet.
 * The `data-active` styles (gold bar + deep blue) are prepared for the future
 * filter; nothing sets it today, so no row pretends to be filtering.
 */
export default function Sidebar({ sources }: { sources: SidebarSource[] }) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="flex h-10 items-center px-4">
        <span className="text-[10px] font-medium tracking-[0.28em] text-fg-subtle">
          LAYERS
        </span>
      </div>

      <ul className="flex flex-col gap-px px-2">
        {CATEGORIES.map((category) => (
          <li
            key={category.id}
            className="group relative flex h-9 items-center gap-3 rounded px-3 text-fg-muted transition-colors hover:bg-elevated hover:text-fg data-[active=true]:bg-deep data-[active=true]:text-fg"
            title="Layer controls not available yet"
          >
            <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-gold opacity-0 group-data-[active=true]:opacity-100" />
            <span className="text-fg-subtle transition-colors group-hover:text-fg-muted">
              <CategoryIcon id={category.id} />
            </span>
            <span className="text-[11px] font-medium tracking-[0.16em]">
              {category.label}
            </span>
            <span className="ml-auto font-mono text-[10px] text-fg-subtle">
              —
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto border-t border-line px-4 py-3 text-[11px] leading-relaxed text-fg-subtle">
        <p className="text-[10px] font-medium tracking-[0.2em]">SOURCES</p>
        <ul className="mt-1 flex flex-col gap-1.5">
          {sources.map((source) => (
            <li key={source.id}>
              <span className="text-fg-muted">{source.name}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[9.5px] font-medium tracking-[0.16em]">
                <span
                  className={`size-1.5 rounded-full ${
                    source.health === "fresh" ? "bg-cyan" : "border border-fg-subtle"
                  }`}
                  aria-hidden="true"
                />
                {source.health.toUpperCase()}
                {source.ageMs !== null && (
                  <span className="font-mono tracking-normal">
                    · UPDATED {formatAgo(source.ageMs).toUpperCase()}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
