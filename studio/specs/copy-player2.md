# Copy: the second player diary's writer rows (writer, draft 1, 2026-11-03; against `reviews/director-player2.md`)

Strings for rulings R6, R7, R9 and R10 and the diary's contradictions (row 7), plus the small rows that need words (8, 9, 12, 15, 16). Keys are proposed in `copy.ts` style; engineering names the final ones. `{key}` is config; `{x}` is a value the engine computes. Plain on money and risk throughout; no string over 20 words.

**Placement.** UX places these in `player2-ux.md` at the same time. Where a label depends on where it sits, both forms are given: **sheet** (a bottom sheet over the screen) and **inline** (the card expands where the tap was).

**New keys engineering adds:** `guard.confirmShareOfCash`, `guard.newsFd`, `guard.hireCoverWeeks` (the director's), and the upgrades' effects, which today are numbers in the engine: `mods.apu.idleFuelCut`, `mods.aero.fuelCut`, `mods.tires.maintCut`, `mods.sleeper.perDiemCut`.

## R6: the confirm card

Any action that can't be undone, or that spends more than `{guard.confirmShareOfCash}` of cash.

### The card's frame

| Key | Sheet form | Inline form |
|---|---|---|
| `confirm.title` | `{Verb}` `{item}`? ("Buy this truck?") | (no title; the card's own heading stays) |
| `confirm.cost` | It costs · `{fd}` FD | Costs `{fd}` FD |
| `confirm.after` | Left after · `{fd}` FD, `{n}` weeks of cushion | Leaves `{fd}` FD, `{n}` weeks of cushion |
| `confirm.does` | What it does | (the line alone, no label) |
| `confirm.risk` | The one risk | Risk: |
| `confirm.go` | `{Verb}` · `{fd}` FD | the same |
| `confirm.cancel` | Not now | the same |
| `confirm.lowCushion` | Under `{n}` weeks of cushion after this. (red, when the cushion falls below 4 weeks) | the same |

### What it does, and the one risk, by action

| Key | Action | What it does | The one risk |
|---|---|---|---|
| `confirm.used.fresh` | used truck, rebuilds left | A used `{make}`: `{pct}` condition, `{n}` rebuilds left. | Worn trucks break down more, usually far from home. A rebuild costs `{fd}` FD. |
| `confirm.used.last` | used truck, past its last rebuild | A used `{make}`: `{pct}` of its life left, no rebuilds. | It runs until it's worn out, then goes for scrap, for about `{fd}` FD. |
| `confirm.used.away` | used truck, far from your base (added to either) | It's at `{hub}`, `{mi}` miles from home. | Bringing it home takes a driver and empty miles. |
| `confirm.new` | new truck | A new `{make}`, arriving `{date}`. | It loses value from the day it arrives, and costs money every week it sits. |
| `confirm.lease` | lease another truck | Leases a `{make}`: `{deposit}` FD deposit, at least `{leaseMin}` FD a week. | It costs the weekly minimum, earning or not, for at least `{minTermDays}` days. |
| `confirm.trailer` | trailer | A `{type}` trailer of your own, kept in your yard. | It takes yard space and upkeep whether it's hooked or not. |
| `confirm.apu` | APU | Cuts the fuel truck `{n}` burns idling overnight by `{mods.apu.idleFuelCut}`. | It pays back only on nights away: about `{n}` weeks at this truck's pace. |
| `confirm.aero` | aero kit | Cuts truck `{n}`'s fuel by `{mods.aero.fuelCut}`. | It pays back in about `{n}` weeks at this truck's miles. |
| `confirm.tires` | premium tires | Cuts truck `{n}`'s maintenance by `{mods.tires.maintCut}`. | It pays back in about `{n}` weeks at this truck's miles. |
| `confirm.sleeper` | sleeper upgrade | Cuts the per diem on nights away by `{mods.sleeper.perDiemCut}`. | It pays back only if the truck sleeps away often: about `{n}` weeks. |
| `confirm.rebuild` | rebuild | Two days in the shop; condition back to new. | `{n}` of `{wear.maxRebuilds}` rebuilds left after this. Past the last, it runs to scrap. |
| `confirm.scrap` | scrap | Ends truck `{n}` for `{fd}` FD from the scrapyard. | Sold, it would fetch about `{fd}` FD. Scrapping can't be undone. |
| `confirm.sell` | sell | Lists truck `{n}` at `{fd}` FD. The price drops each week until it sells. | It earns nothing while it's listed and parked. |
| `confirm.hire` | a hire whose wage passes a week's net | Hires `{name}` at `{fd}` FD a week. | That's more than your company kept last week: `{fd}` FD. |
| `confirm.factoring` | factoring contract | Every truck's invoices paid on delivery, for `{months}` months, at `{rate}`. | No leaving early, whatever the market does. |
| `confirm.contract` | a shipper's contract | `{origin}` to `{dest}`, `{n}` loads a week at `{rate}`/mi, for `{weeks}` weeks. | Turning down a tender costs your stake and the shipper's trust. |

The upgrades' payback weeks come from this truck's own record (its miles or nights away over the last `{cushionAvgWeeks}` weeks). With no record yet: "Payback unknown until it has run a few weeks."

## R7: the doors

### An offer says what it delivers

| Key | Now | New |
|---|---|---|
| `dealer.usedLead` | Used trucks deliver today | Used trucks: delivered `{today / in n weeks}`. |
| `dealer.rowDelivery` | (none) | Delivers today · or · Ordered: arrives `{date}` |
| `dealer.newLead` | (none) | New trucks arrive in `{n}` days: the factory is behind on orders. **[economy: confirm the cause]** |
| `dealer.leaseRow` | Lease another truck: No money down… | Lease another truck · `{fd}` FD deposit · at least `{leaseMin}` FD a week |
| `finance.borrowRow` | Truck `{n}` · up to `{fd}` FD … (refused at that figure) | Truck `{n}` · borrow up to `{fd}` FD (only an amount the lender will give) |
| `finance.borrowNone` | (the row, then a refusal) | Truck `{n}` can't carry a loan: it's already borrowed against. |
| `finance.ltvLine` | Over the loan-to-value limit. | A loan can be at most `{equipmentFinance.maxLoanToValue}` of the truck's value. |

### A refusal names the amount, the condition and the date

| Key | String |
|---|---|
| `refuse.deposit` | Deposit `{fd}` FD: you have `{fd}`. |
| `refuse.yard` | Your yard holds `{n}` trucks: this order makes `{m}`. (shown before the order, never after) |
| `refuse.yardTrailer` | Your yard holds `{n}` trailers: this makes `{m}`. |
| `refuse.cash` | It costs `{fd}` FD: you have `{fd}`. |
| `refuse.until` | Not until `{date}`: `{reason}`. |

### A locked door says what opens it, and offers what can be done now

| Key | Where | String |
|---|---|---|
| `door.yard` | MORE YARD SPACE, before yards open | Yards open `{date}`. Until then, make room: park a truck, sell one, or lease one out. |
| `door.yardButtons` | its buttons | Park · Sell · Offer for lease |
| `door.yardShort` | MORE YARD SPACE, open but short of cash | A small yard costs `{fd}` FD plus a `{fd}` FD bond: you have `{fd}`. |

### Loans and rates on Money

| Key | Now | New |
|---|---|---|
| `money.loansOnOrder` | Loans: 76,156 FD owed · 959 a week | Loans: `{fd}` FD owed, for `{n}` trucks on order · `{fd}` FD a week |
| `money.rateLabelPurchase` | (an unlabelled rate) | Truck loan: `{rate}` a week |
| `money.rateLabelBorrow` | (an unlabelled rate) | Borrowed against a truck: `{rate}` a week |

## R9: the badge and the money lines

### The badge

| Key | String |
|---|---|
| `needs.badgeTitle` | Needs you: `{n}` |
| `needs.newTab` | (a dot, never a count) accessible name: New on `{tab}` |
| `needs.tired` | `{name}` has been out `{n}` days and is tired. · **Send home when idle** |
| `needs.tiredDone` | `{name}` heads home after this load. |
| `needs.hireBlocked` | A seat is empty: hiring `{name}` at `{fd}` a week needs `{fd}`. (the director's, kept) |
| `needs.truckDown` | Truck `{n}` is broken down at `{place}`: back on the road `{when}`. |
| `needs.rebuildDue` | Truck `{n}` is due a rebuild: `{pct}` condition. · **Rebuild · `{fd}` FD** |

### Money events, in the money style (above `{guard.newsFd}`)

| Key | Line | Why it happened (one line, tappable) |
|---|---|---|
| `news.breakdown` | Breakdown, truck `{n}`: −`{fd}` FD for the tow and repair. | `{why}` |
| `news.breakdownWhy.worn` | | Worn: `{pct}` condition. A rebuild would have reset it. |
| `news.breakdownWhy.pastRebuild` | | Past its last rebuild: it only wears from here. |
| `news.breakdownWhy.rain` | | In the rain: wet roads break more trucks. |
| `news.breakdownWhy.luck` | | Bad luck: even a sound truck breaks down sometimes. |
| `news.fine` | Ticket, truck `{n}`: −`{fd}` FD for stopping on the shoulder. | `{who}` chose the stop; no legal one was in reach before the hours ran out. |
| `news.fineWho` | | Your dispatcher · You |
| `news.writeOff` | Written off: −`{fd}` FD, `{what}`. | `{what}`: a shipper who never paid · a load lost in transit · a truck scrapped below its value |

## R10: the month report on Money

The button "Read the month" opens it. Two forms: a **card** at the top of Money for the week after the close, or a **sheet**.

| Key | Card form | Sheet form |
|---|---|---|
| `month.title` | `{Month}` closed | `{Month}`: the month's books |
| `month.earned` | Earned | the same |
| `month.spent` | Spent | the same |
| `month.kept` | Kept | the same |
| `month.where` | Where it went | the same |
| `month.whereRows` | Fuel · Wages · Insurance · Maintenance and repairs · Tolls and taxes · Fines · Fees and interest | the same |
| `month.held` | Held toward your truck | the same |
| `month.owed` | Owed to you at the close | the same |
| `month.cash` | Cash at the close | the same |
| `month.reconcile` | Kept is your cash's change, plus what's held, plus what you're now owed. | the same |
| `month.button` | Read the month | (on the caption line; it stays until tapped, R10) |

## Row 7: the contradictions

| Where | Now | New |
|---|---|---|
| Delivered card and feed, on quick pay | Paid Feb 5 | Paid today, less `{quickPayPct}`. |
| The same, under factoring | Paid Feb 5 | Paid today by the factor, less `{rate}`. |
| The same, on net terms | Paid Feb 5 | Due `{date}`. |
| Feed, an owned truck | `{fd}` FD yours after fuel, tolls and the lessor's cut | `{fd}` FD yours after fuel and tolls. (no lessor named on an owned truck: QA's B9) |
| Company, the fines row | Fines paid 0 FD | Fines and tickets paid · `{fd}` FD (engineering counts the tickets) |

## Small rows

| Row | Where | String |
|---|---|---|
| 8 | the start button, by choice | Start: owner-operator · Start: small fleet |
| 9 | hire toast | Hired `{name}`, `{fd}` FD a week. |
| 12 | a ticket's line | as `news.fine` above: it names who chose the stop |
| 15 | the Dealer's lead time | as `dealer.newLead` above |
| 16 | upgrades' explain entries | `mod.apu`, `mod.aero`, `mod.tires`, `mod.sleeper`: what it is (the `confirm.*` "what it does" line), how (its cut times this truck's spending), what moves it ("This truck's miles or nights away.") |
| 14 | the first-owned-truck milestone on a fleet start | no string: engineering fires it only for a company that started leased |
