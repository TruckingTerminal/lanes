import { useEffect, useState } from "preact/hooks";

/**
 * A late card waits for a still hand (the gamer: Iuliia's card arrived mid-typing, the layout moved under the thumb and
 * the next keys went into the wrong box). A card new to the screen shows only once the player has been idle
 * `SETTLE_MS` with no input, select or textarea focused; once shown it stays.
 */
export const SETTLE_MS = 1500;
let lastInput = -Infinity;
let wired = false;
const shown = new Set<string>();

function wire(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;
  const touch = () => (lastInput = performance.now());
  for (const e of ["keydown", "input", "pointerdown", "focusin", "wheel"]) window.addEventListener(e, touch, { passive: true, capture: true });
}

function settled(): boolean {
  if (typeof document === "undefined") return true;
  const el = document.activeElement;
  const typing = el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
  return !typing && performance.now() - lastInput >= SETTLE_MS;
}

/**
 * A card's next page is the same card, already on screen: it shows at once (the diaries, 2026-11-09: Iuliia's "1 of 3"
 * went on Next and "2 of 3" turned up a moment later on another screen, since the tap on Next was input to settle on).
 */
export function settleShown(key: string): void {
  shown.add(key);
}

/** Whether the card `key` may show now (null: no card, nothing to hold). */
export function useSettled(key: string | null): boolean {
  wire();
  const [, tick] = useState(0);
  const ready = key === null || shown.has(key) || settled();
  if (key !== null && ready) shown.add(key);
  useEffect(() => {
    if (ready || key === null) return;
    const id = setInterval(() => {
      if (settled()) {
        clearInterval(id);
        tick((n) => n + 1);
      }
    }, 250);
    return () => clearInterval(id);
  }, [key, ready]);
  return ready;
}
