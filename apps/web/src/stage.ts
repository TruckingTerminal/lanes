/**
 * The accent stage (studio/specs/menu-system.md §4, rule 3): one accent at a time per screen. Accents queue here and
 * play one after another, the highest priority first: a pay landing, a bid's result stamp, Iuliia's new line, a tier
 * or stage reached, a stamp on the player's own act, a gleam. One waiting more than 3 s is dropped, except a pay
 * landing, which always plays (its toast carries the news either way). Ambient loops are not accents.
 *
 * An accent is a function that plays and calls `done` when it has finished (or at once, if Motion leaves it nothing to
 * animate); the stage never waits on it for more than its own `maxMs`, so a lost callback can't stall the queue.
 */
export type AccentKind = "pay" | "result" | "iuliia" | "tier" | "own" | "gleam";
export const PRIORITY: Record<AccentKind, number> = { pay: 6, result: 5, iuliia: 4, tier: 3, own: 2, gleam: 1 };
export const DROP_AFTER_MS = 3000;

export interface Accent {
  kind: AccentKind;
  play: (done: () => void) => void;
  /** The most the stage waits for `done` before the next accent plays. */
  maxMs?: number;
}
interface Queued extends Accent {
  at: number;
  seq: number;
}

export interface Clock {
  now: () => number;
  later: (f: () => void, ms: number) => unknown;
}
const realClock: Clock = { now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()), later: (f, ms) => setTimeout(f, ms) };

export class Stage {
  private queue: Queued[] = [];
  private playing: Queued | null = null;
  private seq = 0;
  constructor(private readonly clock: Clock = realClock) {}

  /** Queues an accent; it plays now if the stage is free. */
  add(a: Accent): void {
    this.queue.push({ ...a, at: this.clock.now(), seq: this.seq++ });
    if (!this.playing) this.next();
  }
  /** What's playing now, for a test or a debug line. */
  get current(): AccentKind | null {
    return this.playing?.kind ?? null;
  }
  get waiting(): number {
    return this.queue.length;
  }

  private next(): void {
    const now = this.clock.now();
    this.queue = this.queue.filter((q) => q.kind === "pay" || now - q.at <= DROP_AFTER_MS);
    if (!this.queue.length) {
      this.playing = null;
      return;
    }
    // Highest priority first; within a priority, the oldest.
    this.queue.sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind] || a.seq - b.seq);
    const q = this.queue.shift()!;
    this.playing = q;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      if (this.playing === q) this.next();
    };
    this.clock.later(done, q.maxMs ?? 2000);
    try {
      q.play(done);
    } catch {
      done();
    }
  }
}

/** The page's one stage. */
export const stage = new Stage();
