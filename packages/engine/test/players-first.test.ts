import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import {
  applyAction,
  companyAccount,
  createWorld,
  dayOf,
  formCompany,
  isRoundBoundary,
  stepHour,
  noteBrokerTender,
  partnerOf,
  playersFirst,
  postHeld,
  startHold,
  renewalCounts,
  renewalReport,
  stakeAccount,
  tradingBroker,
  weeklyBrokerEntry,
  type Company,
  type World,
} from "@lanes/engine";

/**
 * The director's players-first ruling (director-broker-players-2026-11-15.md; brokerRisk.entry.playersFirst): a brokerage a
 * carrier forms withdraws the newest AI brokerage founded and not yet open, one for one (§1); a carrier's brokerage that
 * stops trading stops counting and is logged for the monthly report, players' and AI's apart (§2).
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const entry = (yields: boolean): EconomyConfig => ({
  ...LIVE,
  brokerRisk: { ...LIVE.brokerRisk, entry: { ...LIVE.brokerRisk.entry, enabled: true, playersFirst: { ...LIVE.brokerRisk.entry.playersFirst, yields, signal: true } } },
});

/** Four AI brokers, entry's state begun, and a carrier with the cash to form a brokerage, the layer open. */
function world(cfg: EconomyConfig): { w: World; carrier: Company } {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 7, keepLedgerEntries: true });
  populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
  noteBrokerTender(w);
  if (w.ladder) w.ladder.brokerage = dayOf(w.t, w.cfg);
  const carrier = formCompany(w, { name: "Owner Freight", role: "carrier", homeHubId: "DAL", strategy: "player:owner", orders: [], freePath: false, human: true });
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(carrier.id), 200_000, "test");
  return { w, carrier };
}
const toRound = (w: World) => {
  do stepHour(w);
  while (!isRoundBoundary(w.t, w.cfg));
};
const form = (w: World, carrier: Company) => {
  const capital = w.cfg.token.staking.roles.broker + w.cfg.permits.brokerLicenseRenewalFd + 20_000;
  expect(applyAction(w, carrier.id, { type: "form_brokerage", name: "Owner Brokerage", capitalFd: capital })).toEqual({ ok: true });
  return partnerOf(w, carrier)!;
};

describe("players first (brokerRisk.entry.playersFirst)", () => {
  it("is off by default and in the live levers", () => {
    expect(LIVE.brokerRisk.entry.playersFirst).toEqual({ yields: false, signal: false, hint: false, path: false, peopleOnly: false });
    expect(playersFirst(createWorld({ cfg: LIVE, net, feeds: neutralFeeds, seed: 1 }))).toEqual({ yields: false, signal: false, hint: false, peopleOnly: false });
  });

  it("§1: a carrier's new brokerage withdraws the newest AI brokerage not yet open, one for one; off, none", () => {
    const { w, carrier } = world(entry(true));
    w.brokerEntry!.entrants.push({ founded: 0, opens: 120 }, { founded: 7, opens: 127 });
    const b = form(w, carrier);
    const today = dayOf(w.t, w.cfg);
    expect(w.brokerEntry!.entrants).toEqual([
      { founded: 0, opens: 120 },
      { founded: 7, opens: 127, withdrawn: today, withdrawnFor: b.id },
    ]);
    expect(renewalReport(w)!.entrants).toMatchObject({ founded: 2, withdrawn: 1, yielded: 1 });

    const off = world(entry(false));
    off.w.brokerEntry!.entrants.push({ founded: 0, opens: 120 });
    form(off.w, off.carrier);
    expect(off.w.brokerEntry!.entrants).toEqual([{ founded: 0, opens: 120 }]);
  });

  it("the red team's 0.25.6 low item: an idle licensed brokerage stops counting after flowWeeks; posting a tender brings it back", () => {
    const { w, carrier } = world(entry(true));
    toRound(w); // loads on the board, before the brokerage exists to be tendered any
    const b = form(w, carrier);
    const weeks = w.cfg.brokerRisk.entry.flowWeeks;
    expect(tradingBroker(w, b)).toBe(true); // formed today: at work
    w.t += weeks * 7 * w.cfg.time.gameMinutesPerDay; // flowWeeks with nothing posted
    expect(b.stakedFd).toBe(w.cfg.token.staking.roles.broker); // still licensed
    expect(tradingBroker(w, b)).toBe(false);
    // A tender held for it and posted: at work again, from today.
    const l = [...w.loads.values()].find((x) => x.status === "open" && x.brokerId === null && !x.hold)!;
    l.brokerId = b.id;
    b.openBrokerLoads++;
    startHold(w, l, b);
    expect(tradingBroker(w, b)).toBe(true); // a load open
    expect(postHeld(w, b, l)).toBeNull();
    expect(b.brokerActiveDay).toBe(dayOf(w.t, w.cfg));
    b.openBrokerLoads = 0;
    expect(tradingBroker(w, b)).toBe(true);
    // With entry off (the live levers), nothing is stamped.
    const off = world(LIVE);
    toRound(off.w);
    const ob = form(off.w, off.carrier);
    const ol = [...off.w.loads.values()].find((x) => x.status === "open" && x.brokerId === null && !x.hold)!;
    ol.brokerId = ob.id;
    ob.openBrokerLoads++;
    startHold(off.w, ol, ob);
    postHeld(off.w, ob, ol);
    expect(ob.brokerActiveDay).toBeUndefined();
  });

  it("the director's pending call, peopleOnly: a bot carrier's pair yields only with it off; a person's either way", () => {
    const people = (on: boolean): EconomyConfig => {
      const c = entry(true);
      return { ...c, brokerRisk: { ...c.brokerRisk, entry: { ...c.brokerRisk.entry, playersFirst: { ...c.brokerRisk.entry.playersFirst, peopleOnly: on } } } };
    };
    for (const on of [false, true]) {
      const { w } = world(people(on));
      const bot = formCompany(w, { name: "Bot Freight", role: "carrier", homeHubId: "DAL", strategy: "greedy", orders: [], freePath: false });
      w.ledger.post(w.t, "faucet:starting_grant", companyAccount(bot.id), 200_000, "test");
      w.brokerEntry!.entrants.push({ founded: 0, opens: 120 });
      form(w, bot);
      expect(w.brokerEntry!.entrants[0]!.withdrawn !== undefined).toBe(!on);
    }
    const { w, carrier } = world(people(true));
    w.brokerEntry!.entrants.push({ founded: 0, opens: 120 });
    form(w, carrier); // a person's
    expect(w.brokerEntry!.entrants[0]!.withdrawn).toBeDefined();
  });

  it("§1: with none pending, the brokerage counts in the flow's denominator as it trades; lapsed, it stops counting and is logged", () => {
    const { w, carrier } = world(entry(true));
    const b = form(w, carrier);
    expect(tradingBroker(w, b)).toBe(true);
    weeklyBrokerEntry(w);
    expect(w.brokerEntry!.weeks.at(-1)!.trading).toBe(5); // four AI brokers and the player's
    expect(w.brokerEntry!.carrierOwned).toEqual([b.id]);
    // Its bond gone (a lapse): no longer trading, so no longer counted; the stop is logged once.
    w.ledger.post(w.t, stakeAccount(b.id), companyAccount(b.id), b.stakedFd, "test");
    b.stakedFd = 0;
    expect(tradingBroker(w, b)).toBe(false);
    weeklyBrokerEntry(w);
    weeklyBrokerEntry(w);
    expect(w.brokerEntry!.weeks.at(-1)!.trading).toBe(4);
    expect(w.brokerEntry!.carrierOwnedStops).toEqual([{ day: dayOf(w.t, w.cfg), companyId: b.id }]);
    const today = dayOf(w.t, w.cfg);
    expect(renewalCounts(w, today, today)).toMatchObject({ carrierOwnedOpened: 1, carrierOwnedStopped: 1 });
  });
});
