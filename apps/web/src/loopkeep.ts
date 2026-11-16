/**
 * The windows' graded loops, as object URLs (ui/Window.tsx gradedLoop). QA's 0.25.6 item 3 (twelve `blob:`
 * ERR_FILE_NOT_FOUND on a long run): the page kept two loops and revoked the oldest as soon as a third was made, even
 * while a window still drew it, so the browser's next style pass read a revoked URL. A fast clock's stale band effects
 * finishing late, or a hero and the screen's window up together, made that third.
 *
 * Now each window holds the loop it draws, and a URL is revoked only when no window holds it and more than `keep` loops
 * are kept, oldest first, never the newest (its maker takes its hold in the same turn).
 */
export class LoopKeep {
  private readonly urls = new Map<string, string>();
  /** Oldest first. */
  private readonly order: string[] = [];
  private readonly holds = new Map<string, number>();

  constructor(
    private readonly keep: number,
    private readonly revoke: (url: string) => void,
  ) {}

  get(key: string): string | undefined {
    return this.urls.get(key);
  }

  /** Keeps a loop just made. A key already kept keeps its first URL, and the second is revoked. */
  add(key: string, url: string): void {
    if (this.urls.has(key)) {
      if (this.urls.get(key) !== url) this.revoke(url);
      return;
    }
    this.urls.set(key, url);
    this.order.push(key);
    this.trim();
  }

  /** Holds a kept loop for a window that draws it. The release lets it go, once; then it may be revoked. */
  hold(key: string): () => void {
    this.holds.set(key, (this.holds.get(key) ?? 0) + 1);
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      const n = (this.holds.get(key) ?? 1) - 1;
      if (n > 0) this.holds.set(key, n);
      else this.holds.delete(key);
      this.trim();
    };
  }

  /** The keys kept, oldest first. */
  kept(): string[] {
    return [...this.order];
  }

  private trim(): void {
    for (let i = 0; this.order.length > this.keep && i < this.order.length - 1; ) {
      const key = this.order[i]!;
      if (this.holds.has(key)) {
        i++;
        continue;
      }
      this.order.splice(i, 1);
      const url = this.urls.get(key);
      this.urls.delete(key);
      if (url !== undefined) this.revoke(url);
    }
  }
}
