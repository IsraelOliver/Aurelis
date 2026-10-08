/**
 * Compact segmented switch used for the map controls (one instance per independent state).
 * Desktop (`lg`+): floating material with a raised thumb on the selected segment.
 */
export default function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** Accessible name of the group. */
  label: string;
  options: { value: T; label: string; disabled?: boolean; title?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex overflow-hidden rounded border border-line bg-surface/90 text-[10px] font-medium tracking-[0.2em] lg:gap-0.5 lg:rounded-full lg:border-hairline-strong lg:bg-material-float lg:p-1 lg:shadow-float lg:backdrop-blur-material"
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`h-7 px-3 transition-colors disabled:cursor-not-allowed disabled:opacity-40 max-lg:h-11 max-lg:px-3.5 lg:h-7 lg:rounded-full lg:px-3.5 lg:duration-150 ${
              active
                ? "bg-deep text-fg lg:text-fg lg:shadow-thumb lg:[background:var(--thumb-fill)]"
                : "text-fg-subtle hover:bg-elevated hover:text-fg-muted lg:hover:bg-material-hover"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
