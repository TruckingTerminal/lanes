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

/**
 * Client batch 8b item 14 (the exploit hunter: "Wed Feb 29" in Year 1, and "due Feb 30"): the dates were labelled on
 * twelve 30-day months, December running long, so February had 30 days. They're on the calendar's own months now (a
 * 365-day year, no leap day), so every date shown is one that exists. The engine's month closes still come every 30
 * days (step.ts); a month's report is named for the month most of it falls in (MonthReport, its middle day).
 */
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
/** The calendar month (0–11) and the day of it (1–31) a game day falls on. */
export function calendarDate(day: number): { month: number; date: number } {
  const doy = ((day % 365) + 365) % 365;
  let m = 11;
  while (MONTH_START[m]! > doy) m--;
  return { month: m, date: doy - MONTH_START[m]! + 1 };
}
export function dateLabel(day: number): string {
  const { month, date } = calendarDate(day);
  return `${DAYS[day % 7]} ${MONTHS[month]} ${date}, Year ${Math.floor(day / 365) + 1}`;
}
/** "Jan 29, Year 1": a date without its weekday, for when something opens. */
export const dayDate = (day: number): string => dateLabel(day).slice(4);
/** "Tue": the weekday alone, for the top strip's clock. */
export const weekday = (day: number): string => DAYS[day % 7]!;
/** The game's date with its weekday: "Fri Feb 2" (the title's Continue, copy-player5.md R25). */
export const weekdayDate = (day: number): string => `${DAYS[day % 7]} ${shortDate(day)}`;
/** "January": the calendar month a day falls in. */
export const monthName = (day: number): string => MONTH_NAMES[calendarDate(day).month]!;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "Oct 28" from a day number, for dense tables. */

export function shortDate(day: number): string {
  const { month, date } = calendarDate(day);
  return `${MONTHS[month]} ${date}`;
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

/**
 * Client batch X (QA's 0.25.0 replay, fail 7): "a 804 FD claim" and "1 loads". A line's article before a figure follows
 * how the figure is said ("an 804", "an 11-min", "an 18,000", "a 1,100"), and a count of one takes the singular. Applied
 * to a finished line, so the writer's templates keep their words (withGrammar wraps a copy object's functions).
 */
const AN_FIGURE = /(^|[^\w])([Aa]) (?=(\d[\d,]*))/g;
function anFor(figure: string): boolean {
  const lead = figure.split(",")[0]!;
  return lead.startsWith("8") || lead === "11" || lead === "18";
}
const ONE_OF = /(^|[^\w.,−-])1 (load|day|truck|driver|claim|night|week|hour|round|mile|order|space|year|month|trailer|bid)s\b/g;
export function grammar(text: string): string {
  return text.replace(AN_FIGURE, (m, pre: string, a: string, fig: string) => (anFor(fig) ? `${pre}${a}n ` : m)).replace(ONE_OF, (_m, pre: string, word: string) => `${pre}1 ${word}`);
}
/** A copy object whose functions' lines pass through grammar (fail 7); its plain strings are as written. */
export function withGrammar<T extends object>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    out[k] =
      typeof v === "function"
        ? (...a: unknown[]) => {
            const r = (v as (...x: unknown[]) => unknown)(...a);
            return typeof r === "string" ? grammar(r) : r;
          }
        : v;
  }
  return out as T;
}
