/**
 * The walkthrough (Jeff, 2026-11-01): Iuliia, the dispatcher-trainer, walks a new player from one leased truck to a
 * fleet. A checklist that reads the world: each step is done when the company's own state says so, nothing is saved,
 * so it is right on every screen and after every reload. The card shows the first step not yet done, what Iuliia
 * says about it, where to click, and why; the player can read ahead.
 */
import type { EconomyConfig } from "@lanes/config";
import { dayOf, type Company, type World } from "@lanes/engine";
import type { Tab } from "./state.js";

/** Which of Iuliia's loops the step shows (assets/people/iuliia-*.loop.png; the still when a loop is missing). */
export type Mood = "idle" | "wave" | "point" | "laugh";

export interface WalkStep {
  id: string;
  title: string;
  tab: Tab;
  mood: Mood;
  /** What Iuliia says, a paragraph each. */
  say: string[];
  /** Where to click, in one line. */
  do: string;
  /** Why it matters, in one line. */
  why: string;
  done: (w: World, c: Company) => boolean;
}

const n = (x: number) => Math.round(x).toLocaleString("en-US");
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function walkSteps(cfg: EconomyConfig): WalkStep[] {
  const [r1, r2] = cfg.time.boardRoundHours;
  const round = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const trucksOf = (w: World, c: Company) => (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired");
  const staffOf = (w: World, c: Company, kind: string) => w.staff.filter((s) => s.companyId === c.id && s.kind === kind && !s.owner && s.status !== "gone").length;
  const age = (w: World, c: Company) => dayOf(w.t, w.cfg) - c.createdDay;
  const miles = (c: Company) => c.milesHistory.reduce((a, b) => a + b, 0) + c.milesTotal;
  const [down0, down1] = cfg.equipmentFinance.purchase.downShare;
  const hours = cfg.hos.drivingHoursPerDay;
  const rig = cfg.dealerFd.tractor.workhorse + cfg.dealerFd.trailer.van;
  return [
    {
      id: "welcome",
      title: "Welcome aboard",
      tab: "fleet",
      mood: "wave",
      say: [
        `Hi. I'm Iuliia, and this clipboard says you're the new owner-operator. Congratulations: you own a company, a coffee habit, and one leased Workhorse with a dry van. The truck belongs to the lessor, who takes ${pct(cfg.costs.npcLeaseShareOfGross)} of every load and keeps it maintained; the rest is yours, and so is the driving, because the driver is you.`,
        `The clock is real: one game day every ${cfg.time.realHoursPerGameDayLive} hours of your life. The market keeps moving while you sleep, which is also true of real trucking, so you'll feel right at home. The Fleet tab is your truck. The map is everyone's trucks. Mine is the one that's never late.`,
      ],
      do: "Look at your truck on the Fleet tab, then find your home hub on the map.",
      why: "Everything starts and ends at your hub: the loads you can see first, the shippers who prefer locals, and where the truck sleeps for free.",
      done: (w, c) => c.bidStats.truckRounds > 0 || c.bidStats.wins > 0 || c.delivered > 0,
    },
    {
      id: "board",
      title: "Reading the board",
      tab: "loads",
      mood: "point",
      say: [
        `The Loads tab is the whole game in one list. Each line is a lane, so many miles, and a rate per mile. The shipper has a ceiling it won't pay above; your truck has a break-even it can't run below, and the board shows you both, because I'm nice. Loads near your truck first: an empty mile costs fuel and hours and pays nothing.`,
        `Bids clear twice a day, at ${round(r1)} and ${round(r2)} game time. The lowest rate that still covers the shipper wins, so bidding high is a way to watch other people haul. Bid once, then let it clear; if you bid nothing, your dispatcher bids for you. For now your dispatcher is you, with a clipboard, standing next to me.`,
      ],
      do: "Pick a load leaving your hub, bid a rate above your break-even, and wait for the next round.",
      why: "Rates move with the market: a strong hub pays to leave, a weak one pays to arrive, and the board's recent rates tell you which is which.",
      done: (w, c) => c.bidStats.wins >= 1 || c.delivered >= 1,
    },
    {
      id: "haul",
      title: "The truck rolls",
      tab: "fleet",
      mood: "idle",
      say: [
        `You won one. Now the slow part, which is most of trucking. A driver may drive ${hours} hours in a day, then must rest, and the game counts them; the truck fuels about every 400 miles and the gallons are real money. At night it sleeps where it stands: a truck stop is safe, a rest area is free, and the shoulder is illegal, which the patrol will mention in writing.`,
        `Docks keep their own hours. The big dry-van docks never close; the rest work business hours, and a truck that arrives at midnight waits for the morning. The Fleet tab shows the ETA with the waiting in it. The map shows the truck moving, which never stops being satisfying, and I've watched a lot of trucks.`,
      ],
      do: "Watch the truck on the map and the ETA on its Fleet card. Note where it sleeps tonight.",
      why: "Hours, fuel and docks decide how many loads a week a truck can do; the rate only decides what each one pays.",
      done: (w, c) => c.delivered >= 1,
    },
    {
      id: "paid",
      title: "Getting paid",
      tab: "money",
      mood: "point",
      say: [
        `Delivered. The money, though, is not in your account yet, because shippers pay net-30: thirty game days after delivery. The Money tab shows what you're owed and the day it lands. If you need it now, quick pay brings it forward for ${pct(cfg.token.payment.quickPayPct)}. That's an emergency tool. Companies that live on quick pay are companies I've written goodbye cards for.`,
        `What landed is net of the lessor's ${pct(cfg.costs.npcLeaseShareOfGross)}. The lease also holds a deposit, which you'll see again when you buy your first truck, so don't mourn it. Your cash line at the top of the screen is the one number to watch every day.`,
      ],
      do: "Open the Money tab: find the receivable from your first load and its due day.",
      why: "Cash arrives a month after the work; costs arrive now. The gap is what kills new carriers, not the rates.",
      done: (w, c) => c.delivered >= 2,
    },
    {
      id: "reload",
      title: "The reload",
      tab: "fleet",
      mood: "idle",
      say: [
        `Your truck is standing at the other end of the country with an empty trailer and a driver who wants to know what's next. The Find loads list on the truck's card is sorted by distance for exactly this moment. A load leaving the hub you're in is the best; a short deadhead to a strong hub is fine; driving home empty is how you turn a good load into a bad week.`,
        `Hubs have characters. Some are strong outbound, with freight piling up and good rates to leave; some are weak, where trucks pile up instead and the rate to leave is thin. Your home hub likes you a little: its shippers hold some loads for local carriers first. Everyone else's home hub likes them. Nobody likes the shoulder.`,
      ],
      do: "From the truck's card, pick the next load from the Find loads list, nearest first.",
      why: "Loaded miles against total miles is the number that separates a fleet from a hobby.",
      done: (w, c) => c.delivered >= 4,
    },
    {
      id: "costs",
      title: "What it costs to exist",
      tab: "money",
      mood: "laugh",
      say: [
        `Here's the part of the clipboard nobody likes. Fuel, maintenance, insurance, tolls, the fuel tax, the sales tax on anything you buy, idling at night, and fines when the driver does something the patrol disagrees with. The Money tab lists the last twenty days of it. Read it once a week like a grown-up.`,
        `The books close weekly. Finish ${cfg.insolvency.weeksInDebt} weekly checks in a row more than ${n(cfg.insolvency.debtLimitFd)} FD under, and the company is liquidated: trucks sold, staff gone, and you start again on a lease. Keep a cushion. A cushion is cheaper than a restart, and much cheaper than my sympathy.`,
      ],
      do: "On the Money tab, compare freight revenue against operating costs for the last twenty days.",
      why: "Revenue is a rate times miles; profit is what's left after a truck's fixed costs, and those run whether it moves or not.",
      done: (w, c) => age(w, c) >= 14 && c.delivered >= 5,
    },
    {
      id: "maintenance",
      title: "Keeping it on the road",
      tab: "fleet",
      mood: "point",
      say: [
        `Condition falls with the miles and the truck breaks down more as it does. Defects pile up if nobody fixes them, which an inspector will notice before you do. A rebuild resets the clock and costs real money; the price rises with the odometer, because a shop can read an odometer too.`,
        `Breakdowns on the road call out road service, the dearest mechanic in the game, unless a truck stop with a shop is near. Repairs at home are cheaper than repairs away. Trucks get two rebuilds in a life, or about a million miles, then they run until they're worn out and go for scrap. So does the coffee machine in the office, I'm told.`,
      ],
      do: "Check the condition bar on your truck's Fleet card; plan the rebuild before it's urgent.",
      why: "A breakdown costs the tow, the repair, the missed delivery and the driver's hours. A planned rebuild costs the rebuild.",
      done: (w, c) => age(w, c) >= 28 && c.delivered >= 8,
    },
    {
      id: "law",
      title: "The law",
      tab: "company",
      mood: "idle",
      say: [
        `Weigh stations pull trucks in. A clean carrier mostly gets the bypass; a carrier with alerts gets the full tour. Inspections find defects and hours violations, and both go on your record for two years. Enough of them and an auditor comes for a compliance review: satisfactory, conditional, unsatisfactory, and unsatisfactory twice means the authority is revoked.`,
        `A conditional rating costs you: higher insurance, more inspections, and strict brokers who won't load you until a clean follow-up. The Company tab shows your rating and the alerts behind it. Drivers who are tired break rules; home time and honest hours are cheaper than fines. Yes, I have a chart.`,
      ],
      do: "Open the Company tab: find your safety rating and the measures behind it.",
      why: "Brokers vet carriers on authority age, rating and record; the record is the slowest thing to repair.",
      done: (w, c) => age(w, c) >= 35,
    },
    {
      id: "own",
      title: "Your first truck",
      tab: "market",
      mood: "wave",
      say: [
        `The lessor's ${pct(cfg.costs.npcLeaseShareOfGross)} is the most expensive thing you pay, and the only one that ends when you buy. A new Workhorse with a van runs about ${n(rig)} FD. The used lot on the Dealer tab sells a worn one at about a quarter of that: four years and a lot of miles on it, delivered like a new truck, and good enough to earn.`,
        `Your lease deposit counts toward it, and the Money tab's purchase loan covers the rest with ${pct(down0)} to ${pct(down1)} down. Owned trucks pay their own maintenance and insurance, cost you when they sit idle, and lose value every year. They also keep every dollar they earn. Buy the used one first. Ambition is for the second truck.`,
      ],
      do: "On the Dealer tab, buy a rig from the used lot, with a purchase loan from the Money tab if the cash is short.",
      why: "Ownership turns the lessor's cut into your margin and is the only way a one-truck company grows into two.",
      done: (w, c) => trucksOf(w, c).some((t) => t.lease === "owned"),
    },
    {
      id: "driver",
      title: "Hiring a driver",
      tab: "staff",
      mood: "point",
      say: [
        `A second truck needs a second driver, and that means the Staff tab and the labor pool. Skill shows up as fuel and maintenance, and as fewer things that make the patrol write. Pay sets who takes the job: offer below the market and the good ones stay home. Morale sets who stays: home time every few weeks, or you'll be hiring again.`,
        `You can run ${cfg.labor.owner.span} trucks yourself. From the next one you need a dispatcher, who bids and plans for the trucks you don't touch. Then every few trucks, another. It's a ladder, and each rung costs money; it's also the only way up. I'll be at the top with the clipboard.`,
      ],
      do: "On the Staff tab, hire a driver for the second truck. Set a pay the market will take.",
      why: "Drivers are the largest cost in the game and the largest difference between two companies with the same trucks.",
      done: (w, c) => trucksOf(w, c).length >= 2 && staffOf(w, c, "driver") >= 1,
    },
    {
      id: "orders",
      title: "Standing orders",
      tab: "fleet",
      mood: "laugh",
      say: [
        `Nobody bids every load by hand past two trucks, and the clock doesn't wait for you to wake up. The standing orders at the bottom of the Fleet tab are your rules: where to bid, how low, which lanes, when to go home. Your dispatcher follows them for every truck you don't handle yourself.`,
        `Set them before you need them. Then check what they did, because a rule that looked clever on Tuesday will find a way to be stupid by Friday. I've worked with rules. I've worked with people. The rules at least don't argue.`,
      ],
      do: "At the bottom of the Fleet tab, set the bidding rule and the home-time rule, then watch a round clear.",
      why: "Orders turn a company that needs you every six hours into one that runs while you're away.",
      done: (w, c) => trucksOf(w, c).length >= 3 || staffOf(w, c, "dispatcher") >= 1,
    },
    {
      id: "yard",
      title: "The yard",
      tab: "business",
      mood: "point",
      say: [
        `Past ${cfg.token.catalogue.trucksWithoutYard} trucks you need a yard: a place to park, drop trailers and swap them. It costs FD through the catalogue plus a bond you get back, and a little every week. With a yard come trailers of your own, which means a tractor can drop one at a dock and pull another instead of waiting, which is how real fleets make a truck do two jobs.`,
        `Later a yard takes security: a gate, cameras, lighting, a guard. Why would it need those? That's a later chapter. I'm not allowed to give away the plot.`,
      ],
      do: "On the Business tab, buy a small yard when you pass five trucks; add trailer space as the fleet grows.",
      why: "Trailers are the cheap half of a rig and the half that waits at docks; owning spares turns waiting into hauling.",
      done: (w, c) => c.yard !== "none",
    },
    {
      id: "miles",
      title: "Miles",
      tab: "logbook",
      mood: "wave",
      say: [
        `Every loaded mile earns Miles. That's your standing in the beta, on the Logbook tab and up at the top next to your cash. What Miles become is announced when the token is; until then they're the score, and the score is what gets you on my clipboard.`,
        `Two more things. The locked tabs are the layers still coming: read the Guide's road ahead for the whole plan. And the Report button up top sends me a bug or an idea with everything I need already attached. I read all of them. Mostly while pretending to be busy.`,
      ],
      do: "Open the Logbook tab for your Miles, then the Guide's road ahead for what's coming.",
      why: "The beta is tuned on what players do; your reports are how the market gets right.",
      done: (w, c) => miles(c) >= 25_000,
    },
  ];
}

/** The first step not yet done, and how many are done. */
export function walkProgress(cfg: EconomyConfig, w: World, c: Company): { step: WalkStep | null; index: number; done: number; total: number } {
  const steps = walkSteps(cfg);
  const done = steps.filter((s) => s.done(w, c)).length;
  const index = steps.findIndex((s) => !s.done(w, c));
  return { step: index >= 0 ? steps[index]! : null, index, done, total: steps.length };
}
