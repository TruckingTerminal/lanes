import "./seed.js";
import { describe, expect, it, vi } from "vitest";
import { IULIIA_SAY } from "../src/copy.js";
import { GAME_CONFIG } from "../src/game.js";
import { iuliiaFirst, iuliiaNow, iuliiaSay, setIuliiaMuted } from "../src/iuliia.js";
import { S } from "../src/state.js";

describe("Iuliia by tab and card", () => {
  it("rotates variants, keeps her quiet time, shows a line for its seconds, and goes silent when muted", () => {
    const k = GAME_CONFIG.ui.iuliia;
    let now = 1_000_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const lines = IULIIA_SAY["loads:first"]!;
    const said: string[] = [];
    for (let i = 0; i < lines.length * 2; i++) {
      iuliiaSay("loads:first");
      said.push(iuliiaNow()!);
      // Inside the quiet time nothing new is said; past the show time the strip frees.
      iuliiaSay("load:bid");
      expect(iuliiaNow()).toBe(said.at(-1));
      now += k.showSeconds * 1000 + 1;
      expect(iuliiaNow()).toBeNull();
      now += k.quietSeconds * 1000;
    }
    // Each variant once before any repeats.
    expect(new Set(said.slice(0, lines.length)).size).toBe(lines.length);
    expect(said.slice(lines.length)).toEqual(said.slice(0, lines.length));
    // First visits are once per sitting.
    iuliiaFirst("money:first");
    expect(iuliiaNow()).not.toBeNull();
    now += (k.showSeconds + k.quietSeconds) * 1000 + 2;
    iuliiaNow();
    iuliiaFirst("money:first");
    expect(iuliiaNow()).toBeNull();
    // Quiet mutes her.
    setIuliiaMuted(true);
    iuliiaSay("result:won");
    expect(S.iuliiaLine).toBeNull();
    setIuliiaMuted(false);
    vi.restoreAllMocks();
  });
});
