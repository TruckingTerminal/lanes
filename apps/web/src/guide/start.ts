import type { EconomyConfig } from "@lanes/config";
import { type GuidePage, n, p, pct, see, table, ul } from "./util.js";

const S = "Getting started";

export function startPages(cfg: EconomyConfig): GuidePage[] {
  const [r1, r2] = cfg.time.boardRoundHours;
  const realDay = cfg.time.realHoursPerGameDayLive;
  return [
    {
      id: "start",
      section: S,
      title: "Your first week",
      html:
        p(`LANES is one shared freight market. You run a carrier: you bid on loads, haul them, and grow from one leased truck into a fleet. Every other company is a player or an AI competing for the same freight.`) +
        p(`You start as an owner-operator: one NPC-leased Workhorse with a dry van, ${n(cfg.company.startingGrantFd)} FD, and you behind the wheel. The lessor takes ${pct(cfg.costs.npcLeaseShareOfGross)} of every load's pay and maintains the truck.`) +
        ul([
          `<b>Day 1:</b> open the Load board, pick a load near your truck, and bid. Bids clear at ${String(r1).padStart(2, "0")}:00 and ${r2}:00 game time.`,
          `<b>Every day:</b> your dispatcher (you, at first) bids for idle trucks you don't bid on by hand. Set its rules at the bottom of the Fleet tab.`,
          `<b>First goal:</b> save ${n(cfg.dealerFd.tractor.workhorse + cfg.dealerFd.trailer.van)} FD for your own Workhorse and dry van. Owning ends the lessor's cut. See ${see("buying", "Buying trucks")}.`,
          `<b>Then:</b> more trucks, drivers to run them (${see("drivers", "Drivers")}), a dispatcher once you pass ${cfg.labor.owner.span} trucks (${see("dispatchers", "Dispatchers")}).`,
        ]) +
        p(`New authority is on probation: some brokers won't load you until your authority is ${cfg.fraud.vetting.standard.minAuthorityDays} days old, the strictest not before ${cfg.fraud.vetting.strict.minAuthorityDays} days and a record. See ${see("vetting", "Vetting")}.`),
    },
    {
      id: "worlds",
      section: S,
      title: "The live world and test worlds",
      html:
        p(`<b>The live world</b> is shared by every player and runs on the real clock: a game day every ${realDay} real hours, a game year about every ${Math.round((cfg.time.daysPerSeason * realDay) / 24)} real days. It never pauses, nothing resets, and every order stands. Your orders reach everyone and take effect about half a real minute later, at the same moment on every screen.`) +
        p(`<b>A test world</b> is a private copy of the rules with only you and the AI in it. You can pause it and run it up to a game day every two seconds. On the public test site your test world is kept in your browser; starting a new one replaces it, and a test world from older rules can't be replayed.`) +
        p(`<b>Starts:</b> the live world only offers the owner-operator start. A test world also offers a small fleet: two used trucks and ${n(cfg.company.startingGrantFd + 20_000)} FD.`),
    },
    {
      id: "screen",
      section: S,
      title: "The screen and controls",
      html:
        ul([
          `<b>The map</b> shows every hub, the lanes between them, and the trucks on them: yours, other players', and the AI's. Tap a hub to see its open loads; tap your truck to select it.`,
          `<b>The ticker</b> under the clock lists what just happened to your company: loads won and delivered, breakdowns, inspections, staff news.`,
          `<b>The tabs:</b> Fleet (your trucks and the dispatcher), Load board, Staff, Dealer (new, used and leased trucks, facilities), Money (cash, loans, the exchange), Company (your record, the market report, the leaderboard), and this Guide.`,
        ]) +
        table(
          ["Control", "What it does"],
          [
            ["Drag / pinch / wheel", "Pan and zoom the map"],
            ["+ / − / 0", "Zoom in, out, fit the map"],
            ["F", "Full screen"],
            ["Space, 1–3", "Pause and set the speed (test worlds only)"],
          ],
        ),
    },
  ];
}
