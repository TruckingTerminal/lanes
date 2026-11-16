import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Jeff, 2026-11-16: the guide is Julia (she was Iuliia). Her code id keeps the old spelling (src/iuliia.ts says where),
 * so this looks only for the old name standing as a word: in a line a player can read, or in a comment that would teach
 * the next writer the old name. It reads the client's source and the packages that feed it.
 */
const root = join(__dirname, "..", "..", "..");
const DIRS = ["apps/web/src", "packages/engine/src", "packages/agents/src", "packages/config/src"];
const OLD = /(?<![A-Za-z])Iuliia(?![A-Za-z])/;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|html|css)$/.test(f) ? [p] : [];
  });

describe("her name", () => {
  it("is Julia wherever the word stands alone", () => {
    const hits = DIRS.flatMap((d) => walk(join(root, d))).flatMap((p) =>
      readFileSync(p, "utf8")
        .split("\n")
        .flatMap((line, i) => (OLD.test(line) ? [`${relative(root, p)}:${i + 1}`] : [])),
    );
    expect(hits).toEqual([]);
  });
});
