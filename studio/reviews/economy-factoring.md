# Economy review: factoring as a contract, no pools (2026-11-02)

Economy designer, for the producer. Jeff's decision (studio/DECISIONS.md, 2026-11-02) and his three follow-ups the
same day: the rate falls in a straight line from 6% at one truck to a 2.5% floor at fifty, fixed for the term and
re-read at renewal; brokers factor at a flat 5%; a broker's accounts payable never pass its posted bond; the fees are
sinks that refill the reserve, never burns. Nothing is committed. Live levers and the ruleset are untouched. Batch:
v56-a, with v56-0 as the control (`runs/compare-v56.md`).

## 1. The rule as built

**Switch:** `token.payment.factoring.contract.enabled` (default off) in `packages/config/src/economy.config.ts`.
It only acts while `token.payment.enabled` is on, as it is in the live levers. Keys under it:

| Key | Value | Reads |
|---|---|---|
| `months` | 3 | a term runs `months × time.daysPerMonth` = 90 game days from signing (22.5 real days at the live clock) |
| `wholeFleet` | true | every invoice of every truck the company runs under contract goes to the factor, trucks added mid-term too; quick pay is closed while it runs (false: only the trucks it was signed for) |
| `rateByTrucks` | `[[1, 0.06], [50, 0.025]]` | a carrier's discount per invoice by operating trucks: straight lines between the points, flat past either end |
| `brokerRate` | 0.05 | a broker's discount, flat ("capital depots ... don't scale with factoring") |

**The contract** (`receivables.ts`). Choosing factor (`set_pay_terms`) signs a term with the NPC factor. There is
no stake: Jeff's terms name none, and nothing has to be forfeited because the contract can't be left early. Choosing
net or quick pay while a term runs doesn't end it; it sets the terms the contract lapses into at its end. Choosing
factor again while it runs renews it at its end. At term the contract renews if asked, at the rate the fleet sets
that day, or it lapses. The NPC factor pays every invoice on delivery: the full amount from `faucet:npc_factor`, less
the discount, which goes to **`sink:factoring_fee`**. It buys two kinds of paper. An NPC shipper's always pays, so
nothing moves when it falls due. A bonded broker's is a carrier's invoice to its broker, which the broker repays
into `sink:npc_factor` at due. A player shipper has no bond behind its paper yet, so that invoice waits net-30 even
under a contract. Leased trucks keep the lessor's same-day pay, with no discount. A liquidation ends the contract;
the factor keeps the paper it bought. Off, the one-year contract with its stake runs exactly as before. v56-0
reproduces v55-a to the digit.

**Why the rate is fixed for the term and re-read at renewal.** A term is a price agreed for three months. If the
rate were re-read every month, a fleet that grows mid-term would get cheaper during the contract, and one that
shrinks would get dearer, which is no contract. Renewal every 90 days follows the fleet closely enough.

**Jeff's line**, 0.071 points a truck:

| Trucks | 1 | 2 | 5 | 10 | 15 | 20 | 30 | 40 | 50+ |
|---|---|---|---|---|---|---|---|---|---|
| Discount | 6.00% | 5.93% | 5.71% | 5.36% | 5.00% | 4.64% | 3.93% | 3.21% | 2.50% |

`company.maxTrucks` is 30 and the staking tiers stop at 30. So no company can reach the floor today, and the
cheapest contract the game can write is 3.93%.

**The pools stand down under the same switch** (`pools.ts poolsOn`; Jeff: "For now, let's not use the pools"). No
pool lever changes value, and `token.pools.enabled` stays on: it now only lets units already deposited leave
through the exit queue. With the switch on, `poolsOn()` is false. That retires every lever of the three lines:

- `token.pools.insurance`: `priceOfBase` 0.8, `thinMarkup` 1.3, `backstopMarkup` 1.25, `minCapitalRatio`, `deductibleStake`.
- `token.pools.factoring`: its markups. The contract's rate replaces the old 4% × 1.4 NPC price.
- `token.pools.surety`: `thinMarkup` 1.3, `backstopMarkup` 1.25.
- The `deposit_pool` action, which is refused.

The NPC insurer writes every policy at its own price: base × risk × garaging × the market index, with no backstop
markup, since there is no pool to be thin. Its premiums go to `sink:insurance`. The NPC surety charges the plain
bond premium to `sink:surety`. Not touched: staking, purchase loans, and the Equipment Finance depositors' desk
(`finance.ts`, its own config). Also unused under the switch: `payment.factoring.discountNpc`, `discountPlayer`,
`termDays`, `stakePerTruckFd`, `stakeBrokerFd` and `earlyExitForfeits`.

**Every fee is a sink that refills the reserve, never a burn.** `sink:factoring_fee`, `sink:insurance` and
`sink:surety` are plain sinks, as `sink:npc_lease` (the lessor's share) is. None of them is in `CIRCULAR_BURNS` or
`BURN_TAGS`. Under `token.circular` the ledger credits them to `reserve` (`ledger.ts`: "a sink refills the
reserve"), and they count as operating sinks in the balance dial.

**Brokers: accounts payable within the posted bond** (Jeff: "Brokers can't take on more AR than what their posted
bond shows right now"). A broker's accounts payable are what it owes carriers on loads it has booked and not yet
paid. That covers the loads in flight at their cleared rate (a re-posted load at the rate its double broker took
it at) and its delivered, unpaid invoices, whoever holds them: the carrier, the factor or the lessor. Its posted
bond is its stake (the 75k licence stake and anything posted over it). The bond premium is still charged on the
licence's 75k. The rule is checked at three points:

- **Tender:** a broker passes up a tender whose ceiling would push what it owes plus what it has open on the
  board past its bond. The tender goes to another broker, or to the open board as direct NPC freight. The broker
  gets a notice once a game day: "A shipper's tender passed you by: ... can't owe carriers more than its posted
  bond ... Post more bond to take more freight."
- **Booking:** a sealed bid or a book-now on its load that would push it over is refused: "<broker> can't owe
  carriers more than its posted bond (x FD owed, y FD bond)".
- **Unstaking:** the bond can't be pulled under what it backs: "your bond backs what you owe carriers: pay it down
  first".

When the broker's paper falls due, it pays from its cash, then from its bond, with the NPC factor's and lessor's
paper first. A carrier's own paper is paid from the bond only beyond what the NPC holders are still owed. An
overdraft is used only if the bond is spent too. A broker in liquidation keeps its stake as the bond until its last
invoice is paid, then the stake goes to its cash and the restart follows. A revocation's slash and the launch reset
call the bond on all its paper first.

**Brokers factor too, at 5%, in the same contract shape.** A broker's book is all NPC paper (its shippers always pay,
and a shipper default happens before any invoice exists). So the factor carries no risk on it, and the contract can
be the same: three months over the whole book, no early exit. I found no reason for the shape to differ. The only
differences are that the rate is flat and there is no fleet to re-read. Factoring doesn't widen what a broker may
owe: the cap is on its payables, not its cash.

**Why no faucet remains.** The NPC factor's advance is a faucet only if nobody ever pays the invoice behind it:

1. **NPC paper:** the advance is NPC-to-NPC. The shipper's payment and the factor's collection are the same
   reserve, and the discount is a sink.
2. **A broker's paper:** at due it is paid by the broker's cash or by its bond, before any overdraft. The bond
   always covers it, because payables can never pass the bond (checked on every tender and booking) and the bond
   can't shrink below them: unstaking is refused, and a slash, the launch reset or a liquidation pays the paper
   first. The same holds for the lessor's same-day pay on broker paper.
3. **A player shipper's paper:** the factor doesn't buy it.

So there is no recourse to build. The general insolvency write-off (a company's own red balance at its restart)
stays the existing rule, and the factor no longer feeds it. In v56-a no NPC-held paper went unpaid and none was paid
from an overdraft: 0 and 0 FD, against 2.4M FD of factor and lessor paper that the bonds paid.

**The insurer, as asked:** premiums are the sink, claims are the faucet (`faucet:insurance_pd` and
`faucet:cargo_insurance`), and every claim counts in the loss ratio that moves the market index (`recordClaim`). That
index prices staged claims back into everyone's premiums. The change only removes the pool as a writer. Every
policy is now the NPC's, and every claim is still recorded. The index ran 1.00 / 1.38 / 1.38 (low / high / end) in
both batches.

**Purchase loans (the writer's question).** The first truck's purchase loan is the NPC lender's
(`equipmentFinance.purchase`: `faucet:npc_finance` lends, and repayments go to `sink:loan_principal` and
`sink:loan_interest`), with the deposit credit. It was never funded by a pool, and neither is the Equipment Finance
depositors' desk (`finance.ts`). The switch changes neither. Iuliia's "the Money tab's purchase loan covers the
rest" can go back in. In v56-a the lender made 46.3M FD of purchase loans (36.8M in v55-a).

**Bots** (`packages/agents/src/ruleBots.ts manageFactoring`):

- **Carriers:** a carrier that owns a truck and runs no NPC lease signs when its cash falls under about a month of
  its costs. That month is its operating costs over the last four weeks, scaled to 30 days, plus a month of
  purchase-loan payments. It renews at term while it is still that thin. The free path never signs: the lessor
  already pays on delivery.
- **Brokers:** a broker signs while its cash is under its working cushion, and only if its margin after the 3%
  board fee still covers the 5%. It doesn't factor at a loss on every load. A broker's month of costs is mostly
  carrier pay its own invoices cover, so the cushion is the honest threshold.
- **Brokers' bond:** once a week, a broker whose books fill 80% of its bond posts what it can spare over its
  cushion, up to 25k. Without this, the bots would never grow a bond.
- **Out of contract:** quick pay when half short, as before.

**Tests:** a describe at the end of `packages/engine/test/engine.test.ts`, eight tests:

- The term, no early exit, the lapse, and a renewal that re-reads the fleet.
- The schedule and the broker's flat rate.
- The whole fleet, a mid-term truck, the wholeFleet-false case, and the discount to the sink and the reserve with
  nothing burned.
- The pools standing down, with the NPC insurer at its own price.
- A defaulting player shipper whose paper the factor never buys.
- The AP cap at booking and posting, and the unstake block.
- The cap holding every day while the bots run a world, with no faucet.
- The make-whole: the factor first from a short bond, the bond held through the liquidation, and a full bond paying
  everyone.

Typecheck clean; `npm test` 230 of 230 (222 before).

## 2. What v56-a shows

Seeds 1, 4, 8, 400 days. Means, with min–max where the table has it.

| Measure | v55-a (switch off) | v56-a (switch on) |
|---|---|---|
| Carriers / brokers that signed | old contract: 459 / 0 (v56-0) | 518 of 520 / 31 of 60 |
| Contracts signed / renewed / lapsed | | 1,200 / 638 / 683 |
| Carriers' first signing by fleet: 1 / 2 / 3–5 / 6–10 / over 10 trucks | | 382 / 44 / 66 / 26 / 0 |
| Invoices factored, carriers / brokers | | 401.7M / 4.8M |
| Discounts paid, carriers / brokers (sink) | | 23.5M / 242k; carriers' mean 5.85% |
| Starters signing within 30 days of their first truck's first day | 9 (2%, old contract, v56-0) | 301 of 400 (75%; 283 / 294 / 325) |
| One-truck owners liquidated after buying | 25 of 422 (5.9%, v56-0) | 23 of 382 signers (6.0%); 0.3 of 2.3 non-signers |
| Liquidations | 157 (131–186) | 93 (80–105) |
| …companies liquidated at least once: owner-operators / fleets / brokers | 26 / 11 / 60 | 24 / 14 / 51 |
| Companies in debt at end / debt written off at restart (faucet) | 45 / 525k | 20 / 184k |
| Free path: median days to a first truck / bought within 84 days | 52 / 289 | 36 / 344 |
| Owned trucks at end / purchase-loan defaults | 717 / 49 | 734 / 42 |
| Avg wealth: owner-operator / fleet / broker; wealth Gini | 76k / 223k / −348; 0.52 | 101k / 232k / 4k; 0.47 |
| Operating sinks, all tags | 451.9M | 488.0M (+36.1M, +8%) |
| Factoring discounts / insurance / surety / the lessor's share (sinks) | 0 / 3.9M / 31k / 20.5M | 23.7M / 4.3M / 237k / 19.2M |
| Sinks with burns ÷ faucets, whole run; operating, quarterly | 87%; 82% | 90%; 84% |
| Supply before year-1 close | 82.9M | 87.9M |
| Broker AP cap: tenders passed up / sent to the open board / bids and bookings refused | | 58.6k / 52.6k / 24 |
| Brokers' bonds: paper paid (to the NPC factor or lessor) / NPC paper unpaid / paid from an overdraft / posted at end | — / — / — / 0 (v56-0) | 2.5M (2.4M) / 0 / 0 / 389k |
| Brokered / direct NPC loads delivered; carrier pay per mile | 3,404 / 135,012; 4.17 / 4.80 (v56-0) | 2,809 / 134,355; 3.82 / 4.76 |

**What the numbers say.**

- **Who signs.** Almost every carrier that owns a truck goes thin under net-30 and signs, nearly all of them small.
  No company over eight trucks ever signed, and the realised discounts ran 6.00% at one truck to 5.64% at six. The
  schedule's slope hardly bites in this world.
- **Liquidations fall by 41%, mostly brokers'.** Their bonds now pay their paper instead of an overdraft, so fewer
  repeat liquidations. Owner-operators and fleets liquidated about as often as before. One-truck owners went under
  at 6% with or without the contract, so it doesn't change a starter's odds; it changes who the losses fall on.
- **The write-off faucet falls by two thirds** (525k to 184k), and companies in debt at the end fall from 45 to 20.
- **The free path is 16 days faster.** This is mostly the old bot policy's doing: it signed starters on the lease,
  where the lessor already pays on delivery, and locked 15k of their savings in the stake for a year. Without the
  stake they buy a truck sooner (344 within 84 days against 289), which is where the extra trucks, loans and
  dealer sales come from.
- **Supply at the year-1 close is 6% higher.** Paying on delivery turns about a month of receivables into cash.
  The money isn't new: the whole-run sink ratio rose from 87% to 90%.

## 3. Is this a real sink that is good for everyone? (Jeff)

**It is real and large.** In v56-a the discounts were 23.7M FD: 4.9% of all operating sinks and the fifth largest,
after driver wages (101.6M), fuel (93.7M), new equipment (40.2M) and rebuilds (28.6M). That is more than the
lessor's share (19.2M) and more than the fuel tax (12.2M) or the sales tax (12.8M) on its own. It refills the
reserve that pays NPC freight, so it comes back as rates, not as a burn. The balance dial ended at 0.57 against
0.55.

**Who pays it.** The thin pay it. 75% of starters sign within 30 days of their first truck and pay about 2,000 FD a
month on one truck. What they buy is the 30-day hole closing, and the batch shows the economy is better for it:

- 41% fewer liquidations.
- Two thirds less debt written off: a faucet everyone else pays for in dilution.
- Fewer purchase-loan defaults.
- Brokers that keep their bond.

**Big fleets won't use cheap capital to stop managing cash.** No fleet can reach fifty trucks: the cap is 30, so
the cheapest contract is 3.93%. Cash is cheaper: after the launch, a month of spending is exempt from the 2%-a-week
holding cost, so a fleet that keeps a month of working capital pays nothing to hold it. Factoring at 3.9% a month
is about 48% a year on the money it frees. The contract only pays receivables early: wages, fuel and loans still
come due weekly, so it can't replace cash management. In v56-a no fleet over eight trucks signed. The bots sign
only when thin, and a rational large fleet would do the same.

**The gap it opens is small.** Between a one-truck starter and the largest possible fleet it is 2.1 points of
revenue (6.0% against 3.93%): about 50 FD on a 2,400 FD load, only for companies that factor, and against an
existing gap of 3k against 5k FD profit per truck-week. On v56-a's actual signers it was under half a point. If
Jeff raises the truck cap past 30, the floor becomes reachable and the gap reaches 3.5 points. That is worth one
more look then.

## 4. Brokers' factoring, and whether brokered freight stays competitive

**31 of 60 brokers signed**, the bots whose margin clears the 3% board fee by more than 5%. They factored 4.8M FD
and paid 242k.

**A broker can barely afford the fee.** Its margin is 6–12% of the shipper rate. Take off the 3% board fee and the
shipper defaults (2% and more), and 1–7% is left; a flat 5% takes most or all of it. When every thin broker was
let sign (a diagnostic run before the margin guard), all 60 did, lost money, drew their bonds down and lost their
licences. At this rate, factoring is a last resort for a broker, which fits "capital depots".

**From the carrier's side, nothing changes:** a factored carrier pays its rate on every load, brokered or direct,
so its choice between them doesn't move. The stacking, a carrier at up to 6% and its broker at 5% on the same
load, falls on the broker's margin, not on the carrier's rate. Brokered loads paid carriers 3.82 FD a mile against
4.76 direct (4.17 against 4.80 with the switch off).

**The cap, not the fee, shrank brokered freight.** Brokered deliveries fell 17% (3,404 to 2,809). 52.6k tenders
found every licensed broker at its bond and went to the open board as direct NPC freight. Brokers ended richer
(4k average against −348), held 389k of bond at the end against none, and fewer were liquidated (51 against all
60).

**The live profile was already hard on brokers.** With the switch off, all 60 brokers lose their licence by about
day 70 on seed 1 and never post it again. That is the live profile's problem, not this rule's, and worth its own
look.

## 5. For the writer: what Iuliia tells an owner-operator about capital

**A month of costs for one truck, from the config:**

- **Per mile, 1.64 FD:** fuel 4.0 FD a gallon at the Workhorse's 6.5 mpg is 0.62; the fuel tax 0.08; the driver
  0.75; maintenance 0.18 plus 7% sales tax.
- **Miles:** a truck runs about 12,000 miles a month in the world, so about 19,700 FD.
- **On top:**
  - The loan on a used-lot rig (about 48k at 10–20% down over 104 weeks): about 2,400.
  - Insurance at a new authority's rating: 450–700.
  - Tolls, idle fuel and layovers: about 1,000.
- **Total: about 24,000 FD a month.**

Starters' own books in their first 28 days agree: 30k of running costs, the 6% discount included. 43% of used rigs
also needed a rebuild in that first month, 31,500 FD on a Workhorse.

**Quick pay and the contract on a typical load** (500 miles at year one's 4.8 FD a mile, 2,400 FD):

- **Quick pay:** 240 FD (10%), on the loads you choose, when you need it.
- **The contract:** 145 FD (6% at one truck) on every load for three months, about 2,000 FD a month and 6,000 FD a
  term. You can't leave it early.

**One paragraph for Iuliia:** "Before you sign for a truck, count a month. One truck costs about 24,000 FD a month
to run, and the shipper pays you thirty days after you deliver, so you need that month in the bank after the down
payment, and on a used rig the 31,500 FD a rebuild costs. If you're short, quick pay takes a tenth of a load when
you need it. Factoring pays every load the day you deliver for 6%, but it's a three-month contract on every truck
you have, and you can't walk away from it. Most new owners who sign do it because they bought the truck before they
had the month. Have the month."

## 6. The rings on a fresh world (QA, day 3)

**Yes, the fresh-world reading runs low by construction.** I sampled the page's own world (`apps/web game.ts
newWorld`, read only) and the card's measure (`hubcard.ts seasonMeasure`, its four-round mean) every round on six
fresh worlds, seeds 1–6. On the page's opening day (day 2, 06:00, after `WARM_HOURS` 54), a hub reads a median 12%
of its own level once warmed (days 7–13), and the lowest quarter reads 8%. The ratio climbs about 13 points a day
and reaches 100% by day 8 or 9:

| World's day (06:00) | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| Median of fresh ÷ warmed | 0.00 | 0.03 | 0.12 | 0.26 | 0.37 | 0.53 | 0.66 | 0.83 | 0.96 | 0.99 |

There are three causes:

- **The board starts empty.** It is a stock of open loads, and loads stay up to `board.giveUpAfterRounds` (10
  rounds) with their ceilings rising 10% a round. The share that clears the 25% margin grows with a load's age,
  and on day 2 no load is older than four rounds.
- **The four-round mean averages in the first, emptier rounds.** Dallas on seed 1 read 0.00, 0.21, 0.42 and 1.25
  over its first four rounds.
- **The first bids land on the starter hubs.** Every starter's truck begins at one, and the bots bid by hand at the
  first midnight.

QA's Dallas matches: 0.97 and 0.39 on seeds 1 and 2, against 9.2 and 4.1 warmed. So on the opening day only 13 of
the 49 hub-worlds that read fine or busy once warmed read fine.

**Proposal: a short ramp, as config.**

- **The key:** `ui.season.ramp: [[0, 0.2], [2.5, 0.2], [8.5, 1]]`, [world's day, factor] points with straight
  lines between them and flat past the ends.
- **How it reads:** the card compares the four-round mean against `thinUnder`, `fineFrom` and `busyFrom` × the
  factor at the world's age, `dayOf(w.t)` counted from the world's first day.
- **The calibration stays:** from day 8.5 the factor is 1, and the warmed calibration applies.

On the six worlds:

- **The opening day:** 44 of the 49 warmed fine-or-busy hubs read fine or busy, and none of the 11 warmed thin or
  a-little-thin ones does.
- **Days 3–7:** three or four of those eleven read fine a few days early. They are the marginal ones (warmed
  0.9–1.1, just under the 1.5 line).
- **From day 8:** the reading matches the warmed class as before.

The other way is to warm the page's world to day 8 before it opens and keep the cut points. That is engineering's
cost to weigh: six more game days replayed on every load. The ramp is the cheaper fix. Wiring it is one line in
`seasonLine()` (apps/web, engineering) and the key in the `ui` block. I haven't touched either.

## 7. For the producer

- **To switch it on:** add `"token.payment.factoring.contract.enabled": true` to the live levers, with the ruleset
  bump and a restart with no players. `token.pools.enabled` can stay as it is.
- **Engineering:**
  - Getting paid: the contract's term, its renewal choice, the rate by fleet, and quick pay closed while a term
    runs. Finance.tsx still describes the one-year contract and its stake.
  - The broker's cap notice and its bond line.
  - The ring ramp.
- **Writer:**
  - Iuliia's paragraph above.
  - The purchase-loan line can go back in.
  - The cap's refusal strings, which are drafts.
- **Next look:** brokers' viability in the live profile, worth its own batch.
