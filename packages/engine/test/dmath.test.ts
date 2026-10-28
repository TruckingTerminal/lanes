import { describe, expect, it } from "vitest";
import { dasin, datan, dcos, dexp, dlog, dpow, dsin } from "@lanes/data";
import { Rng } from "../src/rng.js";

const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));

describe("deterministic math", () => {
  const rng = new Rng(11);
  const draws = (lo: number, hi: number) => Array.from({ length: 4000 }, () => rng.range(lo, hi));

  it("exp and log match Math to about 1e-15", () => {
    for (const x of draws(-40, 40)) expect(rel(dexp(x), Math.exp(x))).toBeLessThan(4e-15);
    for (const x of [...draws(1e-9, 10), ...draws(10, 1e9)]) expect(Math.abs(dlog(x) - Math.log(x))).toBeLessThan(4e-15 * Math.max(1, Math.abs(Math.log(x))));
    expect(dexp(0)).toBe(1);
    expect(dlog(1)).toBe(0);
  });

  it("sin, cos, atan and asin match Math", () => {
    for (const x of draws(-200, 200)) {
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(2e-15);
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(2e-15);
      expect(Math.abs(datan(x) - Math.atan(x))).toBeLessThan(2e-15);
    }
    for (const x of draws(-1, 1)) expect(Math.abs(dasin(x) - Math.asin(x))).toBeLessThan(4e-15);
  });

  it("pow handles integer and real exponents", () => {
    expect(dpow(3, 4)).toBe(81);
    expect(dpow(2, -2)).toBe(0.25);
    for (const x of draws(0.01, 5)) expect(rel(dpow(x, 0.7), x ** 0.7)).toBeLessThan(4e-15);
  });
});
