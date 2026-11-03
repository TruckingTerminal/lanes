import { describe, expect, it } from "vitest";
import { FIRST_ENTRY } from "../src/copy.js";

/** Iuliia's intro on the first screen (Jeff, 2026-11-03): a few beats in her register before the hub pick. */
describe("Iuliia's intro", () => {
  it("is brief: three to five beats, each under 20 words, the last pointing at a home", () => {
    const beats = FIRST_ENTRY.intro;
    expect(beats.length).toBeGreaterThanOrEqual(3);
    expect(beats.length).toBeLessThanOrEqual(5);
    for (const b of beats) expect(b.split(/\s+/).length, b).toBeLessThan(20);
    expect(beats[beats.length - 1]).toMatch(/home/i);
  });

  it("opens with her name and says what the world is before what to do", () => {
    expect(FIRST_ENTRY.intro[0]).toMatch(/Iuliia/);
    expect(FIRST_ENTRY.intro.findIndex((b) => /freight market/.test(b))).toBeLessThan(FIRST_ENTRY.intro.findIndex((b) => /home/i.test(b)));
    expect(FIRST_ENTRY.welcomeTitle).toBeTruthy();
  });
});
