# Copy: the first player diary's writer rows (writer, draft 1, 2026-11-03; against `reviews/director-player1.md`)

The strings for R3 and every finding row the director gave the writer. Each names where it goes (the `copy.ts` key or the file and line), the current text, and the new string. `{key}` is config; `{x}` is a value from the world. Plain on money and risk; no string over 20 words. The explain entries and the three new milestones are in `guidance-strings.md`.

## R3: Security, not theft

"Theft risk" becomes **Security**, banded, on every screen. It is a cost the player bears, said plainly, with no crime spectacle.

**The bands**, from `hubTheftRisk` (a multiple of a quiet road). The cut-offs are the economy's to confirm **[size]**; proposed: under 1.2 Quiet, 1.2 to 2 Watch, 2 and over High.

| Band | Card line |
|---|---|
| Quiet | Security: quiet |
| Watch | Security: watch. Cargo goes missing here more than on quiet roads. |
| High | Security: high. Cargo goes missing here often; insurers and some shippers notice. |

| Where | Now | New |
|---|---|---|
| Hub card, `HUB_CARD.theft` | Cargo theft: `{times}` a quiet road's | Security: `{quiet / watch / high}` (shown on every card, quiet included) |
| Rates table, column header (`Rates.tsx:70`) | Theft | Security |
| Rates table, cell | `{x}`× / – | Quiet · Watch · High |
| Business, site row (`Business.tsx:74`) | Theft risk · `{x}`× a quiet road | Security · `{band}` |
| Business, a business's rows (`:228`, `:229`) | Theft risk here · Theft risk at the hub | Security here · Security at the hub |
| Map tooltip, where it names theft | | Security: `{band}` |

The explain entry `market.security` is in `guidance-strings.md`.

## R3: the Economy page

| Where | Now | New |
|---|---|---|
| Economy lead (`Economy.tsx:75`) | Every FD the game pays out and takes back over the last 30 days, the way EVE Online's economists publish theirs each month. Everyone sees the same page. | Every FD the game paid out and took back in the last `{days}` days: the world's own books, published monthly. Everyone sees the same page. |
| Economy rows (`:166` and its neighbour) | Cargo stolen · Channel 19 | Removed from the player's page; to the studio dashboard until the Back Lot opens. |

## Row 2: the hold toward your own truck

`{holdPct}` is `freeEntry.leases.byValue.escrowShareOfPay`; `{depositPct}` is `.depositShare` (the hold stops when the deposit reaches that share of the truck's value). The economy confirms both, and why the diary saw 25% once.

| Where | New |
|---|---|
| Profit chip, a leased truck | +`{profit}` · `{lands}` to you · `{held}` held toward your truck |
| Profit chip, once the deposit is full | +`{profit}` · all of it to you |
| Money, a line under Cash (`DELIVERED.held`'s neighbour) | Held toward your truck · `{fd}` FD in all |
| Its note, first visit | `{holdPct}` of each leased load is kept for you until you buy. It counts in full then. |
| Delivered card row (`DELIVERED.held`) | Held toward your own truck (kept) |
| Step 4, `brief` | Delivered, and paid today. Money shows the lessor's share and the `{holdPct}` held toward your own truck. |
| Step 4, full text, second paragraph | "The lease also holds a little back" becomes "The lease also holds `{holdPct}` of each load back" |

## Row 5: your pay for driving

The economy says where an owner-driver's pay goes **[economy]**. Two forms, one ships:

| Where | If it leaves company cash to you | If it stays in company cash |
|---|---|---|
| Pay row label, `DELIVERED.driverOwner` | Your wage, paid to you | Your wage (kept in the company) |
| Its explain line (`pay.ownerPay`) | Paid to you as the driver, outside company cash, like any driver's wage. | Counted as a cost, but the money stays in your company's cash. |

## Row 12: a late delivery says why

| Where | New |
|---|---|
| Delivered card, late chip's line | Late `{h}` h: `{cause}`. |
| `{cause}` | the driver's hours ran out · the dock was closed until `{day hh:mm}` · weather on the route · a late pickup (the director's four, `guidance.md` section 4) |
| Truck card, waiting at a closed dock | The dock opens `{Monday 06:00}`. |

## Row 13: the market story when rates jump

Replaces the feed line that names "the Cass dial" and its number (`main.tsx:494`).

| Where | New |
|---|---|
| Feed, a boom begins | Freight is booming across the country. Rates are climbing; book what pays. |
| Feed, a slump begins | Freight is slumping across the country. Expect thin boards and lower rates for a while. |
| Feed, back to normal | Freight is back to normal across the country. |
| Company, the row's label (`Company.tsx:60`) | Freight demand, country-wide (was "Freight demand (Cass dial)") |
| Help, the market page (`guide/market.ts:129`) | "National freight demand follows a Cass-style cycle" becomes "National freight demand runs in cycles, as it does in the real freight market" |

## Row 18: what FD is

| Where | New |
|---|---|
| First entry, under the arrival line (`ARRIVAL.fd`) | FD is the game's money: you earn it hauling and spend it running trucks. |

## Row 26: unexplained terms

| Where | Now | New |
|---|---|---|
| Company, home market (`Company.tsx:242`) | Local edge · +`{x}` bid-score points on loads within `{mi}` mi of home | Local edge · your bids rank higher on loads within `{mi}` mi of home (explain key `company.localEdge` for the figure) |
| Load card, vetting chip | Vetting open | Open vetting: any carrier |
| On time, before any delivery | On time — | On time: no deliveries yet |
| Iuliia, a ringed hub card (`copy.ts:567`) | A good place to start this month. Read the costs before the character. | A good place to start this month. Read what it costs to live here, too. |

## Rows 27, 28 and 30

| Where | Now | New |
|---|---|---|
| `ROLLING.tonightShoulder` | Tonight, as planned: the shoulder. Nowhere legal to stop in reach. | No legal stop in reach: the shoulder tonight. (the director's) |
| Help, `guide/safety.ts:39` | Fix them from the Fleet tab | Fix them from the Truck tab |
| Help, `guide/operations.ts:32` | Set them at the bottom of the Fleet tab. | Set them under Dispatcher, on the Truck tab. |
| Help, the starting cash | the grant from config, which reads 5,000 against 4,700 on screen | engineering finds the 300; Help then states the figure the player sees, from config |
| Help, the controls table, a phone | Space, 1–3 · Pause and set the speed | Tap the speed button: pause, or step the speed up or down |
| Plurals and numbers | 1 days · 1470 | 1 day · 1,470 (engineering's formatter) |
