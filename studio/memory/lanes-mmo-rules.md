---
name: lanes-mmo-rules
description: "LANES must be one shared permanent world with a central store; no saves, pauses, restarts or undo outside an owner test world"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 526f296d-690d-46c9-aad3-7168e4b19246
  modified: 2026-10-27T18:01:00.620Z
---

LANES is an MMO: one shared world for all players with a central database, on the real clock. No saves, no pause, no redo/restart. Pausing and speed-up are allowed only in testing (the owner-only private test world).

**Why:** Jeff (2026-10-27) rejected the single-player build with saves: "every action is permanent", "it's extremely important that it is one shared world and there's a central database for all players".

**How to apply:** never add save/load, pause, rewind or per-player worlds to the live game; any engine/config change that would replay history differently needs a checkpoint/migration of the running world, not a reset. See [[lanes-phase0-state]].
