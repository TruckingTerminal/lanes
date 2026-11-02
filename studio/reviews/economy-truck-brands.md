# Economy note: three tractor makes (for the director, 2026-11-02; no build)

Jeff settled three makes, one per existing tier: **Keystone** the workhorse, **Meridian** the economical highway
truck, **Ironwood** the premium driver's favourite. Trailers stay unbranded, by type. Because a make is a tier, the
engine needs no new attribute. Each tier already keys its own price, mpg, upkeep, breakdowns and rebuild cost. Two
things are missing: driver appeal, and a depreciation curve of its own.

## Each make on its tier

Only the depreciation and appeal rows are new to the engine. The prices are the live mid prices.

| | Keystone (workhorse) | Meridian (highwayPro) | Ironwood (flagship) |
|---|---|---|---|
| List price, tractor (`dealerFd.tractor`) | 140,000 | 177,000 | 214,000 |
| mpg (`tractors.mpg`) | 6.5 | 7.6 (from 7.2: the fuel saver) | 7.2 (from 7.8: heavier, the cab and chrome) |
| Upkeep, FD a mile (`maintPerMile`) | 0.15 | 0.14 | 0.13 |
| Breakdowns (`breakdownMult`) | 1.0 | 0.7 | 0.5 |
| Rebuild (`wear.rebuildFd`) | 31,500 | 40,000 | 48,000 |
| Driver appeal (new: added to target morale) | 0 | +0.03 | +0.08 |
| Depreciation (new: points of list lost a year of age) | 6.5 | 5 (today's shared value) | 3.5 |
| Residual floor | the scrap share (3%) | 3% | 5% |

**The characters.** Keystone is the cheapest way in and the commonest on the used lot, with the worst resale.
Meridian is the cheapest truck a mile on the highway. Ironwood costs the most to buy, keeps its drivers and its
value, and breaks down least.

**Balance check.** All-in cost a mile over a five-year, 600,000-mile life, at 4.0 FD fuel and the live curve's life
share. Each line is fuel + upkeep + breakdowns + value lost:

- **Keystone:** 0.615 + 0.15 + 0.045 + 0.216 = **1.03 FD a mile**.
- **Meridian:** 0.526 + 0.14 + 0.032 + 0.250 = **0.95**.
- **Ironwood:** 0.556 + 0.13 + 0.023 + 0.277 = **0.99**.

That is within ±4% of each other. No make is simply best:

- **Keystone** saves 37–74k up front: the starter's choice.
- **Meridian** wins on miles: the fleet's choice.
- **Ironwood** wins on drivers and resale: the owner-operator who keeps a truck.

**Driver appeal must stay well under pay.** Target morale is 0.6 + 2 × the pay gap, so +0.08 is worth about a 4%
raise. It means fewer quits and poaches and faster hires, never a reason to underpay. The batch should check that
an Ironwood seat fills faster but a Keystone at market pay keeps its driver.

## What the engine needs for depreciation per make

- `tractorMarketValue` (`wear.ts`) uses the shared `cfg.depreciation.perYear` and the scrap share. Read both from
  the tier instead: `tractors[tier].depPerYear` and `tractors[tier].residualFloor`, and remove the shared value (or
  keep it as the default). Life used and the condition cut stay as they are.
- Everything that prices a used tractor follows on its own, because it calls this function:
  - the market value on the card, trade-in offers, fire sales and repossessions;
  - the used lot's price (`dealer.ts lotPrice`) and the loan's security;
  - physical-damage cover (a share of value);
  - the chop shop's take (a share of value).
- I'd keep one straight-line shape for all three and vary only the slope and the floor. It makes resale a real
  choice and the card still explains it in one line ("loses about 6.5% a year").
- **Driver appeal** is one term in the weekly morale target (`labor.ts`), read from `tractors[tier].appeal`, beside
  `wornTruckPenalty`.
- **Display names** come from the copy (`copy.ts`), keyed by tier: no engine change.

## What the used lot must know

- **Stock by make.** The lot holds one count today (`usedMarket.npcLot.stock`) of whatever tier a buyer asks for.
  With makes it should stock in a mix, for example 60 / 30 / 10, like the factory's `tractorMix`, so a starter
  mostly finds Keystones and the rare used Ironwood is an event.
- **Prices follow each make's curve.** At the lot's four years and 450k miles, Keystone keeps less than Ironwood:
  the free path's real choice between cheap now and worth more later.
- **The lot's age and miles** (`ageYears`, `odometer`, `milesSinceRebuild`) can stay shared at first. If Jeff wants
  fleet trade-ins to look older than owner-operators', the lot can draw them per make later.

## What the insurer must know

- **Physical damage** already prices from value, so an Ironwood pays more cover in its first years and keeps paying
  more as it holds value. No new code.
- **Liability** stays per truck. If Meridian is to be the safety pick, a per-make factor on the crash odds (not on
  the premium) is the honest lever; the loss ratio then prices it in by itself. I'd leave it out of the first pass.
- **Theft:** the chop shop already takes more of a dearer tier (`robbery.lot.board.chopShareByTier` 0.15 / 0.20 /
  0.25), so Ironwood is the thieves' favourite with no change.
- The market index stays one index for all makes.

## For the director

Confirm the three characters and the numbers to size. The build is small: three config rows and two engine reads,
plus the lot's mix. The economy sizes it in one batch with the bots choosing by persona. The starter and greedy
fleets would buy Keystone and Meridian; the conservative owner-operators would buy Ironwood. Like any asset change,
it ships with a ruleset bump and a restart with no players.
