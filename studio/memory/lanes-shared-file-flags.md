---
name: lanes-shared-file-flags
description: "Never put temporary flag-on edits in shared LANES files (economy.config.ts, game.ts); another session's commit swept one in"
metadata:
  node_type: memory
  type: feedback
  originSessionId: fd181f3a-159f-4766-aec4-2fd820da4b64
  modified: 2026-11-03T00:14:43.559Z
---

Never make a temporary "flag on for a page check" edit in a shared file of the LANES checkout (packages/config/src/economy.config.ts above all, also apps/web/src/game.ts). On 2026-11-02 the economy's commit cd7e9d4 took the whole config file while my temporary `cashNow.enabled: true` sat in it, so main shipped the switch on.

**Why:** several sessions edit and commit in the one shared checkout; anything left in a shared file, even for minutes, can be committed by someone else's `git add` of that file.

**How to apply:** for a flag-on check, use a test that flips GAME_CONFIG in memory, or flip it in the page at runtime, or build from a private copy; if a shared-file edit is unavoidable, revert it before anything else and tell the producer at once if it was committed. Related: [[lanes-studio-role]], [[lanes-push-rule]].

**2026-11-02 second incident (producer's own):** a one-line regex fix in apps/web/test/explain.test.ts was staged
as a whole file while engineering had in-progress test lines in it (imports of uncommitted source) → CI would
fail; reverted in a follow-up commit, the lines restored unstaged to the working tree.
**Rule:** when the producer touches a file a role is editing, save the working copy to the scratchpad, build the
commit from the last committed version plus only the intended hunk, commit, then restore the working copy. Never
`git add <file>` for a producer fix in a role's open file; check `git diff --cached --stat` line counts match the
intended change before committing.

**2026-11-02 third incident (producer's own):** `git add <spec> && git commit` committed the WHOLE index, which held
engineering's 12 staged batch files, under the writer's name (adcc343). Caught before the push; rewritten with
`git reset --soft`, `git restore --staged .`, then one commit per role. **Rule:** `git commit` commits everything
staged, not just what was added last. Before EVERY commit run `git diff --cached --name-only` and compare with
the intended list; when a role may have staged work, commit with explicit paths (`git commit -- <paths>`) or
clear the index first. Never commit on a chain of `git add … && git commit` without the check between them.
