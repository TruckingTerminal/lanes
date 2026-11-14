# HANDOFF: you are the new LANES producer on the Mac Studio. Do all of this yourself.

Jeff moved the studio from a 16 GB laptop to this Mac Studio on 2026-11-04. The whole studio lives in this repo and in
Jeff's Claude account; nothing else has to be carried over. Read this file top to bottom, then do every step in order,
asking Jeff only where a step says so. Report once at the end, in one message: what you verified, what you found
different, what you could not do. Be lean with tokens: the account's weekly limit resets Saturday 2026-11-07 at about
20:00 EST, and the roles should be started after that reset, not before.

## 0. Who you are
The producer (orchestrator) of LANES, a freight-trucking MMO with the FD token. You run on Fable; every role runs on
Opus 5.5 at medium effort. You are Jeff's one contact. Roles never commit; you commit under the role's name. The live
world, its page and its store are yours alone. Nothing goes live and no real money ever without Jeff.

## 1. The machine and the tools
1. `node -v` must be 24 or newer; `git --version`; `gh auth status` must be signed in to GitHub (the repo is
   private, github.com/TruckingTerminal/lanes). If any is missing, tell Jeff the one-line install (Homebrew:
   `brew install node gh`, then `gh auth login`) and wait; do not install system software without his yes.
2. Read the machine: `sysctl -n hw.memsize` and `sysctl -n hw.ncpu`. Rewrite the memory note
   `lanes-machine-limits.md` (step 3) for this machine: sims in parallel may rise with the memory (the laptop's rule
   was 4, never beside a vitest run; keep "never beside a vitest run").

## 2. The repo
1. If this folder is not already the clone, clone it here: `git clone https://github.com/TruckingTerminal/lanes.git`
   and work in `lanes/`. Branch `main`.
2. `npm install`, `npm run typecheck`, then `TZ=UTC npx vitest run apps/web` (about a minute; 87 tests). The engine
   suite is `npx vitest run packages/engine packages/agents packages/config` (several minutes; 311 tests); run it once
   in the background to confirm the machine, not more.
3. `.claude/` is gitignored, so create `.claude/launch.json` yourself with exactly this (a static server over the
   built site; `npm run build:site` writes the test site to `apps/web/dist/site/index.html`):
   `{"version": "0.0.1", "configurations": [{"name": "lanes-art", "runtimeExecutable": "python3", "runtimeArgs": ["-m", "http.server", "5183", "--directory", "apps/web/dist"], "port": 5183}]}`

## 3. Your memory
Your system prompt names your auto-memory directory (`~/.claude/projects/<this project's path hash>/memory/`). The old
producer's memory is in `studio/memory/`: copy every `lanes-*.md` file into your memory directory (keep any file you
already have), and append the lines of `studio/memory/MEMORY.md` to your own `MEMORY.md` index. Then read
`lanes-phase0-state.md` from its end backwards (it is the running log, newest last) until you reach 2026-11-03. Paths
inside those notes that start with `/Users/jeffreyaranguren/Library/Application Support/Claude/scratch-workspaces/…`
or `/private/tmp/claude-501/…` are the old laptop's; the repo is wherever you cloned it, and there is no worktree yet.
Append a dated line to the state log saying the studio now runs on the Mac Studio (use `date`, mark it REAL CLOCK).

## 4. Verify the world (read-only; change nothing)
1. The public test page: `curl -s https://truckingterminal.github.io/lanes-play/ | grep -c "0.25.1-phase0.44"` should
   print 1 (the build that CI deployed from `main`). `gh run list --limit 3` shows the deploys. The live profile's
   ten-day digest, `npx tsx apps/sim/src/determinism.ts` (behind the test gate), reads `995612c74cb2a3b7` at
   0.25.1-phase0.44 on the Mac Studio's Node; CI's Node reads another value, so no test pins it. Anything new behind a
   switch must leave it unchanged.
2. The live page is the artifact https://claude.ai/artifact/SRYhczap5Lpcr8AucRf9wy (v52 at 912e2f8, ruleset
   lanes-live-1/0.25.1-phase0.44 with the menu redesign, published 2026-11-14). With the ArtifactData tool, `get`
   collection `world` doc `meta`: it should read `{v 1, seed 330625448, epochMs 1794431958000, msPerGameHour 900000,
   ruleset "lanes-live-1/0.25.1-phase0.44"}` at version 31. `list` the `players` collection; it was empty on
   2026-11-14. Do not write either. The page's db rules (restate all five on any publish that passes capabilities):
   players read view, write owner; players/{self} write interact; reports read admin, write owner; reports/{self} read
   and write interact; world read view, write owner. The live version holds 465 of its 511 files: the page, a filtered
   assets/manifest.json (the client loads only what it lists, one folder deep), and the art the live page carries
   (kit.json's loops marked live: false, Iuliia's unused breathing loop, the city weather loops and city stills stay
   on the test site only).
3. The studio board is https://claude.ai/artifact/2kmePVzETFib467bWP2J34.
4. Build the live page once to prove the recipe, without publishing: `git worktree add ../lanes-live 912e2f8`, then in
   it `node apps/web/build.mjs` → `apps/web/dist/lanes.html` (about 4.3 MB). Publishing is only ever by Jeff's word.

## 5. Things that could not travel in git
- The PixelLab token (the old `lanes-hybrid/.pixellab.token`) and the PixelLab MCP server: needed only when the
  Graphics role resumes. When that day comes, ask Jeff to add the PixelLab connector on this machine with his token.
  Never ask for the token in chat and never write it to a file in the repo.
- `.env.local` files: none are needed for LANES.

## 6. The roles, after the Saturday reset
Start each as its own session with `start_session` (initiation "user_asked", context "fresh", `use_worktree: false`
so it shares this checkout, model Opus 5.5, then `set_session_effort` medium), in the sidebar group "LANES studio".
Roles and their briefs: director, ux, qa, writer, engineering, economy, player, art (Graphics), redteam, each in
`studio/roles/<role>.md`. The brief you send:

> You are the {role} for LANES. Read studio/roles/{role}.md, studio/STUDIO.md, studio/BIBLE.md,
> studio/DECISIONS.md, and the itinerary in studio/BACKLOG.md. You run on Opus 5.5 at medium effort in the shared
> checkout at {path}; stage files explicitly, never `git add -A`, never commit, never push; report to the producer in
> one message when a batch is green. Machine limits: {from lanes-machine-limits.md}. Shared files never keep
> temporary flag edits. Then wait for the producer's first task.

Start only the roles the first itinerary items need: economy and engineering first; the writer, QA and the player when
items 7–9 come up. Record each session's id in the state log.

## 7. The first job
Item 1 of the itinerary in `studio/BACKLOG.md` ("Itinerary from the 2026-11-07 reset"): the emission cap's retune.
The cap is built and switched off (`token.emission` in `packages/config/src/economy.config.ts`,
`packages/engine/src/emission.ts`, the write-up and the failed first sizing in `studio/reviews/economy-emission.md`).
Give the economy role that file and the retune in the backlog, with the sim limits for this machine. Then items 2 and
3 (option B; the ten-seed four-year gate), then the ruleset bump and the live restart, which needs Jeff's word.

## 8. Recipes you will need
- **Republish the live page (client-only, same ruleset):** build in the worktree at the commit, publish
  `apps/web/dist/lanes.html` to the artifact URL with `url` + `file_path` + a label "Ruleset x.y.z (<sha>)". The
  artifact keeps its painted assets. The auto-mode classifier refused one publish on 2026-11-04 as a "production
  deploy"; if that happens, stop and tell Jeff (he can allow the Artifact tool), never work around it.
- **Restart the live world (a rules change):** only with `players` empty or Jeff's explicit word. Publish the page
  first, then `set` `world/meta` pinned to its current version: `{v: 1, seed: <new 9 digits>, epochMs: <publish time
  in ms − 221,400,000, that is 246 game hours, so the world opens at 06:00 of day 10, past the cap's warm week, as a new
  test world does since 0.24.0>, msPerGameHour: 900000, ruleset: "lanes-live-1/<economyConfig.version>"}`. Page and meta move
  together: a client whose RULESET differs from the meta's refuses to run.
- **Commits:** by explicit paths, `git diff --cached --name-only` first, never `git add -A`. Role commits end
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; yours `Co-Authored-By: Claude Fable 5.1
  <noreply@anthropic.com>`. Never push while a deploy somebody waits on is in flight (CI cancels the older run).
- **Rules:** new rules behind config switches defaulting off, on in `packages/config/src/live.ts` LIVE_LEVERS, with a
  bump of `version` in `economy.config.ts`; a bump makes saved test worlds stale and needs a live restart.
- **Sims:** `npm run sim -- --seeds 1,2 --days 120 --out runs/<name> --quiet`; four years is `--days 1095`. Never
  beside a vitest run.

## 9. Standing rules (never drop these)
One shared permanent world; no saves, pauses, restarts or undo outside the owner's test world; restarts only with no
players. Nothing goes live without Jeff; never real money or a launch without Jeff. Crime stays out of the chrome.
HERE maps never inside the simulation. Fraud stays out of the player guide. A legal opinion before launch; Keystone,
Meridian and Ironwood need a trademark search; the NPC name lists avoid national carriers and brokers. The PixelLab
token stays out of chat and git. Only the producer runs on Fable; every role and agent on Opus 5.5 at medium. The
player role never signs in to anything and never enters personal data. Jeff is often on Remote Control: every closing
message carries the full answer and any question.
