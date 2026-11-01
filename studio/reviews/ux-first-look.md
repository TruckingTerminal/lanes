# UX first look (2026-11-01)

The UX designer, as a stranger on the test page (ruleset 0.19.1): owner-operator, Dallas, at 375×812, then
1440×900. Numbers are measured on the page.

## The three worst things for a new player on a phone

1. **The game screen is a desktop page stacked into one column.** The sticky top bar takes 246px of 812 and
   never scrolls away: logo, Menu, clock, four speed buttons, FD, Miles, a beta countdown, a 34-theme picker,
   Full screen. The first screen is 576px wide on a 375px phone, so Iuliia's lines are cut off at the right
   (the welcome strip sizes itself from `window.innerWidth` and locks in at 512px). Three of thirteen tabs show.
   The map hides behind a button called "⤡ Restore". At 1440 wide, thirteen tabs share 384px and their labels
   print over each other.

2. **The load board is unusable by thumb.** The first load is 1,688px down, under the walkthrough (887px), a
   200px painting and a six-field search form. Rows are 188px tall in a 690px table that scrolls sideways;
   break-even isn't on the row. The detail opens inside the table, clipped. Its big green button is "Book now ·
   1.85" on a load that loses 245 FD; Counter is grey.

3. **The game happens where you aren't looking.** Results reach only the ticker, at the bottom of a 6,876px page.
   I learned I'd lost my first bid there, in a line that contradicts itself ("Lost DAL→CLT… Your bid of
   2.39/mi is in for the next round"). Meanwhile the dispatcher ran three loads I never ordered, and the
   walkthrough ticked four steps itself, but not "bid on a load", which I did.

## The three cheapest fixes

1. **One 48px top row on the phone:** clock, FD, pause/play, the latest ticker line. Theme, Full screen,
   speeds, Miles and the countdown move into Menu. A "Map" tab replaces "⤡ Restore".
2. **Walkthrough collapsed to its Do line**, with "Iuliia says more" to open the rest; the welcome strip sized
   by CSS, not `innerWidth`. One component.
3. **Load board: Counter primary, Book now red when its profit is negative; on a phone, the painting and search
   form fold under one "Filters" button.** Three conditionals and a media query.

None touches a rule. Whether the dispatcher sits out the first round is the director's question.

## What I'd keep

- **The load detail:** break-even, profit at book-now and at your counter, "usually clears near", reload at
  the destination. It becomes the phone's load card.
- **Iuliia's voice and the Do/Why shape.** Only the length is wrong.
- **The bid toast** ("Bid in at 2.39/mi. It clears at 06:00 (in 10h)") and the delivery lines ("Delivered
  CMH→BUF: +2,611 FD, 1,497 after costs"). The feedback is written; it needs to be where the eyes are.
- **Find loads, nearest first, on the truck card.** The right first decision in one list.
- **The art,** on its own screens, not between a player and the board.
