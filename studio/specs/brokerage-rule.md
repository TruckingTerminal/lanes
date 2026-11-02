# The brokerage rule (director's brief for the economy and UX, sprint 2 item 3; revision 1, 2026-11-03; owner: the director)

Jeff's ruling (`DECISIONS.md`, 2026-11-02): "Brokerages and carriers should be different companies. Each player can have 1 of each at most."

Revision 1 adds two more of Jeff's rules, as section 3a:
- "Carriers can broker their loads tendered directly to them if they have a brokerage arm, but all requirements are still there with the bond etc."
- "If a player owned brokerage is receiving direct freight from a shipper, they can also tender them directly to their carrier company without posting it on the loadboard."

It also adds the fee on the owner's transfer (section 2). This replaces the broker-desk option in `specs/brokerage-brief.md`. That brief's screens and inventory still apply wherever they don't depend on the desk.

Who does what:
- **The economy** sizes every figure marked *(size)* and sims the self-dealing rows.
- **UX** draws the screens.
- **The writer** words them.
- **Engineering** builds it.
- The ruleset is then bumped, and the world restarts while it has no players.

Player-facing words stay crime-free. Studio words such as "self-dealing" and "wash" appear only in this file.

## 1. Forming the brokerage

**When.** The ladder's `brokerage` layer: day 91, counted from world day 0 in the beta, and 91 days after launch afterwards. Before that, the teaser (section 7).

**Who may form one: only a player with an active carrier.** A player's first company is always a carrier. A brokerage is the second company a player grows into. Nobody starts as a broker only. Three reasons:
- **Pillar 3: growth is earned.** The 75,000 FD bond has to come from somewhere. In the world the only earned source is hauling. A broker-only start would make the bond a dollar purchase: paying to skip the game.
- **The first ten minutes are built for a carrier** (`BIBLE.md`), and a stranger has no use for a brokerage on day 1.
- **It is one rule the client can check per account**, with no new identity data.

"Active" means:
- the carrier's authority is active, not suspended or revoked;
- the carrier is not liquidating;
- *(size)* it is at least N days old. The economy decides whether an age gate is needed; I'd start with none.

**What it costs**, all in config and all shown on one sheet before the button:

| Cost | Figure | Where it goes |
|---|---|---|
| Licence | 300 FD, renewed each season (`permits.brokerLicenseRenewalFd`) | Sink |
| Bond | 75,000 FD locked as the brokerage's stake (`staking.roles.broker`) | Stays the brokerage's, locked behind its paper |
| Surety premium | 2–12% a year on the bond by the brokerage's credit (`permits.suretyPctPerYear`); the NPC surety writes it | Sink |
| Starting grant | **None.** The 5,000 FD grant is a faucet for a person's first company; a second company is not a new player | – |

**Credit starts fresh.** The brokerage does not inherit the carrier's credit score, because credit is a payment record and the brokerage has none yet. *(size)*: the starting score. It decides the first year's surety premium, so the economy should check that a new brokerage's premium isn't a wall.

**The money to form it** comes from the carrier, as the owner's capital (section 2).

**What a brokerage is not.** It owns no trucks or trailers and hires no drivers (`"only carriers run trucks"` holds). It has its own name, its own Intel card and its own authority record.

## 2. Two companies under one login

- **One identity, two companies at most:** one carrier and one brokerage, never two of either.
- **Switching** is a company switcher in the strip. It shows the name of the company the player is looking at, and one tap swaps to the other. Each company keeps its own tabs. The "Needs you" badge counts both companies and names which one needs the player. The brokerage's four-item bar is UX's to draw. "Truck" makes no sense for a broker, so my guess is Book, Board, Money, More.

**Shared between the two:**
- the login;
- Iuliia's walkthrough and its progress;
- settings;
- the person's logbook and airdrop standing (section 3, row 1).

**Not shared:**
- cash, the ledger, credit, the record, Miles and staff.

**The one financial rule between them: the owner's capital.** The owner may move FD between their two companies, in either direction, as a capital transfer. Without it the brokerage could never be funded, and a profitable brokerage could never buy its owner a truck, which is a call the owner should get to make.

The guards on a transfer:
- **No transfer out of a company that:**
  - is liquidating;
  - is in its grace period under its stake;
  - has overdue paper;
  - would be left with negative cash.
- **A brokerage can't transfer out below its bond while it has paper open.** The bond stays behind its paper, as it does today.
- **A transfer is equity, not revenue or cost.** It counts toward no profit, Miles, logbook, Intel revenue or profit tax.
- **A fee of {3%} of every transfer**, in either direction, goes to the reserve. It is a sink, like the factoring fee, and its config key is `brokerage.transferFeePct`. Jeff set it at 3% (2026-11-03: "higher than 1%"). The fee is the only tax on a transfer. It keeps money moving between the two companies from being free. And because every other channel between them (section 3a's tender, row 7) is held to the lane's band, a transfer is the one way to move money untaxed by freight, and it is taxed here.
- **Every transfer is logged** in both companies' Money, privately, with its fee.

## 3. Self-dealing: allowed, with no advantage

**The question:** may a player's carrier haul its own brokerage's loads, and may paper between the two be factored?

**The ruling: allow the hauling and neutralise every advantage. Forbid the factoring.** Real brokers often run their own trucks too. Forbidding it would make a player's two companies worth less together than apart, which works against Jeff's one-of-each. The red team's concerns are the counts (`reviews/redteam-2026-11-03.md`, hole 2) and the bond (E-BONDWASH, closed), not the haul itself.

Inside one account the client knows both companies have the same owner, so every row below can be enforced today. Across accounts it can't (section 8).

| # | Where an own-company load could pay without real work | The rule |
|---|---|---|
| 1 | **Logbook volume milestones and anything token-side** (red team hole 2: the broker posts, its own carrier hauls, both score) | A load counts **once per person**. The logbook and the airdrop are the person's, not each company's. |
| 2 | **Credit**: a brokerage paying its own carrier on time would buy a top credit band, so a cheap surety and carriers willing to haul for it | Payments between own companies **don't enter either credit record**, on time or late. |
| 3 | **Getting its own brokerage's loads** | Two ways only. The board's normal round, with no early sight of sealed bids. Or, for freight a shipper tendered to the brokerage, a direct tender to the own carrier (Jeff's rule, section 3a), with the hauler's pay inside the lane's band. |
| 4 | **Factoring or quick pay on own paper.** The carrier's invoice to its own brokerage, factored, would turn the locked bond into a cheap loan from the NPC factor | **Forbidden.** Paper between own companies is paid at net 30, never factored or quick-paid. |
| 5 | **The bond cap** | What the brokerage owes its own carrier counts toward the cap like any carrier's. No exemption. |
| 6 | **A wind-up**: the bond paying the owner's own carrier before strangers | The own carrier stands **last** in the bond's queue, after the NPC factor, the lessor and every other carrier. |
| 7 | **Moving money through freight rates** around section 2's guards and fee | On a direct tender to the own carrier, the hauler's pay must sit **inside the lane's band, floor to ceiling** *(size: the economy defines the band, e.g. from the lane's recent clearing rates)*. A tender outside it is refused. On the board, a high posting loses to any lower bid, so it's no reliable channel. The economy still sims own-company rates against the lane's clearing rate. |

Miles and on-time stay counted for the hauling carrier, because the freight is real: an NPC shipper pays for it. Intel's last-month revenue counts it for both companies, as real books would.

## 3a. Direct freight between the two companies (Jeff's rules, revision 1)

**Rule A: a carrier may pass its direct freight to its own brokerage.**

A carrier holds a contract with a local shipper (`contracts.direct`). Each load of that contract reaches the carrier as a tender. It is never a board load. Today the carrier hauls the tender, or turns it down: turning it down slashes the contract's performance stake and costs the shipper's trust. With a brokerage, the carrier gets a third choice: **Pass to {brokerage}**.

- **Every requirement holds.** The brokerage must be licensed, bonded at its stake, inside its grace, and under its bond cap with this load added. If any check fails, the pass is refused, and the carrier hauls or turns the load down as before. The pass must happen inside the tender's window (`contracts.tenderHours`).
- **The shipper's payable moves to the brokerage.** The load is re-papered:
  - The shipper pays the **brokerage**, at the contract rate, on the shipper's usual terms.
  - That invoice is the brokerage's receivable, factorable at the brokerage's flat 5%.
  - The brokerage owes the hauler, under its bond cap, with its bond and the NPC surety behind it.
  - The carrier neither bills nor owes anything on the load.
- **The carrier's credit is untouched.** It is neither payer nor payee, so the pass enters no credit record.
- **The carrier's contract counts the load as covered.** No stake slash and no lost trust, so long as the load is delivered.
- **If the passed load falls off** (nobody hauls it before the shipper gives up), the shipper is made whole **once**: by the brokerage's fall-off charge, under its bond. The carrier's stake is not slashed as well. The carrier's contract records the load as not covered, for trust only. *(size)*: whether that trust cost is right.
- **Its volume cap stays as it is.** A carrier still holds contract volume only up to what its own trucks can haul (`loadsPerTruckWeek`). A brokerage gives the carrier an outlet for a busy week, not a way to sign freight it could never haul. *(size)*: whether a brokerage should lift that cap at all.
- **Where the brokerage sends a passed load:** it may post it to the board, or tender it to another carrier under the board's rules. It may **not** tender it back to the carrier that passed it. That round trip would leave the load where it started, re-papered so it factors at 5% instead of the carrier's line, and pay nothing for it.

**Rule B: a brokerage may tender its own shipper freight straight to its own carrier.**

Freight a shipper tenders to the brokerage (NPC tenders today) may go to the owner's carrier as a direct tender, without a board posting.

- **The carrier accepts or declines,** like any tender. A decline sends the load to the board.
- **The hauler's pay sits inside the lane's band** (row 7). The tender shows the band and refuses a figure outside it.
- **The bond cap counts it** like any carrier's payable (row 5).
- **Everything else in section 3 holds:**
  - The own carrier is last in the bond's queue.
  - The load counts once per person.
  - Payments between the two stay out of credit.
  - Own paper is never factored (row 4). The carrier's invoice to its own brokerage waits net, and the brokerage's receivable from the shipper factors at 5% as usual.

**What the player sees.**
- The carrier's contract tender gains **Pass to {brokerage}**. It is greyed out, with the reason, when a check fails.
- A brokerage's shipper tender gains **Tender to {carrier}**, with the band shown.
- Both name the other company and are logged in both feeds.
- No crime words: a pass and a tender are ordinary business.

**Answers to engineering (2026-11-03).**

1. **The hold, and what happens when it runs out.**
   - **A shipper's tender to a player brokerage is held** in Offered for `contracts.tenderHours` (12 game hours, the same window every tender in the game has, so there is one number to learn). The player chooses **Post**, **Tender to {carrier}** or **Decline**.
   - **On timeout, the brokerage's standing order acts.** With no standing order, the tender is declined and goes on, as today, to another broker or the open board. A brokerage never takes on bond exposure it didn't choose.
   - **A passed load (Rule A) is different.** The brokerage already holds it, so it can't be declined. Its hold is the rest of the carrier's tender window. On timeout it is posted by the standing order, or, with none, at `{brokerage.defaultMarginPct}` (*size*). It is never dropped.
   - **Hand calls are this same hold** (the brief's question 5): the player decides inside the window, and the standing order decides after it.
   - **The standing order may name the own carrier:** "tender to {carrier} first". The rate is the posting rate held inside the lane's band (row 7). The carrier still accepts or declines.
2. **Rule A has one flow: the writer's "Pass to {brokerage}".** One action on the carrier's side, and every decision made in the brokerage, where its tools are. UX's "Broker it" sheet with a margin control goes. **A pass counts as accepted** in the carrier's tender acceptance rate, and the contract counts the load as covered. If the passed load falls off, the contract records it as not covered (as above).
3. **Confirmed:** a tender the own carrier declines or lets expire goes to the **board**, not back to Offered. It posts at the rate the carrier was offered. A return trip to Offered would loop, and the board is where the brokerage's tools already work.
4. **Check both times.** At send, so an impossible tender is never offered: the writer's "{carrier} has no free truck in reach of the pickup". And again at accept, because the world moves. If the check fails at accept, the accept is refused, the tender stands until it expires, and then it goes to the board.
5. **The brokerage's home hub is the carrier's home hub at formation, fixed for the brokerage's life.** It doesn't follow if the carrier later moves.
6. **Agreed:** for a load between the owner's own two companies, the **hauler's** logbook entry carries it and the brokerage's is skipped. The hauler did the work, and Miles are the hauler's. Loads the brokerage places with anyone else count for it as usual.

## 4. The brokerage's own money

**Stake and bond.** The 75,000 FD stake is the bond. Under the factoring contract switch (on, 0.20.0) it stays behind the brokerage's paper until the last invoice is paid. Under the stake, the brokerage takes no new tenders after 14 days of grace (`staking.graceDays`).

**The bond cap.** What the brokerage owes carriers, booked and unpaid, never passes its bond. A tender that would pass it goes to another broker or the open board, with a notice once a game day (`receivables.ts` `apCapBlock`). The screen shows this as a meter: "{x} of 75,000 bond used".

**Factoring.** A flat 5% on the brokerage's receivables, whatever its size (`contract.brokerRate`, Jeff). The contract runs three game months, like a carrier's. The fee is a sink. The carrier keeps its own fleet-size line (6% down to 2.5%). The two contracts are separate.

**Surety.** The NPC surety writes the bond. The premium (2–12% a year by credit) is a sink. If the brokerage can't pay a carrier, the bond pays: NPC paper first, then carriers, the owner's own carrier last.

**Running costs.** The licence renews each season. The board fee is 3% of what posted freight pays. A load nobody hauls before the shipper gives up costs a fall-off charge of 15% of the contract. When a shipper doesn't pay (about 2% of loads, more in a slump), the brokerage still owes its carrier. The contract rate trails spot by 30 days.

**Winding up.** As the engine does for AI brokers today (`solvency.ts`):
- The brokerage stops taking tenders.
- The bond stays behind its paper until the last invoice is paid, then the rest of the stake is released.
- The licence lapses with the stake, and no grant comes back.
- To broker again, the brokerage posts the stake again.

The carrier is untouched. Separate companies, separate liability.

**The token launch reset.** A brokerage formed before the token launch loses its bond at the launch reset, like every beta stake (`TOKENOMICS.md`, the lean launch). **The forming sheet says so plainly, and the bond is not returned to cash before the reset.** Three reasons:
- **Returning it would not save it.** The reset keeps only a company's working capital (the larger of 25,000 FD and four weeks of its own spending). A brokerage's spending is small, so most of a returned 75,000 would burn as cash instead of as a stake.
- **It would leave the paper unbacked.** For the hours before the reset, the brokerage's carriers would have no bond behind their invoices, and the bond cap would fall to zero.
- **It would reopen the hole the lean launch closed:** beta FD carried through by moving it out of a stake.

Telling the truth on the sheet costs nothing and keeps the rule simple. A beta bond is beta money, the same as everything else in the beta.

**For the writer,** on the forming sheet while the token hasn't launched, plain, with no joke: "Beta bond: it is burned at the token launch, like every beta stake. To keep brokering after launch, you post it again."

**For the economy** *(size)*: the part of the bond behind paper still open at the reset should burn only when that paper is paid, so no carrier goes unpaid across the launch. After the reset, the 14-day grace applies, as for every re-posted stake.

**A revocation.** A brokerage's authority revoked bars that person from forming another brokerage for the bar. It does not close the carrier. *(size)*: whether a carrier revoked for a serious record should bar forming a brokerage. Real regulators look at the people behind both; I'd say yes, for the bar's length.

## 5. Intel

- **Two rows for one player:** the carrier and the brokerage, each its own company. Each card says "same owner as {other company}". Common ownership is public: it tells carriers a broker has trucks behind it, and no cash can be derived from it.
- **The broker's card leads with credit**, the first thing a carrier reads (`specs/intel.md`, row 9 moved up).
- **The broker's card then shows:**
  - bonded (no amount);
  - the vetting tier it requires;
  - authority age;
  - last month's loads brokered;
  - last month's share hauled against fallen off;
  - last month's revenue.
- **Never on the card:** cash, the bond's use, what it owes, or its transfers. Intel's row 1 holds.

## 6. What the player sees

The screens are as in `specs/brokerage-brief.md`, "What the player sees": the licence sheet, posting, the carrier's trail, the margin, and Money with Owed by you and the bond meter.

Two things change:
- Formation adds a naming step and the first capital transfer from the carrier, on the same sheet as the three costs.
- The brief's UX question 5 stands: a standing order, or calls by hand on tenders and stuck postings.

## 7. The ladder and the teaser

**Before day 91.**
- **The card.** More → Coming soon: "Brokerage · opens {date}", one line on what a brokerage does, and one Iuliia line.
- **The working action:** **See what brokers earned last month**, which opens Intel's broker rows (AI brokers until players arrive).
- **Renames.** The Logbook's ladder row and Help's roadmap say "Brokerage", never "Re-brokering". Help's promise becomes "your own brokerage: a licence, a bond, and freight to post".

**From day 91.**
- **If the player qualifies,** the card becomes **Start a brokerage**.
- **If not,** it shows what it takes (an active carrier, 75,000 FD for the bond, 300 FD, the premium) and how far away the player is. No dead tap.
- **Iuliia** says one line, once, when the layer opens.

**The engine's layer.** In the engine today, the `brokerage` layer also opens double brokering for carriers. Engineering took it off every player screen in 60d1a26, and it stays the Back Lot's. **Jeff, 2026-11-03: it closes to player carriers in the rules with the brokerage bump.** A player who wants to broker forms a brokerage. The AI's outlaws keep the action; for players it returns only if the Back Lot brings it back.

## 8. The server note

**One of each per player is an identity rule, and only the server can hold it.** The client enforces it per account: the live world already refuses a second join for a uid (`apps/web/src/live.ts:279`), and the brokerage join extends that to one carrier and one brokerage per uid. A person with two accounts has two carriers and two brokerages. Between accounts, none of section 3's neutralisers apply, because the client can't see the same owner. That is the red team's sybil and wash hole, open until the server's verified login and same-owner link.

Until then the logbook leans on delivered-on-time and tenure, as the red team advised. The beta's honest position is "per account, enforced; per person, the server's job".

## What the engine has, and what is new

| Piece | Today | New |
|---|---|---|
| A broker company with licence, bond stake, surety, bond cap, 5% factoring, defaults, contract lag, fall-off, wind-up | Yes: AI companies formed `role: "broker"` (`world.ts` `formCompany`, `receivables.ts`, `solvency.ts`, `freight.ts`) | – |
| Players' companies | One per uid, always `role: "carrier"` (`game.ts:74`, `live.ts:279`) | A second join for a brokerage, gated on an active carrier and the open layer |
| Owner across companies | None: companies don't know their owner beyond the uid | An owner link between the two companies of one uid |
| Capital transfers | None | The owner's transfer, with section 2's guards and the `{3%}` fee to the reserve |
| Self-dealing rows 1–7 | None | Once-per-person counting, credit exclusion, no own-paper factoring, own carrier last in the bond queue, the lane's band on own tenders |
| Direct freight | A carrier's `contracts.direct` tenders: accept onto a truck, or turn down (stake slashed) | Rule A: pass to the own brokerage, the shipper's payable re-papered to it, no tender back to the passer. Rule B: a brokerage's shipper tender straight to the own carrier inside the band |
| Tenders to a player broker | AI brokers get tenders by weight on a standing order | The same for a player brokerage; hand calls if UX's question 5 says so |
| Double brokering for player carriers | In the rules, off the screens (60d1a26) | Closed to player carriers in the rules with this bump (Jeff) |
| Intel's two rows and the owner link | – | `specs/intel.md` plus section 5 |
