import type { SourceHealth } from "@/types";
import { formatUtc } from "@/lib/format";

/**
 * Shared building blocks of the Intelligence Panel (one panel at a time).
 * Desktop (`lg`+, AURELIS 1.1): an inspector — floating panel material,
 * sections as grouped lists with hairline row separators. Compact layouts
 * keep their bottom-sheet styling (only `lg:` classes differ).
 */

export const EMPTY = "—";

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-1.5 max-sm:grid-cols-[7.25rem_1fr] lg:grid-cols-[8rem_1fr] lg:border-b lg:border-hairline lg:py-2 lg:last:border-b-0">
      <dt className="pt-px text-[10px] font-medium tracking-[0.18em] text-fg-subtle phone:text-[11px] phone:tracking-[0.12em] lg:pt-0.5 lg:tracking-[0.14em]">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-[12px] text-fg max-lg:text-[13.5px] lg:text-[12.5px]">{children}</dd>
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <span className="mt-0.5 block text-[11px] leading-snug text-fg-subtle max-lg:text-[12px]">{children}</span>;
}

export function Time({ iso }: { iso: string | undefined }) {
  const t = formatUtc(iso);
  if (!t) return <>{EMPTY}</>;
  return (
    <span className="font-mono">
      {t.date}
      <br />
      {t.time}
    </span>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line px-4 py-3 phone:border-t-0 phone:pb-1 lg:border-t-0 lg:px-4 lg:pb-1.5 lg:pt-3">
      <h3 className="mb-1 text-[10px] font-medium tracking-[0.28em] text-fg-subtle phone:mb-1.5 phone:text-[11px] phone:tracking-[0.18em] lg:mb-1.5 lg:px-2 lg:tracking-[0.2em]">
        {title}
      </h3>
      <dl className="phone:rounded-[18px] phone:border phone:border-hairline phone:bg-material-group phone:px-3.5 phone:py-1 lg:rounded-2xl lg:border lg:border-hairline lg:bg-material-group lg:px-3.5 lg:py-1.5">{children}</dl>
    </section>
  );
}

const HEALTH_NOTICE: Partial<Record<SourceHealth, string>> = {
  stale: "SOURCE STALE · showing the last known data; it may be out of date.",
  unavailable: "SOURCE UNAVAILABLE",
};

/**
 * Fixed right-hand panel frame: eyebrow, title, close button, source notice.
 * A plain block in the layout (not a modal), so it can later become a bottom sheet.
 */
export function PanelShell({
  eyebrow,
  title,
  sourceHealth,
  onClose,
  wide = false,
  children,
}: {
  eyebrow: string;
  title: string;
  /** Single-source panels; a multi-source domain panel shows notices per section instead. */
  sourceHealth?: SourceHealth;
  onClose: () => void;
  /** Moderately wider (e.g. while a video is open); capped relative to the viewport. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const notice = sourceHealth ? HEALTH_NOTICE[sourceHealth] : undefined;
  return (
    <aside
      aria-label="Intelligence panel"
      className={`flex shrink-0 flex-col overflow-y-auto overscroll-contain border-l border-line bg-surface phone:bg-transparent max-lg:min-h-0 max-lg:w-full max-lg:max-w-none max-lg:flex-1 max-lg:border-l-0 lg:rounded-window lg:border lg:border-hairline lg:bg-material-panel lg:pb-2 lg:shadow-panel lg:backdrop-blur-material lg:backdrop-saturate-150 motion-safe:lg:animate-panel-in ${
        wide ? "w-[400px] max-w-[46vw] xl:w-[440px]" : "w-[340px] max-w-[42vw] xl:w-[380px]"
      }`}
    >
      <header className="flex items-start gap-3 px-4 pb-3 pt-4 max-lg:sticky max-lg:top-0 max-lg:z-10 max-lg:bg-surface phone:bg-sheet phone:px-5 phone:pt-1 lg:px-6 lg:pb-4 lg:pt-6">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[10px] font-medium tracking-[0.28em] text-fg-subtle phone:text-[11px] phone:tracking-[0.2em] lg:tracking-[0.2em]">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            {eyebrow}
          </p>
          <h2 className="mt-1.5 text-[15px] font-medium leading-snug text-fg phone:mt-2 phone:font-display phone:text-[25px] phone:font-normal phone:leading-[1.1] lg:mt-3 lg:font-display lg:text-[27px] lg:font-normal lg:leading-[1.08] lg:tracking-[-0.005em]">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close intelligence panel"
          className="-mr-1 grid size-7 shrink-0 place-items-center rounded text-fg-subtle transition-colors hover:bg-elevated hover:text-fg max-lg:-mr-2.5 max-lg:-mt-2 max-lg:size-11 lg:-mt-0.5 lg:rounded-full lg:duration-150 lg:hover:bg-material-hover"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>
      {notice && (
        <p role="status" className="mx-4 mb-3 rounded border border-line px-3 py-2 text-[11px] leading-snug text-fg-muted lg:mx-5 lg:rounded-lg lg:border-hairline-strong lg:bg-material-group">
          {notice}
        </p>
      )}
      {children}
    </aside>
  );
}

export function SourceLink({ href, srText }: { href: string; srText: string }) {
  return (
    <div className="border-t border-line px-4 py-4 lg:border-t-0 lg:px-5 lg:pb-3 lg:pt-3">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex h-8 items-center justify-center gap-2 rounded border border-line text-[10px] font-medium tracking-[0.2em] text-fg-muted transition-colors hover:border-line-strong hover:text-fg lg:h-9 lg:rounded-lg lg:border-hairline-strong lg:bg-material-group lg:hover:bg-material-hover"
      >
        OPEN ORIGINAL SOURCE
        <span className="sr-only">({srText}, opens in a new tab)</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
      </a>
    </div>
  );
}
