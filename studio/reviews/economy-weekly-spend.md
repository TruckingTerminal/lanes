# Economy: what counts as a week's spending (2026-11-10)

On QA's cushion reading after a truck bought on a loan (0.4 weeks at 6,929 FD, 1.2 weeks three weeks later), for the
producer. No engine edit; nothing run.

## Is it so

Yes, with one twist. `step.ts` l.146 reads the ledger's `outflowCents` for each company once a week, and the ledger
(`ledger.ts` l.140) counts an outflow as any posting from a company's account **to a sink**, except burns of cash itself
(the season close, the launch reset, the holding cost, swaps, the buyback) and, since the red team's E3-CAPINFLATE, the
NPC lease's deposit. Transfers to other companies and to escrows never count. So a truck's purchase counts in full when
it is bought from the NPC: the dealer's price (`sink:equipment_dealer`), a lot rig's (`sink:used_lot`), a facility's
(`sink:facility_dealer`), a business's (`sink:business_dealer`), and the sales tax on each; on a loan it is the whole
price that lands that week, since the lender's share arrives first and the price is paid as for cash. The loan's stake
and a listing bought from another company do not count (a transfer, not a sink); the 5% market fee on the listing does.
That is QA's 0.4 weeks: a lot rig's price in one week's "spending", averaged over the four weeks the guide keeps, and it
is also why the same purchase reads differently by route.

## Who reads it

Five readers share `Company.weeklySpend`, the last four weeks (`seasonClose.workingCapitalWeeks`):

| Reader | What it does with it |
|---|---|
| `solvency.ts workingCapital` | cash sheltered from the weekly holding cost: the larger of 25,000 and the four weeks' sum (the holding cost runs after the token launch on live) |
| `season.ts` | the season close keeps the larger of the carryover (25% to 25,000) and the four weeks' sum, and burns the rest |
| `cashReserve.ts reserveCapFd` | the Reserve's cap: 13 weeks of the mean weekly spend (`cashReserve.enabled` is on in live) |
| `ruleBots.ts operatingFloor`, the lock sizing | the prudent bot keeps two weeks of it out of the Reserve; a bot sizes its staking lock to its monthly spend |
| `apps/web figures.ts cushion`, Milestones | the guide's cushion in weeks (over `guide.cushionAvgWeeks`) |

## Should a capital purchase count

**No.** Every one of these rules was sized as operating burn: the holding cost's working capital and the season's
carryover shelter the cash a company needs to run four weeks (the §Circular economy's "working capital", and
economy-reserve.md sized the Reserve's cap as thirteen weeks of bills); the cushion is Iuliia's "weeks of your own
spending"; the bots' floor is two weeks of bills. A truck is not four weeks of bills; it is the thing the bills run.
Counting it has three effects, all wrong the same way:

- **The cushion lies to the player for a month** after a purchase (0.4 weeks with 6,929 FD in hand, when the true
  figure on an owner-operator's 1,500–2,000 a week of bills is three to four), which is the worst moment for it to.
- **A purchase is a shelter.** For four weeks after buying a 50k rig the working capital reads about 12,500 a week
  higher, the Reserve's cap 13 × that, 160k higher, and the season's carryover keeps the four weeks' sum instead of
  25,000 if the purchase fell in the last month of the season. That is E3-CAPINFLATE again with a truck instead of a
  deposit, and it is cheap: the red team's wreck (9.6k, resold at a 5% fee) would do it for 500 FD.
- **It is uneven by route:** a lot rig counts and a listing does not, so the same truck sets the cushion, the shelter
  and the Reserve's cap differently by where it was bought.

## The fix

One place, the ledger: add the capital refs to `NOT_OUTFLOW` so no reader sees them: `buy:` (the dealer's and the
lot's orders, tractors and trailers, with their sales tax, which posts under the same ref), `facility:` (a facility
bought), the business purchase's ref (`businesses.ts` l.63), and a listing's market fee (`listing:`, for the route's
evenness). Repairs, rebuilds, refurbishments, tyres and parts stay in: they are what keeping a truck costs. Loan
payments, lease rent, lease deposits (already out), yard rent, insurance, wages, fuel and tolls stay in. Behind a
switch (`ledger.capitalNotSpending`, say), default off, with the five readers unchanged, since they read the list.

**Does it move the gate?** Yes, a little, and it should be read: the bots' Reserve caps and sheltered working capital
fall after their purchases, so a little more of their cash meets the holding cost after launch and the season burn in a
purchase month, and the prudent bots' operating floor stops jumping after a truck. All of it is sinks of cash the rules
meant to reach, so the corrected ratio should read a hair higher, not lower, and nothing in freight moves. A pair on two
seeds against the twin on the same code is enough to say so before the switch turns; the ten seeds only if the two
move the band by more than its thousandths. It is a rule change on the live levers (the Reserve and the holding cost
read it), so a ruleset, and it can ride with 0.24.1's set if engineering has it before the cut and the two seeds read
clean; it does not need the restart on its own account, since it changes what a company keeps, not what it did.
