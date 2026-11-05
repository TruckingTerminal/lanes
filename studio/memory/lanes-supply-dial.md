---
name: lanes-supply-dial
description: "After launch the live supply dial can't move either way (rateFloor 1), so the published path has no working lever; v52-a ran 6% over it"
metadata:
  node_type: memory
  type: project
  originSessionId: 9eb67832-08bf-44d9-a4e3-1088f8d69fb9
  modified: 2026-11-01T18:29:47.656Z
---

In the live levers (eb2cd38, 2026-11-01), `token.supplyCeiling.rateFloor` is 1. `ceiling.ts` clamps the dial between `launchMult × rateFloor` and `launchMult`, so from the TGE on, NPC freight rates are frozen at the launch level.
- The airdrop is paid at the TGE, so holding its unlocks no longer slows supply. The team's vest is the only thing the ceiling can hold, and it starts six real months after the TGE.
- Nothing raises supply when sinks outrun faucets (the ceiling's own comment says so).
- v52-a (the exact live profile, bots only): supply rose 13% in the two years after launch, against a path of +10% over four, and ended at 125.0M against the path's 117.7M.
- PvP is no lever either way: robbery netted about 2M FD out over the run, against 336M of driver wages alone.

**Why:** on 2026-11-01 Jeff asked whether PvP would bring deflation, and whether the game is over-engineered and will soon need stimulus levers. My answer: the sim still inflates, so it needs no stimulus now; the missing piece is a dial that works both ways. I also suggested freezing new systems until real players are in.

**How to apply:** before anyone proposes a stimulus faucet or new sinks, check the dial's bounds in `ceiling.ts` and `live.ts`; a two-way dial is the smaller change. Related: [[lanes-phase0-state]], [[lanes-bad-actor-spec]].
