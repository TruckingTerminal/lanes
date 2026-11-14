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
  S.iuliiaLine = { text: lines[n % lines.length]!, shownAt: null, key };
  bumpData();
}

/**
 * Her face for the first 2.5 s of a line (the menu system §2.5), by what the line is about: good news proud, bad news
 * concerned, a laugh for a quip that has one; null after, or for a line without a key. Calm and Still change faces too.
 */
export const FACE_MS = 2500;
const GOOD = /(:won|:onTime|delivered$|:bought|first|milestone)/;
const BAD = /(:late|:lost|:nobody|blocked|breakdown|claim|:refused|:short)/;
export function faceFor(key: string | undefined): "proud" | "concerned" | null {
  if (!key) return null;
  if (BAD.test(key)) return "concerned";
  if (GOOD.test(key)) return "proud";
  return null;
}
export function iuliiaFace(): "proud" | "concerned" | null {
  const l = S.iuliiaLine;
  if (!l || l.shownAt === null || performance.now() - l.shownAt > FACE_MS) return null;
  return faceFor(l.key);
}

/** A line of hers worded at the moment, with its figures (a filed bid's hub and hour): said as a keyed line is. */
export function iuliiaSayText(text: string): void {
  if (muted) return;
  if (performance.now() - lastShownAt < GAME_CONFIG.ui.iuliia.quietSeconds * 1000) return;
  S.iuliiaLine = { text, shownAt: null };
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

/**
 * A line said once ever in this browser (client batch W, the director's first lines on delivery windows): kept as said
 * only once it could be shown (not on Quiet, the quiet time over), so a line held back comes again at its next trigger.
 */
const ONCE_KEY = "lanes.iuliia.once";
let onceSaid: Set<string> = (() => {
  try {
    return new Set(JSON.parse(store.get(ONCE_KEY) ?? "[]") as string[]);
  } catch {
    return new Set<string>();
  }
})();
export function iuliiaOnce(key: string, text: string): void {
  if (onceSaid.has(key) || muted || performance.now() - lastShownAt < GAME_CONFIG.ui.iuliia.quietSeconds * 1000) return;
  onceSaid = new Set([...onceSaid, key]);
  store.set(ONCE_KEY, JSON.stringify([...onceSaid]));
  iuliiaSayText(text);
}

/** Whether a new unasked line may start now (caption rule 3, the milestones): not on Quiet, and the quiet time is over. */
export const iuliiaMayStart = (): boolean => !muted && performance.now() - lastShownAt >= GAME_CONFIG.ui.iuliia.quietSeconds * 1000;
/** A milestone line started: the quiet time runs from now, as after her tab lines. */
export function iuliiaStarted(): void {
  lastShownAt = performance.now();
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
    setTimeout(bumpData, FACE_MS + 50); // her face goes back to the portrait
  }
  if (now - l.shownAt > GAME_CONFIG.ui.iuliia.showSeconds * 1000) {
    S.iuliiaLine = null;
    return null;
  }
  return l.text;
}
