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

export const POPULATION = { freeOwnerOperators: 400, fleets: 120, brokers: 60 };
/** Play dollars for the token market (this build has no real money). */
export const PLAYER_WALLET_USD = 100;
const FLEET_START_EXTRA_FD = 20_000;

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
export function joinCompany(w: World, key: string, name: string, hub: string, start: StartKind = "oo"): Company | null {
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
  t: number;
  acts: [number, Action][];
}

/**
 * A private test world: same rules, nobody else in it, and the only place the clock
 * can pause or speed up. Actions apply the moment they're taken. Its log lets the
 * test build carry the world across visits by replaying it.
 */
export class TestGame {
  readonly kind = "test";
  readonly w: World;
  readonly player: Company;
  readonly log: TestLog;
  private listeners: ((e: GameEvent) => void)[] = [];

  constructor(name: string, start: StartKind, hub: string, seed = Math.floor(Math.random() * 1e9)) {
    this.log = { v: 1, ruleset: RULESET, seed, name, start, hub, t: 0, acts: [] };
    this.w = newWorld(seed);
    this.player = joinCompany(this.w, "test", name, hub, start)!;
    this.w.listener = (e) => {
      for (const l of this.listeners) l(e);
    };
    // Open at 06:00, as the first board round clears.
    for (let h = 0; h < 6; h++) this.stepHour();
  }

  /** Rebuilds a test world from its log, a slice at a time so the page stays responsive. */
  static async restore(log: TestLog, onProgress?: (share: number) => void): Promise<TestGame> {
    const g = new TestGame(log.name, log.start, log.hub, log.seed);
    const listeners = g.listeners;
    g.listeners = [];
    let next = 0;
    const applyDue = () => {
      while (next < log.acts.length && log.acts[next]![0] <= g.w.t) g.act(log.acts[next++]![1]);
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

  act(action: Action): ActionResult {
    const r = applyAction(this.w, this.player.id, action);
    if (r.ok) this.log.acts.push([this.w.t, JSON.parse(JSON.stringify(action)) as Action]);
    return r;
  }

  stepHour(): void {
    stepHour(this.w, ruleBotHook);
    this.log.t = this.w.t;
  }
}
