"use client";

import { useEffect, useRef } from "react";

const COMPACT = "(width < 64rem)"; // below Tailwind `lg`
const PHONE = "(width < 48rem), (width < 64rem) and (height < 30rem)"; // the mobile app shell (Tailwind `phone`)

/**
 * Where SMILEY lives. Desktop (`lg` and up): no box (`display: contents`), the
 * panel stays the right-hand column. Below `lg`: a full-screen surface over the
 * map (the map, selection and chat stay mounted underneath), sized to the
 * visual viewport so the composer stays above the on-screen keyboard even on
 * browsers whose `dvh` ignores the keyboard (iOS Safari).
 * Phone (Tailwind `phone`): SMILEY is a tab of the app shell — the screen rests on
 * the tab bar; while the keyboard is up (visual viewport clearly shorter than
 * the layout viewport) `<html data-keyboard="open">` lets the tab bar step
 * aside so the composer sits right above the keyboard.
 */
export default function SmileyDock({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const vv = window.visualViewport;
    if (!el || !vv) return;
    const compact = window.matchMedia(COMPACT);
    const phone = window.matchMedia(PHONE);
    const root = document.documentElement;
    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (compact.matches) {
          el.style.height = `${vv.height}px`;
          el.style.transform = `translateY(${vv.offsetTop}px)`;
        } else {
          el.style.height = "";
          el.style.transform = "";
        }
        if (phone.matches && window.innerHeight - vv.height > 120) root.dataset.keyboard = "open";
        else delete root.dataset.keyboard;
      });
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    compact.addEventListener("change", apply);
    return () => {
      cancelAnimationFrame(frame);
      delete root.dataset.keyboard;
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      compact.removeEventListener("change", apply);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="lg:contents max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:z-[45] max-lg:flex max-lg:h-dvh max-lg:flex-col max-lg:bg-surface max-lg:pb-[env(safe-area-inset-bottom)] max-lg:pl-[env(safe-area-inset-left)] max-lg:pr-[env(safe-area-inset-right)] max-lg:pt-[env(safe-area-inset-top)] aurelis-smiley-dock phone:pb-[var(--tabbar-space)] phone:[background:var(--shell-background)] phone:motion-safe:animate-[aurelis-screen-in_220ms_cubic-bezier(0.2,0.8,0.2,1)]"
    >
      {children}
    </div>
  );
}
