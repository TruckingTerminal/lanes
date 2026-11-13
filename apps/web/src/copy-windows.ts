/**
 * Delivery windows' words (client batch W; the director's design, director-windows-screens-2026-11-13.md). Placeholders
 * for the writer, who words them in one pass; every figure comes from the engine (windowsui.ts). Shown only with
 * windows.enabled on. The writer owns this file once batch W lands.
 */
export const WINDOWS = {
  // §1 The load card: one line under the lane, in the order the player meets them.
  cardLine: (ready: string, pickupBy: string, deliverBy: string) => `Ready ${ready} · pick up by ${pickupBy} · deliver by ${deliverBy}`,
  readyToday: "Today",
  sameDay: (pct: string) => `+${pct} same day`,
  closing: (closes: string) => `Pickup closes ${closes} · rate rising`,
  // canMake's reason as the card's single chip (R22).
  cantPickup: (truck: number, place: string, at: string, closes: string) => `Truck ${truck} reaches ${place} ${at}, after the ${closes} pickup.`,
  cantDeliver: (truck: number, place: string, at: string, deadline: string) => `Truck ${truck} delivers at ${place} ${at}, after the ${deadline} deadline.`,
  // The sheet.
  ready: "Ready",
  pickupBy: "Pick up by",
  deliverBy: "Deliver by",
  agreeTitle: "What you're agreeing to",
  agreeNoShow: (by: string, fd: string) => `Pick up by ${by}, or it's a no-show: claim ${fd} FD.`,
  agreeLate: (by: string, fd: string) => `Deliver by ${by}, or it's late: claim ${fd} FD and a mark on your record.`,
  agreeRelease: (before: string, early: string, urgent: string) => `Release it before ${before}: ${early} FD. After that: ${urgent}.`,
  agreeReleaseLate: (urgent: string) => `Release it now: ${urgent} FD.`,
  agreeTruck: (truck: number, free: string, place: string, at: string, pickupT: string, delivers: string, spare: string) =>
    free ? `Truck ${truck}: free ${free} at ${place}, at ${at} by ${pickupT}, delivers about ${delivers}, ${spare} to spare.` : `Truck ${truck}: at ${at} by ${pickupT}, delivers about ${delivers}, ${spare} to spare.`,
  tight: (spare: string) => `Tight: ${spare} to spare. A long dock wait or a closed road makes it late.`,
  // The board's sort and the table's columns.
  sortPickup: "Pickup",
  colReady: "Ready",
  colPickupBy: "Pick up by",
  colDeliverBy: "Deliver by",
  // §2 Booking ahead.
  pickerBusy: (truck: number, trailer: string, free: string, place: string) => `Truck ${truck} · ${trailer} · free ${free} at ${place}`,
  boardAhead: (truck: number, free: string, place: string) => `Truck ${truck} is on a job: this books its next load, from ${place} once it's free ${free}.`,
  nowLine: (from: string, to: string, delivers: string) => `Now: ${from} → ${to} · delivers ${delivers}`,
  nextLine: (from: string, to: string, pickupBy: string) => `Next: ${from} → ${to} · pick up by ${pickupBy} (booked ahead)`,
  twoDeep: (truck: number) => `Truck ${truck} already has a next load. Release it, or book this for another truck.`,
  release: (fd: string) => `Release · ${fd} FD`,
  released: "Load released",
  // §3 A breakdown's release-or-keep ask.
  askTitle: (truck: number, from: string, to: string) => `Truck ${truck}'s breakdown puts ${from} → ${to} at risk.`,
  askFigures: (repaired: string, place: string, reach: string, late: string, closes: string) => `Repaired about ${repaired}; it would reach ${place} about ${reach}, ${late} after the ${closes} pickup.`,
  askRelease: (fd: string) => `Release now: ${fd} FD claim, and the load goes back on the board.`,
  askKeep: (fd: string) => `Keep it: if it misses the pickup, ${fd} FD no-show and a mark on your record.`,
  askKeepLikely: (spare: string) => `Keep it: likely to make it, ${spare} to spare.`,
  askNoAnswer: (closes: string) => `No answer by ${closes} counts as keep.`,
  askKeepButton: "Keep it",
  kept: "Load kept",
  // §4 What now?'s states.
  riskPickup: (truck: number, at: string, place: string, fd: string) => `Truck ${truck} may miss its ${at} pickup at ${place}. Claim ${fd}.`,
  riskDelivery: (truck: number, at: string, place: string, fd: string) => `Truck ${truck} may miss its ${at} delivery at ${place}. Claim ${fd}.`,
  riskButton: "See the load",
  lateStatement: (truck: number, late: string, place: string, fd: string) => `Truck ${truck} will be about ${late} late at ${place}: claim ${fd}. Nothing changes it now.`,
  nextBooked: (truck: number, delivers: string, place: string, pickupBy: string) => `Truck ${truck} delivers ${delivers}, then picks up at ${place} by ${pickupBy}. Nothing to do.`,
  waitingReady: (truck: number, place: string, ready: string) => `Truck ${truck} waits at ${place} until ${ready}: dwell, no detention before ready.`,
  waitingLong: (truck: number, place: string, ready: string, perDay: string) => `Truck ${truck} waits at ${place} until ${ready}, and it costs ${perDay} FD a day standing.`,
  // §5 Lost loads.
  lostBid: (from: string, to: string, closes: string) => `${from} → ${to} is gone: no carrier took it by its ${closes} pickup. It isn't reposted.`,
  // The director's line names a raise ("Raise the pay to 3.40 or lose it"); no action raises a posted load's pay yet, so
  // this says the close and the fall-off only (engineering's note).
  brokerageClosing: (from: string, to: string, closes: string, fd: string) => `Your ${from} → ${to} has no carrier and closes at ${closes}. Unhauled, it's lost with a ${fd} FD fall-off.`,
  brokerageLost: (closes: string, fd: string) => `Lost: no carrier by ${closes}. Fall-off ${fd} FD paid.`,
  shipperUnsold: (from: string, to: string, fd: string) => `Not hauled: ${from} → ${to}, your goods went unsold (${fd} FD of goods).`,
  hubLost: (hub: string, n: number, rateUp: string | null) => `${hub} lost ${n} ${n === 1 ? "load" : "loads"} this week${rateUp ? `; rates there are up ${rateUp}` : ""}.`,
  hubLostTitle: "Lost loads this week",
  monthClaims: "Claims",
  // §7 Iuliia's first lines, once each.
  iuliiaFirstSheet: "Every load has a pickup and a delivery deadline. Miss either and the poster claims against you; the sheet shows how much.",
  iuliiaFirstBusy: (truck: number) => `You can book Truck ${truck}'s next load now, while it's still on this one. One ahead, never two.`,
  iuliiaFirstClosing: "This one's pickup closes tonight, so the rate is climbing. Wait too long and nobody hauls it.",
  iuliiaFirstClaim: (cause: string) => cause,
  claimCauseLate: (place: string, late: string, fd: string) => `Late at ${place} by ${late}: ${fd} FD.`,
  claimCauseNoShow: (place: string, fd: string) => `A no-show at ${place}: ${fd} FD.`,
  claimCauseCancel: (fd: string) => `A released load: ${fd} FD.`,
  claimCauseDock: (place: string) => ` The dock wait at ${place} cost the margin.`,
};

/** The explain sheets' words for the windows' figures (Explain.tsx reads these before copy.ts EXPLAIN). */
export const WINDOWS_EXPLAIN: Record<string, { what: string; how: string; moves: string }> = {
  "load.window": { what: "When this load is ready, when its pickup closes, and when it must be delivered.", how: "Set by the shipper when the load is posted: a ready time, a pickup window after it, a delivery deadline from the trip's hours.", moves: "Nothing once posted: the windows never move." },
  "claim.noShow": { what: "What the poster claims if your truck isn't at the shipper when the pickup closes.", how: "A share of the load's pay as booked.", moves: "The rate you book at and the load's miles." },
  "claim.late": { what: "What the poster claims if the load is delivered after its deadline, with a mark on your record.", how: "A share of the load's pay as booked.", moves: "The rate you book at and the load's miles." },
  "claim.lost": { what: "What releasing a load booked ahead costs.", how: "A smaller share of the load's pay while its pickup is days off; a larger one in its last rounds.", moves: "How close the pickup is when you release it." },
};
