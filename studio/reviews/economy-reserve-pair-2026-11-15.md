# Economy: the winding-up check counts the Reserve, the director's §15 pair (2026-11-15)

The pair is on engineering's build 5aceaad, run at b994907 (5aceaad plus the Reserve card): `insolvency.countReserve`
on against off, on 0.25.3's live profile. It ran ten seeds, 1,460 days, each arm with its cap-off twin.

## Verdict

**Within the spread on every line. It is ready to switch on.**

- **The gate passes 10 of 10.** The worst carriers read 81·79 (seed 7), against 83·86 off; the band is 0.880–0.915.
- **Bankruptcies:** 135.2 against 138.4. Owner-operators 73.9 against 77.4, fleets 20.5 against 19.8, brokers 21.8
  against 21.4. Liquidations by persona are inside their ranges (prudent owner-operators .140 against .139).
- **Carriers:** owner-operators' profit per truck-week 1,717 against 1,691, fleets' 1,629 against 1,650. Cleared loads
  413,222 against 415,946 (−0.7%), the rate the same.
- **AI fleets' wind-ups:**
  - the population dial winds down 27.0 bots a run against 22.5, inside a wide range (15–60 against 5–35);
  - it retires 12.1 against 12.3;
  - bankruptcy events are 192 against 196.
- **The Reserve barely changes:** 3.70M held at the end both ways, 39.1M deposited against 39.4M, 104 holders.
  - The bots that bank a cushion (`manageReserve`: the prudent owner-operators and fleets) now count it at the
    winding-up check, as the director ruled.
  - In the bots' world that rarely decides a case. Few of them are short on cash while holding a Reserve, so the
    effect is a small fall in bankruptcies, not a shift.

| Ten seeds | Off | **On** |
|---|---|---|
| Gate · worst carriers · band | 10 of 10 · 83·86 · 0.881–0.922 | **10 of 10 · 81·79 · 0.880–0.915** |
| Companies bankrupt (OO · fleet · broker) | 138.4 (77.4 · 19.8 · 21.4) | **135.2 (73.9 · 20.5 · 21.8)** |
| OO liquidated: greedy · random · prudent | .213 · .227 · .139 | **.202 · .210 · .140** |
| Fleets liquidated: greedy · random · prudent | .170 · .147 · .177 | **.190 · .155 · .168** |
| Owner-operators' · fleets' profit per truck-week | 1,691 · 1,650 | **1,717 · 1,629** |
| Cleared loads · rate | 415,946 · 3.632 | **413,222 · 3.636** |
| Loan defaults · trucks seized | 204 · 154 | **206 · 150** |
| The dial: wound down · retired | 22.5 · 12.3 | **27.0 · 12.1** |
| The Reserve: held at the end · deposited · withdrawn (M) | 3.70 · 39.4 · 29.8 | **3.70 · 39.1 · 29.3** |
| FD in circulation, year 4 (M) | 83.2 | **84.3** |

## How it ran

- **The worktree:** a scratch worktree at b994907 (lanes-r15), from the gated pair script with pauses between waves,
  11:52–13:09.
- **On:** the live profile with `--set insolvency.countReserve=true`. **Off:** the live profile as it is.

Nothing in the shared checkout changed and nothing is staged.
