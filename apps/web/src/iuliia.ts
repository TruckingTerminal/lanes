import { IULIIA_SAY } from "./copy.js";
import { GAME_CONFIG } from "./game.js";
import { bumpData, S, setSaidHook } from "./state.js";

/**
 * Iuliia by tab and card (the writer's iuliia-lines.md): one line per screen at a time, on a first visit in a sitting or a
 * named change there. She speaks in the caption strip for `ui.iuliia.showSeconds`, then the walkthrough's Do line returns;
 * never two lines within `ui.iuliia.quietSeconds` (real time); variants rotate, each used once before any repeats; the
 * walkthrough's own line comes first (the caption shows hers only when it's free). "Quiet" on the Iuliia tab mutes these,
 * per browser; the walkthrough's lines stay. Silence on bad news is the callers' part: nothing calls her on an error.
 */

const QUIET_KEY = "lanes.iuliia.quiet";
const TURN_KEY = "lanes.iuliia.turns";
const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private window: the setting lasts the sitting */
    }
  },
};

let muted = store.get(QUIET_KEY) === "1";
export const iuliiaMuted = (): boolean => muted;
export function setIuliiaMuted(on: boolean): void {
  muted = on;
  store.set(QUIET_KEY, on ? "1" : "0");
  if (on) S.iuliiaLine = null;
  bumpData();
}

/** Each key's variants in a shuffled-once order and how far along it is, kept per browser so a sitting doesn't restart it. */
let turns: Record<string, number> = (() => {
  try {
    return JSON.parse(store.get(TURN_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
})();

const seenThisSitting = new Set<string>();
let lastShownAt = -Infinity;

/** Her next line for this trigger, if one may be said now. */
export function iuliiaSay(key: string): void {
  if (muted) return;
  const lines = IULIIA_SAY[key];
  if (!lines?.length) return;
  const k = GAME_CONFIG.ui.iuliia;
  if (performance.now() - lastShownAt < k.quietSeconds * 1000) return;
  // A line waiting for the walkthrough to free the strip is replaced by the newest: two never stack.
  const n = turns[key] ?? 0;
  turns = { ...turns, [key]: n + 1 };
  store.set(TURN_KEY, JSON.stringify(turns));
  S.iuliiaLine = { text: lines[n % lines.length]!, shownAt: null };
  bumpData();
}

setSaidHook((key) => iuliiaSay(key));

/** A first-visit trigger: once per screen per sitting (`screen` names the screen when several share one set of lines). */
export function iuliiaFirst(key: string, screen = key): void {
  if (seenThisSitting.has(screen)) return;
  seenThisSitting.add(screen);
  iuliiaSay(key);
}

/** A change seen on a value between frames (a truck starts rolling, cash goes red): says `key` when `now` differs from the last seen. */
const lastSeen = new Map<string, unknown>();
export function iuliiaOnChange(id: string, now: unknown, key: string | null): void {
  const was = lastSeen.get(id);
  lastSeen.set(id, now);
  if (was !== undefined && was !== now && key) iuliiaSay(key);
}

/** The line to show in the caption strip now, if any; the caption calls this only when the walkthrough's own line is not showing. */
export function iuliiaNow(): string | null {
  const l = S.iuliiaLine;
  if (!l) return null;
  const now = performance.now();
  if (l.shownAt === null) {
    l.shownAt = now;
    lastShownAt = now;
    setTimeout(bumpData, GAME_CONFIG.ui.iuliia.showSeconds * 1000 + 50);
  }
  if (now - l.shownAt > GAME_CONFIG.ui.iuliia.showSeconds * 1000) {
    S.iuliiaLine = null;
    return null;
  }
  return l.text;
}
