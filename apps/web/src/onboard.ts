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
  /** The board has been opened once (its first visit sorts profitable book-nows first). */
  boardVisited: boolean;
  /** Tabs opened at least once: an opened teaser shows "New" under More until then. */
  visited: string[];
}

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
