# Economy review: the player brokerage (2026-11-02)

Economy designer, for the producer and the director. Jeff's decisions of today:
- a brokerage is its own company, one carrier and one brokerage per player;
- a carrier may pass its direct freight to its brokerage (Rule A);
- a brokerage may tender its shipper freight straight to its own carrier (Rule B);
- the owner's capital moves between the two for a fee of 3% to the reserve.

This sizes the director's brief (`studio/specs/brokerage-rule.md`, revision 1) and builds it behind a switch.

Nothing is committed. Live levers, the ruleset and the config version are untouched.

## 1. The rule as built

**Switch:** `brokerage.enabled` (default off) in `packages/config/src/economy.config.ts`. With it off, the tree
reproduces v59-a to the byte (a 240-day check, seed 3).

| Key | Value | What it does |
|---|---|---|
| `minCarrierAgeDays` | 0 | an age gate on the carrier: none (§4) |
| `transferFeePct` | 0.03 | Jeff's fee on every capital transfer, a sink to the reserve |
| `band` | `[0.85, 1.15]` | Rule B: the hauler's pay inside these multiples of the lane's market rate |
| `closeDoubleBrokering` | true | a player carrier can't double broker in the rules (§5) |
| `bots` | `{ share: 0.25, ownTenderAt: null }` | a batch scenario, not a rule: which carrier bots form one, and where they price own tenders |

**The engine** (`packages/engine/src/brokerage.ts`, new):

- **Forming** (`form_brokerage`):
  - Who: a carrier with an active authority, not barred, not liquidating, with no brokerage yet, once the ladder's
    `brokerage` layer is open (day 91 in the staged beta).
  - What it creates: a broker company of its own at the carrier's hub, linked both ways (`Company.partnerId`). It
    gets no grant and fresh credit; its licence is paid on forming.
  - How it's funded: the owner's starting capital moves in from the carrier as a transfer (3% fee), and the 75k bond
    is staked out of it.
- **The owner's capital** (`transfer_capital`):
  - Either way, as equity: no operating result, Miles, logbook, tax or credit sees it.
  - Refused out of a company that is:
    - being wound up;
    - in its grace under its stake;
    - a brokerage under its bond with paper open;
    - in debt for a week;
    - left negative by the transfer and its fee.
  - The fee goes to `sink:capital_transfer_fee`.
  - The batch led to one refinement: past its grace, a brokerage with no paper open may send its cash home. Without
    that, a brokerage whose bond the launch burned could never empty its account.
- **Rule A** (`pass_tender`, or the standing choice `Company.passTenders`): a carrier passes a direct-contract tender
  inside its window, and the load is re-papered.
  - The shipper pays the brokerage the contract rate.
  - The brokerage posts the load at its margin and owes the hauler, under its bond cap.
  - The carrier neither bills nor owes. Its contract counts the load covered once booked, and counts it against
    trust only if it falls off. No stake is slashed.
  - Never back to the carrier: a passed load can't be tendered to the carrier that passed it.
  - The standing choice passes only when the contract pays at least the board's book-now. One posted under the
    going rate falls off, and the 15% fall-off charge costs more than the slash for turning it down.
- **Rule B** (`tender_own`): a brokerage tenders an open shipper load straight to its own carrier.
  - The pay must sit inside the band. The lane's market rate is the lane's trailing cleared rate (the last 40 or so
    clears, own-company clears left out), or its origin market's for that trailer while the lane has fewer than 5,
    or the load's ceiling before either.
  - The carrier accepts like any tender. A lapse returns the load to the board.
- **Between the two companies:**
  - A load counts once per person: the brokerage's logbook loads and Miles are dropped when its own carrier hauled.
  - Payments between them stay out of both credit records.
  - Own paper is held at net, never factored, quick-paid or taken by the lessor.
  - The own carrier stands last in the bond's queue (`receivables.ts`).
  - One profit-tax allowance per person: the two companies' week is taxed together (`token.ts`).
  - One airdrop share per person: the brokerage's Miles and profit score for its carrier, capped once (`token.ts`).
- **Closing double brokering** (Jeff: closed to player carriers with this bump):
  - A human carrier, or any carrier with a brokerage, gets "a carrier brokers through its own brokerage" from
    `rebrokerLoad` (`fraud.ts`).
  - `applyAction` gives the same answer to a `rebroker_load` action and to a standing order carrying a `rebroker`.
  - AI carriers keep the re-post, as today.
- **The launch reset** (the director's rule):
  - A beta brokerage's bond burns at the reset like every beta stake, except the part standing behind paper still
    open (`launchHold`): what it owes, up to its stake.
  - That part stays staked. It pays that paper first when it falls due, before the brokerage's own cash, so the
    carrier is paid after the reset in new FD.
  - Whatever it didn't need burns the day its last such paper is paid (`releaseLaunchHolds`).
- **A wound-down brokerage:** no stake and no paper means its licence has lapsed. It pays no surety premium and no
  renewal.
- **Reports:** `report.brokerage` gives each pair, the controls, the flows, the AI brokers beside them, and the bond.

Tests: `packages/engine/test/brokerage.test.ts`.

## 2. The batch

`runs/v59-k`: four years, seeds 1–10, the live profile with `brokerage.enabled`.

- A quarter of the carrier bots, chosen by id so no random draw moves, form a brokerage once the layer opens and they
  can spare the bond, the licence, a 15k float and the fee over their own reserve.
- Formation day: median 108, p90 656. 404 of the 422 pairs formed before the launch.
- The carriers that could have formed one and weren't chosen are the controls, 1,302 of them.
- A pair runs as a player would:
  - the brokerage brokers like an AI broker of its owner's persona;
  - the carrier passes tenders its trucks don't take (Rule A);
  - the brokerage tenders open loads to its own idle trucks at its book-now, held inside the band (Rule B);
  - weekly rescues go to whichever company is in the red;
  - monthly, profits go home;
  - an owner closes a brokerage that lost money over eight weeks once it has run a quarter.
- Two probes, seeds 1–3: own tenders at the band's ceiling (`v59-k-ceil`), and the same with the band widened to
  [0.5, 1.5] (`v59-k-wide`).

## 3. What the batch says

**Does a brokerage pay? Not in the beta. After the launch, slowly.**

| Ten seeds | Formed before the launch (404) | Formed after (18) |
|---|---|---|
| Brokerage operating result, median | −18k | +19k |
| Operating result positive | 33% | 16 of 18 |
| Revenue, median | 286k | 493k |
| Bond at the end, median | 0 (burned at the launch reset) | 75k |
| Gain for the owner, median (net worth now + capital home − capital in) | −90k | −12k |

- **In the beta brokering loses money.** The shipper pays a broker the lane's trailing contract level, and early in
  the beta spot runs above it, so the broker pays its carriers more than it is paid. The AI brokers beside them show
  the same: 60 a seed, an operating result of +3.1k each over four years on 2.24M of revenue, and 59 of the 60
  liquidated at least once, as in the run without player brokerages (v59-a: 59.2).
- **The launch reset burns a beta brokerage's 75k bond.** Stakes are beta FD and go at the reset, so nearly the whole
  loss of a beta brokerage is its bond. This is the rule as it stands, not a fault of the brokerage rule. It needs
  saying on the forming sheet, or the bond should come back to cash before the reset, where the working-capital rule
  keeps what it keeps. That is Jeff's call (§6).
- **After the launch the business earns:** +19k median over about a year and a half, roughly 4% of revenue. The
  licence, the surety (about 3–5k a year at the credit these brokerages reach), the fees and the bond's idle time
  aren't paid back by the run's end. A brokerage pays its owner over years, not months.

**Does it drain the carrier?**

| Ten seeds | Owner-operators: pairs | Owner-operators: controls | Fleets: pairs | Fleets: controls |
|---|---|---|---|---|
| Carrier net worth, mean / median | 65.5k / 40.4k | 64.9k / 36.1k | 169k / 77k | 228k / 136k |
| Pair total (carrier + brokerage), mean | 69.6k | – | 170k | – |
| Carrier liquidated at least once | 14% | 21% | 40% | 36% |
| Trucks at the end | 1.7 | 1.7 | 1.5 | 1.6 |

- **An owner-operator's carrier is not drained.** It ends as rich as the controls and is liquidated less often. The
  93k it put into the brokerage would mostly have burned at the year-end close and the launch anyway: cash over four
  weeks of spending is burned, and a stake isn't until the launch.
- **A fleet loses about the capital it put in.** That is 58k at the median.

**Can the pair move money between themselves for an advantage?** Per seed, over four years:

| Channel | Volume | What it can move | What it gains |
|---|---|---|---|
| Rule B own tenders | 46 booked, 106k FD | pay inside the band; 36 of 46 at an edge, the book-now held in | the carrier was paid 0.905× the lane rate, the market 0.931×: within the band, about 3% of 106k moved to the brokerage |
| Own carrier winning its brokerage's board loads | 17 | the board's own price | 0.999× the lane rate: the market |
| Rule A passes | 163, 104 booked, 59 fell off | a contract load re-papered at the contract rate | none: the pair's revenue is the shipper's rate either way, and a fall-off costs more than the turned-down tender's slash |
| Capital transfers | 109: 3.8M formation capital, 0.4M more to brokerages, 0.65M home | anything, both ways | none: 147k paid in fees |
| Rescues | 33, 457k | a company in the red | survival, for the fee |

Moving money between two companies of one person buys something only where the rules treat two companies better
than one. I closed each such place in the rule:
- the profit-tax allowance: one per person;
- the airdrop's cap and score: one per person;
- the logbook's load count and the broker's Miles: once per person;
- credit: own payments left out;
- factoring: own paper never factored.

What's left is the 25k holding-cost floor each company has, which can shelter at most 25k per person (§6). A
brokerage's working capital (four weeks of its spending) protects more, but that is its own spending: a single company
doing both jobs would protect the same amount.

**The probes: own tenders at the band's edge.** Seeds 1–3, pairs priced at the band's ceiling every time:

| Seeds 1–3, per seed | Book-now in the band (main batch) | At the ceiling, ±15% | At the ceiling, band widened to ±50% |
|---|---|---|---|
| Own tenders booked | 48 | 54 | 42 |
| Own-tender pay | 117k FD | 162k FD | 181k FD |
| Own-tender rate ÷ lane rate (board clears: 0.93) | 0.905 | 1.150 | 1.500 |
| FD moved to the carrier over the market | about −3k | about 31k | about 69k |
| Pair total, mean / median | 126k / 72k | 134k / 84k | 120k / 68k |
| Carrier liquidated at least once | 24% | 18% | 27% |

At the ceiling the channel moves about 31k FD a seed from brokerages to their carriers: about 700 FD a pair over four
years. With the band at ±50% it moves about 69k. The pairs' totals move within the noise between runs, and in the
wide band they fall. The fee the channel avoids is 3% of what it moves, 1–2k FD a seed.

The channel is too narrow to matter, and it gains nothing: the tax, the airdrop, the logbook and credit already treat
the pair as one person. The band's job is to keep the pay plausible on screen, and to keep Rule B from becoming a
free way round the transfer fee.

**Does the bond stand?** Yes.
- The bonds of all brokers, AI and player, paid 18.9M of paper a seed, and only 5.8k a seed went uncovered.
- The AP cap refused 132 Rule A passes a seed at the brokerage's bond.
- There were 3,232 "under its stake" refusals a seed. Nearly all are bots retrying weekly sweeps out of a brokerage
  whose bond the launch had burned; the refinement in §1 lets those send their cash home.

**Should the bond rise with the brokerage's payables?** Not as a rule. The AP cap already makes it rise: a brokerage
that wants more freight posts more bond (the bots' `growBond`), and the cap held every brokerage's payables within its
bond. A larger fixed bond would only raise the wall for the first one.

## 4. The sizes

| Figure | Size | Why |
|---|---|---|
| Licence | 300 FD a season, as now | a nuisance cost only; its lapse with the stake ends a wound-down brokerage cleanly |
| Bond | 75,000 FD, as now | it covered everything but 5.8k a seed of 18.9M drawn, with the AP cap in front of it |
| Surety | 2–12% a year by credit, as now | player brokerages end at credit 86 (median), about 3.4% (2.6k a year); a new one starts near 50–60, about 5k a year |
| Starting credit | the engine's newcomer record, as now | the first year's premium, about 5k, is 2–3% of a year's revenue: no wall to forming, though it is most of a thin margin |
| Age gate on the carrier | none | the bond is the gate: the median pair formed at day 108, when the carrier could spare 93k |
| Transfer fee | 3% (Jeff) | it taxes routine sweeps; a rescue still happens |
| Transfer limit | none | no channel needs one (§3) |
| Band for own tenders | ±15% of the lane's trailing cleared rate | ±15% holds own tenders to 0.905–1.15× the lane rate, a channel of about 700 FD a pair over four years at its edge; ±50% doubles the channel and gains the pair nothing. Keep ±15% |

**A rescue at 3% against 1%.** The batch's rescues averaged 13.8k each. At 3% one costs 415 FD, at 1% 138 FD. Over a
seed's four years that is 13.7k against 4.6k. Either way it's far less than what it saves: a liquidation takes the
company's trucks at fire-sale prices and its credit with them. 3% doesn't stop a rescue. It makes keeping a fat float
in the other company, "just in case", cost something, which is the point of the fee.

## 5. Double brokering by player carriers: closed in this bump (Jeff)

Close it in the rules now, with the brokerage. The Back Lot keeps the AI's.

- Today the action is only off the screens (60d1a26). The rule still lets a player carrier re-post a load it won,
  keep the spread and, if it chooses, not pay.
- With a legal brokerage one tap away, the only thing the illegal path adds is the chance to steal from the hauler.
- The economy doesn't need it: none of the batch's figures depend on player double brokering.
- In the engine this is `brokerage.closeDoubleBrokering` (true under the switch). It refuses `rebrokerLoad`, the
  action and a re-post standing order for any human carrier and any carrier with a brokerage.

**What it changes for the fraud layer.**
- **Double brokering becomes an AI act only.** The outlaw carriers keep their re-post orders, the Back Lot keeps
  them, and every case, conviction and unpaid hauler in `fraud.ts` stays as it is for them.
- **A player can be a victim but never the double broker.** A player's brokerage or carrier still meets AI double
  brokers on the board, so the vetting tiers keep their job, and player brokerages need them most.
- **No player can steal a hauler's pay through an unpaid re-post any more.** The theft paths that remain open to
  players are the hired crews of the Back Lot.
- **In the batch:** the carriers that formed brokerages stopped re-posting. Double-brokered loads fell from 294 to
  263 a seed over four years. Only player-like pairs are affected; in a world of human players, every player carrier
  is.

## 5a. The launch hold, sized

The director's rule: a beta brokerage's bond burns at the launch reset like every beta stake, except the part
standing behind paper still open, which burns only once that paper is paid, so no carrier goes unpaid across the
launch.

Before this rule, the reset called every broker's bond on its open paper at once (`callBond`). The carriers were paid
in beta FD the moment before the reset burned their own wallets down to working capital, so most of what they were
paid burned with it.

Seeds 1–3, the main batch's pairs (`v59-k`), then the hold (`v59-kl`, `v59-kl2`):

| Seeds 1–3, per seed | Bond called at the reset (v59-k) | Hold, paid from cash first (v59-kl) | **Hold, kept bond pays first (v59-kl2)** |
|---|---|---|---|
| Bond kept behind open paper at the reset | – | 656k | 656k |
| Paid out of it to the paper's holders | all, at the reset | 242k | **656k** |
| Burned once the paper was paid | – | 414k | 0 |
| Days the holds lasted | – | 29 (the net-30 terms) | 29 |
| Uncovered paper | 0 | 10.4k | 0 |
| Brokerages liquidated at least once | 27% | 16% | **9%** |
| Owner's gain, median | −90k | −33k | −29k |
| Liquidations, all | 395 | 382 | 371 |

**The kept bond pays its own paper first.** I built the hold first with the paper paid from cash first. That made the
brokerage's new FD pay for beta freight while its beta bond burned unused: 414k a seed burned after doing nothing. With
the kept bond paying first:
- every FD of the 656k kept a seed pays the paper it stood behind;
- the carriers are paid after the reset, in new FD;
- the brokerage's own cash starts the new era untouched;
- nothing is left over to burn, so the late burn is 0.

The owner's median loss falls from 90k to 29k. Brokerages that went under at least once fall from 27% to 9%.

Two changes landed between the main batch and these runs, and both feed the owner's gain:
- the transfer guard's refinement (a wound-down brokerage may send its cash home);
- carriers with a brokerage no longer carry a re-post order.

The hold is what moves the liquidations and the uncovered paper.

**Size:** none to set. The hold is bounded by the paper open at the reset, up to the bond (656k a seed across about
45 pairs, about 15k each), and it lasts the payment terms, 30 days.

## 5b. The sizes at which a post-launch brokerage pays

The producer's question: at which sizes does a well-run brokerage formed after the launch earn a positive operating
result inside its first year, and pay back its licence, surety and fees inside two? The constraints are sensible
margins, the AP cap respected and factoring at 5%, with the fewest levers changed. Jeff decides; the current sizes
stand until he does.

**The batch.** `runs/v59-p0`…`p3`, seeds 1–3 each, the live profile, `brokerage.bots.fromDay` 760.
- A quarter of the carrier bots form a brokerage once they can, but not before a month after the launch. That gives
  about six pairs a seed, formed around day 1,000.
- "Gain" is what the brokerage has made for its owner: its FD (bond and contract accounts in) plus the capital sent
  home, less the capital put in. So the licence, surety, fees and losses are all paid out of it.
- A pair formed after day 730 has no two-year mark inside four years. The two-year test is read from the one-year
  mark and the operating pace.

| Seeds 1–3 | P0: today | P1: board fee 1% | **P2: surety 1–6%, credit premium 10%** | P3: brokerage margin 5% |
|---|---|---|---|---|
| Levers changed | – | `board.posterFeePct` 0.03 → 0.01 | `permits.suretyPctPerYear` [0.02, 0.12] → [0.01, 0.06]; `token.credit.premiumMax` 0.2 → 0.1 | bots' broker margin 5% (no rule) |
| Year 1: operating result, median (positive) | +2.3k (55%) | +14.4k (89%) | **+19.9k (82%)** | +7.7k (83%) |
| Year 1: owner's gain, median (paid back) | −11.2k (18%) | −9.0k (33%) | **+5.5k (64%)** | +1.8k (58%) |
| At the run's end: gain mean / median (positive) | +4.8k / −9.1k (24%) | +38.1k / +4.2k (60%) | +5.8k / +4.4k (63%) | +6.9k / +2.9k (67%) |
| AI brokers: operating over four years, mean | +17.3k | +71.9k | +44.4k | +22.1k |
| AI broker liquidations a seed: beta / after the launch | 63 / 49 | 62 / 37 | **55 / 3** | 63 / 49 |
| Board cleared rate | 3.948 | 3.967 | 3.935 | 3.946 |
| Operating sinks ÷ faucets, whole run | 90.4% | 90.9% | 90.7% | 90.6% |
| Supply at the end | 59.2M | 64.4M | 59.7M | 57.9M |
| Liquidations, all | 375 | 381 | 340 | 382 |

**Today's sizes almost pass.** A median post-launch brokerage is operating-positive in its first year by a hair, and
still 11k short of its outlay at one year.

**P2 passes with two levers, both on the cost of weak credit.** A new brokerage starts near credit 50–60, and that
costs it twice:
- carriers ask up to 20% more to haul its paper (`premiumMax`);
- the surety prices its bond at up to 12% a year.

Halving both, the median brokerage earns about 20k in its first year, and two-thirds have paid back the licence, the
surety and the fees within it. Two years is then comfortable at the median.

**What P2 costs.**
- It is the only variant that also saves the AI brokers after the launch: their post-launch liquidations fall from
  49 a seed to 3.
- Carriers' rates move 0.3% (cheaper broker paper means slightly lower asks).
- The sink ratio and supply barely move.
- `premiumMax` also prices a player's paper at the factoring pool and the surety premium itself, so it is one lever
  with three readers.
- What it can't do: beta brokering still loses (55 AI liquidations a seed in the beta), because the shipper pays a
  broker the trailing contract level while spot runs far above it early in the beta. That is the contract index, not
  a brokerage size.

**P3: a thinner margin is a player's choice, not a rule.** At 5% the player brokerages win more tenders and fall
off less. Year 1 is positive for 83% and 58% have paid back, but the median earns less than P2's (+7.7k), and the AI
brokers are untouched. A sensible margin helps; the layer's sizes are what fail the AI.

**P1 isn't the lever.** Cutting the board fee to 1% raises every broker's result, but brokers still go under after
the launch (37 a seed), and supply ends 9% higher. It also cuts what player shippers (facilities) pay, and removes
2.2M of sinks a seed.

**My recommendation for Jeff:** P2. Set the surety at 1–6% a year by credit, and the credit premium's maximum at 10%.
Keep the board fee, the bond and the margins as they are.

## 5c. The hold, and a brokerage's first orders

Engineering built the screens on the patch and found two gaps. Both are now in the engine, behind `brokerage.enabled`.

**The hold** (the director's brief §3a, answer 1):
- **For player brokerages only.** A shipper's tender to one is held off the board for `contracts.tenderHours` (12 game
  hours, about one board round): `Load.hold`, `startHold` in `freight.ts`, `mayTake` refuses a held load to every
  carrier. AI brokers post at once, as today.
- **During the hold** the owner may:
  - post it at a margin of its choosing (`post_tender`, `postHeld`);
  - tender it to the own carrier inside the band (`tender_own` takes it straight from the hold);
  - decline it (`decline_tender`): it goes on as the shipper's own spot freight on the open board, as when no broker
    takes one.
- **At the window's end** (`holdsAtEnd`, each round after the tenders) the standing order acts. With
  `ownFirst: true` on the broker order, it tenders the load to the own carrier first, when a crewed truck of that
  trailer stands idle at the pickup's hub, at the order's margin held inside the band; otherwise it posts at the
  order's margin. With no order, a tender is declined.
- **A passed load** (Rule A) can't be declined and is never dropped. Its hold is the rest of the carrier's window, and
  then the order posts it, or `brokerage.defaultMarginPct` does.
- Hand calls share the hold. A held load neither rolls over nor falls off while it waits.
- Counted in `report.brokerage.holds`: held, posted by hand, posted by the order, declined, sent to the own carrier,
  passed loads posted at the default.

**The first orders: `formBrokerage` should set them itself, and now does.** A brokerage with no broker order gets no
tenders, so without one it is dead on arrival. The defaults:

| Key | Size | Why |
|---|---|---|
| `brokerage.defaultMarginPct` | **5%** | the post-launch sizing (§5b): at 5% a new brokerage wins more tenders (shippers weight brokers by 1 ÷ margin²) and loses fewer to fall-offs; year 1 positive for 83%, 58% paid back. Engineering's 10% wins few tenders; the AI's 7–12% did worse (P0) |
| `brokerage.defaultOpenLoads` | **20** | the AP cap binds first: a 75k bond carries about 25 posted loads at a typical 3k (about 650 miles at a 4.3 ceiling), so 40 is never reached; 20 leaves room for what's booked |
| `brokerage.defaultVetting` | 1 (standard) | 30 days of authority. It keeps the newest carriers, and the AI's fresh double brokers, off its paper without shrinking the field much |
| `brokerage.startCashFd` | **15,000** | the working cash on the forming sheet: the first year's surety (about 5k at a new brokerage's credit), the licence, and about a month of fall-off charges and shipper defaults. Engineering's prefill (the bond, the licence and the first year's premium) leaves no float. Shipper and carrier paper are both net 30, so no other float is needed. The batch's pairs started this way |

So the forming sheet's capital is the bond (75,000), the licence (300) and the start cash (15,000): 90,300 FD, and
93,009 with the 3% transfer fee. Engineering's first `set_standing_orders` and `set_vetting` can go; the owner
changes them later.

**A check with the hold on** (`runs/v59-ph`, seeds 1–3, post-launch formation, the bots at the 5% default and 20
loads): against P3 (the same 5% margin, 40 loads, no hold):

| Seeds 1–3 | P3: 5%, 40 loads, no hold | **Hold on, 5%, 20 loads** |
|---|---|---|
| Year 1: operating result, median (positive) | +7.7k (83%) | **+24.4k (85%)** |
| Year 1: owner's gain, median (paid back) | +1.8k (58%) | **+10.4k (85%)** |
| Gain at the run's end, median (positive) | +2.9k (67%) | +10.0k (79%) |
| Holds a seed: held / posted by the order / declined / to the own carrier | – | 2,040 / 2,033 / 3 / 4 |
| Board cleared rate | 3.946 | 3.957 |
| Liquidations, all / sinks ÷ faucets | 382 / 90.6% | 365 / 90.5% |

With the defaults, a post-launch brokerage pays back its licence, surety and fees within its first year on 85% of
pairs. The 20-load default keeps it inside what its bond carries, so it takes fewer loads it can't place. The hold
costs nothing: the bots' orders post 99.7% of held tenders at the window's end. A human owner's hand calls replace
that.

## 6. For Jeff and the producer

- **To switch it on:** `brokerage.enabled` with the ruleset bump and a restart with no players. Engineering builds the
  client side: the second join per uid, the company switch, the forming sheet, Pass to {brokerage}, Tender to
  {carrier}, and Intel's two rows.
- **The beta bond (decided):** it burns at the reset like every stake, except the part behind open paper (§5a). The
  forming sheet should say so plainly.
- **Jeff's call 2: the 25k floor.** The holding cost's 25k floor (`holdingCost.minProtectedFd`) is per company, so two
  companies shelter 50k for one person. I'd leave it; it is small and a brokerage spends it.
- **Engineering:** the transfer guard's refinement (§1) is in the code.

## 7. Engineering's three config questions

1. **The transfer fee's key is `brokerage.transferFeePct`, 0.03.** That's the key the switch reads. UX and the
   writer's `brokerage.transfer.feePct` should follow it; there is no `transfer` sub-block.
2. **The bond rule is `token.staking.roles.broker`.** That's the stake a broker posts, and it is what everything that
   decides whether a brokerage trades reads:
   - the licence check (`brokerLicensed`);
   - the AP cap (`postedBondFd` is the stake);
   - the bond's queue;
   - the surety pool's cover (`receivables.ts`).

   `permits.brokerBondFd` is the bond's face value that the surety premium is charged on (`step.ts`), and the surety
   pool's exposure. Keep both, with engineering's test that they agree. Dropping `permits.brokerBondFd` would change
   the staking-off base config the tests run. When the next bump allows it, the premium should read the stake key and
   `permits.brokerBondFd` can go.
3. **The board fee's key is `board.posterFeePct`, 0.03, not `market.posterFeePct`.** It is the fee a brokerage pays
   for freight it posts: 3% of what the shipper pays it, charged on delivery as `sink:board_fee`.

   **A direct tender to the own carrier pays it too, as built.** The brokerage holds the shipper's freight on the
   platform either way, and the fee comes out of the shipper's payment. Charging it keeps Rule B neutral against
   posting the load: the band already holds the pay at the market, so an own tender saves a board round, not money.
   Waiving it would make hauling in-house three points better than brokering to a stranger, on a business whose
   whole margin is a few points (§3). The writer's [size] mark: yes, 3%.

## Files

- `packages/engine/src/brokerage.ts` (new); `types.ts`, `world.ts` (the partner link, the log, the actions);
  `actions.ts`, `board.ts`, `contracts.ts`, `receivables.ts`, `trips.ts`, `token.ts`, `fraud.ts`, `step.ts`,
  `population.ts`, `report.ts`, `index.ts`.
- `packages/config/src/economy.config.ts` (`brokerage`, off).
- `packages/agents/src/ruleBots.ts` (the pairs, a batch scenario under the switch).
- `packages/engine/test/brokerage.test.ts` (new).
