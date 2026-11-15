# Economy: the bus home, sized for 0.25.3 (2026-11-15)

For the director's §9 (director-sprint-2026-11-15.md): a driver with no truck outside the home radius takes the bus
home. The probe:
- a scratch build at dae2317 (lanes-bus);
- all four 0.25.2 fixes on, so `labor.truckLessHomeByHub` is on;
- two seeds, four years;
- three versions, read against the 0.25.2 pair's off arm and its on arm without a bus.

## The sizes

- **Pace: 800 miles a day,** as the director's example. Miles are hub to hub (world.ts `hubMiles`). The trip takes
  miles ÷ 800 days, and arrival is the day after the last part-day.
- **Fare: one day's per diem, plus per diem for each day on the bus,** fractional days counted: `perDiemFd × (1 +
  miles ÷ 800)`. At today's 30 FD a day:
  - the average trip, 1,125 miles over 1.4 days, costs about 72 FD;
  - Miami to Dallas (about 1,300 miles) costs about 79;
  - coast to coast (about 2,800) costs about 135.
- **When:**
  - Bots, and the dispatcher when it is on, send the driver at once, unless an empty truck of the company at that hub
    needs a driver.
  - A driver whose company staffs by hand goes after a day without a truck.
- **On the bus:** every day counts as a day away with no rest, and no layover per diem besides the fare (the fare
  already holds the bus's per diem).
- **Arriving:** the last hub is the home hub. The driver is home, and the days off start if due.

## What it does (seeds 1–2)

| Seeds 1–2, 0.25.2's four fixes on | Fixes off | On, no bus | **Bus 800 mi · fare 1 day** | Bus 800 mi · fare 3 days | Bus 500 mi · fare 1 day |
|---|---|---|---|---|---|
| Companies bankrupt (OO) | 136.5 (82.5) | 229.5 (150) | **133.5 (75)** | 149.5 (84.5) | 136 (83.5) |
| OO liquidated: greedy · random · prudent | .243 · .199 · .177 | .347 · .380 · .398 | **.213 · .199 · .150** | .235 · .214 · .184 | .250 · .229 · .147 |
| Per diem and fares (M) | 0.93 | 6.01 | **1.12** | 1.31 | 1.26 |
| Clean drivers tired, year 4 | 3.9% | 17.4% | **4.7%** | 4.7% | 4.3% |
| Corner-cutters tired, year 4 | 44% | 70% | **49%** | 46% | 46% |
| Truckless clean drivers' days away, year 4 | 0.3 | 191 | **0.4** | 0.3 | 0.5 |
| Owner-operators' · fleets' profit per truck-week | 1,719 · 1,606 | 1,698 · 1,617 | 1,732 · 1,546 | 1,728 · 1,601 | 1,710 · 1,558 |
| Bus trips a run (by owners) | — | — | **2,962 (683)** | 2,869 (704) | 3,045 (702) |
| Mean trip: miles · days · fare (FD) | — | — | **1,125 · 1.4 · 72** | 1,138 · 1.4 · 133 | 1,148 · 2.3 · 99 |
| Fares over four years (M) | — | — | **0.21** | 0.38 | 0.30 |

**Reading it:**
- **The bus at the director's sizes ends the trap.** Bankruptcies, owner-operator liquidations, per diem, fatigue and
  days away all come back to the off arm within two seeds' noise.
- **The driver's way home is cheap and quick.** About two trips a day across the world, a quarter of them
  owner-operators whose truck is gone. The fares come to 0.21M over four years, about a fortieth of what the stranded
  per diem cost.
- **A dearer fare or a slower bus only adds cost.** Three days' fare, or 500 miles a day, change nothing the bus is
  for. Bankruptcies at three days' fare (149.5) are inside two seeds' noise, as are the fleets' profit figures in every
  version (1,546–1,617). The ten-seed pair settles both.
- **L2 stays closed.** Rest still counts only at home:
  - stepping out of a truck to rest costs the bus both ways (about 150 FD), the days off, and the truck's idle days at
    the far hub;
  - at a fleet's 1,600 FD a truck-week, the idle truck is the real price, not the fare.

## For the 0.25.3 pair

When engineering's build lands, the pair is the live profile with `labor.truckLessHomeByHub` and the bus on, against
off: ten seeds with twins. The check is the director's (per diem and owner-operator bankruptcies back toward the off
arm), plus:
- fatigue;
- truckless days away;
- the trips and fares;
- the fleets' profit, which two seeds can't settle;
- the gate.

The runner already has every tap.

## How it ran

- **The worktree:** a scratch worktree at dae2317 (lanes-bus), seeds 1–2, 04:50–04:58.
- **The build:** `labor.scratchBus` in config and the trip in labor.ts `dailyDrivers`, scratch only.
- **The comparison:** the 0.25.2 pair's off and on arms on the same seeds.

Nothing in the shared checkout changed and nothing is staged.
