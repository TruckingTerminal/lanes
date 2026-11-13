import type { StandingOrder } from "@lanes/engine";
import { DEFAULT_ORDERS, PLAYER_DISPATCHER_ORDERS } from "./game.js";

/**
 * The dispatcher panel's form (Dispatcher.tsx) as data, so what it shows and what Save writes are one round trip (QA's 8b
 * replay, fail 2: the contracts box read "any contracts order", so Save with nothing changed turned contract offers on).
 * `formOf` is what the panel shows for the saved orders; `ordersFrom` is what Save writes from the form. Saving the form as
 * shown writes the orders it was shown from.
 */
export interface DispatcherForm {
  /** Miles empty to a pickup, the bid's and the further orders'. */
  dh: number;
  /** The bid's markup, in whole percent. */
  pct: number;
  /** The floor over break-even, in whole percent. */
  floor: number;
  repo: boolean;
  repoRounds: number;
  bn: boolean;
  bnPct: number;
  /** Contracts: take local shippers' offers (the box), and when a tender may lapse (the select). */
  ct: boolean;
  ctSpot: string;
  homeAfter: number;
}

type Of<K extends StandingOrder["kind"]> = Extract<StandingOrder, { kind: K }>;
const find = <K extends StandingOrder["kind"]>(orders: readonly StandingOrder[], k: K) => orders.find((o): o is Of<K> => o.kind === k);
const def = <K extends StandingOrder["kind"]>(k: K) => find([...PLAYER_DISPATCHER_ORDERS, ...DEFAULT_ORDERS], k);

/** The form as the panel shows it for these orders. */
export function formOf(orders: readonly StandingOrder[]): DispatcherForm {
  const bid = find(orders, "bid");
  const floor = find(orders, "floor");
  const repo = find(orders, "reposition");
  const bn = find(orders, "bookNow");
  const hm = find(orders, "homeTime");
  const ct = find(orders, "contracts");
  return {
    dh: bid?.maxDeadheadMi ?? 150,
    pct: Math.round((bid?.price.pct ?? def("bid")?.price.pct ?? 0) * 100),
    floor: Math.round((floor?.breakEvenPlusPct ?? 0) * 100),
    repo: Boolean(repo),
    repoRounds: repo?.afterIdleRounds ?? 2,
    bn: Boolean(bn),
    bnPct: Math.round((bn?.breakEvenPlusPct ?? 0.2) * 100),
    // The box is the offers, not the order: a contracts order that takes tenders but no offers shows it unticked.
    ct: ct?.acceptOffers === true,
    ctSpot: ct ? (ct.spotAbovePct === null ? "always" : String(ct.spotAbovePct)) : "always",
    homeAfter: hm?.afterDays ?? def("homeTime")?.afterDays ?? 21,
  };
}

/** What Save writes from the form; `prior` is the orders the panel was shown (their price mode, rest days, contracts). */
export function ordersFrom(f: DispatcherForm, bidding: boolean, prior: readonly StandingOrder[]): StandingOrder[] {
  const bid = find(prior, "bid");
  const hm = find(prior, "homeTime");
  const ct = find(prior, "contracts");
  const dh = Math.max(0, Math.min(150, f.dh || 150));
  const list: StandingOrder[] = [];
  if (bidding) {
    list.push({ kind: "bid", maxDeadheadMi: dh, price: { mode: bid?.price.mode ?? "clearsNear", pct: Math.max(0, f.pct) / 100 } });
    list.push({ kind: "floor", breakEvenPlusPct: Math.max(0, f.floor) / 100 });
    if (f.repo) list.push({ kind: "reposition", afterIdleRounds: Math.max(1, f.repoRounds), to: { openLoadsWithinMi: 400 } });
    if (f.bn) list.push({ kind: "bookNow", breakEvenPlusPct: Math.min(5, Math.max(0, f.bnPct / 100 || 0)), maxDeadheadMi: dh });
    const spotAbovePct = f.ctSpot === "always" ? null : Number(f.ctSpot);
    // Ticked: offers taken. Unticked, a contracts order already there keeps taking tenders, with no offers.
    if (f.ct) list.push({ kind: "contracts", acceptOffers: true, spotAbovePct, maxDeadheadMi: dh });
    else if (ct) list.push({ kind: "contracts", acceptOffers: false, spotAbovePct, maxDeadheadMi: dh });
  }
  list.push({ kind: "homeTime", afterDays: Math.min(365, Math.max(1, Math.round(f.homeAfter) || 21)), restDays: hm?.restDays ?? def("homeTime")?.restDays ?? 5 });
  return list;
}
