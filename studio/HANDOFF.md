# Handoff: continuing the LANES studio on another machine (2026-11-04)

What a new producer session needs to pick the studio up from here. The repo holds the code, the specs, the reviews,
the backlog (`studio/BACKLOG.md`, "Itinerary from the 2026-11-07 reset") and the role briefs (`studio/roles/*.md`).

## Where things are
- **Code:** github.com/TruckingTerminal/lanes (private), branch `main`. Node 24. `npm install`, `npm run typecheck`,
  `TZ=UTC npx vitest run apps/web` (web), `npx vitest run packages/engine packages/agents packages/config` (engine, minutes).
- **Public test page:** https://truckingterminal.github.io/lanes-play/ — CI "Test and deploy" on every push to `main`,
  13–21 min; a newer push cancels the older run. Never push while a deploy somebody waits on is in flight.
- **Live page (the shared world):** https://claude.ai/artifact/SRYhczap5Lpcr8AucRf9wy — v49 at 77b8186, ruleset
  `lanes-live-1/0.23.0-phase0.38`. Its database holds `world/meta` (seed, epochMs, msPerGameHour 900000, ruleset)
  and the `players` collection. The live world, its page and its store are the producer's alone.
- **Studio board:** https://claude.ai/artifact/2kmePVzETFib467bWP2J34.
- **Not in git, copy by hand:** `../lanes-hybrid/` (the art and PixelLab project; its `.pixellab.token` stays out of
  chat and git), `.claude/launch.json` (dev-server entries; recreate), any `.env.local` (never committed).

## Recipes
- **Republish the live page (client-only change, same ruleset):** `git worktree add <dir> <sha>` (or
  `git checkout --detach <sha>` in an existing worktree), `node apps/web/build.mjs` there →
  `apps/web/dist/lanes.html`, then publish it to the artifact URL above with a label "Ruleset x.y.z (<sha>)".
  The artifact keeps its painted assets; nothing else to upload.
- **Restart the live world (a rules change):** only with no companies in `players`. Publish the page first, then
  write `world/meta` = `{v: 1, seed: <new>, epochMs: <publish time − 12 h, ms>, msPerGameHour: 900000,
  ruleset: "lanes-live-1/<economyConfig.version>"}` pinned to the document's current version. A client whose
  RULESET differs from the meta's shows "update" and refuses to run, so page and meta move together.
- **Commits:** the producer commits under the role's name, by explicit paths, never `git add -A`; role commits end
  "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", the producer's "Co-Authored-By: Claude Fable 5.1
  <noreply@anthropic.com>". New rules go behind config switches defaulting off, on in `packages/config/src/live.ts`,
  with a ruleset bump in `economy.config.ts` `version`.
- **Sims:** `npm run sim -- --seeds 1,2 --days 120 --out runs/<name> --quiet`; never beside a vitest run; cap the
  parallel sims to what the machine's memory allows (the 16 GB laptop took 4 at most).

## The roles
Each is its own Claude Code session on Opus 5.5 at medium effort, started by the producer in the shared checkout
with its brief from `studio/roles/`: director, ux, qa, writer, engineering, economy, player, art (Graphics),
redteam. Roles never commit; they stage and report. The producer is Jeff's one contact. The producer's running
log and rules live in its auto-memory (`~/.claude/projects/<project-path-hash>/memory/`); copy that directory's
files into the new machine's matching memory directory after the first session there.

## Standing rules (short)
One shared permanent world, no saves or pauses or undo outside the owner's test world; restarts only with no
players. Nothing goes live without Jeff; never real money without Jeff. Crime stays out of the chrome. HERE maps
never inside the simulation. Fraud stays out of the player guide. A legal opinion before launch (Keystone, Meridian,
Ironwood need a trademark search). The PixelLab token stays out of chat and git.
