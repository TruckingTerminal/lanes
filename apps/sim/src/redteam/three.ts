/**
 * Red team, pass 2026-11-03b: the three rules of the next restart, with all three switches on, on the live profile.
 * The player brokerage (brokerage.enabled), the Reserve (cashReserve.enabled) and cash now (token.payment.cashNow).
 * Each probe tries to take FD the rules didn't mean to give, or to break what they promise, and prints the FD a day
 * gained or the guard that stopped it. Read-only on the engine: it drives companies through applyAction and reads the
 * ledger (studio/reviews/redteam-2026-11-03b.md).
 *
 * Run:  npx tsx apps/sim/src/redteam/three.ts [--seed 1] [--years 4]
 */
import { parseArgs } from "node:util";
import {
  applyAction,
  companyAccount,
  dayOf,
  facilitiesOf,
  partnerOf,
  reserveCapFd,
  reserveFd,
  reserveHeldFd,
  samePerson,
  shelteredFd,
  type Company,
  type World,
} from "@lanes/engine";
import { act, addAttacker, checkInvariants, checkThree, factorLeak, makeWorld, run, tapLedger, threeConfig } from "./harness.js";

const money = (n: number) => `${n >= 0 ? "" : "-"}${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })} FD`;
const tag = (w: World, t: string) => (w.ledger.totals.get(t) ?? 0) / 100;

interface Finding {
  id: string;
  title: string;
  worked: boolean;
  fdPerDay: number;
  detail: string;
}
const findings: Finding[] = [];
const report = (f: Finding) => {
  findings.push(f);
  console.log(`[${f.worked ? "HOLE" : "ok  "}] ${f.id} ${f.title}${f.worked ? ` — ${money(f.fdPerDay)}/day` : ""}\n       ${f.detail}`);
};

/** Opens the brokerage layer (day 91 of the beta) by running the world, then returns a funded attacker carrier with its brokerage. */
function makePair(w: World, name: string, carrierFd: number): { carrier: Company; broker: Company } | string {
  const carrier = addAttacker(w, name, { freePath: false });
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(carrier.id), carrierFd, `seed:${carrier.id}`);
  const r = act(w, carrier, { type: "form_brokerage", name: `${name} Brokerage`, capitalFd: 120_000 });
  if (!r.ok) return r.reason;
  const broker = partnerOf(w, carrier);
  if (!broker) return "no partner";
  act(w, broker, { type: "set_standing_orders", orders: [{ kind: "broker", marginPct: 0.08, maxOpenLoads: 40 }] });
  return { carrier, broker };
}

// --- E3-RESERVE: dodge the burn beyond the cap (timing, or an inflated cap) --------------------------
function reserveDodge(seed: number): void {
  const w = makeWorld({ seed, cfg: threeConfig(), oo: 40, fleets: 10, brokers: 5 });
  run(w, 95); // open the layer and settle the market
  const c = addAttacker(w, "reserve-hoarder", { freePath: false });
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 2_000_000, `seed:${c.id}`);

  // Attempt A: pile FD into the Reserve and see how much the shelter covers — it must be capped at
  // capWeeks × the week's spending, and this company spends almost nothing, so its cap is tiny.
  act(w, c, { type: "reserve_deposit", fd: 1_500_000 });
  const capA = reserveCapFd(w, c);
  const shelteredA = shelteredFd(w, c);
  const overCap = reserveFd(w, c.id) - shelteredA;

  // Attempt B: a late deposit just before a check can't shelter that week (the first deposit counts from next week,
  // and the week's lowest balance decides). Deposit, then read the shelter before any weekly reset: still 0 beyond
  // what a prior week established.
  const c2 = addAttacker(w, "reserve-timer", { freePath: false });
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c2.id), 500_000, `seed:${c2.id}`);
  act(w, c2, { type: "reserve_deposit", fd: 400_000 });
  const shelteredB = shelteredFd(w, c2); // reserveLowFd was set to 0 on the first deposit → 0 sheltered this week

  // Attempt C: can a capital transfer between an owner's two companies inflate the spend-based cap? The spend only
  // counts true sinks (NOT_SPENDING excludes transfers), so a wash transfer adds nothing to weeklySpend.
  const pair = makePair(w, "reserve-pair", 400_000);
  let capBefore = 0;
  let capAfter = 0;
  if (typeof pair !== "string") {
    run(w, 14); // let a week of spending land so the cap is non-zero
    capBefore = reserveCapFd(w, pair.broker);
    for (let i = 0; i < 20; i++) {
      act(w, pair.broker, { type: "transfer_capital", fd: 1_000 });
      act(w, pair.carrier, { type: "transfer_capital", fd: 1_000 });
    }
    run(w, 14);
    capAfter = reserveCapFd(w, pair.broker);
  }

  const worked = overCap < -0.01 || shelteredB > 1 || capAfter > capBefore * 3 + 1;
  report({
    id: "E3-RESERVE",
    title: "the Reserve dodges the burn beyond its cap",
    worked,
    fdPerDay: 0,
    detail:
      `A small spender deposits 1.5M: cap ${money(capA)}, sheltered ${money(shelteredA)}, over the cap ${money(overCap < 0 ? 0 : overCap)} pays burn/holding as cash. ` +
      `A late deposit of 400k the same week shelters ${money(shelteredB)} (the first deposit counts from next week). ` +
      `A pair washing 40k of transfers moved the spend-based cap ${money(capBefore)} → ${money(capAfter)} (transfers aren't spending). ${worked ? "DODGE" : "the cap holds; the shelter is the week's low up to capWeeks of real spending"}.`,
  });
}

// --- E3-CASHNOW: cash now as a faucet (loop, or combined) --------------------------------------------
function cashNowFaucet(seed: number): void {
  const w = makeWorld({ seed, cfg: threeConfig(), oo: 100, fleets: 30, brokers: 20 });
  const days = 220;
  const feeBefore = tag(w, "sink:factoring_fee");
  const advanceBefore = tag(w, "faucet:npc_factor");
  run(w, 95);

  // A pair cashing its own paper, and a company cashing every invoice it holds, every day it can.
  const pair = makePair(w, "cashnow-pair", 400_000);
  let secondCash = 0;
  let ownRefused = 0;
  run(w, days, () => {
    for (const c of w.companies) {
      if (c.role !== "carrier" && c.role !== "broker") continue;
      for (const r of w.receivables.filter((x) => x.holder === c.id)) {
        const before = w.receivables.find((x) => x.id === r.id)?.holder;
        const res = applyAction(w, c.id, { type: "cash_invoice", receivableId: r.id });
        if (res.ok) {
          // Try to cash the same invoice a second time: it must refuse (the factor holds it now).
          if (applyAction(w, c.id, { type: "cash_invoice", receivableId: r.id }).ok) secondCash++;
        } else if (before !== undefined && typeof pair !== "string" && (r.payer !== 0 && samePerson(w, r.payer, c.id))) {
          ownRefused++;
        }
      }
    }
  });
  const inv = checkInvariants(w, "cashnow").concat(checkThree(w, "cashnow"));
  const leak = factorLeak(w);
  const worked = secondCash > 0 || leak.uncovered > 1 || inv.length > 0;
  report({
    id: "E3-CASHNOW",
    title: "cash now looped or combined into a faucet",
    worked,
    fdPerDay: leak.uncovered / days,
    detail:
      `${days}d, everyone cashing every invoice they hold daily: factor advanced ${money(tag(w, "faucet:npc_factor") - advanceBefore)}, fees to the sink ${money(tag(w, "sink:factoring_fee") - feeBefore)}; ` +
      `a second cash of the same invoice refused ${secondCash === 0 ? "every time" : `${secondCash}× ACCEPTED`}; own/player-shipper paper refused ${ownRefused}×. ` +
      `NPC paper left unpaid ${money(leak.uncovered)}. ${inv.length ? inv.slice(0, 3).join("; ") : "the advance is the shipper's mint brought forward, the fee a sink; no loop mints, cap identity held"}.`,
  });
}

// --- E3-WASH: money between a player's two companies for net gain -----------------------------------
// Four years, the brokerage bots forming pairs and pricing Rule B at the band's ceiling, with the Reserve and cash
// now on too. Measures what the channel moves to the pair over the market, and whether the logbook counts a load twice.
function washAndLogbook(seed: number, years: number): void {
  const days = Math.round(years * 365);
  const w = makeWorld({
    seed,
    cfg: threeConfig({ "brokerage.bots.share": 0.5, "brokerage.bots.ownTenderAt": 1, "brokerage.bots.fromDay": 0, "token.payment.cashNow.botsNetOnly": false }),
    oo: 120,
    fleets: 40,
    brokers: 20,
  });
  run(w, days);
  const inv = checkInvariants(w, "wash").concat(checkThree(w, "wash"));
  const log = w.brokerageLog;
  const leak = factorLeak(w);
  // The channel: own tenders booked, the pay, and the rate over the lane's market (1.0 = the market).
  const booked = log?.ownTendersBooked ?? 0;
  const payFd = log?.ownTenderFd ?? 0;
  const avgRate = booked > 0 ? (log?.ownRateOverRef ?? 0) / booked : 0;
  const movedOverMarket = payFd - payFd / Math.max(0.01, avgRate); // FD paid above what the market would have paid
  // The logbook counts once per person: a load its own carrier hauled drops the broker's handled count.
  const countedOnce = log?.countedOnce ?? 0;
  const feeFd = log?.feeFd ?? 0;
  const worked = inv.length > 0 || leak.uncovered > 1;
  report({
    id: "E3-WASH",
    title: "wash money/loads between a player's two companies",
    worked,
    fdPerDay: Math.max(0, movedOverMarket) / days / Math.max(1, log?.formed.length ?? 1),
    detail:
      `${years}y, ${log?.formed.length ?? 0} pairs, Rule B at the ceiling: ${booked} own tenders booked for ${money(payFd)}, rate/market ${avgRate.toFixed(3)}, ` +
      `moved over the market ${money(Math.max(0, movedOverMarket))} (the band holds the pay; transfer fees paid ${money(feeFd)}). ` +
      `A load its own carrier hauled dropped the broker's count ${countedOnce}× (counted once per person). NPC paper unpaid ${money(leak.uncovered)}. ` +
      `${inv.length ? inv.slice(0, 3).join("; ") : "cap identity held; the tax, airdrop, logbook and credit treat the pair as one person"}.`,
  });
}

// --- E3-FACBOND: a broker that also ships (a facility) outruns its bond ------------------------------
// A broker may own a facility (the shipper role). Its shipper paper is paid from the same bond and counts in its AP,
// but posting facility freight isn't gated by the AP cap. Does that let the NPC factor advance against paper the bond
// can't cover, and lose FD when the broker winds up?
function facilityBond(seed: number): void {
  const w = makeWorld({ seed, cfg: threeConfig(), oo: 80, fleets: 30, brokers: 20 });
  const days = 300;
  run(w, 95);
  const pair = makePair(w, "facility-broker", 600_000);
  if (typeof pair === "string") {
    report({ id: "E3-FACBOND", title: "a broker that ships outruns its bond", worked: false, fdPerDay: 0, detail: `couldn't form the pair: ${pair}` });
    return;
  }
  // The brokerage buys facilities (the shipper role) and signs a factoring contract, so its carriers' paper is
  // advanced by the NPC factor on delivery. Then it posts freight far past its 75k bond. It is funded first, while it
  // has no paper (a transfer out of the carrier is allowed then), so it can afford the facilities over its bond.
  act(w, pair.carrier, { type: "transfer_capital", fd: 300_000 }); // carrier → brokerage, as the owner's capital
  let bought = 0;
  for (const h of w.net.hubs.slice(0, 6)) {
    if (act(w, pair.broker, { type: "buy_facility", facility: "warehouse", hubId: h.id }).ok) bought++;
  }
  act(w, pair.broker, { type: "set_pay_terms", terms: "factor" });
  const leak0 = factorLeak(w);
  run(w, days, () => {
    for (const r of w.receivables.filter((x) => x.holder === pair.broker.id)) applyAction(w, pair.broker.id, { type: "cash_invoice", receivableId: r.id });
  });
  const inv = checkInvariants(w, "facbond").concat(checkThree(w, "facbond"));
  const leak = factorLeak(w);
  const uncovered = leak.uncovered - leak0.uncovered;
  const liq = pair.broker.liquidatingSince !== null || pair.broker.bankruptcies > 0;
  // Control: the same pair and the same cash-now draining, but no facilities (no shipper paper past the bond).
  const wc = makeWorld({ seed, cfg: threeConfig(), oo: 80, fleets: 30, brokers: 20 });
  run(wc, 95);
  const pc = makePair(wc, "facility-control", 600_000);
  let ctlUncovered = 0;
  if (typeof pc !== "string") {
    act(wc, pc.carrier, { type: "transfer_capital", fd: 300_000 });
    act(wc, pc.broker, { type: "set_pay_terms", terms: "factor" });
    const c0 = factorLeak(wc);
    run(wc, days, () => { for (const r of wc.receivables.filter((x) => x.holder === pc.broker.id)) applyAction(wc, pc.broker.id, { type: "cash_invoice", receivableId: r.id }); });
    ctlUncovered = factorLeak(wc).uncovered - c0.uncovered;
  }
  const worked = uncovered - ctlUncovered > 1_000 || inv.length > 0;
  report({
    id: "E3-FACBOND",
    title: "a broker that ships outruns its bond",
    worked,
    fdPerDay: Math.max(0, uncovered) / days,
    detail:
      `${days}d, a brokerage with ${bought} facilities (the shipper role) and a factoring contract: NPC factor left unpaid ${money(uncovered)} ` +
      `(control, no facilities: ${money(ctlUncovered)}), overdraft ${money(leak.overdraft - leak0.overdraft)}, the brokerage ${liq ? "liquidated" : "stayed solvent"}. ` +
      `${inv.length ? inv.slice(0, 3).join("; ") : worked ? "the broker's shipper paper is factored as bonded broker paper, but its 75k bond doesn't cover it; on default the NPC factor loses the excess" : "the factor was made whole"}.`,
  });
}

// --- E3-CAPINFLATE: the Reserve's cap inflated by spending that comes back ---------------------------
// The cap is capWeeks x the average of the weeks the working-capital rule keeps (`weeklySpend`, outflows to sinks). An
// NPC lease deposit posts to a sink (sink:lease_deposit, ref "deposit:", not in ledger.ts NOT_SPENDING), so it counts as
// spending, and it is refunded when the truck goes back. A carrier with an owned truck leases extra trucks, lets the week
// close, and hands them back after the minimum term: how much cap (and working capital) does each FD it really loses buy?
function capInflate(seed: number): void {
  const w = makeWorld({ seed, cfg: threeConfig(), oo: 60, fleets: 20, brokers: 10 });
  run(w, 120);
  // A bot carrier that owns a truck and has room under its truck cap, given a hoard to shelter.
  const c = w.companies.find((x) => x.role === "carrier" && x.liquidatingSince === null && x.partnerId === undefined && (w.trucksByCompany.get(x.id) ?? []).some((t) => t.lease === "owned"));
  if (!c) {
    report({ id: "E3-CAPINFLATE", title: "the Reserve's cap inflated by spending that comes back", worked: false, fdPerDay: 0, detail: "no carrier with an owned truck to lease from" });
    return;
  }
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 1_000_000, `seed:${c.id}`);
  const acct = companyAccount(c.id);
  const sums = tapLedger(w, (from, to, ref) => {
    if (from === acct && to === "sink:lease_deposit") return "deposit";
    if (from === "faucet:lease_deposit" && to === acct) return "refund";
    if (from === acct && to === "sink:npc_lease") return "rent";
    if (from === acct && to === "sink:fleet_overhead") return "overhead";
    return null;
  });
  // Let a clean week land so the before-cap is the company's own.
  run(w, 7);
  const capBefore = reserveCapFd(w, c);
  const wcBefore = c.weeklySpend.reduce((a, b) => a + b, 0);
  const rent0 = sums.get("rent") ?? 0;
  const ovh0 = sums.get("overhead") ?? 0;
  const leased: number[] = [];
  for (let i = 0; i < 12; i++) {
    const before = new Set((w.trucksByCompany.get(c.id) ?? []).map((t) => t.id));
    if (!act(w, c, { type: "lease_truck", trailer: "van" }).ok) break;
    for (const t of w.trucksByCompany.get(c.id) ?? []) if (!before.has(t.id)) leased.push(t.id);
  }
  run(w, 7); // the week the deposits landed in closes: weeklySpend carries them
  const capPeak = reserveCapFd(w, c);
  const wcPeak = c.weeklySpend.reduce((a, b) => a + b, 0);
  run(w, w.cfg.freeEntry.leases.minTermDays); // past the minimum term
  // Hand each back the first day it is idle at a hub (a leased truck on a load can't go back until it lands).
  const back = new Set<number>();
  for (let d = 0; d < 45 && back.size < leased.length; d++) {
    for (const id of leased) if (!back.has(id) && act(w, c, { type: "return_lease", truckId: id }).ok) back.add(id);
    if (back.size < leased.length) run(w, 1);
  }
  const returned = back.size;
  const deposit = sums.get("deposit") ?? 0;
  const refund = sums.get("refund") ?? 0;
  const rent = (sums.get("rent") ?? 0) - rent0;
  const overhead = (sums.get("overhead") ?? 0) - ovh0;
  const held = deposit - refund; // still with the lessor, refundable
  const cost = rent + overhead; // what leasing really cost (the trucks' own hauling offsets the lessor's share of gross)
  const capGain = capPeak - capBefore;
  const wcGain = wcPeak - wcBefore;
  const shelter = capGain + wcGain; // what the close would not burn, at the peak
  const worked = leased.length > 0 && shelter > 2 * Math.max(1, deposit);
  report({
    id: "E3-CAPINFLATE",
    title: "the Reserve's cap inflated by spending that comes back",
    worked,
    fdPerDay: 0,
    detail:
      `${c.name}: ${leased.length} extra NPC leases, ${returned} handed back once idle after the ${w.cfg.freeEntry.leases.minTermDays}d term: deposits counted as spending ${money(deposit)}, refunded ${money(refund)} (${money(held)} still held, refundable); ` +
      `rent ${money(rent)} + overhead ${money(overhead)} paid while they ran. The Reserve cap ${money(capBefore)} -> ${money(capPeak)} and working capital ${money(wcBefore)} -> ${money(wcPeak)}: ` +
      `${money(shelter)} more shelter from the season close at the peak, ${(shelter / Math.max(1, deposit)).toFixed(1)} FD per FD of deposit put up (and the deposit comes back). ` +
      `${worked ? "The deposit is refundable but counts as spending (ledger.ts NOT_SPENDING lacks \"deposit:\")" : "the cap holds"}.`,
  });
}

// --- E3-SPLIT: the airdrop's profit score split across the pair -----------------------------------
// At the launch each company's beta operating profit is clamped at zero (token.ts launchToken) before
// onePersonOneShare adds the brokerage's to its carrier's. So a brokerage's loss is dropped, not netted: the person
// scores max(0, carrier) + max(0, brokerage) instead of max(0, carrier + brokerage). Rule B at the band's ceiling moves
// profit from the brokerage to the carrier at will. This replicates the allocation from the state the day before the
// launch both ways and reports the FD of airdrop share the split hands the pairs.
function airdropSplit(seed: number): void {
  const w = makeWorld({
    seed,
    cfg: threeConfig({ "token.betaYears": 1, "brokerage.bots.share": 0.6, "brokerage.bots.ownTenderAt": 1, "brokerage.bots.fromDay": 0 }),
    oo: 120,
    fleets: 40,
    brokers: 20,
  });
  const launchAt = Math.round(w.cfg.token.betaYears * w.cfg.time.daysPerSeason);
  run(w, launchAt - 1); // the state just before the launch day's jobs
  const tc = w.cfg.token;
  const op = (c: Company) => c.operating.revenueFd - c.operating.costFd + facilitiesOf(w, c.id).reduce((x, f) => x + f.netFd, 0);
  const life = (c: Company) => c.milesHistory.reduce((a, b) => a + b, 0) + c.milesTotal;
  const ok = (c: Company) => c.liquidatingSince === null && c.authority.status !== "revoked";
  const shares = (fair: boolean): Map<number, number> => {
    const miles = w.companies.map((c) => (ok(c) ? life(c) : 0));
    const profits = w.companies.map((c) => (ok(c) ? Math.max(0, op(c)) : 0));
    w.companies.forEach((c, i) => {
      const carrier = c.role === "broker" ? partnerOf(w, c) : null;
      if (!carrier) return;
      const j = carrier.id - 1;
      miles[j]! += miles[i]!;
      // As built: the clamped parts add. Fair: one person, one result, clamped once.
      profits[j] = fair ? (ok(carrier) ? Math.max(0, op(carrier) + (ok(c) ? op(c) : 0)) : 0) : profits[j]! + profits[i]!;
      miles[i] = 0;
      profits[i] = 0;
    });
    const tm = miles.reduce((a, b) => a + b, 0);
    const tp = profits.reduce((a, b) => a + b, 0);
    const cap = tc.airdrop.fd * tc.airdrop.capShare;
    const out = new Map<number, number>();
    w.companies.forEach((c, i) => {
      const score = (tm > 0 ? (tc.airdrop.weights.miles * miles[i]!) / tm : 0) + (tp > 0 ? (tc.airdrop.weights.profit * profits[i]!) / tp : 0);
      out.set(c.id, Math.min(cap, tc.airdrop.fd * score));
    });
    return out;
  };
  const built = shares(false);
  const fair = shares(true);
  const carriers = w.companies.filter((c) => c.role === "carrier" && c.partnerId !== undefined);
  let extra = 0;
  let pairsHelped = 0;
  let brokerLoss = 0;
  let biggest = 0;
  for (const c of carriers) {
    const d = (built.get(c.id) ?? 0) - (fair.get(c.id) ?? 0);
    extra += d;
    if (d > 1) pairsHelped++;
    biggest = Math.max(biggest, d);
    const b = partnerOf(w, c);
    if (b && op(b) < 0) brokerLoss += -op(b);
  }
  run(w, 2); // through the launch: the engine's own allocation, to check the replica
  const actual = carriers.reduce((x, c) => x + (c.airdrop?.totalFd ?? 0), 0);
  const replica = carriers.reduce((x, c) => x + (built.get(c.id) ?? 0), 0);
  const inv = checkInvariants(w, "split").concat(checkThree(w, "split"));
  report({
    id: "E3-SPLIT",
    title: "the airdrop's profit score split across the pair",
    worked: extra > 1_000,
    fdPerDay: extra / launchAt / Math.max(1, carriers.length),
    detail:
      `${carriers.length} pairs at the launch (day ${w.token.launchDay}): brokerages' beta losses ${money(brokerLoss)} dropped from the profit score, not netted; ` +
      `the pairs' airdrop as built ${money(replica)} (the engine allocated ${money(actual)}) against ${money(replica - extra)} with one result per person: ` +
      `${money(extra)} more for ${pairsHelped} pairs (largest ${money(biggest)}). ` +
      `${inv.length ? inv.slice(0, 2).join("; ") : "money conserved; the excess comes out of the other companies' shares of the pot"}.`,
  });
}

// --- E3-LAUNCHHOLD: carry beta stake across the reset by owing the own carrier ----------------------
// The launch hold keeps a beta brokerage's bond behind paper still open at the reset and pays it after, so a carrier
// isn't stiffed across the launch. Own-carrier paper isn't excluded: an owner whose brokerage owes its own carrier at
// the reset has kept stake (beta FD that would otherwise burn) pay the paired carrier in post-reset FD. This measures
// how much the launch holds pay to OWN carriers (samePerson) across the reset, against the brokerage stake that burns.
function launchHoldCarry(seed: number): void {
  // A one-year beta so the launch happens inside a tractable run, with the pairs forming from day 91 and pricing Rule B
  // at the ceiling; the mechanism doesn't depend on when the launch falls.
  const w = makeWorld({
    seed,
    cfg: threeConfig({ "token.betaYears": 1, "brokerage.bots.share": 0.6, "brokerage.bots.ownTenderAt": 1, "brokerage.bots.fromDay": 0 }),
    oo: 120,
    fleets: 40,
    brokers: 20,
  });
  // Tap stake -> carrier postings during the launch window, split by whether the carrier is the stake owner's own carrier.
  const taps = tapLedger(w, (from, to, ref) => {
    if (!ref.startsWith("receivable:") && !ref.startsWith("launch:")) return null;
    const bm = /^co:stake:(\d+)$/.exec(from);
    const cm = /^co:(\d+)$/.exec(to);
    if (!bm || !cm) return null;
    const bid = Number(bm[1]);
    const cid = Number(cm[1]);
    const broker = w.companies[bid - 1];
    if (!broker || broker.role !== "broker" || w.token.launchDay === null) return null;
    return broker.partnerId === cid ? "own" : "arm";
  });
  run(w, 365 + 40); // to just past the launch and through the net-30 hold window
  const inv = checkInvariants(w, "launchhold").concat(checkThree(w, "launchhold"));
  const ownCarry = taps.get("own") ?? 0;
  const armCarry = taps.get("arm") ?? 0;
  const resetBurn = tag(w, "sink:launch_reset");
  const lateBurn = w.brokerageLog?.launchLateBurnFd ?? 0;
  const pairs = w.brokerageLog?.formed.length ?? 0;
  const worked = inv.length > 0; // money is conserved either way; the question is whether the carry is a net gain vs an honest burn
  report({
    id: "E3-LAUNCHHOLD",
    title: "carry beta stake across the reset to the own carrier",
    worked,
    fdPerDay: 0,
    detail:
      `${pairs} pairs, launch at day ${w.token.launchDay}: launch holds paid own carriers ${money(ownCarry)} and arm's-length carriers ${money(armCarry)} in post-reset FD; ` +
      `brokerage stake burned at the reset total ${money(resetBurn)} (late burn ${money(lateBurn)}). ` +
      `${inv.length ? inv.slice(0, 3).join("; ") : `money conserved; the hold pays open paper (NPC first, the own carrier last) and burns the rest. ${ownCarry > 1000 ? "A pair that owes its own carrier at the reset recovers that much bond value as post-reset FD instead of burning it — see the review." : "Own carriers were paid little across this reset."}`}.`,
  });
}

function main(): void {
  const { values } = parseArgs({ options: { seed: { type: "string", default: "1" }, years: { type: "string", default: "4" }, only: { type: "string", default: "" } } });
  const seed = Number(values.seed);
  const years = Number(values.years);
  const only = values.only;
  console.log(`THREE RULES · live profile, all three switches on · seed ${seed}${only ? ` · only ${only}` : ""}\n`);
  const run1 = (name: string, fn: () => void) => { if (!only || only === name) fn(); };
  run1("reserve", () => reserveDodge(seed));
  run1("cashnow", () => cashNowFaucet(seed));
  run1("facbond", () => facilityBond(seed));
  run1("launchhold", () => launchHoldCarry(seed));
  run1("capinflate", () => capInflate(seed));
  run1("split", () => airdropSplit(seed));
  run1("wash", () => washAndLogbook(seed, years));
  const holes = findings.filter((f) => f.worked);
  console.log(`\n${holes.length} of ${findings.length} probes found a hole.`);
  for (const h of holes) console.log(`  HOLE ${h.id}: ${money(h.fdPerDay)}/day — ${h.title}`);
}

main();
