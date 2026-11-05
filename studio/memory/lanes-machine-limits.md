---
name: lanes-machine-limits
description: Jeff's Mac is 16 GB / 8 cores and crashed out of memory on 2026-11-02 under 22 concurrent sims plus test suites; cap sims at 4 at a time, never beside a vitest run
metadata:
  type: project
---

Jeff's Mac (the only machine the studio runs on) has 16 GB of RAM and 8 cores. On 2026-11-02 at about 09:00 it ran out of memory and Jeff had to restart it: the economy agent had 22 four-year sims running at once (each a node process of several hundred MB) while engineering's vitest workers and my abandoned worktree suite ran beside them and seven Claude sessions were open. Everything in flight was lost: the prudence pair (1 h 45 min of sims, no report written), engineering's suite run, the in-process economy agent and every background task of this session. Nothing on main or in the live artifact was touched.

**Why:** a batch that would take 40 minutes on free cores takes hours when 22 processes share 8 cores, and the memory runs out long before that.

**How to apply:** every brief that runs sims says: at most 4 sims at a time, `pgrep -f vitest` empty before launching, `vm_stat` checked; one `npm test` at the end, not alongside batches. Never run two roles' suites at once; kill stale worktree test runs once CI has answered. Related: [[lanes-phase0-state]], [[lanes-github-deploy]].
