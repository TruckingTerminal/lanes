# Coming back (UX spec, draft 1, 2026-11-03; owner: UX)

From the return sitting (`playtests/play-2026-11-02-returning.md`, phone, 11 screenshots) and the director's
triage (`reviews/director-player5.md`, R21–R25). The director owns the rules; this places them, phone first.
Strings are the writer's placeholders; `{}` keys from config; figures from the diary. Sheets follow
`guidance-ux.md` §3 (standing on the nav, pinned foot, five ways out); buttons follow `player2-ux.md` R20 (every
button answers under itself).

## 1. The Continue screen (R25)

- **The button:** "Continue · Steady Buckeye Haul · Fri Feb 2", the game's date in the form the top strip uses.
  No "Day 33".
- **The tap answers at once.** Within 100 ms the button becomes a progress bar in the same place, the same size:
  "Loading your world… 42%", the replay's share done; indeterminate stripes until the first share is known. The
  title loop keeps running behind it. The three dead seconds the diary timed are engineering's to remove; the bar
  covers whatever remains.
- **No determinism wording** on screen ("Replaying its history in this browser" goes); Help explains it to whoever
  asks.
- **Failure:** the bar becomes "Couldn't load it · Try again", in place.

## 2. The return card (R21)

**When:** the world opens after `{guide.returnHours}` (8) real hours since this browser's last visit (kept per
browser, a convenience). It fires on every such return.

**Where: Iuliia's caption, at the top of the Truck tab.** Not the Continue screen (its job is loading, and the card
needs the loaded world), and not over the map (an overlay covers the map the card talks about). On a phone the app
opens on Truck with the sheet at **half**, scrolled to the top, whatever height it was left at, so the card is the
first thing under the state line. In the caption's order (`guidance-ux.md` §1) it sits just below an asked answer:
it's the one line allowed to replace a walkthrough line. On the laptop it's the caption under the tabs.

**What it holds,** her 96 px portrait beside a header and up to five rows, each only where it applies:

| # | Row | Example |
|---|---|---|
| – | Header | "Welcome back. Fri Feb 2, 17:00." |
| 1 | Where the truck is | "Truck 1 · Jacksonville, FL · 894 mi from home" |
| 2 | What it's doing and why | "Idle 13 h: every load in reach needs 90 days' authority; yours reaches it Apr 3." / "Loaded to Dallas, TX · ETA Sat 14:00" |
| 3 | While you were away | live: "3 loads delivered · +6,240 FD in · 1,180 out · 1 breakdown ›" (opens Today) · test page: "Nothing moved while you were away." |
| 4 | A month that closed | "January closed: kept 25,473 FD · Read the month ›" (`player2-ux.md` R10) |
| 5 | What now?'s top action | the action and its reason, then its button and **Not now**, as What now? answers (`guidance-ux.md` §2) |

**Two or more trucks:** rows 1 and 2 per truck, up to three, then "and 4 more on Truck ›". The trucks are ordered
the way the badge ranks them (`player2-ux.md` R9): the one with most at stake first.

**It goes away** when the player taps row 5's button (its action runs), taps **Not now** or the card's **×**, or
leaves the Truck tab (R10's rule for a line with a button). It never rotates out on a timer. Afterwards it's in
More › Iuliia's timeline as "Back Fri Feb 2", where a tap reopens it as it was.

**At strip height** (if the player drops the sheet while it shows): the 44 px caption row reads "Back · Truck 1
idle at Jacksonville" with the What now? chip; a tap raises the sheet to half.

## 3. A price on every move (R24)

**Which buttons:** Send home, Send empty (to a hub), Reposition, and their rows in the truck card's ⋯ menu.

**Phone (< 900 px): the label on the button, the price on a line under it.** "Home · 894 mi empty · about 1,425 FD ·
2 days" is about 44 characters, which can't sit on a 343 px button in the button type without wrapping. So:
- the button: **Send home** (or **Send to Dallas**, **Reposition**);
- under it, muted, one line, never wrapping: "894 mi empty · about 1,425 FD · 2 days". If it can't fit, "empty" goes
  first, then "about"; the FD figure and the days never go.
- Send empty's line changes with the hub picked in its select, before the press.

**Laptop:** the whole thing on the button: "Send home · 894 mi empty · about 1,425 FD · 2 days".

**The figure** is an explain key (`move.cost`): fuel, the driver's pay and tolls over the empty miles, the same
per-mile parts as break-even, so the two can't disagree. Above R6's threshold the confirm card follows the press;
below it, the price line is the guardrail.

## 4. The wall, where it's hit (R22)

**On the board,** a load the company can't take shows **one** refusal chip, the first the engine would give in its
own order (`vettingBlock` before `mayTake`), never two and never a lesser one. A time-gated wall carries its date:
"Needs 90 days' authority · Apr 3". When every load in reach fails the same wall, one line sits under the board's
header, above the cards: "Every load here needs 90 days' authority (yours: Apr 3). **Ways out ›**"

**In Needs you,** the moment a truck goes idle with nothing it may take (not a day later):
- line: "Truck 1 can't take a load at Jacksonville: vetting until Apr 3";
- button: **Ways out**, ranked by R9 (what idling costs a day).

**The Ways out sheet** (What now?'s rule 3b in full, `guide.ts`'s "ways out", pending the director's word to
Jeff): a phone sheet with the wall's line at the top, then each way as a row with its price and its button, the
cheapest first and marked:
- "Wait here · about 140 FD a day · vetting opens Apr 3" · **Wait**
- "Run home · 894 mi empty · about 1,425 FD · 2 days" · **Send home**
- "Reposition to Atlanta, GA · 346 mi empty · about 560 FD · its best load leaves +1,210" · **Send to Atlanta**
- "Take the best load here · loses 1,142 · leaves you in Des Moines, IA" · **See the load**

Every figure is an explain key; each button follows R20 (it answers under itself) and R6 when over its threshold.

**The idle card** on the Truck tab carries the same line and **Ways out** button, and no longer arrives as a toast.

## 5. Pause on a phone, and the ticker

**Pause.** The ruling is already in `first-ten-minutes.md` (Layout): a **Pause/Play** button (44 px, one tap always
stops or starts) beside a **speed** button that opens a four-row menu; nothing cycles through Paused. It isn't built
yet, and this is the third diary to hit it ("To pause I had to tap through Day in 6 s and Day in 2 s"). I'd rank it
with R21 in the next build. On a return the world opens paused with ▶ showing.

**The ticker's phone form: no ticker.** A scrolling line at phone size is unreadable and moves under the thumb. Its
job goes to two things already on screen:
- **the sheet's state line:** when something happens (a delivery, a win or loss, a money event over
  `{guard.newsFd}`), the state line shows it for 6 s in the money style ("Delivered Dallas, TX · +2,593 FD"), then
  returns to the truck's state. Two in a row queue; never two at once.
- **a count chip** at the state line's right end, "+3", for events since the player last opened Today; a tap opens
  the Truck tab's **Today** list, newest first, which reads from the world's history (R25), not this browser's.

Events never arrive as toasts (`player2-ux.md` R20); toasts stay only for the connection.

## Questions

1. **Engineering:** the last-visit time per browser; "what changed since" for row 3; the replay's progress share
   for the bar; the Ways out figures (pending R23).
2. **Writer:** the return card's lines, the price line's words, the wall lines with dates, the Ways out rows.
3. **Config:** `{guide.returnHours}` 8.
