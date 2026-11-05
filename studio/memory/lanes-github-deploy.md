---
name: lanes-github-deploy
description: Where LANES code lives on GitHub and how the test build deploys (private repo + public lanes-play Pages site)
metadata:
  node_type: memory
  type: reference
  originSessionId: 526f296d-690d-46c9-aad3-7168e4b19246
  modified: 2026-10-28T17:21:52.914Z
---

Code: private repo https://github.com/TruckingTerminal/lanes (GitHub account TruckingTerminal, free plan, so no Pages on private repos). Test build (pausable, world kept in browser localStorage `lanes.testworld.v1`): https://truckingterminal.github.io/lanes-play/, served by Pages from the public repo TruckingTerminal/lanes-play (branch main, root).

Pipeline (set up 2026-10-28): `.github/workflows/pages.yml` in lanes runs typecheck + tests + `npm run build:site` on every push/PR; on main it pushes `index.html` to lanes-play using the deploy key in secret `LANES_PLAY_DEPLOY_KEY` (write deploy key "lanes CI deploy" on lanes-play). Jeff chose private code / public site over a public repo.

The shared live MMO world is separate: the claude.ai artifact (see [[lanes-phase0-state]], [[lanes-mmo-rules]]).

**The live artifact's caps (found 2026-11-02 at the 0.20.0 republish):** a version holds at most 511 files / 256 MB, one publish ≤ 255 files / 64 MB. The full `apps/web/dist/assets` is 718 files / 457 MB, so the live page carries 177 MB: everything EXCEPT the cityview weather loops (`cityviews/*-{day,night,rain,snow}.loop.png`, 196 files) and the city stills (`cities/*.png`, 60 files), 280 MB together. The page asks only for files the manifest lists (`mapart.ts hasAsset/known`), so the live publish sends a FILTERED manifest (`manifest.live.json`, built by the republish step) and falls back to stills; the test page on Pages has all 718. Republish recipe: clean worktree at the commit, node_modules dir of symlinks with `@lanes/*` relinked to the worktree's own packages (a whole-dir symlink makes tsc see two engines), `node apps/web/build.mjs`, publish `apps/web/dist/lanes.html` with `files` = the A/M asset delta since the last republished commit + `assets/manifest.json` ← `manifest.live.json`, nulls for deleted files, `root` = that dist.
