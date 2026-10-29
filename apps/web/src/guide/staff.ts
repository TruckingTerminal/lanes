import type { EconomyConfig } from "@lanes/config";
import { type GuidePage, n, p, pct, see, table, ul, h } from "./util.js";

const S = "Staff";

export function staffPages(cfg: EconomyConfig): GuidePage[] {
  const lab = cfg.labor;
  const m = lab.morale;
  const stars = [0, 0.25, 0.5, 0.75, 1].map((s, i) => [
    "★".repeat(i + 1),
    `${(lab.driver.payPerMile[0] + (lab.driver.payPerMile[1] - lab.driver.payPerMile[0]) * s).toFixed(2)} FD/mi`,
    `${pct(lab.driver.mpgRange * (s - 0.5))}`,
    `${pct(-lab.driver.maintRange * (s - 0.5))}`,
    `×${(lab.driver.crash[0] + (lab.driver.crash[1] - lab.driver.crash[0]) * s).toFixed(1)}`,
  ]);
  return [
    {
      id: "drivers",
      section: S,
      title: "Drivers",
      html:
        p(`Every truck needs a driver; a truck without one sits. You drive your first truck yourself, at a fixed owner's draw of ${lab.owner.driverPayPerMile.toFixed(2)} FD/mi, and you never quit on yourself. Every other seat is a hire.`) +
        table(["Skill", "Market pay", "Fuel economy", "Maintenance and breakdowns", "Crash odds"], stars) +
        p(`Speed moves ±${pct(lab.driver.mphRange / 2)} with skill too. Market pay is multiplied by the wage index, which rises up to ×${lab.wageIndex.range[1]} when the pool of unemployed drivers runs thin and falls to ×${lab.wageIndex.range[0]} when it's deep.`) +
        p(`<b>Experience:</b> each mile closes a little of the gap between a driver's skill and their own potential (gap × miles ÷ ${n(lab.driver.learnMiles)}). A rookie with promise becomes a veteran in a year or two of steady driving, and from then on the market will pay them like one.`) +
        p(`<b>Teams:</b> seat a co-driver on a truck that already has a driver and it runs ${cfg.safety.hos.teamHours} hours a day legally. Each driver earns ${pct(lab.driver.teamPayShare)} of their rate on every mile, so a team costs about ${pct(lab.driver.teamPayShare * 2 - 1)} more per mile than one driver and covers twice the ground. Teams are how hot loads get delivered legally.`) +
        p(`Every driver carries a record of violations and crashes that any employer can see before hiring.`),
    },
    {
      id: "hometime",
      section: S,
      title: "Fatigue, home time and per diem",
      html:
        p(`Drivers wear down on the road. Each one has a fatigue level you can see on the Staff tab and on their truck.`) +
        ul([
          `<b>Weeks out:</b> past ${cfg.fatigue.roadDays} consecutive days away from the home hub, fatigue builds every day, faster the longer they're out.`,
          `<b>Long days:</b> a day over ${cfg.fatigue.longDayHours} driving hours builds it too, and each consecutive long day builds more than the last. Running over hours on falsified logs makes long days routine.`,
          `<b>Days off:</b> ${cfg.fatigue.resetDays} straight days off at home reset fatigue to zero. Each extra day off banks a buffer (up to ${cfg.fatigue.bufferMax} days' worth) that absorbs the next stretch before fatigue starts climbing. A day off on the road takes a little off but doesn't reset the clock.`,
          `<b>What it does:</b> crash odds ×${1 + cfg.fatigue.crashMult} at full fatigue, the truck runs up to ${pct(cfg.fatigue.paceLoss)} slower, and a tired hire's morale drops every day until they quit.`,
        ]) +
        h("Home time") +
        p(`The standing order "Bring drivers home" sends a truck to your home hub after a set number of days out and rests its driver for a set number of days; the dispatcher leaves the truck alone meanwhile. You can also send any idle truck home from its card. Teams rest together. You drive your first truck yourself, and the same rules apply to you.`) +
        h("Per diem") +
        p(`Every day a driver is away from the home hub costs the company ${cfg.labor.driver.perDiemFd} FD in per diem (meals, parking, showers). A truck sitting idle far from home is spending money and wearing its driver out; that's why a local carrier can wait for a good load and a visitor can't.`),
    },
    {
      id: "dispatchers",
      section: S,
      title: "Dispatchers",
      html:
        p(`You dispatch your first ${lab.owner.span} trucks yourself. Past that you need dispatchers, or some of your idle trucks sit out each round. A dispatcher's skill sets how many trucks they can run and how well (${see("dispatch", "You against your dispatcher")}):`) +
        table(
          ["Skill", "Runs", "Pricing error", "Reload priced in", "Season foresight", "Full-span pay"],
          [0, 0.5, 1].map((s) => [
            s === 0 ? "★" : s === 0.5 ? "★★★" : "★★★★★",
            `${Math.round(lab.dispatcher.span[0] + (lab.dispatcher.span[1] - lab.dispatcher.span[0]) * s)} trucks`,
            `~${pct(lab.dispatcher.noise[0] + (lab.dispatcher.noise[1] - lab.dispatcher.noise[0]) * s)}`,
            `${(lab.dispatcher.reloadAware[0] + (lab.dispatcher.reloadAware[1] - lab.dispatcher.reloadAware[0]) * s).toFixed(2)}×`,
            `${Math.round(lab.dispatcher.foresightDays[1] * s)} days`,
            `${n(lab.dispatcher.payPerWeek[0] + (lab.dispatcher.payPerWeek[1] - lab.dispatcher.payPerWeek[0]) * s)} FD/wk`,
          ]),
        ) +
        p(`Pay is quoted for a full span and billed weekly for the trucks a dispatcher actually runs past your own ${lab.owner.span}, with a quarter as a retainer. Your best dispatcher takes the trucks first. Dispatchers learn with every load they book (gap × loads ÷ ${n(lab.dispatcher.learnLoads)}). So do you: your own dispatching skill grows the same way.`),
    },
    {
      id: "people",
      section: S,
      title: "Hiring, poaching and keeping people",
      html:
        ul([
          `<b>Hiring:</b> anyone in the pool takes a job at their asking pay or more: market pay for their skill, times a personal premium of ${pct(lab.pool.personal[0] - 1)} to ${pct(lab.pool.personal[1] - 1)}. The pool refills every week with rookies and returning veterans.`,
          `<b>Morale</b> drifts each week toward a target set mostly by pay against market (every 10% under costs about ${pct(m.payWeight * 0.1)}), plus up to ${pct(m.tenureCap)} for tenure, minus ${pct(m.wornTruckPenalty)} for a worn-out truck, ${pct(m.badRatingPenalty)} for a conditional or unsatisfactory safety rating, and up to ${pct(m.pushedPenalty)} for running outside the rules, which the best drivers mind most.`,
          `<b>Quitting:</b> settled people rarely leave; unhappy ones quit at up to about ${pct(m.quitBase + m.quitSlope * 0.5)} a week. A driver left without a truck walks after ${m.unseatedWeeks} weeks. Anyone mid-trip finishes the load first.`,
          `<b>Poaching:</b> anyone working elsewhere will move for a raise of ${pct(m.loyalty[0])} (miserable) to ${pct(m.loyalty[1])} (happy) over what they make, and at least their asking pay. Their employer gets ${m.noticeDays} days to match. If they match, they stay.`,
          `<b>Your people get offers too.</b> The Staff tab flags them with a Match button. Raises keep people; a cut lowers morale on the spot.`,
          `Going broke or losing your authority lets everyone go.`,
        ]),
    },
    {
      id: "autostaff",
      section: S,
      title: "Auto-staff",
      html: p(
        `On by default. Each day it seats any idle driver on a truck that needs one, hires the best-value driver in the pool for any remaining empty seat (asking pay against what their skill saves), hires a dispatcher when your fleet outgrows your team's span, and lets go a dispatcher you no longer need. It doesn't give raises, match offers, or poach: those are yours. Turn it off on the Staff tab to do it all by hand.`,
      ),
    },
  ];
}
