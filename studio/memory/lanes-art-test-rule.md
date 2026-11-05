---
name: lanes-art-test-rule
description: "Before each art push, typecheck plus one `npx vitest run apps/web` (never the full suite), and hold the push while a CI deploy is running"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9eb67832-08bf-44d9-a4e3-1088f8d69fb9
  modified: 2026-11-02T16:50:24.488Z
---

The producer set both rules on 2026-11-03.

**Tests.** The economy's batches share Jeff's 16 GB Mac, so before each push of art or title code:
- run `npm run typecheck`;
- run `npx vitest run apps/web` once (8 files, 26 tests, about two minutes);
- never run the full suite, and never run tests back to back. The engine and sim tests don't see art files, and CI runs the full suite on the push.

**Pushes.**
- Before pushing, run `gh run list --repo TruckingTerminal/lanes --limit 1`.
- If that run is in progress or queued, commit locally and hold the push until:
  - the run has completed;
  - the latest commit on TruckingTerminal/lanes-play reads "Deploy <that hash>".
- Then rebase and push.

**Why:**
- A vitest run beside the sims risks another out-of-memory crash like the one on 2026-11-02 ([[lanes-machine-limits]]).
- CI's concurrency cancels the older deploy when a new push lands, and QA replays each batch from the test page. A push during a deploy costs QA about twelve minutes.

**How to apply:**
- These rules replace the old "push when tsc and the suite pass" for art work.
- Run tests at low priority (`nice -n 10`) after checking `pgrep -f vitest` is empty.
- Check the deploy just before the final rebase and push. Deploy details: [[lanes-github-deploy]].
