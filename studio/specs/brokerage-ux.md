# Brokerage (UX spec, draft 0, 2026-11-02; owner: UX)

Sprint 2, item 3. Jeff, 2026-11-02: a brokerage is its own company, separate from the carrier, and a player has at
most one of each. This draft covers what doesn't wait for the sizing: two companies under one login, the
brokerage's four-item bar, the forming flow at day 91, and Intel with two rows. Everything marked **[rule]** waits
for the director's `specs/brokerage-rule.md` and the economy's sizing; numbers are config keys. Strings are the
writer's placeholders.

## 1. Two companies, one login

**One company in view at a time.** Every screen (bar, sheet, map overlays, Money, the needs list) is the company
in view. The client's `S.game.player` becomes the company in view; the login holds up to two.

**The switch lives in the top strip,** at its left edge, because it must be one tap from every screen and the bar
holds four items, no fifth. It appears only once the player has two companies.
- **Phone:** a 36 px chip before the clock: the company's kind icon (a truck for the carrier, a handshake for
  the brokerage) inside a ring in the company's colour (carrier cyan, brokerage amber; art picks the two).
- **Laptop:** the same chip with the company's name beside it ("Red River Lines ▾").
- **Tap:** a small sheet, two rows, one per company: icon, name, cash, its needs count. Tapping the other row
  switches; the current row is marked "In view". No confirm: switching changes nothing in the world.

**How the screen says which company you're in,** three ways at once, none needing a legend:
1. the chip;
2. the top strip's bottom edge, a 3 px line in the company's colour;
3. the sheet's state line starts with the company's name: "Red River Logistics · 3 loads posted".

**What stays shared:** the clock, the map, Iuliia, Help, Intel, the ≡ menu.

**The needs dot counts both companies.** Each row in its list starts with the company's icon; tapping a row for
the other company switches first, then opens it.

**The map shows both, whichever is in view:** the carrier's trucks in cyan as today, the brokerage's open
postings as amber pins at their origin, and a brokered load in motion as an amber dashed lane under whoever hauls
it. Tapping an amber pin switches to the brokerage and opens that load's card.

**Feed lines** carry the company's icon. The laptop ticker shows both.

## 2. The brokerage's bar

Four items, same places as the carrier's, so the thumb learns one bar: **Book · Carriers · Money · More**.

### Book (the carrier's Loads slot)
The brokerage's loads, one card each, grouped by stage, in this order:
1. **Offered to you** **[rule: whether tenders arrive for a hand decision]**: lane, trailer, "Shipper pays 3,100
   FD", "You'd post at 2,790 (your 10% margin)", "Board fee 93". Actions, if the rule gives a hand call: **Post
   it** · **Pass**.
2. **On the board:** "Posted at 2.58/mi · clears 18:00 · in 5 h", a ring to the round. **[rule: re-price]**
3. **Moving:** "Taken by Prairie Haul at 2.52/mi · picked up Jan 9".
4. **Delivered, waiting for pay:** "Shipper pays you Feb 8 · you pay Prairie Haul Feb 8".

**The card:** line 1 the lane; line 2 "Shipper 3,100 · carrier 2,720 · fee 93 · **yours 287 FD**" (the margin
last and bold, red when below zero); a six-dot trail under it: Tendered · Posted · Taken · Picked up · Delivered ·
Paid, the current dot filled. Tapping opens the load sheet: the trail with a date on each stage, the carrier's
name (a link to its Intel card), the shipper's due day, the carrier's due day, and the fall-off charge if it
happens ("Nobody took it: you paid the shipper `{brokerRisk.fallOffShare}` of the contract, 465 FD").

**Header:** "Red River Logistics · 6 loads · 1,740 FD margin this month". **Empty:** "No loads yet. Shippers
offer tenders to brokers every round; yours start at 06:00."

### Carriers
- **"Who may haul your loads":** Open · Standard · Strict, a three-way control, one line under each saying what
  it asks: "Any carrier" · "`{vetting.standard.minAuthorityDays}` days of authority" · "`{vetting.strict.minAuthorityDays}`
  days and `{vetting.strict.minDelivered}` loads delivered". Tighter means safer and slower to fill.
- **"Carriers who've hauled for you":** a list, one row each: name, loads hauled for you, on time %, each a link to
  Intel. The player's own carrier, if it has hauled, carries a "Yours" chip. **[rule: self-dealing]**
- **"Your standing order"** **[rule: its fields]**: margin %, cap on open loads; the economy's defaults.

### Money (the brokerage's own ledger)
In this order:
1. "Cash", with the sparkline.
2. "Owed to you": shippers' invoices, lane and "brokered", due day. One line under the list: "About 1 load in 50
   is never paid, more in a slump." (`{brokerRisk.defaultRate}`).
3. **"Owed by you"** (new): what the brokerage owes carriers, lane, carrier, due day; above the list the bond meter:
   "41,000 of your 75,000 FD bond in use" (`{permits.brokerBondFd}`), amber past 80%, red at 100% with "New
   tenders pass you by until this falls."
4. "This month": margin, defaults, fall-off charges, surety premium, licence fee, each a row, the net last.
5. Link rows: "Getting paid: Net 30 ›" and the rest of Finance (the broker variant in `specs/finance.md`).

### More
The same More as the carrier's: Iuliia, Help, Company (the brokerage's own books), Intel, teasers.

## 3. Forming the brokerage at day 91

**Before day 91:** the teaser in More (as built), its action "See what brokers earned last month" (Intel,
brokers, sorted by last month). **Seven days before**, one card on the carrier's Truck tab, once:
"Brokerage opens Apr 2" and three rows, the player's own figures: "Bond: 75,000 FD, locked while you broker" ·
"Licence: 300 FD a season" (`{permits.brokerLicenseRenewalFd}`) · "Surety: 2,250 FD a year at credit C"
(`{permits.suretyPctPerYear}` by band). **See what brokers earn** · **Dismiss**.

**On day 91** the teaser becomes **Form a brokerage**: a four-step sheet (full on a phone, the panel on a laptop),
a step counter "1 of 4" at the top, **Back** and **Next** at the foot.

1. **Name it.** "Brokerage name" (default "{carrier's name} Logistics", 32 characters); "Home hub" **[rule:
   any hub, or the carrier's]**.
2. **The licence.** The three costs as rows with the player's figures, then two sentences: "The bond is locked as
   a stake. If you can't pay a carrier, the bond does, and you can never owe carriers more than it." and "Fall
   under it and you have `{staking.graceDays}` days before your loads stop."
3. **Fund it** **[rule: where the brokerage's first cash and bond come from]**. The sheet shows the source, the
   amount moving, and both companies' cash after it.
4. **Your terms.** Margin, cap on open loads, who may haul (as on Carriers). Defaults filled.

**Confirm:** a summary of the four steps and **Form Red River Logistics**. Live world: "Sent · in effect 06:02".
Once formed, the app switches into the brokerage; the chip appears; Book shows its empty state; Iuliia says one
line, once.

**Short of the bond:** the sheet still opens. Step 2 shows "You're 31,000 FD short" in red under the bond row,
**Next** is disabled with that reason beside it, and one link: "What brokers earned last month ›". No dead tap.

**After forming,** More's brokerage entry becomes "Red River Logistics ›" (switches). A second brokerage can't be
formed; nothing offers one.

## 4. Intel with two rows

The two companies are two rows and two cards, each with its own Miles, size, bands and month.
- Both carry the "Player" chip. **Proposal [rule]:** both cards also say "Same owner as Red River Lines", with a
  link. Hiding it lets a player's carrier haul its own brokerage's loads where nobody can see; showing it lets the
  market price it. The director's brief decides.
- **Pinned rows:** "How others see you" pins both, the company in view first, each with its kind chip.
- The brokerage's row reads as any broker's: "Dallas · broker · credit B".

## 5. Iuliia

One line each, the writer's, under the placement rule: the seven-day card's first showing; forming; the first
switch between companies. None on a refusal, a default or a fall-off.

## Waiting on `brokerage-rule.md`

1. Where the brokerage's first cash and bond come from, and whether cash can move between the two companies.
2. Self-dealing: may the player's carrier (or its dispatcher) take its own brokerage's postings?
3. Whether Intel names the shared owner.
4. Hand work: take or pass a tender; re-price a posting before it falls off.
5. The brokerage's home hub, and the standing order's fields and defaults.
6. The board fee's key (3% today; I couldn't find it in config by name).
