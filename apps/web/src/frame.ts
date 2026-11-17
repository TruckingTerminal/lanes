/**
 * The frame-rate floor (studio/specs/menu-system.md §5.4: no frame over 33 ms during a screen change, a sheet snap or a
 * pay landing; no main-thread task over 50 ms while one plays), from the producer's 6× CPU-slowdown pass of 2026-11-15
 * (producer-framerate-2026-11-15.md). Each change that alters what the page does, or when, has its own switch here, so
 * any one can be turned off alone; off, each is the page as it was. Page-only: the world, its replay and its digest never
 * read these.
 */
export const FRAME: {
  /**
   * The test clock (main.tsx loop): Paused holds at once, and the game hours waiting to step never exceed what one real
   * second adds at the speed set. Off: up to 48 game hours wait, so after Day in 2 s a slow device kept stepping the world
   * through Paused and Live pace, one long task per frame (the producer's 412 ms "just after a delivery").
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
   * The board's load cards off screen skip layout and paint until scrolled to (CSS content-visibility; page.html).
   * Off since 2026-11-17 (the producer, on QA's check of 60191cc): a card not yet drawn holds 110 px against a real
   * 117 to 222 px, so a fresh board's scroll bar shrank and slid as the cards drew (6,493 px of a true 9,928 px) and a
   * jump to the end landed about 1,200 px short. Back on when a card's placeholder is its real height.
   */
  boardOffscreen: boolean;
} = {
  clockHolds: true,
  panelsApart: true,
  panelBudget: true,
  boardOffscreen: false,
};

/** How many game hours may wait to step at `hoursPerSec` with FRAME.clockHolds on: one real second's worth, none while paused. */
export function backlogCap(hoursPerSec: number): number {
  return hoursPerSec > 0 ? Math.max(1, hoursPerSec) : 0;
}

/**
 * Whether the panels may redraw now for a moved world minute (FRAME.panelBudget): at least three times the last redraw's
 * cost after it began. The one-second timer redraws regardless.
 */
export function panelsMayRedraw(now: number, lastAt: number, lastCostMs: number): boolean {
  return !FRAME.panelBudget || now - lastAt >= 3 * lastCostMs;
}
