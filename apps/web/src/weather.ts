import { hash } from "./map.js";

/**
 * The weather over the map: deterministic from the world seed and the in-game day, so every
 * page shows the same sky. A slow-moving pressure field decides where it rains, the season and
 * the latitude decide whether that is rain, snow or a storm, mornings on coasts and in the
 * valleys bring fog, and summer afternoons in the south bring heat. The engine's rates only
 * see `feeds.weather` for now; this drives the map's overlays and will feed the rules later.
 */

export type WeatherKind = "clear" | "cloud" | "rain" | "storm" | "snow" | "fog" | "heat";
export interface Weather {
  kind: WeatherKind;
  /** 0–1: how heavy the rain or snow, how thick the fog, how dark the cloud. */
  intensity: number;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
/** Value noise over a seeded lattice; the `s` picks the field. */
function noise(x: number, y: number, s: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = hash(x0, y0, s);
  const b = hash(x0 + 1, y0, s);
  const c = hash(x0, y0 + 1, s);
  const d = hash(x0 + 1, y0 + 1, s);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/** The weather at a place (longitude, latitude) on an in-game day and hour, for a world seed. */
export function weatherAt(lon: number, lat: number, day: number, hour: number, seed: number): Weather {
  const s = seed % 1000;
  // Systems drift east about 5° a day: the field is sampled upwind of today.
  const t = day + hour / 24;
  const px = (lon + t * 5) / 9;
  const py = lat / 6 + t * 0.07;
  const pressure = noise(px, py, s + 1) * 0.7 + noise(px * 2.3, py * 2.3, s + 2) * 0.3;
  const doy = day % 365;
  // Cold: north and midwinter; the season swings ±1, the latitude 0 at 25° to 1 at 49°.
  const seasonCold = Math.cos(((doy - 15) / 365) * Math.PI * 2);
  const northness = Math.min(1, Math.max(0, (lat - 25) / 24));
  const cold = seasonCold * 0.6 + northness * 0.9 - 0.55 + (noise(px * 1.7, py * 1.7, s + 3) - 0.5) * 0.3;
  const wet = pressure - 0.58;
  if (wet > 0) {
    const intensity = Math.min(1, wet / 0.3);
    if (cold > 0.35) return { kind: "snow", intensity };
    if (intensity > 0.75 && cold < 0) return { kind: "storm", intensity };
    return { kind: "rain", intensity };
  }
  // Morning fog along the coasts and in the valleys when the air is still.
  const coast = noise(lon / 2.5, lat / 2.5, s + 4);
  if (hour >= 5 && hour < 10 && pressure > 0.42 && coast > 0.62) return { kind: "fog", intensity: Math.min(1, (coast - 0.62) / 0.2) };
  if (wet > -0.05) return { kind: "cloud", intensity: Math.min(1, (wet + 0.05) / 0.05) };
  if (cold < -0.75 && hour >= 12 && hour < 19) return { kind: "heat", intensity: Math.min(1, (-0.75 - cold) / 0.3) };
  return { kind: "clear", intensity: 0 };
}

/** One line of the forecast for a hub, for tooltips and the hub panel. */
export function weatherLabel(w: Weather): string {
  const heavy = w.intensity > 0.6;
  switch (w.kind) {
    case "clear": return "clear";
    case "cloud": return "overcast";
    case "rain": return heavy ? "heavy rain" : "rain";
    case "storm": return "thunderstorms";
    case "snow": return heavy ? "heavy snow" : "snow";
    case "fog": return "fog";
    case "heat": return "heat";
  }
}
