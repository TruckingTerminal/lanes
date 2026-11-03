# Copy: the third player diary's writer rows (writer, draft 1, 2026-11-03; against `reviews/director-player3.md`)

Strings for R14, R15, R13's "show now" half, and rows 11, 12, 14, 15 and 16. R11's boom and slump announcements and R12's hours lines wait until the economy sizes them. Keys are proposed in `copy.ts` style; engineering names the final ones. `{key}` is config; `{x}` is a value the engine computes. Plain on money throughout; no string over 20 words.

## R14: the profit chip, one pair everywhere

The hold is the player's own money, held toward his truck: saving, not loss. So the chip never says "to you".

| Key | Where | String |
|---|---|---|
| `chip.full` | laptop, a load that holds | +`{profit}` · cash `{cash}` · held `{held}` |
| `chip.short` | phone (never wraps) | +`{profit}` · cash `{cash}` |
| `chip.noHold` | an owned truck, or the deposit full | +`{profit}` (cash equals profit, so the pair collapses) |
| `chip.loss` | profit below zero | −`{loss}` · cash −`{fd}` |
| `chip.a11y` | the chip's accessible name | Profit `{profit}` FD. Cash `{cash}` FD now. `{held}` FD held toward your truck. |
| `sheet.heldRow` | the load's sheet, under The money | Held toward your truck · `{held}` FD (explain key `money.held`) |

**Colour** follows the profit (green above zero, red below). The cash figure alone turns amber when it is negative: the cash dips, the load still earns.

| Key | Where | String |
|---|---|---|
| `book.withChip` | Book now, with the chip on the same card | Book now · `{rate}`/mi · +`{profit}` |
| `book.alone` | Book now, with no chip beside it | Book now · `{rate}`/mi · +`{profit}`, cash `{cash}` |
| `bid.withChip` · `bid.alone` | Bid, the same two forms | Bid · +`{profit}` · Bid · +`{profit}`, cash `{cash}` |
| `now.idle.reasonHeld` | What now? rule 3, when the hold makes cash differ (cash below zero) | `{profit}` over break-even: `{cash}` out of cash now, `{held}` toward your truck. |
| `now.idle.reasonHeldPlus` | the same, cash above zero | `{profit}` over break-even: `{cash}` to cash now, `{held}` toward your truck. |

The two What now? forms replace `now.idle.reason` in `guidance-strings.md` whenever a hold applies.

## R15: the hold explains itself when it changes

`{depositPct}` is `freeEntry.leases.byValue.depositShare`; `{holdPct}` is `.escrowShareOfPay`.

| Key | When | String |
|---|---|---|
| `hold.full` | the deposit reaches its target; the hold stops | Your deposit is full at `{fd}` FD. The hold stops: every load pays you in full now. |
| `hold.topUp` | the last load tops up less than the full share | This load filled your deposit: `{fd}` FD held, not the usual `{holdPct}`. |
| `hold.again` | the target rises, so the hold starts again **[engineering: if the rule can do this]** | The hold is back: your target truck now costs `{fd}` FD, so the deposit needs `{fd}` more. |
| `gap.whyPriceRose` | the next-truck gap grew because the price rose | The cheapest truck's price rose to `{fd}` FD this month. |

The two gap lines from diary 1, row 4 (the cheapest truck changed; the first week closed) stay as written in `copy-player1.md`.

## Your draw, and the hold (the economy's section 5, diary 1 row 5, diary 3 row 6)

**Your draw.** The owner-driver's `{labor.owner.driverPayPerMile}` FD a mile stays, named for what it is: the living the owner takes out of the business. It must never read as pay that will arrive.

| Key | Where | String |
|---|---|---|
| `money.draw` | Money, This week's costs | Your draw · `{fd}` FD: what you take home to live on |
| `DELIVERED.driverOwner` | the delivered card's row | Your draw · −`{fd}` FD |
| explain `pay.ownerDraw`, what | | Your draw: the living you take out of the business for driving. |
| explain `pay.ownerDraw`, how | | `{labor.owner.driverPayPerMile}` FD for each mile you drive, taken out of each load like a wage. |
| explain `pay.ownerDraw`, moves | | The miles you drive yourself. It leaves the business; nothing arrives later. |

A hired driver's row stays "Driver's pay · `{name}`".

**The hold** stays at `{holdPct}` of each leased load (the economy keeps 30% for this restart). Every line about it says, in one breath, that it is the player's own money, counted in full, and why it is a share of each load.

| Key | Where | String |
|---|---|---|
| Money's held line, note | first visit (`copy-player1.md`, row 2) | Your own money: `{holdPct}` of each leased load, so you never pay the deposit as a lump. It counts in full when you buy. |
| explain `money.held`, what | | Your own money, held toward your truck: a share of each leased load, not a fee. |
| explain `money.held`, moves | | Every leased load adds to it until the deposit is full. It counts in full when you buy. |

## R13, show now: the paperwork

| Key | Where | String |
|---|---|---|
| `load.weight` | load card line 2, and the sheet's Route group | `{lb}` lb (thousands separated: "42,000 lb") |
| `load.line2` | load card line 2, in full | `{total}` FD · `{rate}`/mi · `{lb}` lb · `{mi}` mi empty to pickup |
| `load.deliverBy` | everywhere a deliver-by shows | Deliver by `{Jan 7}`, `{08:00}` (rounded to the dock's hours: the hour it opens or the hour it closes) |
| `load.deliverByAllDay` | a dock open all day | Deliver by `{Jan 7}`, any hour |
| `load.empty` | the one deadhead label, on the board, the sheet and the hub board | `{mi}` mi empty to pickup |
| `load.emptyColumn` | the table's column header | Empty to pickup |
| `place.name` | every town in every list | `{Town}`, `{ST}` ("Louisville, KY"; never a code or a neighbourhood alone) |
| `place.within` | a place inside a bigger city, if the data has one | `{Place}` (`{City}`), `{ST}` ("Newburg (Louisville), KY") |

**Commodities, until hazmat exists (R13):** "Chemicals and plastics" becomes **"Plastics and resins"**. No other commodity name implies hazmat.

## Row 12: the dock, and live loads

| Key | Where | String |
|---|---|---|
| `truck.waitDock` | truck card, at a closed dock | Waiting at `{place}`: the dock opens `{Monday 06:00}`. |
| `truck.waitWeekend` | the same, over a weekend | Waiting at `{place}` for the weekend: the dock opens `{Monday 06:00}`. |
| `truck.liveLoad` | truck card, a live load | Loading at `{place}`: a live load, about `{h}` h. Done around `{hh:mm}`. |
| `truck.liveUnload` | truck card, a live unload | Unloading at `{place}`: about `{h}` h. Done around `{hh:mm}`. |

Detention pay is R13's rule change for sprint 4; its line waits for the economy's `{detention.freeHours}`.

## Row 11: the ETA badge reads Late only against the deliver-by

| Key | When | String |
|---|---|---|
| `eta.spare` | the ETA is before the deliver-by by an hour or more | ETA `{Jan 18 10:43}` · `{h}` h to spare |
| `eta.onTime` | within the hour | ETA `{Jan 18 10:43}` · on time |
| `eta.late` | the ETA is after the deliver-by, and only then | ETA `{Jan 18 10:43}` · Late `{h}` h |

The ETA includes planned rest and dock hours (diary 1, row 12), so a planning estimate never shows as "Late".

## Row 14: what Miles count

Replaces `standing.miles` in `guidance-strings.md`.

| Key | What it is | How it's computed | What moves it |
|---|---|---|---|
| `standing.miles` | Your standing in the beta: loaded miles on loads you delivered. | Each delivered load's loaded miles. Empty miles and loads still on the road don't count. | Delivering loaded. Your odometer also counts empty miles, so it reads higher. |

## Rows 15 and 16: unexplained terms, and two untrue lines

| Key | Where | String |
|---|---|---|
| explain `board.posterScore` | a broker's "Score" | What it is: the poster's record of paying carriers on time. Moves with: its payments. |
| explain `board.vetting` | "strict vetting" on a load | What it is: what a poster asks of a carrier before it loads them: Open, Standard or Strict. |
| explain `board.reload` | the reload figures on the sheet | What it is: how easily a truck finds its next load at the destination. Higher is easier. |
| `load.waiting` | "Raised · 1 round running" | On the board `{n}` rounds · book-now rises each round it waits |
| `feed.booked` | "Won … your bid" for a book-now | Booked at book-now: `{origin}` to `{dest}`, `{miles}` mi at `{rate}`/mi. |
| step 5, `say[0]` opening | "Your truck is at the far end of the country" | Your truck is `{mi}` miles from home with an empty trailer. |

## The board batch (engineering, after R11's anchor and R16)

| Key | Where | String | Kept or changed |
|---|---|---|---|
| `bidAtClears` | the Dispatcher's bid rule | Bid at what loads usually clear near, plus `[ ]` % | changed: "loads", so it matches the board's "usually clears near" |
| `poachLate` | the hiring row, an offer past its deadline | Offer pending · past its deadline: they answer at the day's close, once their truck stops. | changed: "answer", since "move" read as a relocation |
| `hub.marketBoom` | the hub card, after the season line, while a boom runs | Freight is booming across the country. | the row 13 feed line, unchanged |
| `hub.marketSlump` | the same, a slump | Freight is slumping across the country. | the same |
| (normal) | the same, no boom or slump | (no line) | |

