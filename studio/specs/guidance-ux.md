# Guidance: the surface (UX spec, draft 2, 2026-11-03; owner: UX; the director's gate U1–U3 applied)

The surface for the director's `specs/guidance.md`, which owns the rules, the rule order, the figures and the
milestones. This spec says where each piece sits, phone first, and how they share one screen. Strings are the
writer's placeholders; figures are one example.

## 0. Three things, three jobs, one place each

The player can see three kinds of "next" today or soon. Each gets one job and one place, so they never compete:

| Thing | Its job | Where | Speaks? |
|---|---|---|---|
| **The red badge** (top strip) | *What's waiting*, all of it, by deadline | top strip; a tap lists them | Never. A count and a list, no reasons, no advice |
| **The walkthrough's Do line** | *The lesson*: the step being taught | Iuliia's caption, while a step is current | Her line, once per step, then the Do line rests there |
| **What now?** | *The one best action now*, computed | a chip on Iuliia's caption, every screen | Only when tapped |

**What now? is not in the top strip.** The strip already holds the red badge; a second badge there would make two
things shout for the same thumb. The caption is on every screen (in the sheet on a phone, under the tabs on a
laptop), so the chip is always one tap away.

**When they would disagree.** While a walkthrough step is current but `nextAction` picks a rule above it (1–3:
danger, something waiting, an idle truck that could earn), the chip carries a small amber dot. The dot says "there's
something more urgent than this step" without a word. It's a state, not a line, so it survives Quiet. When
What now? picks an item from the red badge's list, its answer says so: "(1 of 3 waiting ›)".

## 1. Iuliia's caption: the one place she speaks

One row in the page's flow, never an overlay, so nothing she says can sit on a figure.

**Phone.**
- **Sheet at strip height (88 px):** the state line on top, as built; under it a 44 px caption row: her 32 px
  face, the caption's current text, and the **What now?** chip (36 px tall, right-aligned). **Her own button
  (Next, Show me the board…) is not in this row**: it stays at half and full. The text takes the whole width
  between the face and the chip, up to two lines at 13 px, then an ellipsis; a tap on the face or the text raises
  the sheet to half, where her button is. (As built in d62e775 both buttons share the row and squeeze the line to
  about 145 px, "Each line is a l…", or "This…" beside a wider button; looked at in an isolated copy at 375 × 812.)
- **Sheet at half or full:** the caption as built (96 px portrait, her line, its button), with the What now? chip
  at the right of the button row.
- **The walkthrough hidden ("Hide"):** the caption collapses to the 44 px row: face, chip, nothing else. What now?
  never hides.
- **Not accepted: the chip in its own row under the caption** (as built in bb8e161, looked at on the test page at
  375 × 812, 2026-11-02). Two faults, both from the separate row: at strip height the row falls below the 88 px
  strip, so What now? can't be reached with the sheet down; and the answer opens as a second caption with a second
  portrait under the first, repeating the caption's line word for word (rule 4). The change: the chip goes in the
  caption's own button row, and the answer replaces the caption's content, one portrait (sections 2 and 5).

**Her first words are always in view** (the player's diary, finding 4: the first in-game screen opened scrolled
past her). The sheet's content scrolls to the top on every tab change and on the first entry after **Start here**,
so the caption is the first thing in it. When a new line arrives (caption rules 1–3) while the player has
scrolled down past the caption, the sheet doesn't jump: the grab-handle row shows her 24 px face with a dot, and a
tap there scrolls to her. Decorative paintings (the yard, the truck stop) sit below the caption and the first card,
never above them.

**Where the walkthrough lives: in the caption, not in a drawer** (finding 4: the thirteen steps were found by
accident under More). While a step is current, the caption's line starts with a link, **"Step 4 of 13 ›"**. A tap
opens that step's full card in the sheet over the current tab (full height on a phone): her paragraphs, the Do,
the Why, the step's **Go to …** button, and **Back**/**Read ahead** between steps. Closing it returns to the tab.
More › Iuliia keeps the whole list, the timeline and Help, as the archive, not the way in.

**Laptop.** The caption under the five-tab control, as built, with the chip at the right of its button row. The
key **?** opens What now? from anywhere outside a text field.

**What the caption shows when several things want it,** first match wins:
1. **An answer the player asked for** (What now?): until they act, tap **Not now**, or switch tabs.
2. **A walkthrough step's line**, the first time the step is current.
3. **A milestone's line**, once (section 4). If quiet time blocks it, it waits, inside its window.
4. **A tab's or card's line** (`iuliia-lines.md`), under the placement rule.
5. **The resting line:** the current step's Do line; after the walkthrough, the compact next step (section 2).

Rules 3 and 4 respect `{iuliia.quietSeconds}` and Quiet. Rules 1, 2 and 5 don't wait.

## 2. What now?

**The answer** replaces the caption's text in place and grows the caption to fit, pushing the screen down (a
phone at strip height rises to half). It has exactly three parts:
- **The action**, bold, one line: "Bid on Chicago → Elkhart."
- **The reason**, one line, with this company's figures: "It pays 412 FD over your break-even, and your truck has
  sat 14 hours." Each figure in it is tappable (section 3).
- **One button** that does it or opens where it's done ("Show me the load"), and **Not now** beside it.

**By rule** (the director's order), what's different on screen:
- **Rule 1, danger:** the action in red type; the reason leads with the countdown: "2 of 4 weekly checks in debt;
  the next is Mar 14." The button opens the lever (the load, the invoice to factor, the lease to return).
- **Rule 2, something waiting:** "(1 of 3 waiting ›)" after the reason, opening the red badge's list.
- **Rule 4, the step:** the action is the Do line with "Step 6 of 13" before it; the button is the step's Go.
- **Rule 6, nothing:** "Nothing needs you. The next round is at 18:00, in 4 h." One button: **OK**.
- **No rule fits:** "I don't have a step for this one. Help has the whole system." Button: **Open Help**.

**After the action** the caption returns to its resting line; the feedback is where the action happened (the
pinned bid card, the accepted tender), not in the caption.

**If the world moves while the answer shows** and its action is no longer possible (the load cleared), the answer
becomes "That's changed. Ask me again." with the chip. It never shows a stale action.

**The resting line after the walkthrough** (rule 5 of the caption): the action alone, in muted type, prefixed
"Next:": "Next: bid on Chicago → Elkhart." No reason until asked. Under Quiet the resting line is empty and only
the chip shows.

## 3. Help on every figure

**What looks tappable.** A covered figure (one with an explain key) has a dotted underline, 1 px, at half the
text's colour. Bands, chips and meters that are covered take no extra mark: a chip already looks like a control.
Figures without a key have no underline, so the mark never lies (the coverage test keeps the two in step). No ⓘ
icons: on a 375 px screen they would double the visual noise of every row.

**Targets.** Every covered figure gets a hit area at least 44 px tall and as wide as its text plus 8 px, by padding,
not by a bigger font. **Inside a card that is itself a tap target** (a load card, a list row), its figures don't
explain separately: the card opens its sheet, and the sheet's label/value rows explain. No long-press: nobody
finds it.

**Discovering it.** Once, the first time a covered figure is on screen after the arrival, a caption line (rule 4,
the writer's): "Tap any number with a dotted line and I'll show you where it comes from."

### The explain sheet, phone
- **Where:** a bottom sheet **standing on the nav, never under or over it**: its bottom edge is the nav's top
  edge (56 px plus the phone's safe area), and it rises to **at most 60% of the screen height**. (Draft 2 said
  "over the nav"; built that way, the nav covered the sheet's foot and trapped the player, the player's diary of
  2026-11-02, finding 1.) Before it rises, the page
  scrolls so the tapped figure sits at least 16 px above the sheet's top edge, and the figure gets a 2 px outline
  in the accent colour while the sheet is open. **The figure is never covered.** A figure in the top strip (cash,
  the clock) needs no scroll; the strip stays visible.
- **A figure near the end of a short page** (the page can't scroll far enough to clear it): first pad the page's
  foot by the sheet's height, then scroll. The padding goes when the sheet closes. The sheet is never shrunk below
  its contents to make room; the page grows instead.
- **Header:** her 32 px face; the figure's label and its value, large: "Break-even · 2.36/mi".
- **What it is:** one sentence.
- **How it's computed:** label/value rows of this company's inputs, ending in a bold total that equals the
  figure exactly, with the arithmetic in words where it isn't a sum ("× 1.15, your lessor's 15%"). Up to five rows
  show; the rest fold into "Everything else 0.11/mi" with **Show all 9**. A row whose input has its own key is a
  link: it opens that figure's sheet in place, with a back arrow; at most three deep.
- **What moves it:** up to three levers, each a row with "›" to where it's done ("Rebuild the truck › Truck").
- **Foot, pinned:** **What now?** (its answer shows in the foot; the sheet stays) and **Close**, in a 56 px foot
  that never scrolls. Only the middle (what it is, how, what moves it) scrolls, between the header and the foot.
  At any height and any content length, Close is on screen.
- **Closing it, on a phone, five ways, all of which must work** (QA tests each):
  1. **Close** in the foot;
  2. an **×** in the header's top-right corner, 44 px;
  3. **a tap anywhere outside the sheet**: a transparent layer over the rest of the screen catches it (no dimming,
     so the outlined figure stays readable); the tap closes the sheet and does nothing else;
  4. **a swipe down** on the header or its grab bar (a 36 × 4 px bar at the top centre);
  5. **a tab change** in the bottom nav (the nav sits outside the sheet and stays tappable): the sheet closes, and
     the new tab opens without it. **A sheet never follows the player to another tab.**
  Plus the phone's Back gesture (the sheet pushes one history entry) and Escape on a keyboard.
- **The same rules hold for every sheet on a phone** (the confirm sheets in Finance, the brokerage, Move money):
  standing on the nav, a pinned foot, the five ways out.
- **A band** (credit C) shows its score, its inputs, and the cut-offs in one line: "C is 50–64. You're at 62."
- **Another company's figure** (Intel): what it is and what moves it, in general. **Never the other company's
  inputs**: the breakdown is private, and Intel's row 1 holds.
- **No breakdown available:** "I can't break this one down yet." and the other two parts. Never an empty sheet.
- **No humor** anywhere in it (the director's rule).

### The explain sheet, laptop
**A 320 px card fixed in a bottom corner, not a popover** (accepted as built in d62e775: simpler, the same
component as the phone's, and no arrow to aim). **The one change: the card takes the bottom corner on the side away
from the figure.** A figure in the panel (nearly all of them) opens the card bottom-left, over the map, 16 px from
the map's edges; a figure on the map side (a hub card's numbers) opens it bottom-right. As built it always sits
bottom-right, over the panel's own lower rows (other figures, the next card), and the panel has to scroll to keep
the tapped figure clear; on the map side neither happens. Same contents. Esc or a click outside closes it. Tab
moves through its links.

## 4. Milestones: progress without a quest log

**Two lines per milestone, each once** (the writer's `guidance-strings.md` §2): a *before* line and an *at*
line. Both are caption rule 3: they wait for quiet time, Quiet mutes them, and each shows once per browser
(remembered with the walkthrough's seen record, `ms:{key}:before` and `ms:{key}:at`).

| Line | Shows when | Its window (`{guide.milestoneWindowDays}`, 12 game days) |
|---|---|---|
| **Before** | only where the date is known ahead | from 12 days before the date until the date; after the date it's dropped, never shown late |
| **At** | the event has happened | from the event until 12 days after it; after that it's only in the timeline |

**Which milestones get a before line:** the month close (day 30 of the company), day 28 (businesses), day 91
(brokerage), the first hired week (the payday is known from the day of hiring), and the debt countdown (the next
check's day is known; this is `now.danger.warn`'s case). Not the first owned truck (step 9 is its before), not the
slump (no notice), not the first dispatcher (no date: its before line doesn't show; writer, drop it or the director
gives it a trigger).

**When both are due** (the player was away through the date), only the *at* line shows. **When two milestones are
due at once,** the *at* lines first, then by date; one per caption, the next after quiet time.

**Each line's layout:** her line; the reason, one line; one button carrying What now?'s next action for it ("Keep
it loaded: see the board"). A *before* line's button opens where to prepare ("See the month so far").

**Where progress lives: More › Iuliia, "Your company so far".** A vertical timeline of milestones that have
happened, newest first: date, the milestone's name, and a tap to re-read her line and its reason. Under the
timeline's top, one line from `guide.ts`: **"Next on the road:"** and the one figure that matters most now ("Your
next truck: 18,400 FD away" / "The brokerage opens Apr 2" / "The season closes in 30 days").

**What it never shows:** future milestones as unticked boxes, a count ("4 of 11"), a percentage bar, or a reward.
The walkthrough's thirteen steps keep their list above the timeline (that is the tutorial, and it ends); the
milestones are the company's history, and they don't.

**Derived, not saved** (the director): each entry's date comes from the world (the first owned truck's purchase
day, the first payday). Engineering lists any milestone whose date can't be derived; those show without a date.

## 5. Quiet and the one-line rule

- **Quiet** lives where it is (More › Iuliia). On: caption rules 3 and 4 never fire; the resting line after the
  walkthrough is empty. Still on: the walkthrough's lines, every What now? answer, every explain sheet, the amber dot.
- **One line per screen:** the caption is the only place she speaks unasked. The explain sheet and the What now?
  answer are asked, so they're outside the count, but they share the caption's place (What now?) or sit beside the
  figure (explain); never two of her voices on screen at once. Opening an explain sheet while a What now? answer
  shows keeps the answer; the sheet's own What now? foot shows the same answer.
- **Never over a figure:** the caption is in the flow; the explain sheet scrolls clear of its figure; the laptop
  popover anchors beside it. QA's check: no Iuliia text box intersects a covered figure's box.

## 6. The silence rule

**Unasked, on bad news, nothing.** A refused order, a crash, a theft, a revocation or a liquidation gets the plain
string where it happened and nothing in the caption: the caption keeps what it showed. No dot, no pulse, no line.
The one exception is the director's: the debt countdown milestone, because she can help.

**Asked, always something.** What now? always answers (rule 6 or "I don't have a step… Open Help"). An explain
sheet always has at least what the figure is and what moves it.

**While the company is being wound up** (from the liquidation until the restart):
- **The caption is silent:** no milestone, tab or card line, and no resting line (the step's Do line would be a
  lesson for a company that is closing). Only her face and the What now? chip show; the amber dot is off.
- **What now?** answers with the writer's `now.liquidating`: what is happening and the day the restart comes, in
  plain words. One button, "See what's being sold" (Money), and **Not now**.
- **The red badge** lists only what the player can still act on; anything the wind-up has frozen leaves it.
- **Explain sheets** work as always.
- **After the restart,** What now? answers with `now.restart` (the restart on a lease), its button opening the
  board; the walkthrough resumes from the step the new company is on.

## Questions

1. **Engineering:** which milestone dates can't be derived from the world (section 4).
2. **Writer:** the discovery line, the "Next:" resting prefix, the no-rule answer, "That's changed. Ask me
   again.", and the explain sheet's three headings.
3. **Writer:** the first dispatcher's *before* line has no date to show against (section 4).

Settled at the gate: `{guide.milestoneWindowDays}` is 12 game days (three real days at live pace).
