# Economy: when an AI broker "can no longer trade", for the wind-up build (2026-11-15)

For the engineer building the broker wind-up (economy-broker-viability-2026-11-13.md §3). A scratch build of the
obvious condition winds up too many brokers. This is the condition that matches the dormant brokers, read from a weekly
tap of every AI broker's licence state on 0.25.1's live profile (b8e3799, seed 1, two years; a scratch worktree,
lanes-g22).

## What a dormant broker is

**How it gets there.** A broker's licence is its 75,000 FD stake (`token.staking.roles.broker`, staking.ts
`brokerLicensed`). Two things take the stake under it:
- **The bond pays the broker's carriers when the broker can't** (receivables.ts `drawBond`).
- **A broker two weeks in debt breaks its stake lock to avoid liquidation** (ruleBots.ts `manageLocks`, instant unstake).

**Why it never comes back.** The bots' weekly `growBond` only posts more stake when the broker's books fill 80% of its
bond. A broker with nothing open has empty books, so it never refills a part-drawn bond. It also has almost no cash to
refill it with. It pays the surety premium daily until it goes negative, is liquidated, and starts over still
unlicensed.

**How many.** At the end of year 1, 33 of the 60 AI brokers are unlicensed with a part stake, and they stay so through
year 2:

| Day | Prudent (7%) | Random (6–12%) | Greedy (12%) |
|---|---|---|---|
| 56 | 2 of 20 | 1 of 20 | 0 of 20 |
| 182 | 7 | 2 | 0 |
| 273 | 16 | 6 | 1 |
| 364 | **19** | **12** | **2** |
| 728 | 20 (one at stake 0) | 13 | 2 |

**My viability note undercounted the dead.** At 10% it said 21 of 60 fail over four years. That counted formal
liquidations. A dormant broker with a little cash left can sit years before its first. The trading layer is about 27
brokers by the end of the opening year, not 40.

**Two kinds of dip:**
- **Transient (14 brokers):** the stake falls a few FD under 75,000 for a week, as the bond pays a carrier, then
  `growBond` refills it while the broker's books are busy.
- **Dormant (31 brokers):** unlicensed with a part stake and nothing open for 8 weeks or more, most for the rest of the
  run (60–98 weeks), with at most 3,814 FD of cash. None of them could restore the licence.

## The condition: wind up an AI broker when, for 8 weeks running, all three hold

1. **Its stake is under the licence:** `!brokerLicensed(w, c)`.
2. **It holds nothing open:** `c.openBrokerLoads === 0`, and no receivables it owes.
3. **Its cash can't restore the licence:** the balance is less than `roles.broker − stakedFd`.

**Why each part:**
- **The 8 weeks** keep the transient dips (a week or less) out.
- **The cash test** keeps out a broker that could restake.
- **"Nothing open"** lets a broker's paper settle before the books close.

**The scratch build without the 8 weeks and the cash test** wound up 32 and 44 brokers on two seeds, against 19
liquidated companies in the base. It took brokers that recover: brokered revenue in years 3–4 ran 15% under the base.

## What winding up does

- **Its effects:**
  - `settleRetired` (paper paid, stake released if no bond is held, debts written off as a bankruptcy's are);
  - orders cleared;
  - `retiredDay` set;
  - counted once.
- **The surety premium must skip it.** step.ts's bond loop charges every company with `role === "broker"` and checks
  only `lapsedBrokerage`. Add `c.retiredDay !== undefined`. Without that, a wound-up broker keeps paying the bond and
  goes negative again.
- **A player's brokerage** never reaches this rule. It has its own lapse (brokerage.ts `lapsedBrokerage`).

## Optional, the bots' side

`growBond` could refill a broker's stake to the licence from spare cash whatever its books, so a broker with the cash
never falls dormant. The tap says this rarely matters: none of the 31 dormant brokers had the cash. It's a one-line
guard for the rare one.

## For the wind-up pair

When the build lands, I pair it on ten seeds with twins: the live profile with the switch on against off. The lines:
- AI brokers wound up by year and persona;
- the formal liquidations and their repeats (these should fall to zero);
- surety and bankruptcy write-offs;
- brokered share and pay per mile;
- carriers' profit;
- the gate.
