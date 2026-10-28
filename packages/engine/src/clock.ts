import type { EconomyConfig } from "@lanes/config";

/**
 * Game time is minutes since the season started (in-game Jan 1, 00:00). The
 * engine only ever sees game minutes; mapping from real time is done here, by the
 * caller, so the engine never reads the wall clock.
 */
export type GameMinutes = number;

export const MINUTES_PER_HOUR = 60;

export function dayOf(t: GameMinutes, cfg: EconomyConfig): number {
  return Math.floor(t / cfg.time.gameMinutesPerDay);
}

export function hourOf(t: GameMinutes, cfg: EconomyConfig): number {
  return Math.floor((t % cfg.time.gameMinutesPerDay) / MINUTES_PER_HOUR);
}

/** Season index (0 = Season 1). One season = one in-game year. */
export function seasonOf(day: number, cfg: EconomyConfig): number {
  return Math.floor(day / cfg.time.daysPerSeason);
}

export function dayOfSeason(day: number, cfg: EconomyConfig): number {
  return day % cfg.time.daysPerSeason;
}

/** In-game month 0–11 for seasonality, from day of season (30-day months, Dec runs long). */
export function monthOf(day: number, cfg: EconomyConfig): number {
  return Math.min(11, Math.floor((day % cfg.time.daysPerSeason) / cfg.time.daysPerMonth));
}

/** Live mode: 1 in-game day = 6 real hours, so 1 real minute = 4 game minutes. */
export function liveGameMinutes(realNowMs: number, seasonEpochMs: number, cfg: EconomyConfig): GameMinutes {
  const realMsPerGameMinute = (cfg.time.realHoursPerGameDayLive * 3_600_000) / cfg.time.gameMinutesPerDay;
  return Math.floor((realNowMs - seasonEpochMs) / realMsPerGameMinute);
}

/** Sim mode at its configured pace (1 in-game day per real minute by default). */
export function simGameMinutes(realElapsedMs: number, cfg: EconomyConfig, realMsPerGameDay = cfg.time.simRealMsPerGameDay): GameMinutes {
  return Math.floor((realElapsedMs / realMsPerGameDay) * cfg.time.gameMinutesPerDay);
}

export function isRoundBoundary(t: GameMinutes, cfg: EconomyConfig): boolean {
  return t % MINUTES_PER_HOUR === 0 && (cfg.time.boardRoundHours as readonly number[]).includes(hourOf(t, cfg));
}
