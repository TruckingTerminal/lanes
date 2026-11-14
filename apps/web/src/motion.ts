/**
 * The Motion setting (studio/specs/menu-system.md §2.6): Full · Calm · Still, one attribute on <html> that every motion
 * rule keys on (`data-motion`), in CSS and in code. Its default follows the system (prefers-reduced-motion: reduce →
 * Calm, else Full); a player's own choice is kept on this device (localStorage, a convenience, not world state), and
 * a page whose storage is blocked runs on the system's.
 *
 *   Full:  everything as designed: backdrop loops, Iuliia's breath and blink, gleams, ripples, stamps with their dust.
 *   Calm:  first frames only, no gleams or ripples; screens and sheets fade in 120 ms; stamps appear with a fade.
 *   Still: nothing moves; what changes, changes at once.
 */
export type Motion = "full" | "calm" | "still";
export const MOTIONS: readonly Motion[] = ["full", "calm", "still"];
const KEY = "lanes.motion";
const REDUCE = "(prefers-reduced-motion: reduce)";

const isMotion = (v: unknown): v is Motion => v === "full" || v === "calm" || v === "still";

/** The system's default: Calm when it asks for reduced motion, else Full. */
export function systemMotion(): Motion {
  try {
    return typeof matchMedia === "function" && matchMedia(REDUCE).matches ? "calm" : "full";
  } catch {
    return "full";
  }
}

/** The player's own choice on this device, or null to follow the system. */
export function storedMotion(): Motion | null {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    return isMotion(v) ? v : null;
  } catch {
    return null;
  }
}

/** The Motion in force. */
export function motion(): Motion {
  return storedMotion() ?? systemMotion();
}
/** True when anything decorative may move (Full). */
export const moving = (): boolean => motion() === "full";

/** Writes the attribute every motion rule reads. */
export function applyMotion(): void {
  if (typeof document !== "undefined") document.documentElement.setAttribute("data-motion", motion());
}

/** The player's choice, kept on this device; null forgets it and follows the system again. */
export function setMotion(m: Motion | null): void {
  try {
    if (m) localStorage.setItem(KEY, m);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the choice holds for this page only.
    if (typeof document !== "undefined" && m) document.documentElement.setAttribute("data-motion", m);
    return;
  }
  applyMotion();
}

/** At start: the attribute, and following the system's setting while the player has made no choice. */
export function initMotion(): void {
  applyMotion();
  try {
    matchMedia(REDUCE).addEventListener("change", () => {
      if (storedMotion() === null) applyMotion();
    });
  } catch {
    // An old browser without the listener: the attribute stands as set.
  }
}
