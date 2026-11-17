import { describe, expect, it } from "vitest";
import { atEnd, LATE, LateCards, type CardEl } from "../src/latecards.js";

/**
 * The board's cards laid out late (latecards.ts; FRAME.boardOffscreen), on a stand-in page: a card's layout costs the
 * device `costMs`, a card still waiting is as tall as the height it's held at, and `later` tasks run when the test says.
 */
const FRAME_PX = 22; // a card's padding and border, top and bottom
const GAP = 6;

class Page {
  t = 1000;
  costMs = 0.1;
  width = 420;
  cards: Card[] = [];
  tasks: (() => void)[] = [];
  readonly late = new LateCards<Card>({ now: () => this.t, later: (fn) => void this.tasks.push(fn), frame: () => FRAME_PX });
  readonly list = { children: this.cards as ArrayLike<Card>, getBoundingClientRect: () => ({ width: this.width }) };

  /** The board draws these loads' cards afresh (new elements), the draw itself taking `drawMs`. */
  open(loads: [id: number, height: number][], drawMs: number): Card[] {
    const drawStart = this.t;
    this.cards.length = 0;
    for (const [id, h] of loads) this.cards.push(new Card(this, id, h));
    this.t += drawMs;
    this.late.drawn(this.list, loads.map(([id]) => id), drawStart);
    return [...this.cards];
  }
  /** The list's height as the page would lay it out now. */
  height(): number {
    return this.cards.reduce((a, c) => a + c.getBoundingClientRect().height, 0) + GAP * (this.cards.length - 1);
  }
  trueHeight(): number {
    return this.cards.reduce((a, c) => a + c.real, 0) + GAP * (this.cards.length - 1);
  }
  waiting(): number {
    return this.cards.filter((c) => c.waits).length;
  }
  /** Runs the next `later` task; how long it took. */
  task(): number {
    const t0 = this.t;
    this.tasks.shift()!();
    return this.t - t0;
  }
}

class Card implements CardEl {
  isConnected = true;
  waits = false;
  /** The content height it's held at while it waits. */
  heldAt: number | null = null;
  layouts = 0;
  constructor(
    private readonly page: Page,
    readonly id: number,
    readonly real: number,
  ) {}
  setAttribute(name: string): void {
    if (name === "data-late") this.waits = true;
  }
  removeAttribute(name: string): void {
    if (name !== "data-late" || !this.waits) return;
    this.waits = false;
    this.layouts++;
    this.page.t += this.page.costMs;
  }
  readonly style = {
    setProperty: (name: string, value: string): void => {
      if (name === "contain-intrinsic-block-size") this.heldAt = Number(/^auto ([\d.]+)px$/.exec(value)![1]);
    },
    removeProperty: (name: string): void => {
      if (name === "contain-intrinsic-block-size") this.heldAt = null;
    },
  };
  getBoundingClientRect(): { height: number } {
    return { height: this.waits ? this.heldAt! + FRAME_PX : this.real };
  }
}

/** Fifty-three loads of mixed heights, as a board has (QA: 117 to 222 px at the laptop's width). */
const loads = (from = 1, n = 53): [number, number][] => Array.from({ length: n }, (_, i) => [from + i, 117 + ((i * 37) % 106) + (i % 3) * 0.5]);

describe("the board's cards laid out late (latecards.ts; the page uses it with FRAME.boardOffscreen on)", () => {
  it("a fast device lays out every card in the task that draws the board: the first frame is the true height", () => {
    const p = new Page();
    p.open(loads(), 4);
    expect(p.waiting()).toBe(0);
    expect(p.late.pending()).toBe(0);
    expect(p.tasks.length).toBe(0);
    expect(p.height()).toBe(p.trueHeight());
    expect(p.cards.every((c) => c.heldAt === null && c.layouts === 1)).toBe(true);
  });

  it("a slow device's first task lays out none; slices follow, none long, until every card is laid out", () => {
    const p = new Page();
    p.costMs = 0.6;
    p.open(loads(), 30);
    // The first frame: every card waits at the likely height, and one task is asked for.
    expect(p.waiting()).toBe(53);
    expect(p.cards.every((c) => c.heldAt === LATE.guess)).toBe(true);
    expect(p.tasks.length).toBe(1);
    const slices: number[] = [];
    const left: number[] = [];
    while (p.tasks.length) {
      slices.push(p.task());
      left.push(p.waiting());
      expect(p.tasks.length).toBeLessThanOrEqual(1);
    }
    // From the top down, a slice's worth at a time.
    expect(left).toEqual([37, 21, 5, 0]);
    for (const ms of slices) expect(ms).toBeLessThanOrEqual(LATE.sliceMs + LATE.batch * p.costMs);
    expect(p.height()).toBe(p.trueHeight());
    expect(p.cards.every((c) => c.heldAt === null && c.layouts === 1)).toBe(true);
    expect(p.late.pending()).toBe(0);
  });

  it("a device between the two lays out what fits in the first task's time, and the rest after", () => {
    const p = new Page();
    p.costMs = 0.3;
    p.open(loads(), 18);
    // 18 ms gone of LATE.firstMs: three passes of eight (2.4 ms each) take the task past twenty-four.
    expect(p.waiting()).toBe(53 - 24);
    expect(p.cards.slice(0, 24).every((c) => !c.waits)).toBe(true);
    while (p.tasks.length) p.task();
    expect(p.waiting()).toBe(0);
    expect(p.height()).toBe(p.trueHeight());
  });

  it("opened again on the slow device, each card waits at its own measured height: the first frame is exact", () => {
    const p = new Page();
    p.costMs = 0.6;
    p.open(loads(), 30);
    while (p.tasks.length) p.task();
    const again = p.open(loads(), 30);
    expect(p.waiting()).toBe(53);
    expect(p.height()).toBe(p.trueHeight());
    for (const c of again) expect(c.heldAt).toBe(c.real - FRAME_PX);
    // And it stays that height as the slices lay the cards out.
    while (p.tasks.length) {
      p.task();
      expect(p.height()).toBe(p.trueHeight());
    }
    expect(p.waiting()).toBe(0);
  });

  it("a load not seen before waits at the mean of the cards measured so far", () => {
    const p = new Page();
    p.costMs = 0.6;
    const first = loads();
    p.open(first, 30);
    while (p.tasks.length) p.task();
    const mean = first.reduce((a, [, h]) => a + h - FRAME_PX, 0) / first.length;
    const next = p.open(loads(1000, 20), 30);
    for (const c of next) expect(c.heldAt).toBeCloseTo(mean, 9);
    // The guess is within a few percent of the truth here, and the truth follows.
    expect(Math.abs(p.height() - p.trueHeight()) / p.trueHeight()).toBeLessThan(0.1);
    while (p.tasks.length) p.task();
    expect(p.height()).toBe(p.trueHeight());
  });

  it("a few new cards among laid-out ones are laid out as they come", () => {
    const p = new Page();
    p.costMs = 0.6;
    p.open(loads(1, 11), 30);
    expect(p.waiting()).toBe(0);
    expect(p.tasks.length).toBe(0);
    // The same elements drawn again, with three new loads among them.
    const drawStart = p.t;
    for (const [id, h] of loads(500, 3)) p.cards.push(new Card(p, id, h));
    p.t += 30;
    p.late.drawn(p.list, p.cards.map((c) => c.id), drawStart);
    expect(p.waiting()).toBe(0);
    expect(p.tasks.length).toBe(0);
  });

  it("finish() lays out every waiting card at once (a scroll is starting), and the slice asked for finds nothing to do", () => {
    const p = new Page();
    p.costMs = 0.6;
    p.open(loads(), 30);
    p.task();
    expect(p.waiting()).toBe(37);
    p.late.finish();
    expect(p.waiting()).toBe(0);
    expect(p.late.pending()).toBe(0);
    expect(p.height()).toBe(p.trueHeight());
    const t = p.t;
    while (p.tasks.length) p.task();
    expect(p.t).toBe(t);
  });

  it("cards that left the page before their turn are passed over, and never measured", () => {
    const p = new Page();
    p.costMs = 0.6;
    const cards = p.open(loads(), 30);
    for (const c of cards.slice(0, 20)) c.isConnected = false;
    while (p.tasks.length) p.task();
    expect(p.late.pending()).toBe(0);
    expect(cards.slice(0, 20).every((c) => c.layouts === 0)).toBe(true);
    expect(cards.slice(20).every((c) => c.layouts === 1 && !c.waits)).toBe(true);
    // A load measured keeps its height; one never measured is held at the mean.
    expect(p.late.held(cards[30]!.id)).toBe(cards[30]!.real - FRAME_PX);
    expect(p.late.held(cards[0]!.id)).not.toBe(cards[0]!.real - FRAME_PX);
  });

  it("the heights kept are for one width of list: at another they start again", () => {
    const p = new Page();
    p.costMs = 0.6;
    const first = p.open(loads(), 30);
    while (p.tasks.length) p.task();
    expect(p.late.held(first[7]!.id)).toBe(first[7]!.real - FRAME_PX);
    // The window narrows: the same loads wrap differently, taller by 40 px.
    p.width = 360;
    const taller = loads().map(([id, h]): [number, number] => [id, h + 40]);
    const cards = p.open(taller, 30);
    p.task();
    // The first slice at the new width forgot the old heights: a load not yet laid out again is held at the new mean.
    const done = cards.filter((c) => c.layouts === 1);
    const mean = done.reduce((a, c) => a + c.real - FRAME_PX, 0) / done.length;
    expect(p.late.held(cards[52]!.id)).toBeCloseTo(mean, 9);
    while (p.tasks.length) p.task();
    expect(p.height()).toBe(p.trueHeight());
    expect(p.late.held(cards[52]!.id)).toBe(cards[52]!.real - FRAME_PX);
  });

  it("atEnd: a scroller at its end, but never one that hasn't been scrolled", () => {
    expect(atEnd(5693, 800, 6493)).toBe(true);
    expect(atEnd(5692.4, 800, 6493)).toBe(true);
    expect(atEnd(5000, 800, 6493)).toBe(false);
    expect(atEnd(0, 800, 800)).toBe(false);
  });
});
