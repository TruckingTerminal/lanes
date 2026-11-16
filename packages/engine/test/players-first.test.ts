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
  noteBrokerTender,
  partnerOf,
  playersFirst,
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
const form = (w: World, carrier: Company) => {
  const capital = w.cfg.token.staking.roles.broker + w.cfg.permits.brokerLicenseRenewalFd + 20_000;
  expect(applyAction(w, carrier.id, { type: "form_brokerage", name: "Owner Brokerage", capitalFd: capital })).toEqual({ ok: true });
  return partnerOf(w, carrier)!;
};

describe("players first (brokerRisk.entry.playersFirst)", () => {
  it("is off by default and in the live levers", () => {
    expect(LIVE.brokerRisk.entry.playersFirst).toEqual({ yields: false, signal: false, hint: false, path: false });
    expect(playersFirst(createWorld({ cfg: LIVE, net, feeds: neutralFeeds, seed: 1 }))).toEqual({ yields: false, signal: false, hint: false });
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
