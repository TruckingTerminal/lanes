import { defineConfig } from "vitest/config";

export default defineConfig({
  // testTimeout: a web test world takes about five seconds to create since the day-ten warm start (apps/web game.ts
  // WARM_HOURS), past vitest's 5 s default; a test that needs longer still says so itself.
  test: { include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"], testTimeout: 60_000 },
});
