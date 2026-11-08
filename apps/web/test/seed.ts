import { beforeEach, afterEach } from "vitest";

/**
 * Every web test runs on a fixed seed (the itinerary, item 6: TestGame.create defaults to Math.random, and board.test and
 * rolling.test flaked on it). Imported by each test file: before each test, Math.random becomes a seeded generator, so a
 * world made without a seed (TestGame.create's default) is the same world every run. The seed is the test's own, from
 * its file and name; LANES_TEST_SEED overrides it, and a failing test prints the line that reruns it.
 *
 *   TZ=UTC LANES_TEST_SEED=<seed> npx vitest run apps/web -t "<test name>"
 */
const real = Math.random;

/** FNV-1a over the text: a test's own seed, the same on every machine. */
export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** mulberry32: small, fast, and good enough to pick world seeds and test dice. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

beforeEach((ctx) => {
  const env = process.env.LANES_TEST_SEED;
  const seed = env !== undefined && env !== "" ? Number(env) >>> 0 : seedOf(`${ctx.task.file?.name ?? ""}::${ctx.task.name}`);
  Math.random = seededRandom(seed);
  ctx.onTestFailed(() => {
    console.error(`[seed] "${ctx.task.name}" ran on seed ${seed}. Rerun it: TZ=UTC LANES_TEST_SEED=${seed} npx vitest run apps/web -t ${JSON.stringify(ctx.task.name)}`);
  });
});

afterEach(() => {
  Math.random = real;
});
