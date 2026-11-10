# The hand-over word, and buying a listing while the lease runs (director, 2026-11-10)

## 1. "Ready" stands
It is the honest word: the date is the earliest the truck can change hands, not a promise that it will. e14a746
stands as committed. One addition for the writer: once the date has passed and the truck is still waiting, the line
says why, so the player is never left guessing.
- Before the date: "ready Mar 8"
- After the date, still waiting: "ready since Mar 8 · handed over when truck 1 next stands idle"

The same word and the same pair of lines on the lot rows, the first-truck card and the ordered line.

## 2. Yes: a listing can be bought while the lease runs, handed over at the next idle
Out there you buy a truck the day you find it, and you collect it when you're free. A rule whose window is minutes
long when the dispatcher is on is a rule the player can't use, and that makes it false in practice. An order already
works this way under swapAtNextIdle; a listing should match it. Behind a switch, in a later ruleset. The economy
sizes anything that moves money.

**The guards:**
- **The sale is at once.** The money is taken and the listing comes off the market when the player presses Buy.
  The truck is the buyer's from that moment: in their books, and ranked as their asset in a liquidation.
- **A player seller is paid at the sale,** as they would be today. Their truck leaves their fleet at once and can't
  be booked by them.
- **No cancelling.** A bought truck is bought (pillar 2: every order stands).
- **Meanwhile, the truck stands where it was listed.** It runs no loads. Any carrying cost while it waits
  (insurance, parking) is the economy's to size, never zero by accident.
- **The hand-over follows today's idle-purchase rule for place and paperwork,** only later. If today's rule moves a
  truck it shouldn't, that's a separate pre-existing question; flag it, don't fix it here.
- **The lessor's cut runs until the hand-over,** and ends at it.
- **The dispatcher books no new load for the leased truck once a hand-over is pending.** Whatever is already
  booked, including a load booked ahead under windows, is run first; then the swap happens.
- **What the listing shows to others:** "Sold", nothing more (no buyer's name).
- **The buyer's card shows:** "Bought · ready when truck 1 is idle · it delivers at Atlanta Tue 14:00"; What now?
  counts it.
- **Bots:** the same rule.
