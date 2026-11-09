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
  clearsShareRef: "This load's own posted reference",
  clearsBlend: "Together, at this load's reference",

  // Fleet.tsx SendHomeActions under labor.sendHomeToWork: an owner-operator's truck at work, home to work after the job.
  homeAfterWork: "Send home after this delivery · back to work",
  homeAfterWorkToast: "It runs home after this delivery, back to work",
  homeAfterWorkQueued: "Going home after this delivery, back to work",
  // Under labor.turnWhileEmpty: a truck running empty turns now.
  sendHomeNowWork: "Send home now · back to work",
  sendHomeNowDays: (days: number) => `Send home now · ${days} days off`,
  turnedToast: "Turned: it runs from the nearest town",
  // Dispatcher.tsx under businesses.parking.stopInTown: the night choice the shoulder ticket assumes.
  nightStopLabel: "When no rest area or truck stop is in reach tonight, sleep in town instead of the shoulder",
  nightStopSaved: "Night stop saved",
} as const;
