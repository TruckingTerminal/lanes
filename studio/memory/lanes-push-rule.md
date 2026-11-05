---
name: lanes-push-rule
description: Never push to lanes main while a CI deploy QA is waiting on is in flight; the pages workflow's concurrency cancels the older run (bit three times on 2026-11-02)
metadata:
  type: feedback
---

The lanes repo's "Test and deploy" workflow runs on every push to main with concurrency that cancels the older in-progress run. A doc-only push (a decision, a writer's strings) while engineering's batch is still deploying cancels that deploy, and QA, which starts its phone replay when the page carries the batch, waits another twelve minutes. It happened with 60d1a26 (my decision push), with d8fc5d7 and again with e3858fb (writer commits pushed on top).

**Why:** nothing is lost (the newer run carries both), but each cancellation delays QA's replay and makes QA re-watch.

**How to apply:** before every `git push`, run `gh run list --limit 1` and, if a run is in progress on a commit QA is waiting to replay, commit locally and hold the push until the lanes-play repo's latest commit says "Deploy <that hash>". Batch doc commits behind the next code push when one is near. Related: [[lanes-github-deploy]], [[lanes-phase0-state]].

**Shared-file rule (2026-11-02, after the cashNow incident):** when a role's file list includes a shared file such as `packages/config/src/economy.config.ts` or `copy.ts`, `git diff` it against the role's description before staging; another role's temporary edit (a flag turned on for a test build) can be sitting in it. Roles make flag edits on a scratchpad copy of the config, never in the shared checkout.
