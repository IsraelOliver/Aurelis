import type { SourceHealth } from "@/types";
import { formatUtc } from "@/lib/format";

/** Shared building blocks of the Intelligence Panel (one panel at a time). */

export const EMPTY = "—";

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-1.5">
      <dt className="pt-px text-[10px] font-medium tracking-[0.18em] text-fg-subtle">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-[12px] text-fg">{children}</dd>
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <span className="mt-0.5 block text-[11px] leading-snug text-fg-subtle">{children}</span>;
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
    <section className="border-t border-line px-4 py-3">
      <h3 className="mb-1 text-[10px] font-medium tracking-[0.28em] text-fg-subtle">
        {title}
      </h3>
      <dl>{children}</dl>
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
      className={`flex shrink-0 flex-col overflow-y-auto border-l border-line bg-surface ${
        wide ? "w-[440px] max-w-[50vw]" : "w-[360px] max-w-[50vw]"
      }`}
    >
      <header className="flex items-start gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[10px] font-medium tracking-[0.28em] text-fg-subtle">
            <span className="size-1.5 rounded-full bg-gold" aria-hidden="true" />
            {eyebrow}
          </p>
          <h2 className="mt-1.5 text-[15px] font-medium leading-snug text-fg">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close intelligence panel"
          className="-mr-1 grid size-7 shrink-0 place-items-center rounded text-fg-subtle transition-colors hover:bg-elevated hover:text-fg"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>
      {notice && (
        <p role="status" className="mx-4 mb-3 rounded border border-line px-3 py-2 text-[11px] leading-snug text-fg-muted">
          {notice}
        </p>
      )}
      {children}
    </aside>
  );
}

export function SourceLink({ href, srText }: { href: string; srText: string }) {
  return (
    <div className="border-t border-line px-4 py-4">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex h-8 items-center justify-center gap-2 rounded border border-line text-[10px] font-medium tracking-[0.2em] text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
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
