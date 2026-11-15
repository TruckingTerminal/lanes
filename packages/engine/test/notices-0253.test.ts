import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, COMMODITIES, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { createWorld, dailyStaking, stepHour, type GameEvent, type Load, type World } from "@lanes/engine";

/**
 * The director's sprint notices: the spoil notice reads from "Deliver by" while windows.spoilAfterDeadline runs the clock
 * from it (§10's words), and a brokerage under its licence stake is told its new loads stop at once.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const withWindows = (o: Record<string, unknown>) => ({ ...LIVE, windows: { ...LIVE.windows, ...o } }) as EconomyConfig;
function world(cfg: EconomyConfig, hours: number, seed: number): World {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed });
  populate(w, { freeOwnerOperators: 20, fleets: 6, brokers: 2 });
  for (let h = 0; h < hours; h++) stepHour(w, ruleBotHook);
  return w;
}

describe("the spoil notice", () => {
  /** A perishable on a loaded truck, made to arrive past its "Deliver by" and its spoil hours; the notices about it. */
  function spoil(cfg: EconomyConfig) {
    const w = world(cfg, 40, 11);
    const perishable = (l: Load) => COMMODITIES[l.commodity]!.spoilHours !== null && l.latestDeliveryT !== undefined;
    const t = w.trucks.find((x) => x.status === "loaded" && x.loadId !== null && perishable(w.loads.get(x.loadId)!))!;
    const l = w.loads.get(t.loadId!)!;
    l.latestDeliveryT = w.t - (COMMODITIES[l.commodity]!.spoilHours! + 1) * 60;
    l.appointmentT = l.latestDeliveryT;
    const said: string[] = [];
    let done = false;
    w.listener = (e: GameEvent) => {
      if (e.kind === "notice" && e.text.startsWith(`Load #${l.id} `)) said.push(e.text);
      if (e.kind === "delivered" && e.loadId === l.id) done = true;
    };
    for (let h = 0; h < 24 * 8 && !done; h++) stepHour(w);
    return said;
  }

  it("with windows.spoilAfterDeadline, it reads from Deliver by, dated, with the claim in full figures", () => {
    expect(spoil(withWindows({ spoilAfterDeadline: true })).some((x) => /^Load #\d+ \(.+\) arrived \d+ h past its Deliver by \(\w{3} \d\d:\d\d\) and was refused as spoiled: no pay, and a [\d,]+ FD cargo claim\.$/.test(x))).toBe(true);
  }, 240_000);

  it("off, it reads from the appointment, as before", () => {
    expect(spoil(withWindows({ spoilAfterDeadline: false })).some((x) => / h past its appointment and was rejected as spoiled: no pay, and a \d+ FD cargo claim\.$/.test(x))).toBe(true);
  }, 240_000);
});

describe("a brokerage under its licence stake", () => {
  it("is told its new loads stop at once, and how soon they start again", () => {
    const w = world(LIVE, 2, 13);
    const b = w.companies.find((c) => c.role === "broker")!;
    b.stakedFd = 0;
    b.tierGraceDay = null;
    const said: string[] = [];
    w.listener = (e: GameEvent) => {
      if (e.kind === "notice" && e.companyId === b.id) said.push(e.text);
    };
    dailyStaking(w);
    const k = w.cfg.token.staking;
    expect(said).toContain(`Your broker licence needs a ${k.roles.broker.toLocaleString("en-US")} FD stake: no new loads until it's staked. Stake it within ${k.graceDays} days and they start again at once; after that, the day after you stake.`);
  });
});
