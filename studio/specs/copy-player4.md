# Copy: the fourth player diary's writer rows (writer, draft 1, 2026-11-03; against `reviews/director-player4.md`)

Strings for what doesn't wait on the economy (R19, R20), and drafts for what will land with the economy's bump (the compliance lines for R18, the driver's notice for R16). Keys are proposed in `copy.ts` style; engineering names the final ones. `{key}` is config; `{x}` is a value the engine computes; sizes the economy hasn't set are placeholders. Plain on money and risk; no string over 20 words.

**One voice for every answer (R20).** A result is past tense and says what happens next. A refusal gives the reason with its figures, never "can't" alone.

## R19: caps and stakes say what binds

| Key | Where | String |
|---|---|---|
| `caps.line` | Truck tab, under the fleet; and Staking | You may run `{n}`: `{binding}`. `{others}` |
| `caps.binding.yard` | `{binding}` | your yard holds `{n}` |
| `caps.binding.stake` | `{binding}` | your stake allows `{n}` |
| `caps.binding.managers` | `{binding}` | your operations managers cover `{n}` |
| `caps.binding.company` | `{binding}` | the company limit is `{company.maxTrucks}` |
| `caps.other.yardsOpen` | `{others}`, one sentence each | Yards open `{date}`. |
| `caps.other.stake` | `{others}` | Staking allows `{n}`. |
| `caps.example` | the director's | You may run 5: your yard holds 5. Yards open Jan 29. Staking allows 10. |

**The staking page:**

| Key | Where | String |
|---|---|---|
| `stake.total` | first row | Staked · `{fd}` FD in all |
| `stake.discount` | second row | Discount · `{pct}` on fuel, maintenance, rebuilds, insurance and board fees |
| `stake.term.free` | third row, no lock | Term · none: unstake any time, back in `{token.staking.exitDays}` days |
| `stake.term.locked` | third row, a lock (when the locks land) | Term · locked until `{date}` |
| `stake.buysNothing` | R6's confirm card, the one risk | Your yard holds `{n}` trucks, so this stake runs no more until yards open `{date}`. |
| `stake.noTrucks` | while the stake tiers are off | (no line promises trucks; the cap rows show only what binds) |

**UNSTAKE answers:**

| Key | Case | String |
|---|---|---|
| `unstake.done` | result | Unstaking `{fd}` FD: back in your cash on `{date}`. |
| `unstake.nowDone` | result, unstake now | `{fd}` FD back now. `{fd}` FD burned. |
| `unstake.none` | refusal | Nothing staked to unstake. |
| `unstake.licence` | refusal, a broker | Your broker licence needs `{fd}` FD staked: you may unstake `{fd}`. |
| `unstake.queued` | refusal, already waiting | `{fd}` FD is already on its way back, arriving `{date}`. |

**Borrow while the pools are off:** no string. The row is offered only if the NPC lender writes it (R19); otherwise it isn't shown.

## R20: every button answers

| Key | Control | Result | Refusal |
|---|---|---|---|
| `answer.bid` | BID | Bid in: `{rate}`/mi on `{origin}` to `{dest}`. It clears at `{hh:00}`. | Above the ceiling: this shipper pays at most `{ceiling}`/mi. |
| `answer.bookVetting` | BOOK NOW, a vetted load | Booked. The truck is on its way. | Strict vetting: needs `{days}` days of authority and `{loads}` loads delivered. You have `{d}` and `{l}`. |
| `answer.bookVettingStd` | the same, standard vetting | | Standard vetting: needs `{days}` days of authority. You have `{d}`. |
| `answer.lease` | LEASE | Leased: a `{make}` at `{hub}`, `{deposit}` FD deposit paid. It's on the Truck tab. | Deposit `{fd}` FD: you have `{fd}`. (R7) · Your yard holds `{n}` trucks: this lease makes `{m}`. · You may lease at most `{freeEntry.leases.maxPerCompany}` trucks. |
| `answer.unstake` | UNSTAKE | (above) | (above) |
| `answer.poach` | OFFER, hiring away | Offer sent to `{name}`: they answer by `{day}`. | `{name}` earns `{fd}`/mi now: an offer must beat it. |
| `answer.poachRow` | the row while it waits | Offer pending · answer by `{day}` | |
| `answer.lease.depositRow` | the lease row, before the button (R7) | Lease another truck · `{fd}` FD deposit · at least `{leaseMin}` FD a week | |

## R18: the compliance page (drafted now; the figures land with the economy's bump)

The director's point for the speed line: a stranger reads 70 on the highway, but the game's speeds are averages over a trip, towns and grades included.

| Key | Option | The line under it |
|---|---|---|
| `policy.lead` | above the three settings | Every setting except Legal breaks the law. Inspections and audits catch up with the record. |
| `policy.hos.legal` | Legal: `{legalH}` h a day | The legal limit. Nothing here for an inspector to fine. |
| `policy.hos.hot` | `{overH}` h on hot loads | Falsified logs on rush loads. Fines when inspected; tired drivers crash more. |
| `policy.hos.always` | `{overH}` h every day | Falsified logs on every trip. Fines, out-of-service orders, an audit, and tired drivers who crash. |
| `policy.speed.legal` | Legal pace | A legal truck averages about `{time.avgMph}` mph over a trip, towns and grades included. |
| `policy.speed.hot` | `{fast}` mph on hot loads | Speeding on rush loads: tickets, and crashes are deadlier. |
| `policy.speed.always` | `{fast}` mph always | Averaging `{fast}` means speeding on every open road. Tickets, deadlier crashes, and an audit. |
| `policy.maint.deferred` | Deferred | Defects build up: inspectors park the truck, and it breaks down more. |

**Money-style lines when R18 lands** (R9's form, each with its one-line why):

| Key | Line | Why |
|---|---|---|
| `news.fineHours` | Hours fine, truck `{n}`: −`{fd}` FD for falsified logs. | Your policy runs `{overH}` hours a day; the inspector read the logs. |
| `news.fineSpeed` | Speeding ticket, truck `{n}`: −`{fd}` FD at `{mph}` mph. | Your policy runs `{fast}` mph. |
| `news.outOfService` | Out of service, truck `{n}`: parked at `{place}` for `{days}` days, −`{fd}` FD. | `{defect / hours}` found at inspection. It runs again once fixed. |
| `news.auditDue` | An auditor reviews your record on `{date}`. | `{n}` safety alerts in the last `{days}` days. |
| `news.auditResult` | Audit: `{Satisfactory / Conditional / Unsatisfactory}`. | `{consequence}` |
| `news.consequence.conditional` | | Strict-vetting brokers won't load you, and your insurance rises. |
| `news.consequence.unsatisfactory` | | Most brokers won't load you. A second Unsatisfactory revokes your authority. |
| `safety.ratedNow` | the Safety band, once there are alerts | (never "Not yet rated" with alerts: the band shows the rating the audit set, or "Under review") |

## R16: the driver's notice (drafted now; it lands with the economy's bump)

| Key | Where | String |
|---|---|---|
| `staff.unhappy` | staff row and the driver's card | `{name}` is unhappy with pay: `{fd}`/mi against a market of `{fd}`. |
| `staff.notice` | feed line (the director's) | `{name}` has given notice: `{days}` days to raise pay. |
| `needs.notice` | Needs-you item | `{name}` leaves `{date}` unless you raise pay. · **Raise pay** |
| `staff.stays` | after a raise in time | `{name}` stays. |
| `staff.left` | after the notice runs out (plain, no line from Iuliia) | `{name}` has left. Truck `{n}` has no driver. |
| `staff.payFloor` | the pay floor's refusal | The lowest pay allowed is `{fd}`/mi: `{labor.payFloorShareOfMarket}` of `{name}`'s market rate. |
| `staff.reputation` | the hire table, after underpaying | Drivers know you underpaid: they ask `{pct}` more until `{date}`. |

## Rows 9 and 11

| Key | Where | String |
|---|---|---|
| `dispatcher.signContracts` | a new rule in More rules, off by default (row 9) | Sign contract offers for me |
| `feed.dispatcherSigned` | when that rule is on and it signs | Your dispatcher signed `{shipper}`'s contract: `{origin}` to `{dest}`, `{weeks}` weeks. |
| `month.rank` | the month report (R10), row 11 | You moved from #`{a}` to #`{b}` this month. |
| `month.vsLast` | the month report | This month against last: kept `{fd}` FD, `{more / less}` by `{fd}`. |
