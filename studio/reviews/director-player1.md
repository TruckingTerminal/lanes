# Triage: the first player diary (the director, 2026-11-03)

Source: `playtests/play-2026-11-02-cautious-owner-operator.md`, with eighteen screenshots: a cautious owner-operator on a phone, his first month, at build `4c931a9`.

**Against the bible.** The first ten minutes partly meet the target. He had a load booked by minute 6, but only after a reload. He knew when it would clear. He did **not** understand what it paid: "+3,971" became 1,273 in hand, through a hold no screen shows. Two things nearly lost him in the first ten minutes: the trapping explanation cards and the money that never matched. Both are blockers.

**The good news is the game itself.** The week he ran it by hand, Jan 22–26, is the bible's feeling exactly: "all on time, all chosen by me, cash nearly doubling". The diary's own conclusion is that the market rewards picking by hand. Every ruling below protects that week.

Severity: **B** loses a stranger. **S** costs trust. **M** confuses. **L** polish.

## Rulings

**R1. The dispatcher waits to be switched on. A rule change for Jeff.**

Today the dispatcher stays idle until the first hand bid (`freeEntry.firstBidByHand`), then switches on by itself. It booked before he could look. Its two picks were his only late deliveries and his two money-losers. He "barely got to choose", which is the opposite of "I made a call".

**Ruling:** the dispatcher stays **off** after the first hand load, until the player switches it on. Iuliia offers it at two moments:
- the first time the truck sits idle past one round while the player is away or running fast;
- the first time the player picks a speed faster than Day a minute.

Her offer: one line and one button, **Let the dispatcher bid**.

The idle card ("sat out 11 bidding rounds… Bid by hand / Turn on the dispatcher") is already right, and it becomes the prompt.

This is a rule change: the economy re-runs v55-a's check on idle cost for absent players, and Jeff extends his own rule.

**A second fault, for the economy:** the default rule bids break-even **+25%**. That anchors to cost, not to the market. So in a boom it wins at 3/mi while the market clears at 10–14: it leaves money on the table and books losing loads after the hold. The defaults should anchor to "usually clears near", with break-even as the floor. That is a rule change too, in the same bump.

**R2. No line outlives its truth, and every step has a soft way out.**

Two failures:
- "Check the rules before you go" stood for four weeks, even after he turned the dispatcher off.
- "Your dispatcher bids when you don't" stayed up after it was off.

**Rulings:**
- **Every unasked caption line is re-checked against the world each round, and retired the moment it is false.** It also retires after `{iuliia.captionMinutes}` real minutes (5), or when the player acts on another screen.
- **Walkthrough steps complete on any state that satisfies them, not one exact action.** For example, the dispatcher switched off completes "Standing orders" for a player who chose to bid by hand.
- **Every step card gains "Skip this step".** A skipped step stays in the list as skipped, not done, and What now? never offers it again.

Owners: engineering, UX.

**R3. The crime words.**

The studio rule exists so the game never teaches players to commit crimes, and never makes crime a spectacle for a stranger. It is not meant to hide a cost the player pays: pillar 1 says the market is real, and a hidden cost breaks it.

**Rulings:**
- **"Theft risk" and the THEFT column** on Rates and Business become **"Security"**, banded **Quiet, Watch or Risky**. *(Amended 2026-11-03, the writer's catch: "Security: High" reads as well protected, the opposite of what it means. "Risky" can't be misread, and it keeps the column name.)* The explain sheet says plainly what it measures: how often cargo goes missing on this market's roads, and that it raises insurance and some shippers' vetting. Writer and UX.
- **"Cargo stolen 28 loads"** and every other crime counter leave the player's Economy page. They move to the studio's dashboard until the Back Lot opens. Writer and engineering.
- **"EVE Online" goes.** Naming another game breaks the fiction, means nothing to a trucker, and is a name we don't own. Writer.
- **The compliance page** offers running 15 hours a day and 56 mph "always". Those are rule-breaking choices the player makes, and they predate the studio rule. I leave them, because each one is costed on the page, and flag them to Jeff as the one place a stranger can choose to break the law.

**R4. The dollar buttons, framed for Jeff.**

Jeff's rule stands: the token surfaces stay on the beta screens until the server. The diary shows what that costs. A cautious trucker saw two lit dollar buttons and decided "the game wants my card", and he stopped touching anything:
- "SMALL YARD · $900", the only lit button on Business;
- BID IN THE OPENING AUCTION, under his weekly costs on Money.

The bible already says the token is off the first hour's path, under a fold on Money. These two buttons break that.

**Proposal for Jeff,** keeping his rule:
1. **No lit dollar button on any screen a first-month player sees.** On Business, the FD price is the button. The dollar price shows as text, in the token fold.
2. **The token section on Money starts folded,** headed "The token (later)", with the auction inside it.
3. **If these buttons can't take a card in this beta, they are also dead taps**, against his own teaser rule. Engineering confirms which.

UX executes whatever Jeff decides.

**R5. The walkthrough comes to the player.**

The thirteen steps, and the best writing in the game, live in a drawer under More. He found them by accident, and on payday they weren't on the screen where he was.

**Ruling:** each step's full line plays **on the screen and at the moment its event happens**:
- "Getting paid" on the first settlement card;
- "The law" at the first inspection line;
- the others the same way.

The list under More › Iuliia stays as the place to reread them. Iuliia's lines that point somewhere ("On Money, find the lessor's share and the hold") must point at something that is there. Owners: engineering, UX, writer.

**Added to `guidance.md` from this diary (I'll write them in on your word): three milestones on news she *can* help with.**
- **The first late delivery:** the cause (hours, the dock, weather) and the fix.
- **The first losing load:** why it lost (the bid against break-even and the hold) and the fix.
- **The first boom**, the slump's mirror: "Rates are up everywhere. Book what pays; don't sign what you can't haul."

The silence rule covers only news she can't help with. These three she can.

## Findings, ranked by how a stranger feels them

| # | Finding | Owner | Sev | Ruling or fix |
|---|---|---|---|---|
| 1 | **Explanation cards trap you on a phone.** CLOSE and WHAT NOW sit under the tab bar. Tapping outside, swiping, the handle, Escape and changing tabs all fail, and the card follows across tabs. Three reloads. | Engineering, UX | **B** | The build breaks the gated spec (sheet at most 60%, tap outside or drag closes). Fix first. QA's check: every sheet closes five ways on a 375 px phone. |
| 2 | **The 30% hold has no screen.** The profit chip promised +3,971 and 1,273 landed. Iuliia calls it "a little". Money doesn't show it. It is the only settlement line without an explanation. | Economy, engineering, writer | **B** | The profit chip shows what lands and what is held ("+3,971 · 2,779 to you · 1,192 held toward your truck"). Money gets a "Held toward your truck" line with its total, plus an explain key. Her line gives `{holdPct}`. Economy: why 30%, and why 25% once. |
| 3 | **The dispatcher books before he can look,** and its picks lose | Jeff, economy | **B** | R1 |
| 4 | **Figures that don't reconcile:** "kept 25,473" against 15,464 in cash; "cushion 0.9 weeks" when he's fine; the next-truck gap jumping from 5,366 to 45,799; insurance 0 on Money against 89 a week and 4,642 a year on Company | Engineering, economy | S | "Kept" reconciles: the cash change plus what's held. The cushion's spending excludes the hold (it's his money, held). The gap never changes definition without a line saying why: engineering finds the jump. Insurance has one figure everywhere. |
| 5 | **"Your pay for driving" shows as a cost to the owner-operator,** and nobody says where it goes | Economy, writer | S | Economy says where the owner's pay goes. The pay row and its explanation then say it ("paid to you, outside company cash", or whatever is true). |
| 6 | A line that stood for four weeks; captions false to the world | Engineering, UX | S | R2 |
| 7 | **The first screen opens scrolled past Iuliia;** What now?'s buttons cut to a 4 px sliver | Engineering | S | The first screen opens at the top. What now? is fully on screen above the tab bar. |
| 8 | **What now? named a load already picked,** and pointed at "Find loads", which doesn't exist | Engineering, writer | S | Rule 4 offers a step only when its action is possible now; otherwise it falls through. Every tab name in a line matches the bar. |
| 9 | **The speed button only goes forward:** Paused is reached through Day in 2 s, losing deliveries and bookings | UX, engineering | S | A pause that is one tap from any speed, and speeds that step down as well as up |
| 10 | **The round closes the card under his thumb** and reshuffles the board | Engineering | S | A card the player has open stays open through a round, with "This load cleared in the round" if it went |
| 11 | **Dispatcher rules reset** when it's switched off or on | Engineering | S | Rules persist through the switch |
| 12 | **The ETA goes red every night** and swings by 12 hours; two late deliveries with no reason given | Engineering | S | The ETA includes planned rest and dock hours (sprint 1's "one ETA, waiting included"). A late delivery's card names its cause. |
| 13 | **Rates tripled with no news;** book-now equals the ceiling at 2–3× "usually clears near" in the boom | Economy, writer | S | The first boom milestone (above). Economy: whether "clears near" lags a boom so badly that it misleads, and whether book-now at the ceiling is intended. |
| 14 | **The dollar buttons** | Jeff, UX | S | R4 |
| 15 | **The walkthrough lives in a drawer** | Engineering, UX, writer | S | R5 |
| 16 | **Crime words;** EVE Online named | Writer, engineering | S | R3 |
| 17 | **Silent at the first late delivery, the first losing load, and 33 hours at a closed dock** | Writer, engineering | M | The three new milestones. The truck card states dock hours: "The dock opens Monday 06:00." |
| 18 | **FD is never explained** | Writer | M | One line at first entry: what FD is in the game, with the token later and folded |
| 19 | The bid stepper starts above book-now | Engineering | M | It starts at "usually clears near" |
| 20 | Loads hidden while driving, so he couldn't line up a reload | Economy | M | Lining up the next load is a rule change (a bid for a truck not yet free). It goes to the economy for sprint 4, not now. |
| 21 | The home rule fired with the dispatcher off, and no line logged it | Engineering, UX | M | Log it. UX decides whether the home rule belongs to the dispatcher. |
| 22 | The board preview has no states or trailer types (Loads does) | Engineering | M | One board renderer |
| 23 | The Rates table is wider than a phone; 45 of 60 markets read "2.50 Hot"; Boise→Denver at 20.98/mi | UX, engineering, economy | M | The phone layout; the display bug; an outlier check |
| 24 | Rivals named "Fleet-18" read as bots | Writer, engineering | M | AI companies get real names from the name generator that gave him "Scioto Freight Lines". Pillar 2 needs rivals that read as people. |
| 25 | "Your company so far" lists none of his firsts | Engineering | M | The guidance build doesn't meet `guidance.md` section 3. Fix. |
| 26 | Unexplained figures and terms: "+5.3 bid-score points", "Cass dial", "Vetting open", "On time —", map labels "COLUMBUS36", "Read the costs before the character" | Writer, engineering | M | Explain keys for the figures. The writer rewords the line. The map label is a bug. |
| 27 | "Tonight, as planned: the shoulder" | Writer | L | "No legal stop in reach: the shoulder tonight." Not "as planned". |
| 28 | Help says a 5,000 start against his 4,700; Help says "Fleet tab"; "press 1–4" shown on a phone | Writer | L | Strings read from config and the bar; a phone variant |
| 29 | The blank portrait on Columbus; hub text running under the buttons; "− FIT + FIT"; the full-screen icon read as a menu; three seconds with no feedback on New test world | Engineering, art | L | Each a fix |
| 30 | "Late 16 / h" wraps; "1470" with no comma; "1 days"; Today holds a week; the settlement card is gone after a reload | Engineering, writer | L | Each a fix |
| 31 | No tolls into New Jersey; condition stuck at 85% over 7,000 miles | Engineering | L | Check the road data and wear |

**Order for the next build:** rows 1, 2 and 4 first: a stranger must be able to ask what a number means and get a true answer. Then R1 and R2, to Jeff and engineering together. Then the rest by severity.
