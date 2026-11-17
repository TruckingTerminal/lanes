/**
 * The board's cards, laid out late (FRAME.boardOffscreen, frame.ts; the producer's frame-rate pass, 2026-11-15).
 *
 * Laying out sixty new load cards is about a third of the board's first draw: at the producer's 6× slowdown, a task of
 * 69 to 77 ms with their layout in it and 48 to 52 ms without. The first try (60191cc) left every card out of view as a
 * placeholder for good (CSS content-visibility with one fixed height), so the list's height was a guess until each card
 * had been scrolled to: QA's check found a fresh board 6,493 px tall of a true 9,928 px, its scroll bar shrinking as the
 * cards drew, and a jump to the end landing about 1,200 px short.
 *
 * Now a placeholder is only a card's first few moments, and its real layout always follows:
 *  - Cards arriving many at once (the board opening, a filter cleared) start late: `data-late` (page.html) holds each at
 *    the height it measured last time, or at the mean of the cards measured so far.
 *  - In the task that drew them, cards get their real layout at once until the task is LATE.firstMs old. A device that
 *    draws the board in a few milliseconds lays out all of them there, so its first frame is exact; at the 6× slowdown
 *    the draw alone takes longer than that, and the task gets nothing added.
 *  - The rest follow in slices of LATE.sliceMs, each a task of its own, from the top down. A slow device's first frame
 *    shows the cards in view and a list of the likely height, exact a few slices later (about 200 ms at 6×, and from the
 *    first frame when the same loads are drawn again); no slice is a long task.
 *  - A scroll never meets a guess: a wheel, touch, press or key lays out every waiting card first (guardScrolls), and a
 *    jump to the end made while cards wait is taken on to the true end.
 * A card laid out is an ordinary card from then on: nothing is left skipped, clipped or blank after a sort, a filter or a
 * jump.
 */

/** The parts of a card's element this uses: an HTMLElement on the page, a stand-in in the tests. */
export interface CardEl {
  readonly isConnected: boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  getBoundingClientRect(): { height: number };
  readonly style: { setProperty(name: string, value: string): void; removeProperty(name: string): unknown };
}

/** The card list's element: its cards in order, and its width. */
export interface ListEl<E> {
  readonly children: ArrayLike<E>;
  getBoundingClientRect(): { width: number };
}

export interface LateIo<E> {
  /** Milliseconds, as performance.now(). */
  now(): number;
  /** Runs `fn` soon, in a task of its own. */
  later(fn: () => void): void;
  /** A card's padding and border, top and bottom together: its height less its content's. */
  frame(el: E): number;
}

export const LATE = {
  /** Fewer new cards than this at once are laid out as they come. */
  bulk: 12,
  /** Cards laid out per layout pass. */
  batch: 8,
  /** The first task lays out cards until it is this old (ms, from state.ts redrawBegan). */
  firstMs: 24,
  /** A later slice's length (ms). */
  sliceMs: 8,
  /** A card's content height before any has been measured (px): between the laptop's mean (128 to 159) and the phone's (165). */
  guess: 150,
  /** Heights remembered, by load; past this the oldest half goes. */
  keep: 4000,
} as const;

const ATTR = "data-late";
const SIZE = "contain-intrinsic-block-size";

interface Waiting<E> {
  el: E;
  id: number;
}

export class LateCards<E extends CardEl> {
  private readonly seen = new WeakSet<E>();
  /** A card's content height as last measured, by load id, at `width`. */
  private readonly heights = new Map<number, number>();
  private width = -1;
  private sum = 0;
  private n = 0;
  private queue: Waiting<E>[] = [];
  private list: ListEl<E> | null = null;
  private scheduled = false;

  constructor(private readonly io: LateIo<E>) {}

  /** How many cards still wait for their layout. */
  pending(): number {
    return this.queue.length;
  }

  /** The content height a card of this load would be held at now: its last measure, else the mean so far. */
  held(id: number): number {
    return this.heights.get(id) ?? (this.n ? this.sum / this.n : LATE.guess);
  }

  /**
   * After the board draws its list (a layout effect): `ids` are the loads of the list's cards, in order, and `drawStart`
   * is when the task's work began. New cards arriving LATE.bulk or more at once start late, and as many as the first
   * task has time for are laid out here.
   */
  drawn(list: ListEl<E> | null, ids: readonly number[], drawStart: number): void {
    if (!list) return;
    const fresh: Waiting<E>[] = [];
    for (let i = 0; i < list.children.length; i++) {
      const el = list.children[i]!;
      if (this.seen.has(el)) continue;
      this.seen.add(el);
      const id = ids[i];
      if (id !== undefined) fresh.push({ el, id });
    }
    if (fresh.length < LATE.bulk) return;
    this.list = list;
    for (const c of fresh) {
      c.el.setAttribute(ATTR, "");
      c.el.style.setProperty(SIZE, `auto ${this.held(c.id)}px`);
    }
    this.queue.push(...fresh);
    while (this.queue.length && this.io.now() - drawStart < LATE.firstMs) this.settle(LATE.batch);
    this.schedule();
  }

  /** Lays out every card still waiting, now. */
  finish(): void {
    while (this.queue.length) this.settle(this.queue.length);
  }

  private schedule(): void {
    if (!this.queue.length || this.scheduled) return;
    this.scheduled = true;
    this.io.later(() => {
      this.scheduled = false;
      const t0 = this.io.now();
      do this.settle(LATE.batch);
      while (this.queue.length && this.io.now() - t0 < LATE.sliceMs);
      this.schedule();
    });
  }

  /** Up to `max` waiting cards become ordinary cards, with one layout for them all; their heights are kept. */
  private settle(max: number): void {
    const batch = this.queue.splice(0, max).filter((c) => c.el.isConnected);
    if (!batch.length) return;
    for (const c of batch) {
      c.el.removeAttribute(ATTR);
      c.el.style.removeProperty(SIZE);
    }
    // The heights kept are for one width of list: at another, they start again.
    const width = this.list ? this.list.getBoundingClientRect().width : this.width;
    if (width !== this.width) {
      this.heights.clear();
      this.sum = 0;
      this.n = 0;
      this.width = width;
    }
    const frame = this.io.frame(batch[0]!.el);
    for (const c of batch) {
      const h = c.el.getBoundingClientRect().height - frame;
      if (!(h > 0)) continue;
      this.heights.delete(c.id);
      this.heights.set(c.id, h);
      this.sum += h;
      this.n++;
    }
    if (this.heights.size > LATE.keep) {
      let drop = this.heights.size - LATE.keep / 2;
      for (const id of this.heights.keys()) {
        if (drop-- <= 0) break;
        this.heights.delete(id);
      }
    }
  }
}

/** The page's cards (ui/panels/Board.tsx). */
export const boardCards = new LateCards<HTMLElement>({
  now: () => performance.now(),
  later: (fn) => void setTimeout(fn, 0),
  frame: (el) => {
    const cs = getComputedStyle(el);
    return parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  },
});

/** Whether a scroller `scrollTop` down, `clientHeight` tall, with `scrollHeight` of content, has been scrolled to its end. */
export function atEnd(scrollTop: number, clientHeight: number, scrollHeight: number): boolean {
  return scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 1;
}

/**
 * While cards wait, a scroll never meets a guessed height: a wheel, a touch, a press (the scroll bar's too) or a key lays
 * them all out before the scroll it starts, and a scroll made by script that had reached the end is taken on to the true
 * end. Returns its own undoing.
 */
export function guardScrolls(cards: LateCards<HTMLElement>): () => void {
  const intent = (): void => {
    if (cards.pending()) cards.finish();
  };
  const scrolled = (e: Event): void => {
    if (!cards.pending()) return;
    const s = e.target instanceof Element ? e.target : document.scrollingElement;
    const end = !!s && atEnd(s.scrollTop, s.clientHeight, s.scrollHeight);
    cards.finish();
    if (s && end) s.scrollTop = s.scrollHeight;
  };
  const opts = { capture: true, passive: true } as const;
  const intents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
  for (const k of intents) document.addEventListener(k, intent, opts);
  document.addEventListener("scroll", scrolled, opts);
  return () => {
    for (const k of intents) document.removeEventListener(k, intent, opts);
    document.removeEventListener("scroll", scrolled, opts);
  };
}
