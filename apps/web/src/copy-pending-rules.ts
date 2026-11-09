/**
 * PLACEHOLDERS for the writer (engineering's rules batch, 2026-11-09: five engine rules behind switches, each off until a
 * ruleset): the strings their screens need, worded by engineering to say what the screen must say. Kept apart from
 * copy-pending.ts, which the writer's pass holds. The writer words each and moves it into copy.ts.
 */
export const PENDING_RULES = {
  // explain.ts "board.clearsNear" under freight.clearsNear.ratio: each row is a share of the figure (the economy's text:
  // recent winning rates on this lane and trailer, as a share of what loads like this are posted at; with few recent
  // clears it leans on this market's, then on the load's own reference).
  clearsShareLane: (trailer: string) => `This lane's recent ${trailer} clears`,
  clearsShareMarket: (hub: string, trailer: string) => `${hub}'s recent ${trailer} clears`,
  clearsShareRef: "This load's reference rate",
  clearsBlend: "Weighed together, on this load's reference rate",

  // Fleet.tsx SendHomeActions under labor.sendHomeToWork: an owner-operator's truck at work, home to work after the job.
  // Client pass 2 (the director): the button is "Send home after this run" (the writer's), and the queued line and toast
  // say what was chosen: back to work, no days off.
  homeAfterWork: "Send home after this run · back to work",
  homeAfterWorkToast: "Home after this run, then back to work",
  homeAfterWorkQueued: "Home after this run, then back to work.",
  // Under labor.turnWhileEmpty: a truck running empty turns now. An owner-operator gets both buttons, as at work.
  sendHomeNowWork: "Send home now · back to work",
  sendHomeNowDays: (days: number) => `Send home now · Home time · ${days} ${days === 1 ? "day" : "days"} off`,
  turnedToast: "Turned: it heads there from the nearest town",
  turnedWorkToast: "Turned for home: back to work from there, no days off",
  turnedDaysToast: "Turned for home: days off when it gets there",
  // Dispatcher.tsx under businesses.parking.stopInTown: the night choice the shoulder ticket assumes.
  nightStopLabel: "When no rest area or truck stop with room is within the day's hours, stop for the night in town rather than drive on to the shoulder: no ticket, but the day's last hours go unused",
  nightStopSaved: "Night stop saved",
} as const;
