# Replay of the player's row 1: the Explain sheet's card trap (QA, 2026-11-03)

This is the director's row 1 in `director-player1.md`, from the player's first diary. It is checked against `specs/guidance-ux.md` §3, "The explain sheet, phone".

**Build:** "Deploy 0ab3ec4 from lanes" (Pages built, waited 60 s), on the public test page.

**Setup:**
- Phone 375×812, built-in browser.
- Console: no errors.
- **World played:** Harbor Gate Transport (small fleet, Los Angeles), continued at day 10 (Wed Jan 10 06:00) and paused throughout.
- Sheets used: Truck 1's "owned · worth 93,249 FD" on the Truck tab, and "Cushion: 1.1 weeks of your own spending" on Money.
- Positions are measured in the page; the nav's top edge is at 756 px.
- Screenshots are in `qa-replay-player1-row1/`.

**Result:** the trap is gone. Every one of the five ways out works, and so do Back and Escape. The sheet never follows to another tab, and its foot sits on the nav and stays on screen. Three things are off the spec: the height, the × on long labels, and What now?.

Severity: **R** blocks the republish · **S** this sprint · **L** later.

| Row | Result | Evidence | Sev |
|---|---|---|---|
| The sheet stands on the nav, not under or over it | **Pass** | Sheet 194–756, nav 756–812. The nav stays visible and tappable ([01](qa-replay-player1-row1/01-worth-sheet-on-the-nav.jpg)) | – |
| The foot (What now?, Close) is pinned and never scrolls away | **Pass** | Foot 700–756 on both sheets. On Cushion the middle scrolled to its end (31.5 of 32 px) and the foot didn't move ([04](qa-replay-player1-row1/04-cushion-body-scrolled-foot-held.jpg)) | – |
| At most 60% of the screen height | **Fail** | Worth: 563 px, 69%. Cushion: 592 px, 73%. 60% of 812 is 487 px | S |
| The tapped figure stays visible, with a 2 px outline | **Pass** | "worth 93,249 FD" sits above the sheet in its outline. Cushion's figure is at 82–126 px with a solid 2 px outline. (One screenshot caught the panel mid-scroll, [03](qa-replay-player1-row1/03-cushion-sheet-x-wrapped.jpg)) | – |
| 1. **Close** in the foot | **Pass** | Closes it, and removes the history entry it added (`history.state` goes back to null) | – |
| 2. The **×** in the header, 44 px, top right | **Pass, with a layout fault** | Closes it, and it is 44×44. On Cushion the long label wraps, and the × drops to its own line at the **left** (x 16, y 336), under the title ([03](qa-replay-player1-row1/03-cushion-sheet-x-wrapped.jpg)). On Worth it is top right | S |
| 3. A tap outside closes it and does nothing else | **Pass** | A tap on the truck card's text closes it. The page's length and scroll are unchanged (1243 / 729 before and after) ([02](qa-replay-player1-row1/02-after-tap-outside.jpg)). A tap on the outlined figure itself only closes; it doesn't reopen | – |
| 4. A swipe down on the header or the grab bar | **Pass on touch** | The grab bar is there (36×4 px, top centre). A touch swipe (pointer events of type touch) closes it, both on the header and on the bar. A **mouse** drag in the same places doesn't. On a phone only touch matters; on a laptop, Esc and a click outside cover it | – |
| 5. A tab change: the sheet doesn't follow | **Pass** | With it open on Truck, a tap on Loads opened Loads with no sheet ([05](qa-replay-player1-row1/05-tab-change-to-loads.jpg)). With Cushion open on Money, a tap on Truck opened Truck with no sheet ([06](qa-replay-player1-row1/06-tab-change-money-to-truck.jpg)). Nothing came back on returning | – |
| The phone's Back | **Pass** | The sheet pushes `{explain: true}`. Back closes it and stays in the game, on the same URL | – |
| Escape | **Pass** | Closes it | – |
| **What now?** answers in the foot, and the sheet stays | **Fail** | A tap on What now? **closed the sheet**. The answer went to the caption instead, and it was the walkthrough's current step ("Step 6 of 13 · Compare revenue against costs on Money…"), not something about the figure ([07](qa-replay-player1-row1/07-after-what-now.jpg)) | S |

## Also seen

- **L:** while an Explain sheet is open, the lower panel expands to full height and covers the map. It goes back down when the sheet closes.
- I didn't test the Finance, brokerage and Move money confirm sheets ("the same rules hold for every sheet"). The brokerage ones are switched off on the public page. On my flagged brokerage build the Tender to {carrier} step was an inline form on the card, not a sheet, so there was nothing there to close five ways.
