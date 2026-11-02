# Gate: guidance (the director, 2026-11-03)

Reviewed: UX's `specs/guidance-ux.md` (draft 1) and the writer's `specs/guidance-strings.md` (draft 1), both against `specs/guidance.md`.

**Verdict: pass with changes.**
- Engineering may start now on `guide.ts`, `nextAction`, the caption chip, the explain sheet and the coverage test.
- Wiring the strings waits for the writer's fixes (W1–W5). They are small.

## The five questions

| Question | Result |
|---|---|
| Are the three kinds of "next" kept apart? | **Pass.** The red badge is a count and a list, and never speaks. The Do line teaches. What now? is a chip on the caption, never in the strip. The amber dot for "something outranks this step" is a good touch: it is a state, not a voice. |
| Does the explain sheet open without covering the figure on a phone? | **Pass, one gap (U1).** The scroll rule, the outline and the 60% cap do it, except for a figure near the end of a short page. |
| Do the What now? reasons match the rule order and never advise an FD trade? | **Pass.** Rules 1–6 and "no rule fits" are in my order. `now.danger.warn` covers "the next check would make it so". Adding the end of the factoring contract to rule 5 is right. No string advises buying or selling FD, frames a stake as a return, or names the Back Lot. |
| Do the milestones read as progress, not a quest log? | **Pass.** The timeline shows only what has happened, newest first, with no count, bar, unticked box or reward. "Next on the road" is one figure. |
| Does the silence rule hold? | **Pass, one hole (U3 and W3).** Nothing unasked on bad news, the debt countdown as the one exception, and an asked question always answered. But the wind-up itself has no answer yet. |

## Changes

**UX**
- **U1.** When the page can't scroll a tapped figure 16 px clear of the sheet, because it sits near the end of a short page, pad the page's foot by the sheet's height first. Never let the sheet cover the figure, and never shrink the sheet below its contents.
- **U2.** The writer gives most milestones two lines, *before* and *at*. In section 4, place both under caption rule 3:
  - each line once, each inside its window;
  - a *before* line only where the date is known (the month close, day 28, day 91).
- **U3.** Add the state while the company is being wound up: the caption keeps its silence, and What now? answers with W3's string.

**The writer**
- **W1.** `pay.fuelTax` is wrong. The engine charges a flat rate per gallon burned, on the road and idling, billed at the month's close (`costs.fuelTax.perGal`), not a share of fuel spending. Its "what moves it" is gallons: empty miles, idling, the make's mpg.
- **W2.** `intel.creditBand`'s "how" must match `creditScore`:
  - the on-time payment record;
  - authority age (not licence age);
  - open claims;
  - bankruptcies;
  - revocations;
  - whether cash and stake cover what's owed.

  On another company's card the `intel.*` entries need third-person variants ("A company's credit"), with no inputs (UX section 3, Intel's row 1).
- **W3.** Missing strings:
  - `now.liquidating`: plainly, what is happening and on what day the restart comes;
  - `now.restart`: after a wind-up, the restart on a lease;
  - UX's open strings: the discovery line, the "Next:" prefix, "That's changed. Ask me again.", and the sheet's three headings.
- **W4.** No typed durations:
  - "a month of costs" in `now.gap.reason` and `guide.gapToTruck` becomes `{guide.gapCushionWeeks}`;
  - "four weeks" in `guide.cushion` becomes `{guide.cushionAvgWeeks}`.

  Engineering's `guide.ts` reads the same keys, so the sentence and the figure can't drift apart.
- **W5.** Engineering confirms against the engine, and the writer amends where it differs:
  - the loan's down payment and rate "set by your credit band" (`purchaseLoans.ts`);
  - safety "over two years";
  - reputation's "claims and service";
  - book-now "rises the longer it sits" (it steps up only in a truck-heavy market).

  The explain sheet's promise is that its "how" is true.

## Where to set config

`{guide.milestoneWindowDays}`: 12 game days. A game day is 6 real hours at live pace, so that is three real days: long enough to survive a weekend away, and short enough that the line still belongs to its event.
