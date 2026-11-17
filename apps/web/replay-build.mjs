// The replay build (apps/web/src/cuts.ts REPLAY_BUILD; the red team's checkpoint review, finding 10): a content hash of every
// source module the live replay runs, so a page never starts from a cut another replay wrote, even after a page-only
// republish that changed the replay. keeper.ts stays out on purpose: it only writes the store's documents (a page's day
// hashes, the owner's checkpoint), and nothing in it changes the world a page computes from them.
// Shared by the page's build (build.mjs) and the node replay (apps/sim/src/live-days.ts), which must name the same build
// as the page whose hashes it is compared with.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export function replayBuild() {
  const root = join(here, "..", "..");
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir).sort()) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith(".ts")) files.push(p);
    }
  };
  for (const pkg of ["engine", "agents", "config", "data"]) walk(join(root, "packages", pkg, "src"));
  for (const f of ["game.ts", "live.ts", "books.ts", "trucknos.ts", "cuts.ts"]) files.push(join(here, "src", f));
  const h = createHash("sha256");
  for (const f of files) h.update(f.slice(root.length)).update("\0").update(readFileSync(f)).update("\0");
  return h.digest("hex").slice(0, 16);
}
