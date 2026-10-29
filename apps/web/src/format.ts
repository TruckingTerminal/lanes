import type { Equipment, FacilityType, TractorTier } from "@lanes/config";

/** Number and label formatting shared by every screen. */

export const fd = (x: number): string => {
  const a = Math.abs(x);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `${(a / 1e3).toFixed(1)}k` : Math.round(a).toLocaleString("en-US");
  return `${x < 0 ? "−" : ""}${s}`;
};
/** Whole FD with thousands separators, for money columns. */
export const fdFull = (x: number): string => `${x < 0 ? "−" : ""}${Math.round(Math.abs(x)).toLocaleString("en-US")}`;
export const usd = (x: number): string => `$${x < 10 ? x.toFixed(2) : Math.round(x).toLocaleString("en-US")}`;
export const pct = (x: number): string => `${Math.round(x * 100)}%`;
export const signedPct = (x: number): string => `${x >= 0 ? "+" : "−"}${Math.round(Math.abs(x) * 100)}%`;
export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const TIER_NAME: Record<TractorTier, string> = { workhorse: "Workhorse", highwayPro: "Highway Pro", flagship: "Flagship" };
export const TRAILER_NAME: Record<Equipment, string> = { van: "Dry van", reefer: "Reefer", flatbed: "Flatbed" };
export const TRAILER_CODE: Record<Equipment, string> = { van: "V", reefer: "R", flatbed: "F" };
export const FAC_NAME: Record<FacilityType, string> = { warehouse: "Warehouse", coldStorage: "Cold storage", factory: "Factory" };

export function dateLabel(day: number): string {
  const doy = day % 365;
  const m = Math.min(11, Math.floor(doy / 30));
  return `${DAYS[day % 7]} ${MONTHS[m]} ${doy - m * 30 + 1}, Year ${Math.floor(day / 365) + 1}`;
}
/** "Oct 28" from a day number, for dense tables. */
export function shortDate(day: number): string {
  const doy = day % 365;
  const m = Math.min(11, Math.floor(doy / 30));
  return `${MONTHS[m]} ${doy - m * 30 + 1}`;
}
export const hhmm = (gameMin: number): string => `${String(Math.floor(gameMin / 60) % 24).padStart(2, "0")}:${String(Math.floor(gameMin) % 60).padStart(2, "0")}`;
/** Real time until a game minute, for the live world: "45s", "12m", "2h 05m". */
export function realUntil(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
/** "5 h", "1 d 3 h", "4 d". */
export function hoursLabel(h: number): string {
  const hh = Math.floor(h);
  const d = Math.floor(hh / 24);
  return d === 0 ? `${hh} h` : `${d} d${hh % 24 ? ` ${hh % 24} h` : ""}`;
}
export const cls = (...xs: (string | false | null | undefined)[]): string => xs.filter(Boolean).join(" ");
