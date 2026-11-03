import type { EconomyConfig } from "@lanes/config";
import { type GuidePage, n, p, pct, see, table, ul } from "./util.js";

const S = "Safety and the law";

export function safetyPages(cfg: EconomyConfig): GuidePage[] {
  const sf = cfg.safety;
  const th = sf.score.thresholds;
  const rv = sf.review;
  const k = sf.crash;
  const v = cfg.fraud.vetting;
  return [
    {
      id: "record",
      section: S,
      title: "Your safety record",
      html:
        p(`Like a real carrier, your company is scored in four areas. Violations count three times as much for six months, twice as much for the next six, once more for the year after, then drop off. Inspections with nothing found dilute the score.`) +
        table(
          ["Area", "Alert at"],
          [
            ["Hours of service", th.hos],
            ["Unsafe driving", th.unsafe],
            ["Vehicle maintenance", th.maintenance],
            ["Crashes (per truck)", th.crash],
          ],
        ) +
        p(`An alert gets your trucks pulled into more weigh stations, raises insurance at renewal, keeps strict brokers away, and two at once call in an auditor.`),
    },
    {
      id: "inspections",
      section: S,
      title: "Weigh stations and inspections",
      html:
        ul([
          `Trucks pass weigh stations on the main interstate corridors, at about the real locations. A station is open ${pct(sf.enforcement.stationOpen)} of the time. Clean carriers are waved through most of the time; alerts, a poor rating or a brand-new authority get pulled in far more.`,
          `Police make traffic stops on the road, more often for trucks that are speeding.`,
          `An inspection checks the driver and logs, the truck, or both. Problems found mean fines, violations on your record, and sometimes an <b>out-of-service order</b> on the spot: the driver must rest, or the truck is repaired at roadside prices before it moves.`,
          `Defects build up on every truck, slowly with full maintenance. Fix them from the Truck tab before an inspector finds them.`,
        ]) +
        p(`Every inspection, clean or not, shows up in your ticker.`),
    },
    {
      id: "reviews",
      section: S,
      title: "Compliance reviews and ratings",
      html:
        ul([
          `A new authority gets a <b>new-entrant audit</b> at ${rv.newEntrantDay} days. After that, reviews follow two alerts at once (at most every ${rv.alertCooldownDays} days), an at-fault crash with injuries or deaths, or a scheduled follow-up.`,
          `An auditor goes through your records, fines what turns up (capped at ${n(rv.finesCap)} FD a review), and rates you <b>satisfactory</b>, <b>conditional</b> or <b>unsatisfactory</b>.`,
          `<b>Conditional:</b> insurance ×${cfg.insurance.rating.conditional} at once, strict brokers won't load you, more inspections, and a follow-up in ${rv.rereviewDays.conditional} days that can clear it.`,
          `<b>Unsatisfactory:</b> insurance ×${cfg.insurance.rating.unsatisfactory} at once, most brokers won't load you, and ${rv.rereviewDays.unsatisfactory} days to clean up. Still unsatisfactory at the follow-up and your authority is revoked (${see("shutdowns", "Shutdowns")}).`,
          `Bad ratings also cost you people: drivers don't like working for a carrier with a poor rating.`,
        ]),
    },
    {
      id: "crashes",
      section: S,
      title: "Crashes",
      html:
        p(`A typical legal truck crashes about once every ${n(1e6 / k.per1MMi)} miles. Fatigue, speed, defects, wear and a green driver all raise the odds; a veteran driver lowers them. About ${pct(k.fatalShare)} of crashes kill someone and ${pct(k.injuryShare)} injure someone; fatigue or speed makes them deadlier.`) +
        p(`What a crash costs depends on why it happened:`) +
        table(
          ["Cause", "What follows"],
          [
            ["Not at fault", "The other side's insurer pays. You lose the load and days in the shop."],
            ["At fault, nothing wrong", `Your insurer pays up to ${n(k.insuranceLimitFd)} FD. You pay the ${n(k.deductibleFd)} FD deductible and anything over the limit; premiums jump at renewal (or at once, for injuries and deaths); a crash on your record.`],
            ["At fault, with violations behind it", `The same, but juries multiply verdicts ${k.negligenceMult[0]}–${k.negligenceMult[1]}×. A verdict the company can't pay winds it up.`],
            ["Fatal, caused by falsified hours or known defects", `A crime. Authority revoked, everything the company has seized, the owner barred for ${sf.bars.criminal} days, and the people who ran the truck that way jailed.`],
          ],
        ) +
        p(`A fatal crash usually totals the truck; a leased one costs ${n(k.leasedTotalLossFd)} FD owed to the lessor. A crash with cargo aboard loses the load and its pay, and you pay the cargo deductible.`),
    },
    {
      id: "shutdowns",
      section: S,
      title: "Shutdowns",
      html:
        p(`A revoked authority means the fleet is sold off, the staff are let go, Miles and any locked airdrop are forfeited, and the account can't file for new authority until its bar runs out:`) +
        table(
          ["Cause", "Bar"],
          [
            ["Unsatisfactory at the follow-up review", `${sf.bars.unsatisfactory} days`],
            ["A second revocation", `${sf.bars.imminentHazard} days`],
            ["A crime", `${sf.bars.criminal} days, everything seized`],
            [`${sf.permanentAfterCrimes} crimes`, "Barred for good"],
          ],
        ) +
        p(`When the bar is over, the account gets new authority and starts over on a lease. Brokers can see the old revocation for a year.`),
    },
    {
      id: "vetting",
      section: S,
      title: "Vetting",
      html:
        p(`Brokers and shippers choose who may haul their freight. Every load shows its poster's requirement:`) +
        table(
          ["Tier", "Requires"],
          [
            ["Open", "Anyone"],
            ["Standard", `Authority at least ${v.standard.minAuthorityDays} days old, no open claims, not rated unsatisfactory`],
            ["Strict", `All of the above, plus at least ${v.strict.minAuthorityDays} days and ${v.strict.minDelivered} loads delivered (or a year old), no conditional rating or alerts, no revocation in the past year; tracking on the load`],
          ],
        ) +
        p(`Hot loads are at least standard. A new carrier starts on open freight and earns its way up. Open freight draws more bidders, so it tends to clear cheaper.`),
    },
  ];
}
