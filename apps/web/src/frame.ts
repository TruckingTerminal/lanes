/**
 * The frame-rate floor (studio/specs/menu-system.md §5.4: no frame over 33 ms during a screen change, a sheet snap or a
 * pay landing; no main-thread task over 50 ms while one plays), from the producer's 6× CPU-slowdown pass of 2026-11-15
 * (producer-framerate-2026-11-15.md). Each change that alters what the page does, or when, has its own switch here, so
 * any one can be turned off alone; off, each is the page as it was. Page-only: the world, its replay and its digest never
 * read these.
 */
export const FRAME: {
  /**
   * The test clock (main.tsx loop): Paused holds at once, and the whole game hours waiting to step never exceed what one
   * real second adds at the speed set; the part-hour already run is kept (clockAfter). Off: up to 48 game hours wait, so
   * after Day in 2 s a slow device kept stepping the world through Paused and Live pace, one long task per frame (the
   * producer's 412 ms "just after a delivery").
   */
  clockHolds: boolean;
  /**
   * The panels' redraw (main.tsx loop): in a task of its own after the frame that draws the map, not inside it, so the
   * map's frame and the panels' redraw never add up to one long task (the live pace's once-a-second hitch).
   */
  panelsApart: boolean;
  /**
   * At the fast test speeds, where every frame moves the world's minute: the panels redraw on a moved minute no sooner
   * than three times their last redraw's cost after it (at most a quarter of the main thread), and on the one-second
   * timer as before. A device that redraws in a few milliseconds still redraws every frame.
   */
  panelBudget: boolean;
  /**
   * The board's load cards arriving many at once get their layout in slices (latecards.ts): as many as the first task
   * has time for at once, the rest in tasks of their own straight after, each card held at its measured or likely height
   * until then. Off: every card is laid out in the task that draws the board (69 to 77 ms at the 6× slowdown for a
   * board of sixty, against 48 to 52 ms).
   * The first form (60191cc) left the cards out of view as 110 px placeholders until scrolled to, so a fresh board's
   * scroll bar shrank and slid as the cards drew (QA: 6,493 px of a true 9,928 px) and a jump to the end landed about
   * 1,200 px short; the producer turned it off (aee6e54). In this form every card ends laid out.
   */
  boardOffscreen: boolean;
} = {
  clockHolds: true,
  panelsApart: true,
  panelBudget: true,
  boardOffscreen: true,
};

/** How many whole game hours may wait to step at `hoursPerSec` with FRAME.clockHolds on: one real second's worth, none while paused. */
export function backlogCap(hoursPerSec: number): number {
  return hoursPerSec > 0 ? Math.max(1, hoursPerSec) : 0;
}

/**
 * The test clock's game hours waiting to step, `dtMs` on at `hoursPerSec` (main.tsx loop steps one for each whole hour).
 * With FRAME.clockHolds the whole hours over the speed's cap are dropped and the part-hour is kept: Paused steps nothing
 * more, and the hour that was running picks up where it stopped. (QA, 2026-11-17: the cap alone zeroed the part-hour
 * too, so a pause 2.0 s into a 2.5 s hour made the next hour take a whole 2.5 s more; at Live pace, up to 15 real minutes.)
 */
export function clockAfter(acc: number, dtMs: number, hoursPerSec: number): number {
  const next = acc + (dtMs / 1000) * hoursPerSec;
  if (!FRAME.clockHolds) return next;
  const cap = backlogCap(hoursPerSec);
  return next <= cap ? next : cap + (next % 1);
}

/**
 * Whether the panels may redraw now for a moved world minute (FRAME.panelBudget): at least three times the last redraw's
 * cost after it began. The one-second timer redraws regardless.
 */
export function panelsMayRedraw(now: number, lastAt: number, lastCostMs: number): boolean {
  return !FRAME.panelBudget || now - lastAt >= 3 * lastCostMs;
}
