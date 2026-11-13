/**
 * The walkthrough (Jeff, 2026-11-01): Iuliia, the dispatcher-trainer, walks a new player from one leased truck to a
 * fleet. A checklist that reads the world: each step is done when the company's own state says so, nothing is saved,
 * so it is right on every screen and after every reload. The card shows the first step not yet done, what Iuliia
 * says about it, where to click, and why; the player can read ahead.
 */
import type { EconomyConfig } from "@lanes/config";
import { condition, crewed, dayOf, ordersWaitForHand, settlementShare, type Company, type World } from "@lanes/engine";
import { firstTruckLine } from "./figures.js";
import type { Tab } from "./tabs.js";
import { STEP9 } from "./copy.js";
import { PENDING } from "./copy-pending.js";
import { firstTruckRoute } from "./finance.js";
import { worldScope } from "./onboard.js";
import { shortDate, TIER_NAME as TIER_LABEL, TRAILER_NAME as TRAILER_LABEL } from "./format.js";

/** Iuliia's mood for the step: her face at rest in the live portrait (portrait.ts). */
export type Mood = "idle" | "wave" | "point" | "laugh";

export interface WalkStep {
  id: string;
  title: string;
  tab: Tab;
  /** The screen where the step's event happens, where its full line plays (the director's R5); `tab` when it's the same. */
  at?: Tab;
  mood: Mood;
  /** What Iuliia says in the sheet, in 25 words or fewer (copy-first-ten-minutes.md). */
  brief: string;
  /** What Iuliia says on her tab, a paragraph each. */
  say: string[];
  /** Where to click, in one line. */
  do: string;
  /** The line instead, from the company's state today (step 9: the used lot empty, the gap to a new rig on a loan); null keeps `do`. */
  doNow?: (w: World, c: Company) => string | null;
  /** Why it matters, in one line. */
  why: string;
  /** The words instead for a company with no lessor's truck (a small fleet owns its two from the start). */
  owned?: { brief: string; say: string[]; do: string; why: string };
  done: (w: World, c: Company) => boolean;
  /**
   * Client batch 8a item 58 (the director's D): whether the step's object exists, so it can be done now. A step that
   * can't be done yet waits: neither skipped nor shown, and the next one that can shows. Absent: always.
   */
  can?: (w: World, c: Company) => boolean;
}

/** The Miles step's done mark: loaded miles in all (second in the director's order, so a first stretch, not a career). */
export const MILES_STEP_DONE = 2_500;

const n = (x: number) => Math.round(x).toLocaleString("en-US");
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function walkSteps(cfg: EconomyConfig, hub = "your home hub"): WalkStep[] {
  const [r1, r2] = cfg.time.boardRoundHours;
  const round = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const trucksOf = (w: World, c: Company) => (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired");
  const staffOf = (w: World, c: Company, kind: string) => w.staff.filter((s) => s.companyId === c.id && s.kind === kind && !s.owner && s.status !== "gone").length;
  const age = (w: World, c: Company) => dayOf(w.t, w.cfg) - c.createdDay;
  const miles = (c: Company) => c.milesHistory.reduce((a, b) => a + b, 0) + c.milesTotal;
  const [down0, down1] = cfg.equipmentFinance.purchase.downShare;
  const hours = cfg.hos.drivingHoursPerDay;
  const rig = cfg.dealerFd.tractor.workhorse + cfg.dealerFd.trailer.van;
  // The lot's rig as the lot sells it (usedMarket.npcLot), and the purchase loan's down payment as the lender reads it.
  const lot = cfg.usedMarket.npcLot;
  const lotCondition = condition(cfg, { lease: "owned", milesSinceRebuild: lot.milesSinceRebuild });
  const col = cfg.equipmentFinance.purchase.collateral;
  const downs = down0 === down1 ? pct(down0) : `${pct(down0)} to ${pct(down1)}`;
  const ownLoanLine = col.enabled
    ? PENDING.walkOwnLoanCollateral(downs, col.freeYears, n(col.freeMiles), pct(col.downPerYear), pct(col.downPer100kMi), pct(col.newBusiness.downAdd), pct(col.maxDownShare), col.declineOverYears, n(col.declineOverMiles))
    : PENDING.walkOwnLoanPlain(downs);
  return [
    {
      id: "welcome",
      title: "Choose your home",
      tab: "fleet",
      mood: "wave",
      brief: "The rings mark where a new carrier finds freight right now. You may start at any starter city; any city shows its freight.",
      say: [
        `Good morning. Iuliia, with two i's; my mother was thorough. I've run operations for fleets a few hundred trucks bigger than this one, and now I run you, which the clipboard says is one leased Workhorse with a dry van. The lessor keeps ${pct(cfg.costs.npcLeaseShareOfGross)} of every load and does the maintenance; the rest is yours, and so is the driving, since the driver is you. A company of one. Lean. I approve.`,
        `The clock is real: one game day every ${cfg.time.realHoursPerGameDayLive} hours of your life, and the market does not sleep. Neither did I, in the nineties; it was that kind of decade. The map is everyone's trucks; the ringed cities are good homes. My grandmother said a person who doesn't know where home is will drive past it twice. She meant my uncle. It applies to fleets.`,
      ],
      do: "Choose your home: tap a ringed hub, then Start here.",
      why: "Everything starts and ends at your hub: the loads you can see first, the shippers who prefer locals, and where the truck sleeps for free.",
      // Ticks on the company's creation, the player's own act (draft 4): a company on screen has done it.
      done: () => true,
    },
    {
      id: "board",
      title: "Reading the board",
      tab: "loads",
      mood: "point",
      brief: "Each card is a load; its chip is your profit. Open a green one near your truck, then Book now or Bid.",
      say: [
        `The Loads tab is the whole game in one list, so sit up straight. Each line is a lane, the miles, and a rate per mile. The shipper has a ceiling it won't pay above; your truck has a break-even it can't run below; the board shows you both, because I prefer my students to lose for interesting reasons. Loads near your truck first: an empty mile pays nothing and burns fuel. One doesn't drive to Vladivostok to say hello.`,
        `Bids clear twice a day, at ${round(r1)} and ${round(r2)} game time. The lowest rate that still covers the shipper wins, so bidding high is a way to watch other people haul. Bid once and let it clear. If you bid nothing, your dispatcher bids for you, and for now your dispatcher is you, standing beside me, holding nothing. Go on.`,
      ],
      do: `Open a load near ${hub}, read the money, then Book now or Bid.`,
      why: "Rates move with the market: a strong hub pays to leave, a weak one pays to arrive, and the board's recent rates tell you which is which.",
      // Ticks on the player's own first bid or booking (draft 4), which the engine records. A fleet whose dispatcher
      // books from the start (no first bid by hand to wait for) ticks it on its first load instead (QA's guidance
      // replay: a small fleet never had a truck idle to bid by hand, and the step stood for a month).
      done: (w, c) => c.firstHandBidDay !== null || (!ordersWaitForHand(w, c) && (c.delivered > 0 || (w.trucksByCompany.get(c.id) ?? []).some((t) => t.loadId !== null))),
    },
    {
      id: "orders",
      title: "Set your dispatcher before you go",
      tab: "fleet",
      mood: "laugh",
      // Client batch 8a item 58 (the director's B): right after the first hand-booked load, with her line.
      brief: "It bids for your truck while you're away. You can still book by hand any time.",
      say: [
        `Nobody bids every load by hand past two trucks, and the clock is indifferent to your sleep. The standing orders at the bottom of the Truck tab are your rules: where to bid, how low, which lanes, when the drivers go home. Your dispatcher follows them for every truck you don't handle yourself.`,
        `Set them before you need them, then audit what they did, because a rule that looked clever on Tuesday finds a way to be foolish by Friday. I've managed rules. I've managed people. The rules, at least, have never asked me to invest in a cousin's restaurant.`,
      ],
      do: "Check the dispatcher is on in Standing orders on the Truck tab, then watch a round clear.",
      // Client batch 8e item 73: with the dispatcher still off, the step asks to turn it on, not to check that it is.
      doNow: (_w, c) => (c.orders.some((o) => o.kind === "bid") ? null : PENDING.dispatcherTurnOn),
      why: "Orders turn a company that needs you every six hours into one that runs while you're away.",
      // Any state that satisfies it (R2): the orders took over the fleet, or the player chose to bid by hand and switched
      // the dispatcher off after its first load.
      // Done once the dispatcher bids for the company, or a hired dispatcher runs the trucks. Where a company joins with the
      // dispatcher already on (guard.dispatcherDefaultOn, off in the live rules), the step shows on the day of the first
      // hand booking and is done the day after (a round cleared with it bidding), or at once when the player turned it
      // off to bid by hand (R2: off, then, is the player's choice, not a step left undone).
      done: (w, c) => {
        if (trucksOf(w, c).length >= 3 || staffOf(w, c, "dispatcher") >= 1) return true;
        const on = c.orders.some((o) => o.kind === "bid");
        if (!w.cfg.guard.dispatcherDefaultOn) return on;
        return c.firstHandBidDay !== null && (!on || dayOf(w.t, w.cfg) > c.firstHandBidDay);
      },
      // Its object: a first load booked by hand (the dispatcher waits for it, ordersWaitForHand).
      can: (w, c) => !ordersWaitForHand(w, c),
    },
    {
      id: "haul",
      at: "fleet",
      title: "The truck rolls",
      tab: "fleet",
      mood: "idle",
      brief: `It's yours. Now the slow part, which is most of trucking: ${hours} driving hours a day, fuel every 400 miles, docks with their own hours.`,
      say: [
        `It's yours. Now the slow part, which is most of trucking and, I'm told, most of life. A driver may drive ${hours} hours in a day, then must rest, and the game counts; the truck fuels about every 400 miles, and the gallons are money. At night it sleeps where it stands: a truck stop is safe, a rest area is free, and the shoulder is illegal, about which the patrol writes a very courteous ticket.`,
        `Docks keep their own hours. The big dry-van docks never close; the rest work business hours, and a truck that arrives at midnight waits for the morning like a diplomat at a border. Watch the ETA on the Fleet card, waiting included, and the truck on the map. My grandfather drove the Moscow–Leningrad road for thirty years. I know a long haul when I see one, and I still like watching them go.`,
      ],
      do: "Watch the ETA. Note where it sleeps tonight.",
      why: "Hours, fuel and docks decide how many loads a week a truck can do; the rate only decides what each one pays.",
      done: (w, c) => c.delivered >= 1,
    },
    {
      id: "paid",
      at: "fleet",
      title: "Getting paid",
      tab: "money",
      mood: "point",
      brief: PENDING.walkPaidBrief(pct(cfg.freeEntry.leases.byValue.escrowShareOfPay)),
      say: [
        `Delivered, and paid the same day. That's the lease: the lessor holds the paper and pays you on delivery, less its share. When you haul with a truck of your own, you'll invoice the shipper yourself, and shippers pay net-30: thirty game days after the work. Quick pay brings that forward for ${pct(cfg.token.payment.quickPayPct)}; an instrument for emergencies, not a policy. Companies that live on quick pay receive a goodbye note from me. Handwritten. Fountain pen.`,
        `What arrives is net of the lessor's ${pct(cfg.costs.npcLeaseShareOfGross)}${settlementShare(cfg) > 0 ? ` and the ${pct(settlementShare(cfg))} settlement fee` : ""}. The lease also holds ${pct(cfg.freeEntry.leases.byValue.escrowShareOfPay)} of each load back toward a truck of your own; you'll see it again when you buy, so don't mourn it. Money shows both. Watch the cash line at the top of the screen every day, the way my grandmother watched the samovar. Trust, and verify. Mostly verify.`,
      ],
      do: "On Money, find the lessor's share and the hold. Invoices come with a truck of your own.",
      why: `On a lease, pay lands on delivery and costs land as they come; what shrinks the pay is the lessor's share${settlementShare(cfg) > 0 ? ", the settlement fee" : ""} and the hold toward your own truck.`,
      // A small fleet owns its trucks, so no lessor pays it on delivery (QA).
      owned: {
        brief: `Delivered. With no lessor, you invoice the shipper, who pays in ${cfg.token.payment.termsDays} days. Money shows what's owed and when.`,
        say: [
          `Delivered. With trucks of your own, no lessor holds the paper: you invoice the shipper, who pays net-${cfg.token.payment.termsDays}, ${cfg.token.payment.termsDays} game days after the work. Quick pay pays each new load on delivery instead, less ${pct(cfg.token.payment.quickPayPct)}: an instrument for emergencies, not a policy.`,
          `Until an invoice is paid, fuel, wages and insurance still go out. That gap is what your cushion is for. Money shows each invoice and its day; watch the cash line at the top every day. Trust, and verify. Mostly verify.`,
        ],
        do: "On Money, find each invoice and the day it's due.",
        why: "On your own truck, pay lands when the shipper pays and costs land as they come. The cushion covers the gap.",
      },
      done: (w, c) => c.delivered >= 2,
    },
    {
      id: "reload",
      at: "fleet",
      title: "The reload",
      tab: "fleet",
      mood: "idle",
      brief: "Empty trailer, far end of the country. Nearest load first: driving home empty turns a good load into a bad week.",
      say: [
        `Your truck is at the far end of the country with an empty trailer and a driver asking what's next. The Find loads list on the truck's card is sorted by distance for exactly this moment. A load from the hub you're in is best; a short hop to a strong hub is acceptable; driving home empty is how a good load becomes a bad week.`,
        `Hubs have characters. Strong ones have freight piling up and pay to leave; weak ones have trucks piling up and pay to arrive, thinly. Your home hub likes you a little: its shippers hold some loads for locals first. Everyone's home is like that. We have a saying: a guest is good when he leaves. A truck is good when it leaves loaded.`,
      ],
      do: "Pick the next load from Find loads, nearest first.",
      why: "Loaded miles against total miles is the number that separates a fleet from a hobby.",
      done: (w, c) => c.delivered >= 4,
    },
    {
      id: "costs",
      title: "What it costs to exist",
      tab: "money",
      mood: "laugh",
      brief: "The page nobody enjoys: fuel, insurance, tolls, taxes, idling. Read it weekly, like an executive, with tea. Keep a cushion.",
      say: [
        `Here is the page of the clipboard nobody enjoys. Fuel, maintenance, insurance, tolls, the fuel tax, the sales tax on anything you buy, idling at night, and fines when a driver gets creative. The Money tab lists twenty days of it. Read it weekly, like an executive, with tea.`,
        `The books close every week. ${cfg.insolvency.weeksInDebt} weekly checks in a row more than ${n(cfg.insolvency.debtLimitFd)} FD under, and the company is wound up: trucks sold, staff gone, and you begin again on a lease. Keep a cushion. A cushion is cheaper than a restart, and considerably cheaper than my sympathy, which is rationed.`,
      ],
      do: "Compare revenue against costs on Money.",
      why: "Revenue is a rate times miles; profit is what's left after a truck's fixed costs, and those run whether it moves or not.",
      done: (w, c) => age(w, c) >= 14 && c.delivered >= 5,
    },
    {
      id: "miles",
      title: "Miles",
      tab: "money",
      mood: "wave",
      brief: "Every loaded mile earns Miles: your standing in the beta, on Money. The Report button reaches me, and I read every one.",
      say: [
        `Every loaded mile earns Miles. That's your standing in the beta, on Money, under Standing. What Miles become is announced when the token is; until then they're the score, and the score is how you get on my clipboard in ink rather than pencil.`,
        `Two more things. The locked tabs are the layers still coming; the Guide's road ahead has the plan. And the Report button sends me a bug or an idea with everything I need already attached. I read every one. Some of them twice, with the eyebrow.`,
      ],
      do: "Open Standing on Money, then the road ahead.",
      why: "The beta is tuned on what players do; your reports are how the market gets right.",
      // Client batch 8a item 58: second in the director's order, so done on a first stretch of loaded miles (it was the last
      // step, at 25,000, and would have held every later step for weeks). The figure is engineering's; the director's to set.
      done: (w, c) => miles(c) >= MILES_STEP_DONE,
    },

    {
      id: "law",
      title: "The law",
      tab: "company",
      mood: "idle",
      brief: "Weigh stations pull trucks in; inspections stay on your record two years. Tired drivers break rules; home time is cheaper than fines.",
      say: [
        `Weigh stations pull trucks in. A clean carrier mostly gets the bypass; one with alerts gets the full tour. Inspections find defects and hours violations, and both stay on your record for two years. Enough of them and an auditor comes: satisfactory, conditional, unsatisfactory, and unsatisfactory twice means the authority is revoked.`,
        `A conditional rating costs you: higher insurance, more inspections, and strict brokers who won't load you until a clean follow-up. Company, under More, shows your rating and what's behind it. Tired drivers break rules; home time is cheaper than fines. I have a chart. I have several. Tolstoy had his estate; I have charts.`,
      ],
      do: "Find your safety rating on Company.",
      why: "Brokers vet carriers on authority age, rating and record; the record is the slowest thing to repair.",
      done: (w, c) => age(w, c) >= 35,
    },
    {
      id: "own",
      title: "Your first truck",
      tab: "market",
      mood: "wave",
      // QA's 0.24.1 replay, fail 2: as the rules run now (the lot's rig ready in its days and worn; the card's sound truck;
      // the lender reading the truck under equipmentFinance.purchase.collateral). Placeholders for the writer's pass.
      brief: PENDING.walkOwnBrief(pct(cfg.costs.npcLeaseShareOfGross)),
      say: [PENDING.walkOwnLot(pct(cfg.costs.npcLeaseShareOfGross), n(rig), cfg.usedMarket.npcLot.deliveryDays, pct(lotCondition)), ownLoanLine],
      do: PENDING.walkOwnDo,
      // From the Dealer's own figures, only routes the company can take now (QA's step-9 replay): the lot keeps the step's
      // line; a listing it can buy, a new rig on a loan it can carry, or the gap and the lot's restock.
      doNow: (w, c) => {
        // Client batch 8a items 57 and 58 (the director's A and D): the first-truck step says the card's one verdict.
        const f = firstTruckLine(w, c);
        if (f && !f.ordered) return f.figure === PENDING.soundTitle ? f.verdict : `${f.figure}. ${f.verdict}`;
        const r = firstTruckRoute(w, c);
        const fd = (x: number) => Math.round(x).toLocaleString("en-US");
        if (r.route === "lot") return null;
        if (r.route === "listing" && r.listing) {
          const t = w.trucks[r.listing.truckId - 1];
          return STEP9.listing(t ? `${TIER_LABEL[t.tier]} + ${TRAILER_LABEL[t.trailer]}` : "used truck", fd(r.listing.askFd));
        }
        if (r.route === "none") return STEP9.none(shortDate(r.restockDay));
        return r.route === "loan" ? STEP9.loanNow(fd(r.need)) : STEP9.gap(fd(r.need), fd(r.have), "", shortDate(r.restockDay));
      },
      why: "Ownership turns the lessor's cut into your margin and is the only way a one-truck company grows into two.",
      // Client batch 7 (QA): a truck ordered to replace the lease counts too; the order's wait is What now?'s line then.
      done: (w, c) => trucksOf(w, c).some((t) => t.lease === "owned") || w.orders.some((o) => o.companyId === c.id && o.replaceNpcLease && o.kind !== "trailer"),
    },
    {
      id: "maintenance",
      title: "Keeping it on the road",
      // The director's D: on owning only; never the condition bar on a truck the lessor maintains.
      can: (w, c) => trucksOf(w, c).some((t) => t.lease === "owned" && t.lessorId === 0),
      tab: "fleet",
      mood: "point",
      brief: "Condition falls with the miles, and a worn truck breaks down more. Repairs at home are cheaper than away.",
      say: [
        `Condition falls with the miles, and a worn truck breaks down more. Defects accumulate if nobody attends to them, and an inspector will notice before you do. A rebuild resets the clock and costs real money, more the higher the odometer, because a shop can read an odometer too.`,
        `A breakdown on the road calls out road service, the dearest mechanic in the game, unless a truck stop with a shop is near. Repairs at home are cheaper than repairs away. A truck gets two rebuilds in a life, or about a million miles, then runs until it's worn out and goes for scrap. My grandfather's Volga got none and ran thirty years, on pride and good manners.`,
      ],
      do: "Check the condition bar; plan the rebuild before it's urgent.",
      why: "A breakdown costs the tow, the repair, the missed delivery and the driver's hours. A planned rebuild costs the rebuild.",
      done: (w, c) => trucksOf(w, c).some((t) => t.lease === "owned") && age(w, c) >= 28 && c.delivered >= 8,
    },
    {
      id: "yard",
      title: "The yard",
      // The director's D: on owning only.
      can: (w, c) => trucksOf(w, c).some((t) => t.lease === "owned"),
      tab: "business",
      mood: "point",
      brief: `Past ${cfg.token.catalogue.trucksWithoutYard} trucks you need a yard: park, drop trailers, swap them. That's how one truck does two jobs.`,
      say: [
        `Past ${cfg.token.catalogue.trucksWithoutYard} trucks you need a yard: a place to park, drop trailers and swap them. It costs FD through the catalogue, plus a bond you get back and a little every week. With a yard come trailers of your own, so a tractor can drop one at a dock and pull another instead of waiting. That's how real fleets make one truck do two jobs, and how a good kitchen makes one chicken do a week.`,
        `Later a yard takes security: a gate, cameras, lights, a guard. Why would a yard need a guard? That's a later chapter. I don't give away the plot. Chekhov wouldn't, and he had a gun on the wall the entire first act.`,
      ],
      do: "Buy a small yard; add trailer space as the fleet grows.",
      why: "Trailers are the cheap half of a rig and the half that waits at docks; owning spares turns waiting into hauling.",
      done: (w, c) => c.yard !== "none",
    },
    {
      id: "driver",
      title: "Hiring a driver",
      // The director's D: only when a second truck is ordered or a truck has no driver; never "a second truck needs a
      // second driver" with one truck.
      can: (w, c) => w.orders.some((o) => o.companyId === c.id && !o.replaceNpcLease && o.kind !== "trailer") || trucksOf(w, c).some((t) => !crewed(t)),
      tab: "staff",
      mood: "point",
      brief: "A second truck needs a second driver. Pay decides who takes the job; home time decides who stays.",
      say: [
        `A second truck needs a second driver, so: Staff, under More, and the labor pool. Skill shows up as fuel, maintenance and fewer letters from the patrol. Pay decides who takes the job: offer below market and the good ones decline, politely, and work for your competitor. Morale decides who stays: home time every few weeks, or you'll be hiring again, and I'll be raising an eyebrow again. I do it in two languages.`,
        `You can run ${cfg.labor.owner.span} trucks yourself. From the next one you need a dispatcher, who bids and plans for the trucks you don't touch. Then every few trucks, another. It's a ladder; each rung costs money; it is also the only way up. I'll be at the top, with the clipboard and the good tea.`,
      ],
      do: "Hire a driver at a pay the market will take.",
      why: "Drivers are the largest cost in the game and the largest difference between two companies with the same trucks.",
      done: (w, c) => trucksOf(w, c).length >= 2 && staffOf(w, c, "driver") >= 1,
    },  ];
}

/** The first step not yet done, and how many are done. */
/**
 * The current step: the first not done, as the world says. "Skip this step" (R2) silences it: it stays in the list as
 * skipped, not done, What now? never offers it, and she says nothing of it; the next step still waits for the world, so
 * no line runs ahead of its event. `skipped` is the player's, kept by the page; the bots skip nothing.
 */
/**
 * Client batch 8a item 58 (the director's D): a step is current only when it can be done: its object exists (`can`) and,
 * where the page says (`pageOpen`, the client's tabOpen), its page is open. A step that can't be done waits: the next one
 * that can is current. `index` is -1 when every step left is done or waiting.
 */
export function walkProgress(cfg: EconomyConfig, w: World, c: Company, skipped: readonly string[] = [], pageOpen?: (tab: Tab) => boolean): { step: WalkStep | null; index: number; done: number; total: number; skipped: boolean } {
  const steps = walkSteps(cfg);
  const done = steps.filter((s) => s.done(w, c)).length;
  const index = steps.findIndex((s) => !s.done(w, c) && (s.can?.(w, c) ?? true) && (pageOpen?.(s.tab) ?? true));
  const step = index >= 0 ? steps[index]! : null;
  return { step, index, done, total: steps.length, skipped: step !== null && skipped.includes(step.id) };
}

/** A step's "Do" line for the world as it is. */
/** A step's words for this company: its owned-fleet words when it has no lessor's truck. */
export function stepText(step: WalkStep, w: World, c: Company): { brief: string; say: string[]; do: string; why: string } {
  const own = step.owned && !(w.trucksByCompany.get(c.id) ?? []).some((t) => t.lease === "npc");
  return own ? step.owned! : step;
}

/**
 * The company a browser's walkthrough marks belong to (said, hidden, skipped, the arrival): its world, id and start
 * day, as the milestones keep theirs. Kept per browser alone, one world's marks silenced the next world's lines (QA's
 * cheap-batch replay: "The truck rolls" never played in a second world).
 */
export const stepScope = (w: World, c: Company): string => worldScope(w, c);
/** A walkthrough mark's key for this company: `{scope}|say:{id}`, `{scope}|arrival`. */
export const stepKey = (w: World, c: Company, k: string): string => `${stepScope(w, c)}|${k}`;

/** The step ids this company has skipped in this browser (onboard `{scope}|skip:{id}`). */
export const skippedSteps = (seen: readonly string[], w: World, c: Company): string[] => {
  const p = stepKey(w, c, "skip:");
  return seen.filter((k) => k.startsWith(p)).map((k) => k.slice(p.length));
};

export const stepDo = (step: WalkStep, w: World, c: Company): string => step.doNow?.(w, c) ?? stepText(step, w, c).do;
