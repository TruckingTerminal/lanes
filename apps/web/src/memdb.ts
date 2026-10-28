import type { CollLike, DbLike, DocLike, SnapLike } from "./live.js";

/**
 * A stand-in for the artifact store, for tests and for running the page locally.
 * Deliveries to subscribers can be held and flushed, to test late-arriving actions.
 * With `persistKey` it keeps its documents in localStorage and hears other tabs.
 */
export class MemoryDb implements DbLike {
  private docs = new Map<string, Record<string, unknown>>();
  private leases = new Map<string, { holder: string; until: number }>();
  private subs = new Set<{ coll: string; next: (s: { docs: SnapLike[] }) => void }>();
  private held: (() => void)[] = [];
  /** When true, subscribers only hear about writes on `flush()`. */
  hold = false;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly persistKey: string | null = null,
  ) {
    if (persistKey) {
      this.loadPersisted();
      addEventListener("storage", (ev) => {
        if (ev.key !== persistKey) return;
        this.loadPersisted();
        for (const s of this.subs) this.notify(s);
      });
    }
  }

  flush(): void {
    const h = this.held;
    this.held = [];
    for (const f of h) f();
  }

  doc(path: string): DocLike {
    return {
      get: async () => this.snap(path),
      set: async (data) => {
        this.docs.set(path, JSON.parse(JSON.stringify(data)) as Record<string, unknown>);
        this.persist();
        const coll = path.slice(0, path.lastIndexOf("/"));
        for (const s of this.subs) if (s.coll === coll) this.deliver(() => this.notify(s));
      },
      acquire: async ({ holder, ttlMs = 30_000 }) => {
        const t = this.now();
        const cur = this.leases.get(path);
        if (cur && cur.until > t && cur.holder !== holder) return { acquired: false, expiresAt: new Date(cur.until).toISOString() };
        const until = t + ttlMs;
        this.leases.set(path, { holder, until });
        return { acquired: true, expiresAt: new Date(until).toISOString() };
      },
    };
  }

  collection(coll: string): CollLike {
    return {
      get: async () => ({ docs: this.list(coll) }),
      onSnapshot: (next) => {
        const s = { coll, next };
        this.subs.add(s);
        this.deliver(() => this.notify(s));
        return () => this.subs.delete(s);
      },
    };
  }

  private deliver(f: () => void): void {
    if (this.hold) this.held.push(f);
    else queueMicrotask(f);
  }

  private notify(s: { coll: string; next: (x: { docs: SnapLike[] }) => void }): void {
    if (this.subs.has(s)) s.next({ docs: this.list(s.coll) });
  }

  private snap(path: string): SnapLike {
    const body = this.docs.get(path);
    const id = path.slice(path.lastIndexOf("/") + 1);
    return { id, exists: body !== undefined, data: () => (body ? (JSON.parse(JSON.stringify(body)) as Record<string, unknown>) : undefined) };
  }

  private list(coll: string): SnapLike[] {
    const out: SnapLike[] = [];
    const depth = coll.split("/").length + 1;
    for (const path of [...this.docs.keys()].sort()) {
      if (path.startsWith(`${coll}/`) && path.split("/").length === depth) out.push(this.snap(path));
    }
    return out;
  }

  private persist(): void {
    if (!this.persistKey) return;
    try {
      localStorage.setItem(this.persistKey, JSON.stringify([...this.docs]));
    } catch {
      /* local runs only; nothing to fall back to */
    }
  }

  private loadPersisted(): void {
    try {
      const raw = localStorage.getItem(this.persistKey!);
      if (raw) this.docs = new Map(JSON.parse(raw) as [string, Record<string, unknown>][]);
    } catch {
      /* start empty */
    }
  }
}
