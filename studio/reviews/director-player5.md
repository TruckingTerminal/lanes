# Triage: the fifth player diary, the return (the director, 2026-11-03)

Source: `playtests/play-2026-11-02-returning.md`, with 11 screenshots. The cautious owner-operator of diary 1 comes back to his own world on day 33, as if the next evening: a phone, about five and a half minutes, at build `4c931a9`. Read it beside `director-player1.md` to `director-player4.md`. Severity as there.

**What this sitting adds.** It is the first look at the second evening, and the second evening is what an MMO lives on.

**The game kept faith.** The Continue card had his company's name on it. The cash, the day, the truck and the dispatcher setting were exactly as he left them.

**The evening had a real decision,** which the first one never did. He was stranded 894 miles from home in a dead market on a Friday: eat a loss, run home empty, or wait. In his words: "the first month taught me the board; the second evening taught me geography". That is the game deepening on its own, and it is worth protecting.

**What failed is that the game knew everything he needed and told him only afterwards:**
- the idle reason came a day late, and contradicted the board;
- the cost of going home appeared only after the money had gone;
- Iuliia's first line was a stale lesson about weigh stations;
- What now? answered with tutorial step 8.

**His own fix is the spec:** "You're 894 mi from home in a dead market. New carriers can't book here until day 90. Going home costs about 1,400; this load loses 1,142." He would have chosen the same, in ten seconds, and "felt clever doing it". That is the bible's feeling: I made a call.

**On the live world this matters more.** The live world keeps running while the player is away, so the return is where he learns what his company did without him.

**What R1–R20 already cover:**
- Iuliia's stale line staying all sitting: **R2**. Unasked lines re-check against the world and retire after 5 minutes; this is R2 not yet built.
- What now?'s buttons below the fold: diary 1, row 7.
- Pausing only through the fastest speeds: diary 1, row 9.
- 503 miles in nine hours, then a silent ten-hour stop: **R12**.
- Twelve a mile at home against 1.44 in Florida, and "book the top": **R11**.
- The settlement card gone after a reload: diary 1, row 30.
- The three dead seconds after Continue: diary 1, row 29.
- The month report Money doesn't have: **R10**. This is its third diary.

## Rulings (numbered on from R20)

**R21. Coming back starts with where you left off.**

When a player opens a world after `{guide.returnHours}` (8) real hours away, Iuliia's first line is a **return card**, computed from the world and not scripted. It replaces any tutorial line until he acts or dismisses it.

**What it holds,** each item only where it applies:
1. **Where the truck is,** and how far from home.
2. **What it is doing, and why.** For an idle truck, the binding reason (R22).
3. **What happened while he was away.** On the live world: loads delivered, cash in and out, anything that went wrong. On the test page the world waits, so the line is "Nothing moved while you were away."
4. **The month's result,** if a month closed while he was away, with its link (R10).
5. **What now?'s top action,** with its button.

It is a milestone that fires each return, not once ever, and it is the one milestone allowed to replace a walkthrough line.

Owners:
- **the writer:** the lines, plain;
- **engineering:** "what changed since the last visit" (the last-visit time is kept per browser, a convenience, not world state);
- **UX:** where the card sits at phone height.

**R22. One true reason, shown where the wall is, when it is hit.**

The board said "Local carriers first this round". The wall that actually bound him was vetting ("authority under 90 days old"), and that arrived a day later, as a toast.

**Rulings** *(engineering, writer)*:
- **Each load on the board shows the first refusal the engine would give him,** in the engine's own order (`vettingBlock` before `mayTake`). That is the reason that binds, not the first one listed.
- **The idle explanation fires when the truck becomes idle with nothing it may take,** not after a day. It is a Needs-you item, with its exits.
- **A time-gated wall names its date:** "Strict vetting needs 90 days' authority: yours reaches it on {date}."
- **What now? reads the same reason** (R23's new rule).

**R23. A new What now? rule: stuck.**

What now? said "Step 8 of 13" because no rule covers a truck that is idle while nothing in reach pays. Rule 3 needs a paying load, so it fell through to the tutorial.

**New rule 3b, between rule 3 and rule 4.** Condition: a truck is idle, and nothing in reach clears break-even. The answer compares the ways out and offers the cheapest, with all of them priced:
- **The best losing load:** what it loses, and where it leaves the truck.
- **The run home:** its cost and its days (R24).
- **A repositioning run** to the nearest market whose board pays: its cost, against what its best load leaves.
- **Waiting a round:** what the truck costs while it sits, and what the next round is likely to bring.

The reason names the wall (R22). For his evening it would read: "Going home costs about 1,425; the best load here loses 1,142 and leaves you in Des Moines. Waiting costs about 140 a day; vetting opens here on {date}."

The figures go into `guide.ts` as "the ways out". I'll write the rule into `guidance.md` on your word.

**R24. Every move shows its price before the tap.**

SEND HOME · 894 MI showed no cost. It took about 1,425 FD, more than the losing load it was avoiding.

**Rule:** SEND HOME, SEND EMPTY and REPOSITION show their expected cost and time on the button, before the tap: "Home · 894 mi empty · about 1,425 FD · 2 days". The cost comes from the same per-mile parts as break-even (fuel, the driver's pay, tolls), over the empty miles.

R6's confirm card applies only above its threshold. Below it, the price on the button is the guardrail.

Engineering and the writer.

**R25. The record lives in the world, not in the browser.**

After the reload:
- the cash chart read "last 3 days", starting at his return;
- Owed to you read "Nothing owed yet. Your first invoice lands here." after twelve loads;
- the title said "Day 33", a unit the game shows nowhere else;
- the yard card said "Now 0 tractors" while he ran one.

**Rulings** *(engineering, writer)*:
- **The cash chart reads from the world's history,** the ledger, not from this browser's session.
- **The month report (R10) is built.** Three diaries have now been sent to a Money page that doesn't have it. Until it exists, every line pointing at it goes.
- **On a lease, Owed to you says what is true:** "On a lease, the lessor pays on delivery. Invoices start with your own truck."
- **The title's Continue card uses the game's date:** "Continue · Steady Buckeye Haul · Fri Feb 2".
- **The yard card counts what he runs:** "1 leased, 0 owned".
- **"Replaying its history in this browser"** becomes "Loading your world…". The determinism explanation belongs in Help, for whoever asks. A cautious player read "replaying" as "could come out different". The 14-second load is engineering's to shorten.

## Findings, ranked by how a returning player feels them

| # | Finding | Owner | Rule it touches | Sev | Fix |
|---|---|---|---|---|---|
| 1 | **No "where you left off":** a stale tutorial line as the first word, all sitting; What now? giving "Step 8 of 13" while the truck sat stranded | Engineering, writer, UX | R21; R23; R2 (not yet built) | **B** | R21, R23, and R2 built |
| 2 | **The idle reason a day late,** contradicting the board's "local carriers first"; the dispatcher left on could never book there | Engineering, writer | R22 | S | R22 |
| 3 | **SEND HOME unpriced;** the safe-looking choice cost more than the loss it avoided | Engineering, writer | R24; pillar 3 (risk with information) | S | R24 |
| 4 | **The month gone:** no month report on Money; the cash chart restarting at the reload; "Nothing owed yet" after twelve loads | Engineering, writer | R25; R10 | S | R25 |
| 5 | **"Day 33" on the title,** a unit shown nowhere else | Writer, engineering | R25 | M | The game's date |
| 6 | **"Replaying its history in this browser":** 14 s, and frightening wording | Writer, engineering | R25 | M | "Loading your world…"; shorten the load |
| 7 | **"Now 0 tractors" with a leased truck running** | Writer, engineering | R25 | M | "1 leased, 0 owned" |
| 8 | **No news ticker at phone size,** so everything arrives as one toast at a time | UX | R21 | M | The return card carries what happened. UX decides whether the phone needs the ticker too. |
| 9 | **The silent ten-hour rest near Knoxville** | Engineering, writer | R12; the "Tonight…" lines | L | The rest is announced as the night's stop is ("Tonight: a rest area near Knoxville") |

**Also aligned in this pass:** `guidance.md`, section 2, now takes UX's ruling (`guidance-ux.md`, section 3). The explain sheet's foot answers about the tapped figure, and the company's What now? is one tap under it. I agree with the ruling: a company-wide answer under a break-even card reads as a non-answer.

**Order for the next build:**
1. R2, which was ruled in diary 1 and is still unbuilt. The stale line is the first thing a returning player reads.
2. R21, R22 and R24: the return card, the true reason, and the price on the button.
3. R25.
4. R23, once its rule is in `guidance.md`.
