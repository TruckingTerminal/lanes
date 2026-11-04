import { describe, expect, it } from "vitest";
import { FIRST_ENTRY, TUTORIAL } from "../src/copy.js";

/** Iuliia's intro on the first screen (Jeff, 2026-11-03): a few beats in her register before the hub pick. */
describe("Iuliia's intro", () => {
  it("is brief: three to five beats, each at most 28 words (a card, not a caption), the last pointing at a home", () => {
    const beats = FIRST_ENTRY.intro;
    expect(beats.length).toBeGreaterThanOrEqual(3);
    expect(beats.length).toBeLessThanOrEqual(5);
    for (const b of beats) expect(b.split(/\s+/).length, b).toBeLessThanOrEqual(28);
    expect(beats[beats.length - 1]).toMatch(/home/i);
  });

  it("opens with her name and says what the world is before what to do", () => {
    expect(FIRST_ENTRY.intro[0]).toMatch(/Iuliia/);
    expect(FIRST_ENTRY.intro.findIndex((b) => /freight market/.test(b))).toBeLessThan(FIRST_ENTRY.intro.findIndex((b) => /home/i.test(b)));
    expect(FIRST_ENTRY.welcomeTitle).toBeTruthy();
  });

  it("her first-load beats are cards: three on Truck, five on Loads, at most 60 words each", () => {
    for (const beats of [TUTORIAL.truck("Dallas", "25%", false), TUTORIAL.truck("Dallas", "25%", true), TUTORIAL.loads("dry van", "06:00", "18:00")]) {
      expect(beats.length).toBeGreaterThanOrEqual(3);
      for (const b of beats) expect(b.split(/\s+/).length).toBeLessThanOrEqual(60);
    }
    expect(TUTORIAL.loads("dry van", "06:00", "18:00").join(" ")).toMatch(/Book now/);
  });
});
