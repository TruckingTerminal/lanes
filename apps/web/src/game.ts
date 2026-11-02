import { economyConfig, withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds, syntheticCassCycle } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import {
  addTruck,
  applyAction,
  companyAccount,
  createWorld,
  formCompany,
  stepHour,
  type Action,
  type ActionResult,
  type Company,
  type GameEvent,
  type StandingOrder,
  type World,
} from "@lanes/engine";

/**
 * The world every player shares: rule-bot companies plus each human as one more
 * company. The engine is deterministic, so every page that replays the same seed
 * and the same actions computes the same world.
 */

/** Seasons off and the token on, launching after the two-year beta (TOKENOMICS.md). */
// The live world runs the locked levers (config/live.ts) on the base config, seasons off, the token on.
export const GAME_CONFIG: EconomyConfig = {
  ...withLiveLevers(economyConfig),
  seasonClose: { ...economyConfig.seasonClose, enabled: false },
  token: { ...withLiveLevers(economyConfig).token, enabled: true },
};

/**
 * Names the rules the live world runs on. Bump it whenever a change would replay
 * history differently (engine, config, bots, population); a page whose ruleset
 * differs from the world's refuses to run it rather than rewrite the past.
 */
export const RULESET = `lanes-live-1/${economyConfig.version}`;

/**
 * The rings' fallback and tie-break (Jeff, 2026-11-02: the rings are the best freight at the time of year the player
 * starts, hubcard.ts rankStarters; until the readings are in, and between equal readings, these three in this order).
 */
export const FIRST_HUBS: readonly string[] = ["DAL", "LAX", "PHX"];

export const POPULATION = { freeOwnerOperators: 400, fleets: 120, brokers: 60 };
/** Play dollars for the token market (this build has no real money). */
export const PLAYER_WALLET_USD = 100;
export const FLEET_START_EXTRA_FD = 20_000;

export const DEFAULT_ORDERS: StandingOrder[] = [
  { kind: "bid", maxDeadheadMi: 150, price: { mode: "breakEvenPlus", pct: 0.25 } },
  { kind: "floor", breakEvenPlusPct: 0.05 },
  { kind: "reposition", afterIdleRounds: 2, to: { openLoadsWithinMi: 400 } },
  { kind: "bookNow", breakEvenPlusPct: 0.2, maxDeadheadMi: 150 },
  { kind: "homeTime", afterDays: 21, restDays: 5 },
  { kind: "contracts", acceptOffers: true, spotAbovePct: null, maxDeadheadMi: 150 },
];

export function newWorld(seed: number): World {
  const net = buildNetwork(hubs, GAME_CONFIG);
  const w = createWorld({ cfg: GAME_CONFIG, net, feeds: { ...neutralFeeds, cycle: syntheticCassCycle({ seed }) }, seed });
  populate(w, POPULATION);
  return w;
}

export type StartKind = "oo" | "fleet";

/** A human company. The live world only offers the owner-operator start, the same free path every newcomer gets. */
export function joinCompany(w: World, key: string, name: string, hub: string, start: StartKind = "oo", look: "m" | "f" = "m"): Company | null {
  if (!hubs.some((h) => h.id === hub && h.isStarter)) return null;
  const c = formCompany(w, {
    name: name.trim().slice(0, 32) || "Unnamed Freight",
    role: "carrier",
    homeHubId: hub,
    strategy: `player:${key}`,
    human: true,
    orders: DEFAULT_ORDERS,
    freePath: start === "oo",
  });
  if (start === "fleet") {
    addTruck(w, c, "owned", "workhorse", "van", false, { odometer: 210_000, milesSinceRebuild: 40_000, builtDay: -700 });
    addTruck(w, c, "owned", "workhorse", "reefer", false, { odometer: 160_000, milesSinceRebuild: 25_000, builtDay: -500 });
    w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), FLEET_START_EXTRA_FD, `grant:${c.id}:fleet`);
  }
  c.usd.wallet = PLAYER_WALLET_USD;
  // The owner's look is the player's pick at first entry (QA row 9); cosmetic, carried on the join so replays agree.
  const owner = w.staffByCompany.get(c.id)?.find((s) => s.owner);
  if (owner) owner.look = look;
  return c;
}

export const isHuman = (c: Company) => c.strategy.startsWith("player:");

/** A test world's whole history: its seed, the start, and each action with the game minute it was taken. */
export interface TestLog {
  v: 1;
  /** The rules it was played under; a log from older rules can't replay. */
  ruleset?: string;
  seed: number;
  name: string;
  start: StartKind;
  hub: string;
  /** The owner's look, picked at first entry (absent in older logs: the man's). */
  look?: "m" | "f";
  /** Hours the world ran before the company joined (the warm start); absent in logs from before it, which joined at 0. */
  warm?: number;
  t: number;
  /** Each order with the game minute it was taken; a third entry "brokerage" when the brokerage gave it. */
  acts: ([number, Action] | [number, Action, "brokerage"])[];
}

/**
 * The warm start (the director's ruling 5, 2026-11-02): a new test world runs two game days, four rounds, before the
 * company joins, so a newcomer arrives in a market already moving, at 06:00 as a round clears. No load is planted.
 */
export const WARM_HOURS = 54;

/** Steps a world some hours in slices, so the page stays responsive and can show how far it is. */
async function warmUp(w: World, hours: number, onProgress?: (share: number) => void, onHour?: (w: World) => void): Promise<void> {
  while (w.t < hours * 60) {
    const end = performance.now() + 30;
    while (w.t < hours * 60 && performance.now() < end) {
      stepHour(w, ruleBotHook);
      onHour?.(w);
    }
    onProgress?.(w.t / (hours * 60));
    await new Promise((r) => setTimeout(r, 0));
  }
}

/**
 * A private test world: same rules, nobody else in it, and the only place the clock
 * can pause or speed up. Actions apply the moment they're taken. Its log lets the
 * test build carry the world across visits by replaying it.
 */
export class TestGame {
  readonly kind = "test";
  readonly w: World;
  /** Your carrier, once you've chosen a home hub; null while the world waits for the choice. */
  /**
   * The player's companies (specs/brokerage-rule.md section 2): the carrier, and the brokerage once formed, at most one
   * of each. `player` is the company in view: what the screens show and the orders act for. Switching changes nothing
   * in the world.
   */
  carrier: Company | null = null;
  inView: "carrier" | "brokerage" = "carrier";
  /** Set only by tests; otherwise the brokerage is the carrier's partner (brokerage.ts), so it survives every replay. */
  private brokerageOverride: Company | null | undefined = undefined;
  get brokerage(): Company | null {
    if (this.brokerageOverride !== undefined) return this.brokerageOverride;
    const id = this.carrier?.partnerId;
    return id ? (this.w.companies[id - 1] ?? null) : null;
  }
  set brokerage(c: Company | null) {
    this.brokerageOverride = c;
  }
  get player(): Company | null {
    return this.inView === "brokerage" && this.brokerage ? this.brokerage : this.carrier;
  }
  set player(c: Company | null) {
    this.carrier = c;
  }
  readonly log: TestLog;
  private listeners: ((e: GameEvent) => void)[] = [];

  private constructor(log: TestLog, w: World) {
    this.log = log;
    this.w = w;
    this.w.listener = (e) => {
      for (const l of this.listeners) l(e);
    };
  }

  /**
   * A new test world: two game days of the market without you (the warm start). You arrive with no company and
   * choose your home hub inside the world (Jeff, 2026-11-02); `join` brings the company in at that minute.
   */
  /** `onHour` sees the world after each warm-up hour (the screen samples the hub readings there; it only reads). */
  static async create(onProgress?: (share: number) => void, onHour?: (w: World) => void, seed = Math.floor(Math.random() * 1e9)): Promise<TestGame> {
    const w = newWorld(seed);
    await warmUp(w, WARM_HOURS, onProgress, onHour);
    return new TestGame({ v: 1, ruleset: RULESET, seed, name: "", start: "oo", hub: "", t: w.t, acts: [] }, w);
  }

  /** Your company joins at this minute, at the hub you chose; the log keeps when, so the world replays the same. */
  join(name: string, start: StartKind, hub: string, look: "m" | "f" = "m"): Company | null {
    if (this.player) return this.player;
    const c = joinCompany(this.w, "test", name, hub, start, look);
    if (!c) return null;
    this.player = c;
    Object.assign(this.log, { name, start, hub, look, warm: this.w.t / 60 });
    return c;
  }

  /** Rebuilds a test world from its log, a slice at a time so the page stays responsive. */
  static async restore(log: TestLog, onProgress?: (share: number) => void): Promise<TestGame> {
    const w = newWorld(log.seed);
    if (log.warm) await warmUp(w, log.warm);
    // A fresh log the replay writes into, as play would; the saved one is only read.
    const g = new TestGame({ ...log, warm: undefined, t: w.t, acts: [] }, w);
    g.join(log.name, log.start, log.hub, log.look ?? "m");
    // A log from before the warm start opened at 06:00 of day one, the company already in.
    if (!log.warm) for (let h = 0; h < 6; h++) g.stepHour();
    const listeners = g.listeners;
    g.listeners = [];
    let next = 0;
    const applyDue = () => {
      while (next < log.acts.length && log.acts[next]![0] <= g.w.t) {
        const [, a, as] = log.acts[next++]!;
        g.act(a, as);
      }
    };
    while (g.w.t < log.t) {
      const end = performance.now() + 30;
      while (g.w.t < log.t && performance.now() < end) {
        applyDue();
        g.stepHour();
      }
      onProgress?.(g.w.t / log.t);
      await new Promise((r) => setTimeout(r, 0));
    }
    applyDue();
    g.listeners = listeners;
    return g;
  }

  onEvent(fn: (e: GameEvent) => void): void {
    this.listeners.push(fn);
  }

  /**
   * Applies an order for the company in view, or for `as` when given (the brokerage's first orders, sent as it's
   * formed). The log keeps which company gave it, so a replay acts for the same one.
   */
  act(action: Action, as: "brokerage" | "carrier" | undefined = this.inView === "brokerage" && this.brokerage ? "brokerage" : "carrier"): ActionResult {
    const who = as === "brokerage" ? this.brokerage : this.carrier;
    if (!who) return { ok: false, reason: as === "brokerage" ? "you have no brokerage" : "choose your home hub first" };
    const r = applyAction(this.w, who.id, action);
    if (r.ok) this.log.acts.push(as === "brokerage" ? [this.w.t, JSON.parse(JSON.stringify(action)) as Action, as] : [this.w.t, JSON.parse(JSON.stringify(action)) as Action]);
    return r;
  }

  stepHour(): void {
    stepHour(this.w, ruleBotHook);
    this.log.t = this.w.t;
  }
}
