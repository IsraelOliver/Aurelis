"use client";

/**
 * Tablet navigation drawer (`md` to `lg`; phones use the tab bar of the
 * mobile app shell): slides in from the left over
 * a dark overlay; tap outside or Escape (handled by Workspace) closes it.
 * Always mounted (inert while closed), so opening it never remounts anything
 * and domain state is untouched. Respects the device safe areas.
 */
export default function MobileDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="lg:hidden phone:hidden" inert={!open}>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-base/65 transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(20rem,80vw)] flex-col border-r border-deep bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)] shadow-[12px_0_32px_rgba(4,9,27,0.6)] transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
