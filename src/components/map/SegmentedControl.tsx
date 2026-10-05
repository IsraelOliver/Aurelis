/** Compact segmented switch used for the map controls (one instance per independent state). */
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
      className="flex overflow-hidden rounded border border-line bg-surface/90 text-[10px] font-medium tracking-[0.2em]"
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
            className={`h-7 px-3 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              active ? "bg-deep text-fg" : "text-fg-subtle hover:bg-elevated hover:text-fg-muted"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
