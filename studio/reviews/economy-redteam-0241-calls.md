# Economy: two calls on the red team's 0.24.1 pass, and the fatigue reset (2026-11-10)

On studio/reviews/redteam-0241.md §7 and §1, for the producer before the 0.24.1 ruleset. No engine edit; nothing run.

## 1. The collateral rule's ten new-business points (§7): key them to the company's age alone

**Call: the ten points apply while the authority is under a year old, whatever the company owns.** Drop the "has never
owned a truck" half of the condition.

- It is what the lender means. The sources behind the rule price a startup by its time in business (banks want two
  years, specialty lenders three to twelve months, a bigger down payment to offset less); none of them stops counting a
  company as new because it bought a wreck. The wreck-first dodge is the letter of my §6 read against the rule's intent,
  and the age alone is the intent.
- The alternative (a truck owned 30 days, or one that delivered a load) is a dodge with one more step: a wreck run for
  one short load, and a new field to carry.
- The year's edge is a step either way (23% down at day 364, 13% at day 366); a player who waits two days has paid a
  year of lease share for it. Fine.

**The gate pair stands without a rerun.** A company's first truck is identical under both forms: no truck owned and the
authority under a year, so ten points both ways. What changes is a second financed truck inside a company's first year,
which now pays the ten points too; among the bots that is the handful of free-path companies that grow to two trucks
before day 365 (the fleets form with their trucks and finance growth later), and ten points on a second loan moves
nothing the ten seeds read outside their spread. The startersFromStock pair and batch 5's ten seeds run on the fixed
rule anyway, so the figure gets read before the next ruleset without a run of its own.

## 2. "Usually clears near" as a ratio (§1): keep the write, change what the default dispatcher does with it

**The figure is true, and neither of the red team's forms makes it truer.** At a thin hub today loads clear after
rolling, at ceilings walked 1.2 × 1.1 a round, so Dallas's loads really do clear near 1.4–1.9× their reference: that is
the market's level there, and it is what "usually clears near" should say. The red team's first form (write each clear
against its ceiling-stepped reference) folds the walk into the reference, so a load that clears at its walked ceiling
writes 1.2 whatever the walk was and the fresh figure reads "the ceiling" everywhere, which is less information, not
more; the second (write only clears inside the posting ceiling) throws away most of a thin hub's clears and reads the
prior, the reference, which is under the market. Nobody could move the figure in three attacks, which is the property
the ratio form was built for; keep `noteClear` as it is.

**What is wrong is the default bid on a load whose ceiling sits under the figure.** The client's dispatcher bids
min(the figure, the ceiling) on every load in reach; at Dallas that is the fresh ceiling (1.2×) on a fresh load, taken
now, while the greedy bot waits for the rolled loads and is paid 1.72× against the victim's 1.65× on the same freight:
the 4% that is the whole gap between +51 and −129 FD a day on five trucks. The carrier is paid its own bid, so bidding a
fresh ceiling under the market's level leaves the walk on the table.

**The rule, one line in `standingOrders.ts priceLoad` under the `clearsNear` mode:** when the figure is above the load's
ceiling (by more than `freight.clearsNear.waitOverCeiling`, 5%), the dispatcher places no bid on that load this round;
the load has not rolled to where loads here clear, and it will. It bids as now on loads whose ceiling has reached the
figure, and Book now is untouched. This is the dispatcher's version of the line the sheet already says ("I wouldn't bid
on this one"), with the opposite case: not "booking is better" but "it will roll to the market". Beside it, for the client
and the writer, the table should carry the mean rounds to a clear per key alongside the ratio ([mean, count] like the
ratio's), so the sheet can say "usually clears near 1.6× after about three rounds"; the engine's figure and the bots do
not read it.

**Test 5 (the trucker's month, `LANES_PROBES=1 npx vitest run apps/web/test/trucker-month.test.ts`) is to be rerun on the
dispatcher change,** since R1's anchor at Dallas is its subject; the six seeds must earn at least the old figure's
10,064 mean, and I would expect them to earn more than the ratio rule's 10,835 once the anchor stops taking fresh
Dallas loads at 1.2×. I run it in a vitest gap on engineering's word that the change is on main (about five minutes, one
suite). **The switch rides in 0.24.1 only if the change is in and the probe passes before the cut; otherwise it stays off
in 0.24.1** (off by default like the other four; Jeff's word turns it on), and no bot reads the figure, so the gate does
not move either way. Under windows the question shrinks on its own: the slide is gone, clears sit near the opening price
with the memory, and the ratio reads 1.0–1.2 everywhere.

## 3. The fatigue reset on a pass home with no day off: I see it the same, with one word changed

`labor.ts dailyDrivers` zeroes `awayDays` on any day the truck stands at home, driven or not, so a fleet that routes
through its home hub every twenty days never accrues the days-out fatigue, and Send home back to work makes that a
click. The real line is where the driver slept, not where the truck passed: **reset awayDays on a night at home (the duty
day closed with the truck at home), not on a day off only.** A day off is already the rest that clears fatigue
(`restDays`, `resetDays`); a night at home ends the stretch away without being a day off, which is what a driver who
sleeps in their own bed one night between two loads has had; a truck that loads at home and leaves the same day has
not. The red team's "only on a day off" would make a driver who sleeps at home three nights a week count as away all
month, which is false the other way. It moves the bots (fleets' drive-through trucks accrue fatigue they do not today:
slower, more crash odds, more home time taken), so it needs the pair and a later ruleset with the director, as the
producer says; I expect a small cost to the fleets' truck-days and nothing to the gate.
