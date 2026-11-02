/**
 * The walkthrough (Jeff, 2026-11-01): Iuliia, the dispatcher-trainer, walks a new player from one leased truck to a
 * fleet. A checklist that reads the world: each step is done when the company's own state says so, nothing is saved,
 * so it is right on every screen and after every reload. The card shows the first step not yet done, what Iuliia
 * says about it, where to click, and why; the player can read ahead.
 */
import type { EconomyConfig } from "@lanes/config";
import { dayOf, ordersWaitForHand, type Company, type World } from "@lanes/engine";
import type { Tab } from "./tabs.js";
import { STEP9 } from "./copy.js";
import { firstTruckRoute } from "./finance.js";
import { shortDate, TIER_NAME as TIER_LABEL, TRAILER_NAME as TRAILER_LABEL } from "./format.js";

/** Iuliia's mood for the step: her face at rest in the live portrait (portrait.ts). */
export type Mood = "idle" | "wave" | "point" | "laugh";

export interface WalkStep {
  id: string;
  title: string;
  tab: Tab;
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
  done: (w: World, c: Company) => boolean;
}

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
  return [
    {
      id: "welcome",
      title: "Choose your home",
      tab: "fleet",
      mood: "wave",
      brief: "The rings mark where a new carrier finds freight right now. You may start at any starter city; any city shows its freight.",
      say: [
        `Good morning. Iuliia, with two i's; my mother was thorough. I ran operations for a fleet of four hundred trucks in Moscow before I was thirty, and now I run you, which the clipboard says is one leased Workhorse with a dry van. The lessor keeps ${pct(cfg.costs.npcLeaseShareOfGross)} of every load and does the maintenance; the rest is yours, and so is the driving, since the driver is you. A company of one. Lean. I approve.`,
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
      brief: "Each line is a lane, the miles and a rate. Pick one near your truck, bid above break-even, and let the round clear.",
      say: [
        `The Loads tab is the whole game in one list, so sit up straight. Each line is a lane, the miles, and a rate per mile. The shipper has a ceiling it won't pay above; your truck has a break-even it can't run below; the board shows you both, because I prefer my students to lose for interesting reasons. Loads near your truck first: an empty mile pays nothing and burns fuel. One doesn't drive to Vladivostok to say hello.`,
        `Bids clear twice a day, at ${round(r1)} and ${round(r2)} game time. The lowest rate that still covers the shipper wins, so bidding high is a way to watch other people haul. Bid once and let it clear. If you bid nothing, your dispatcher bids for you, and for now your dispatcher is you, standing beside me, holding nothing. Go on.`,
      ],
      do: `Bid on a load leaving ${hub}.`,
      why: "Rates move with the market: a strong hub pays to leave, a weak one pays to arrive, and the board's recent rates tell you which is which.",
      // Ticks on the player's own first bid or booking (draft 4), which the engine records. A fleet whose dispatcher
      // books from the start (no first bid by hand to wait for) ticks it on its first load instead (QA's guidance
      // replay: a small fleet never had a truck idle to bid by hand, and the step stood for a month).
      done: (w, c) => c.firstHandBidDay !== null || (!ordersWaitForHand(w, c) && (c.delivered > 0 || (w.trucksByCompany.get(c.id) ?? []).some((t) => t.loadId !== null))),
    },
    {
      id: "haul",
      title: "The truck rolls",
      tab: "fleet",
      mood: "idle",
      brief: `You won one. Now the slow part, which is most of trucking: ${hours} driving hours a day, fuel every 400 miles, docks with their own hours.`,
      say: [
        `You won one. Now the slow part, which is most of trucking and, I'm told, most of life. A driver may drive ${hours} hours in a day, then must rest, and the game counts; the truck fuels about every 400 miles, and the gallons are money. At night it sleeps where it stands: a truck stop is safe, a rest area is free, and the shoulder is illegal, about which the patrol writes a very courteous ticket.`,
        `Docks keep their own hours. The big dry-van docks never close; the rest work business hours, and a truck that arrives at midnight waits for the morning like a diplomat at a border. Watch the ETA on the Fleet card, waiting included, and the truck on the map. My grandfather drove the Moscow–Leningrad road for thirty years. I know a long haul when I see one, and I still like watching them go.`,
      ],
      do: "Watch the ETA. Note where it sleeps tonight.",
      why: "Hours, fuel and docks decide how many loads a week a truck can do; the rate only decides what each one pays.",
      done: (w, c) => c.delivered >= 1,
    },
    {
      id: "paid",
      title: "Getting paid",
      tab: "money",
      mood: "point",
      brief: "Delivered, and paid today: the lessor sees to that. Money shows its share and the hold toward your own truck.",
      say: [
        `Delivered, and paid the same day. That's the lease: the lessor holds the paper and pays you on delivery, less its share. When you haul with a truck of your own, you'll invoice the shipper yourself, and shippers pay net-30: thirty game days after the work. Quick pay brings that forward for ${pct(cfg.token.payment.quickPayPct)}; an instrument for emergencies, not a policy. Companies that live on quick pay receive a goodbye note from me. Handwritten. Fountain pen.`,
        `What arrives is net of the lessor's ${pct(cfg.costs.npcLeaseShareOfGross)}. The lease also holds a little back from each load toward a truck of your own; you'll see it again when you buy, so don't mourn it. Money shows both. Watch the cash line at the top of the screen every day, the way my grandmother watched the samovar. Trust, and verify. Mostly verify.`,
      ],
      do: "On Money, find the lessor's share and the hold. Invoices come with a truck of your own.",
      why: "On a lease, pay lands on delivery and costs land as they come; what shrinks the pay is the lessor's share and the hold toward your own truck.",
      done: (w, c) => c.delivered >= 2,
    },
    {
      id: "reload",
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
      id: "maintenance",
      title: "Keeping it on the road",
      tab: "fleet",
      mood: "point",
      brief: "Condition falls with the miles, and a worn truck breaks down, usually in the rain. Repairs at home are cheaper than away.",
      say: [
        `Condition falls with the miles, and a worn truck breaks down more, usually in the rain. Defects accumulate if nobody attends to them, and an inspector will notice before you do. A rebuild resets the clock and costs real money, more the higher the odometer, because a shop can read an odometer too.`,
        `A breakdown on the road calls out road service, the dearest mechanic in the game, unless a truck stop with a shop is near. Repairs at home are cheaper than repairs away. A truck gets two rebuilds in a life, or about a million miles, then runs until it's worn out and goes for scrap. My grandfather's Volga got none and ran thirty years, on pride and good manners.`,
      ],
      do: "Check the condition bar; plan the rebuild before it's urgent.",
      why: "A breakdown costs the tow, the repair, the missed delivery and the driver's hours. A planned rebuild costs the rebuild.",
      done: (w, c) => age(w, c) >= 28 && c.delivered >= 8,
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
      brief: `The lessor's ${pct(cfg.costs.npcLeaseShareOfGross)} ends the day you buy. Buy the used one first; ambition is for the second truck.`,
      say: [
        `The lessor's ${pct(cfg.costs.npcLeaseShareOfGross)} is the most expensive thing you pay and the only one that ends when you buy. A new Workhorse with a van is about ${n(rig)} FD. The used lot on Dealer, under More, sells a worn one at about a quarter of that: four years old, a great many miles, delivered like new, and good enough to earn. Not elegant. My first office had a view of a parking structure. One begins.`,
        `Your lease deposit counts toward it, and the Dealer's purchase loan covers the rest with ${pct(down0)} to ${pct(down1)} down. Owned trucks pay their own maintenance and insurance, cost you when they sit, and lose value every year. They also keep every dollar they earn. Buy the used one first. Ambition is for the second truck; the first one is arithmetic.`,
      ],
      do: "Buy a rig from the used lot, with a purchase loan if the cash is short.",
      // From the Dealer's own figures, only routes the company can take now (QA's step-9 replay): the lot keeps the step's
      // line; a listing it can buy, a new rig on a loan it can carry, or the gap and the lot's restock.
      doNow: (w, c) => {
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
      done: (w, c) => trucksOf(w, c).some((t) => t.lease === "owned"),
    },
    {
      id: "driver",
      title: "Hiring a driver",
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
    },
    {
      id: "orders",
      title: "Standing orders",
      tab: "fleet",
      mood: "laugh",
      brief: "Nobody bids every load by hand past two trucks. Your dispatcher's rules run the trucks you don't touch.",
      say: [
        `Nobody bids every load by hand past two trucks, and the clock is indifferent to your sleep. The standing orders at the bottom of the Truck tab are your rules: where to bid, how low, which lanes, when the drivers go home. Your dispatcher follows them for every truck you don't handle yourself.`,
        `Set them before you need them, then audit what they did, because a rule that looked clever on Tuesday finds a way to be foolish by Friday. I've managed rules. I've managed people. The rules, at least, have never asked me to invest in a cousin's restaurant.`,
      ],
      do: "Set the bidding and home-time rules, then watch a round clear.",
      why: "Orders turn a company that needs you every six hours into one that runs while you're away.",
      done: (w, c) => trucksOf(w, c).length >= 3 || staffOf(w, c, "dispatcher") >= 1,
    },
    {
      id: "yard",
      title: "The yard",
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

/** A step's "Do" line for the world as it is. */
export const stepDo = (step: WalkStep, w: World, c: Company): string => step.doNow?.(w, c) ?? step.do;
