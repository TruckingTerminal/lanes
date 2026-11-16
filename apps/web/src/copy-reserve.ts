/**
 * The Reserve on Money (UX next-screens §3.8): engineering's placeholder keys, in the writer's drafts
 * (writer-sprint-2026-11-15.md §11) and the director's words for §15 (director-sprint-2026-11-15.md), for the writer's
 * pass. The card reads the config's phase, never the date alone: the live world has no year-end close, so it keeps FD
 * from the weekly holding cost; a world with seasons, before launch, from the close.
 */
export const RESERVE = {
  title: "The Reserve",
  fold: "The Reserve",
  balance: (fd: string) => `${fd} FD`,
  // The shelter.
  sheltered: (sheltered: string, cap: string) => `Sheltered ${sheltered} of ${cap} FD`,
  shelterIs: (weeks: number) => `The shelter is ${weeks} weeks of your spending.`,
  shelterNone: (weeks: number) => `Nothing is sheltered yet: the shelter is ${weeks} weeks of your spending.`,
  overShelter: (over: string) => `${over} FD over the shelter's cap is charged as cash is.`,
  // UX §3.8's first-week line: FD put in this week, not yet in a week's lowest balance. By the phase, not by launch: the live
  // world charges the weekly holding cost before launch too, so this week's check still charges it once.
  firstWeekHolding: (fd: string, day: string) => `${fd} FD put in this week pays ${day}'s holding cost once. It's sheltered after that.`,
  firstWeekClose: (fd: string, day: string) => `${fd} FD put in this week counts toward the shelter from ${day}.`,
  // The phase line: what it keeps FD from.
  phaseHolding: (rate: string) => `It keeps FD from the weekly holding cost, ${rate} of cash over your working capital.`,
  phaseClose: (date: string) => `It keeps FD from the year-end close, ${date}.`,
  // The room line, only when today's cash is over the free line and the Reserve has room.
  roomHolding: (fd: string, room: string) => `At today's cash this week's holding cost would take ${fd} FD; the Reserve has room for ${room}.`,
  roomClose: (fd: string, room: string) => `At today's cash the close would burn ${fd} FD; the Reserve has room for ${room}.`,
  settling: (fd: string, day: string) => `Settling ${fd} FD · in cash ${day}`,
  // The foot, every time; the director's §15 line with the winding-up check counting the Reserve; the launch line before launch.
  foot: "Bills are paid from cash only. A withdrawal reaches cash the next day.",
  footCounts: "If cash runs short, the Reserve still counts: the winding-up check reads cash and the Reserve together.",
  footLaunch: "At FD's launch it goes back into cash, so it keeps nothing from the launch's reset.",
  // The cash card's line.
  cashLine: (fd: string) => `+ ${fd} FD in the Reserve`,
  deposit: "Deposit",
  withdraw: "Withdraw",
  close: "Close",
  amount: "FD",
  // Deposit (a half sheet).
  depositTitle: "Put FD in the Reserve",
  chipRoom: (fd: string) => `Room in the shelter · ${fd}`,
  chipOver: (fd: string) => `Cash over your working capital · ${fd}`,
  depositAfter: (cash: string, reserve: string) => `Cash after: ${cash} FD · Reserve after: ${reserve} FD`,
  depositFrom: "Sheltered from the next full week.",
  warnWeek: (cash: string, costs: string) => `Cash after would be ${cash} FD, under this week's ${costs} FD of costs.`,
  warnDip: (day: string, fd: string) => `Cash after would dip below zero on ${day}, before ${fd} FD of invoices land.`,
  warnOver: (over: string) => `${over} FD of this would be over the shelter: it's charged as cash is.`,
  noCash: "No cash to put in.",
  revoked: "Your authority is revoked: the Reserve takes no deposits.",
  windingUp: "The company is being wound up: the Reserve takes no deposits.",
  // Withdraw.
  withdrawTitle: "Take FD out of the Reserve",
  chipAll: (fd: string) => `All · ${fd}`,
  chipShort: (fd: string) => `What cash is short · ${fd}`,
  withdrawWhen: (day: string) => `In cash ${day}, one day from now. Until then it can't pay a bill.`,
  withdrawAfter: (sheltered: string, cap: string) => `Sheltered after: ${sheltered} of ${cap} FD`,
  // The toasts and chips.
  depositDone: (fd: string) => `${fd} FD → the Reserve`,
  withdrawDone: (fd: string, day: string) => `${fd} FD on its way to cash, ${day}.`,
  landed: (fd: string) => `${fd} FD from the Reserve is in cash.`,
  // Needs you: cash under zero while the Reserve holds FD. With the countdown running (§15 off, or the sum under the line),
  // ranked with it; with the Reserve covering it (§15 on), the director's tier-2 line.
  needCount: (cash: string, reserve: string) => `Cash is ${cash} FD and the weeks-in-debt count is running. ${reserve} FD sits in the Reserve.`,
  needCovers: (cash: string) => `Cash is ${cash} FD. Your Reserve covers it, but bills and purchases are paid from cash.`,
  needWithdraw: (fd: string) => `Withdraw ${fd} FD`,
  needAfter: (fd: string, day: string) => `${fd} FD reaches cash ${day}.`,
  // Needs you: the close window (a world with seasons, before launch, once per close).
  needClose: (date: string, fd: string, room: string) => `The year-end close on ${date} would burn ${fd} FD of today's cash. The Reserve can keep ${room} FD of it.`,
  // The director's §15: the weeks-in-debt warning reads cash and the Reserve together. `under` is how far under the line
  // the two are, null when they're back over it with the count still standing; `next` the next weekly check, `day` the
  // check that would wind the company up (QA's 0.25.5 replay: "week 0 of 4" read like a counter that hadn't started).
  debtTogether: (under: string | null, limit: string, n: number, of: number, next: string, day: string) => {
    const line = `the −${limit} FD line`;
    if (under === null) return `Cash and the Reserve together are back over ${line}. ${n} of ${of} weekly checks counted them under it; if they stay over, the next check, ${next}, clears the count.`;
    const head = `Cash and the Reserve together are ${under} FD under ${line}.`;
    if (n === 0) return `${head} No weekly check has counted it yet: the first is ${next}, and ${of === 4 ? "four" : of} in a row under the line wind the company up on ${day}.`;
    if (n >= of - 1) return `${head} ${n} of ${of} weekly checks have counted it. Unless the two together are back over the line by the next check, ${next}, it winds the company up.`;
    return `${head} ${n} of ${of} weekly checks have counted it; the next is ${next}. Unless the two together are back over the line, the company is wound up on ${day}.`;
  },
  // Its move, on the Needs you card (What now?'s badge row gives it as a button): moving FD between cash and the Reserve
  // changes nothing, since the check counts both.
  debtMoves: "Get loads moving, sell or park a truck, or put money in. Moving FD between cash and the Reserve doesn't change the sum.",
};

/** The card's explain sheets (ui/Explain.tsx): what the figure is, how it's built, what moves it; the phase from the world. */
export const RESERVE_EXPLAIN = (o: { close: boolean; launched: boolean; weeks: number }): Record<string, { what: string; how: string; moves: string }> => ({
  "money.reserve": {
    what: `An account beside cash that keeps FD from ${o.close ? "the year-end close" : "the weekly holding cost"}, up to its shelter. It pays nothing.`,
    how: `Money in it counts toward your credit score as capital. It can't pay a bill, a stake or a bond: those draw on cash.${o.launched ? "" : ` ${RESERVE.footLaunch}`}`,
    moves: "Your deposits and withdrawals.",
  },
  "money.reserveShelter": {
    what: "How much of the Reserve is kept from the charge.",
    how: `Up to ${o.weeks} weeks of your spending (the average of your recent weeks), counted from each week's lowest balance, so FD put in counts from the next full week. Anything over is charged as cash is.`,
    moves: "Your spending sets the shelter; your lowest balance in the week sets what counts.",
  },
  "money.reserveSettling": {
    what: "A withdrawal on its way to cash.",
    how: "It leaves the Reserve at once and lands in cash the next day. Until then it's in neither, and can't pay a bill.",
    moves: "Nothing: it lands on its day.",
  },
});
