# The brokerage rule (director's brief for the economy and UX, sprint 2 item 3; 2026-11-03; owner: the director)

Jeff's ruling (`DECISIONS.md`, 2026-11-02): "Brokerages and carriers should be different companies. Each player can have 1 of each at most." This replaces the broker-desk option in `specs/brokerage-brief.md`. That brief's screens and inventory still apply wherever they don't depend on the desk.

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
- **Every transfer is logged** in both companies' Money, privately.

## 3. Self-dealing: allowed, with no advantage

**The question:** may a player's carrier haul its own brokerage's loads, and may paper between the two be factored?

**The ruling: allow the hauling and neutralise every advantage. Forbid the factoring.** Real brokers often run their own trucks too. Forbidding it would make a player's two companies worth less together than apart, which works against Jeff's one-of-each. The red team's concerns are the counts (`reviews/redteam-2026-11-03.md`, hole 2) and the bond (E-BONDWASH, closed), not the haul itself.

Inside one account the client knows both companies have the same owner, so every row below can be enforced today. Across accounts it can't (section 8).

| # | Where an own-company load could pay without real work | The rule |
|---|---|---|
| 1 | **Logbook volume milestones and anything token-side** (red team hole 2: the broker posts, its own carrier hauls, both score) | A load counts **once per person**. The logbook and the airdrop are the person's, not each company's. |
| 2 | **Credit**: a brokerage paying its own carrier on time would buy a top credit band, so a cheap surety and carriers willing to haul for it | Payments between own companies **don't enter either credit record**, on time or late. |
| 3 | **Winning its own postings** | The own carrier wins only through the board's normal round: no direct assignment, no early sight of sealed bids. The brokerage's posted rate is public like anyone's. |
| 4 | **Factoring or quick pay on own paper.** The carrier's invoice to its own brokerage, factored, would turn the locked bond into a cheap loan from the NPC factor | **Forbidden.** Paper between own companies is paid at net 30, never factored or quick-paid. |
| 5 | **The bond cap** | What the brokerage owes its own carrier counts toward the cap like any carrier's. No exemption. |
| 6 | **A wind-up**: the bond paying the owner's own carrier before strangers | The own carrier stands **last** in the bond's queue, after the NPC factor, the lessor and every other carrier. |
| 7 | **Moving money through freight rates** to get around section 2's guards | Not prevented outright: a high posting loses to any lower bid, so it's no reliable channel. The economy sims it *(size)*: own-company rates against the lane's clearing rate, flagged if they run high. |

Miles and on-time stay counted for the hauling carrier, because the freight is real: an NPC shipper pays for it. Intel's last-month revenue counts it for both companies, as real books would.

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

**The engine's layer.** In the engine today, the `brokerage` layer also opens double brokering for carriers. Engineering took it off every player screen in 60d1a26, and it stays the Back Lot's. A rule that gives a person a legal brokerage should also close that action to player carriers in the rules, not just the chrome. *(size)*: the economy says whether that is part of this bump or the Back Lot's.

## 8. The server note

**One of each per player is an identity rule, and only the server can hold it.** The client enforces it per account: the live world already refuses a second join for a uid (`apps/web/src/live.ts:279`), and the brokerage join extends that to one carrier and one brokerage per uid. A person with two accounts has two carriers and two brokerages. Between accounts, none of section 3's neutralisers apply, because the client can't see the same owner. That is the red team's sybil and wash hole, open until the server's verified login and same-owner link.

Until then the logbook leans on delivered-on-time and tenure, as the red team advised. The beta's honest position is "per account, enforced; per person, the server's job".

## What the engine has, and what is new

| Piece | Today | New |
|---|---|---|
| A broker company with licence, bond stake, surety, bond cap, 5% factoring, defaults, contract lag, fall-off, wind-up | Yes: AI companies formed `role: "broker"` (`world.ts` `formCompany`, `receivables.ts`, `solvency.ts`, `freight.ts`) | – |
| Players' companies | One per uid, always `role: "carrier"` (`game.ts:74`, `live.ts:279`) | A second join for a brokerage, gated on an active carrier and the open layer |
| Owner across companies | None: companies don't know their owner beyond the uid | An owner link between the two companies of one uid |
| Capital transfers | None | The owner's transfer, with section 2's guards |
| Self-dealing rows 1–7 | None | Once-per-person counting, credit exclusion, no own-paper factoring, own carrier last in the bond queue, the rate flag |
| Tenders to a player broker | AI brokers get tenders by weight on a standing order | The same for a player brokerage; hand calls if UX's question 5 says so |
| Double brokering for player carriers | In the rules, off the screens (60d1a26) | Closed in the rules when this bump lands *(size)* |
| Intel's two rows and the owner link | – | `specs/intel.md` plus section 5 |
