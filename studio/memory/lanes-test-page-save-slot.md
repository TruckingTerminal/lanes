---
name: lanes-test-page-save-slot
description: "The lanes-play test page keeps one world per browser profile; the built-in browser's profile is shared, and QA owns it during replays"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9404a96a-ee3b-41c4-a1fd-d6add9a74678
  modified: 2026-11-02T20:04:15.292Z
---

The public test page (truckingterminal.github.io/lanes-play) stores one test world per browser profile
(`lanes.testworld.v1` in localStorage, plus `lanes.onboard.v1` and `lanes.iuliia.*`). Every studio session's
built-in browser shares one profile, so opening a new test world, or even continuing one and reloading, overwrites
whatever another role saved there. A running world re-saves itself on unload, so a restore written while it runs is
overwritten; restore only from the title screen, then verify after a reload.

**Why:** on 2026-11-02 the UX session clobbered QA's saves twice (Brazos Hauling, then Lakefront Hauling) while
looking at builds. The producer ruled the same day: QA owns that profile during a replay.

**How to apply:** to look at the test page, use an isolated origin: curl the deployed page into a scratchpad
folder, insert `<base href="https://truckingterminal.github.io/lanes-play/">` after `<head>` (assets load from
Pages, which sends CORS `*`), and serve it with a `.claude/launch.json` entry (`lanes-ux`, port 5195) via
preview_start; localhost has its own empty storage. The built-in browser has no private window, and a JS shim on
`Storage.prototype.setItem` does NOT stop the page's writes (tried 2026-11-02; it still replaced QA's save). If the
shared profile must be used, back up every `lanes.*` key first and restore it from the title screen afterwards.
Related: [[lanes-studio-role]].
