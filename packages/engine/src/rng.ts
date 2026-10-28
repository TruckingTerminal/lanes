/**
 * Seeded random numbers (mulberry32). The engine never calls Math.random; every
 * draw comes from an Rng so a run replays exactly from its seed.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }

  int(lo: number, hiInclusive: number): number {
    return lo + Math.floor(this.next() * (hiInclusive - lo + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }

  /** Index drawn in proportion to non-negative weights. */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i]!;
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  /** Rounds a fractional expected count stochastically: 2.3 → 2 (70%) or 3 (30%). */
  count(expected: number): number {
    const base = Math.floor(expected);
    return base + (this.next() < expected - base ? 1 : 0);
  }

  /** Independent child stream, so adding draws in one subsystem doesn't shift another. */
  fork(label: string): Rng {
    let h = 2166136261 ^ this.s;
    for (let i = 0; i < label.length; i++) h = Math.imul(h ^ label.charCodeAt(i), 16777619);
    return new Rng(h >>> 0);
  }
}
