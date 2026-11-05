---
name: lanes-bad-actor-spec
description: "Where the LANES bad-actor spec (DESIGN-BAD-ACTORS.md) lives, how far behind main it is, and the five Back Lot v1 holes, live since the eb2cd38 switch-on"
metadata:
  node_type: memory
  type: project
  originSessionId: 9eb67832-08bf-44d9-a4e3-1088f8d69fb9
  modified: 2026-11-01T19:30:45.459Z
---

DESIGN-BAD-ACTORS.md, draft 3 (2026-10-31), checked against `lanes` main af8ee7a.
- It's untracked at the root of the lanes-hybrid worktree, inside this session's scratch folder, so it's lost if the session is deleted.
- Jeff has a copy (sent to him). It isn't committed: Jeff hasn't asked, and §15 question 1 asks where it should live.

**Main moved past it on 2026-11-01** (d407bb7, 3586399, ae2e7a7), with Jeff's overnight decisions made in the parent session:
- Robbers and the Back Lot are **on in the beta** (§15 question 8 answered; don't re-ask it).
- The Back Lot v1 is built behind switches, off: a real stake (`realStake`), `oneCrewPerVictim`, operating companies only, `takeLocked`, the fence share by commodity, fences and chop shops as businesses, bounties, notoriety, `logbookMinVictimTrucks` 3. Questions 2, 3, 6 and 7 are built.
- Also built: the airdrop paid locked at the TGE, the bridge, the opening auction tranche; the price band dropped. Settlement on Solana.
- v51 tested the launch package but **not** the Back Lot (built after the batch was designed).

**Switched on 2026-11-01 at eb2cd38** (Jeff's "Go" in the parent session): ruleset 0.19.0-phase0.29, every lever in `packages/config/src/live.ts`, the live world restarted with no players. The engine didn't change, so all five holes below are live. A rules fix now costs one more restart while there are no players.

**The Back Lot v2 was built the same day (00d536f), switched off** (`robbery.lot`).
- Crews are hired off an NPC board, and the fee is prepaid and burned. There's no stake, cooldown or one-crew rule, and NPC demand boards replace player fences.
- Under it, holes 1 and 3 below don't apply. Holes 2, 4 and 5 haven't been checked against it.
- v53: crime tripled, and hirers netted −0.67M (4.4M of fees burned against 3.8M paid).

**Holes found in the v1 code (2026-11-01), sent to Jeff, with evidence from v52-a** (the exact live profile; ordinary bots only, no token bad actors):
- Fence resale and chop-shop parts are paid from the reserve as free FD (`robbery.ts:385`). A chopped rig adds about 40% of its value in new FD through a player's chop shop, against 9% through the reserve's fence at `npcFenceShare` 0.6. v52-a: the Back Lot paid hirers 344k and the reserve paid it 841k, where the reserve's fence would have paid about 206k for the same take. Robbery as a whole still drained FD (crew fees 902k + fittings 2.2M + wash about 115k, against 1.19M paid out).
- `airdrop.lockedFd` isn't reduced when locked FD is spent (`token.ts:428`, `459`). So milestones can unlock a robber's locked take up to its allocation, and a deadline or conviction can burn locked FD it was paid. TOKENOMICS wrongly says this needs a second allocation. v52-a: 9.3M FD of allocations counted as still locked, against 5.2M locked FD in the whole economy.
- The perishable halving applies to the whole resale (`robbery.ts:245`), not just the markup the comment describes. A fence loses about 10% of value on meat, frozen, dairy and produce, and can't refuse.
- Crews still strike at closed docks (`trips.ts:86`); `theft.dockWaits` is on.
- Double brokering still counts coldCases and takeFd with no victim check (`fraud.ts:240`–`251`). With `fraud.theft.byCarrier` false, stiffing a hauler is the only way to earn "a case gone cold". One company did in v52-a.

**Why:** these change what robbery costs the economy, and Jeff's default is nothing live without his review. The question to Jeff is now whether the parent fixes them before players join (asked 2026-11-01, after the switch-on; don't re-ask "before the switch-on").

**How to apply:**
- Draft 4 should fold in the 2026-11-01 decisions and v50–v52, after the package stops moving. Re-check it against main first ([[lanes-phase0-state]]).
- The fixes are engine work for the parent session. Forward them only with Jeff's go-ahead, quoting his words.
- The art for it is on hold: [[lanes-art-hold]].
