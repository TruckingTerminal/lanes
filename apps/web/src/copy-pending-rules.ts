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
  // QA's 0.24.1 replay, item 10: no days off, so the days-away count doesn't clear (the director's H: "your days-away count
  // won't clear").
  homeAfterWorkQueued: "Home after this run, then back to work. With no days off, the days-away count doesn't clear.",
  // Under labor.turnWhileEmpty: a truck running empty turns now. An owner-operator gets both buttons, as at work.
  sendHomeNowWork: "Send home now · back to work",
  sendHomeNowDays: (days: number) => `Send home now · Home time · ${days} ${days === 1 ? "day" : "days"} off`,
  turnedToast: "Turned: it heads there from the nearest town",
  turnedWorkToast: "Turned for home: back to work from there, no days off",
  turnedDaysToast: "Turned for home: days off when it gets there",
  // Dispatcher.tsx under businesses.parking.stopInTown: the night choice the shoulder ticket assumes.
  nightStopLabel: "When no rest area or truck stop with room is within the day's hours, stop for the night in town rather than drive on to the shoulder: no ticket, but the day's last hours go unused",
  nightStopSaved: "Night stop saved",

  // leverage.localHoldHandBids (the economy's locals-first look, 2026-11-09): in the last round of a locals-first hold a
  // bid by hand is filed for the opening clearing. The load sheet's line in place of the first-call wall (`hh` the opening
  // round's hour); Iuliia's line when it's filed (the director's), and when a local carrier books it first.
  bidFilesFor: (hh: string) => `Local carriers have first call until ${hh}. Bid now and it's filed for that round, when the load opens to everyone.`,
  bidFiled: (hub: string, hh: string) => `Your bid is filed. The shipper gives ${hub}'s own carriers first call until ${hh}; if none takes it, yours is in that round.`,
  localTook: "A local carrier took it. Here's what's next.",

  // equipmentFinance.purchase.collateral (the economy's worn-truck loans): a truck past the lender's caps is cash only. On
  // the Dealer's row under its buttons; `why` the engine's reason ("the lender won't finance a truck past 700,000 miles:
  // cash only"), `fd` the cash it takes (Showroom.tsx Buy).
  // The engine's reason ends ": cash only"; said once, as the row's own sentence. `fd` is price and tax less any deposit.
  cashOnly: (why: string, fd: string) => {
    const reason = why.replace(/:\s*cash only\.?$/i, "");
    return `${reason.charAt(0).toUpperCase()}${reason.slice(1)}. Cash only: ${fd} FD when you sign.`;
  },
  // Under the first-truck figure (the Dealer's card, Iuliia's page) when the truck it prices is cash only.
  cashOnlyFigure: "The lender won't finance that one for its age or miles, so the figure counts its full price and sales tax in cash.",
} as const;
