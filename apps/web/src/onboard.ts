/**
 * The first ten minutes' memory, per browser (localStorage `lanes.onboard.v1`): what this player has already been
 * shown. It is screen state only: never in the world, never in the store, and kept apart from the test world's log
 * (`lanes.testworld.v1`), so changing its shape can't strand a saved world. A missing, corrupt or older record
 * reads as a fresh start.
 */
export const ONBOARD_KEY = "lanes.onboard.v1";

export interface Onboard {
  v: 1;
  /** Walkthrough steps (walkthrough.ts ids) whose card this player has opened. */
  seen: string[];
  /** The browser-wide first-board mark of earlier builds: kept when read, no longer used (the board's is `{scope}|board` in visited). */
  boardVisited: boolean;
  /** Tabs this company opened at least once, `{scope}|{tab}` (and `{scope}|board`): an opened teaser shows "New" under More until then. */
  visited: string[];
}

/**
 * One company's marks in one world: `{seed}:{company id}:{created day}`, so a replaced test world, or a fresh start in
 * the same browser, sees none of the last one's (QA, 2026-11-09: Money's held note and the Dealer's "New" leaked).
 */
export const worldScope = (w: { seed: number }, c: { id: number; createdDay: number }): string => `${w.seed}:${c.id}:${c.createdDay}`;
export const worldMark = (w: { seed: number }, c: { id: number; createdDay: number }, k: string): string => `${worldScope(w, c)}|${k}`;

export const freshOnboard = (): Onboard => ({ v: 1, seen: [], boardVisited: false, visited: [] });

const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);

/** The record from its stored text, or a fresh one when there is none or it can't be read. */
export function parseOnboard(raw: string | null): Onboard {
  if (!raw) return freshOnboard();
  try {
    const o = JSON.parse(raw) as Partial<Onboard> | null;
    if (!o || o.v !== 1) return freshOnboard();
    return {
      v: 1,
      seen: strings(o.seen),
      boardVisited: o.boardVisited === true,
      visited: strings(o.visited),
    };
  } catch {
    return freshOnboard();
  }
}
