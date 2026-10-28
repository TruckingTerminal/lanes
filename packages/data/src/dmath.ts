/**
 * Deterministic math for the simulation. Browsers may disagree in the last bit of
 * Math.sin, exp, log and **, and the live world is replayed on every player's
 * machine, so one stray bit would split it. These use only + − × ÷, sqrt and round,
 * which IEEE 754 defines exactly, so every engine gets the same answer.
 */

const LN2_HI = 6.93147180369123816490e-1;
const LN2_LO = 1.90821492927058770002e-10;
const INV_LN2 = 1.44269504088896338700;
const PIO2_1 = 1.57079632673412561417;
const PIO2_1T = 6.07710050650619224932e-11;
const INV_PIO2 = 6.36619772367581382433e-1;
const HALF_PI = 1.5707963267948966;
const SQRT2 = 1.4142135623730951;
const TWO32 = 4294967296;

/** Taylor coefficients 1/n!, built by division (exact rounding, so identical everywhere). */
const INV_FACT: number[] = [1];
for (let n = 1; n <= 20; n++) INV_FACT.push(INV_FACT[n - 1]! / n);

/** 2^k for an integer k, by exact multiplication by powers of two. */
function pow2(k: number): number {
  let y = 1;
  let b = k >= 0 ? 2 : 0.5;
  let n = Math.abs(k);
  while (n > 0) {
    if (n & 1) y *= b;
    b *= b;
    n >>>= 1;
  }
  return y;
}

export function dexp(x: number): number {
  if (x !== x) return NaN;
  if (x > 709.782712893384) return Infinity;
  if (x < -745.1332191019411) return 0;
  const k = Math.round(x * INV_LN2);
  const r = x - k * LN2_HI - k * LN2_LO;
  let p = INV_FACT[14]!;
  for (let n = 13; n >= 0; n--) p = p * r + INV_FACT[n]!;
  // Split the scale so 2^k never overflows before the multiply.
  if (k > 1000) return p * pow2(1000) * pow2(k - 1000);
  if (k < -1000) return p * pow2(-1000) * pow2(k + 1000);
  return p * pow2(k);
}

export function dlog(x: number): number {
  if (x !== x || x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return Infinity;
  let m = x;
  let e = 0;
  while (m >= TWO32) {
    m /= TWO32;
    e += 32;
  }
  while (m < 1 / TWO32) {
    m *= TWO32;
    e -= 32;
  }
  while (m >= 2) {
    m /= 2;
    e++;
  }
  while (m < 1) {
    m *= 2;
    e--;
  }
  if (m > SQRT2) {
    m /= 2;
    e++;
  }
  // log m = 2·atanh(s), s = (m − 1)/(m + 1), |s| ≤ 0.172.
  const s = (m - 1) / (m + 1);
  const s2 = s * s;
  let p = 1 / 25;
  for (let n = 23; n >= 1; n -= 2) p = p * s2 + 1 / n;
  return e * LN2_HI + (2 * s * p + e * LN2_LO);
}

/** x^y. Small integer powers multiply out; anything else goes through exp and log. */
export function dpow(x: number, y: number): number {
  if (Number.isInteger(y) && Math.abs(y) <= 64) {
    let r = 1;
    let b = x;
    let n = Math.abs(y);
    while (n > 0) {
      if (n & 1) r *= b;
      b *= b;
      n >>>= 1;
    }
    return y < 0 ? 1 / r : r;
  }
  if (x === 0) return y > 0 ? 0 : Infinity;
  if (x < 0) return NaN;
  return dexp(y * dlog(x));
}

/** Reduces x to r in [−π/4, π/4] and its quadrant; fine for the angles a sim uses (|x| < 1e6). */
function reduce(x: number): [number, number] {
  const n = Math.round(x * INV_PIO2);
  const r = x - n * PIO2_1 - n * PIO2_1T;
  return [r, ((n % 4) + 4) % 4];
}

function sinKernel(r: number): number {
  const r2 = r * r;
  let p = INV_FACT[19]!;
  for (let n = 17; n >= 1; n -= 2) p = -p * r2 + INV_FACT[n]!;
  return p * r;
}

function cosKernel(r: number): number {
  const r2 = r * r;
  let p = INV_FACT[18]!;
  for (let n = 16; n >= 0; n -= 2) p = -p * r2 + INV_FACT[n]!;
  return p;
}

export function dsin(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  const [r, q] = reduce(x);
  return q === 0 ? sinKernel(r) : q === 1 ? cosKernel(r) : q === 2 ? -sinKernel(r) : -cosKernel(r);
}

export function dcos(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  const [r, q] = reduce(x);
  return q === 0 ? cosKernel(r) : q === 1 ? -sinKernel(r) : q === 2 ? -cosKernel(r) : sinKernel(r);
}

export function datan(x: number): number {
  if (x !== x) return NaN;
  if (x < 0) return -datan(-x);
  if (x > 1) return HALF_PI - datan(1 / x);
  // Two half-angle steps bring x under tan(π/16) ≈ 0.2, where the series converges fast.
  let z = x / (1 + Math.sqrt(1 + x * x));
  z = z / (1 + Math.sqrt(1 + z * z));
  const z2 = z * z;
  let p = 1 / 25;
  for (let n = 23; n >= 1; n -= 2) p = -p * z2 + 1 / n;
  return 4 * z * p;
}

export function dasin(x: number): number {
  if (x !== x || x < -1 || x > 1) return NaN;
  return 2 * datan(x / (1 + Math.sqrt(1 - x * x)));
}
