import { COMMODITIES } from "@lanes/data";
import { truckLatLon, type Company, type Load, type Truck, type World } from "@lanes/engine";
import { restingUntil } from "./rolling.js";
import { weatherAt } from "./weather.js";

/**
 * Which window each screen shows (UX's picks §3.1, the menu system §3), as names ui/Window.tsx draws: a packed window, or
 * the existing scene of that name. Pure: the screens call these, the tests read them.
 */

/** The facility a load leaves from, by its commodity (the producer approved this mapping, 2026-11-14; the director sees it next). */
export const FACILITY: Record<string, string> = {
  // Dry and general
  grocery: "shp-docks",
  beverages: "shp-docks",
  paper: "shp-docks",
  imports: "shp-docks",
  chemicals: "shp-docks",
  feed: "shp-docks",
  // Manufactured
  autoParts: "shp-factory",
  electronics: "shp-factory",
  machinery: "shp-factory",
  furniture: "shp-factory",
  // Frozen and cold
  frozen: "shp-coldstore",
  dairy: "shp-coldstore",
  meat: "shp-coldstore",
  pharma: "shp-coldstore",
  // Fresh produce and the farm
  produce: "shp-produce",
  potatoes: "shp-produce",
  hay: "shp-produce",
  trees: "shp-produce",
  // Retail
  retail: "shp-dc",
  parcels: "shp-dc",
  textiles: "shp-dc",
  // Metal
  steel: "shp-steel",
  oilfield: "shp-steel",
  // Building materials
  lumber: "shp-lumber",
  building: "shp-lumber",
};
/** A load sheet's window: its origin's facility by the load's kind; the dock until a kind is mapped. */
export function facilityWindow(l: Pick<Load, "commodity">): string {
  const id = COMMODITIES[l.commodity]?.id;
  return (id && FACILITY[id]) ?? "dock";
}

/** The board's window: the dispatch office by day, the ops room at night (UX §3.1). */
export const boardWindow = (band: string): string => (band === "night" ? "bg-board-s2" : "office");

/**
 * The truck card's window, by what the truck is doing (UX §3.1), and whether the side-view rig lies over it (a painting
 * with its own truck in it takes none): rolling, the golden road (a snowy one where it's snowing at the truck); loading
 * or unloading, the dock; waiting at a shipper before the load is ready, detention; on a break, the rest area; resting
 * for the night, the truck stop; in the shop, the repair bay; broken down, the roadside; on days off, home.
 */
export function truckWindow(w: World, c: Company, t: Truck): { name: string; rig: boolean } {
  const driver = t.driverId ? w.staff[t.driverId - 1] : undefined;
  const home = driver && driver.homeUntilDay !== null && driver.homeUntilDay > Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  if (t.status === "repair") return { name: "plan-repair", rig: false };
  if ((t.breakdownMin ?? 0) > 0) return { name: "plan-breakdown", rig: false };
  if (t.status === "idle" && home) return { name: "plan-hometime", rig: false };
  if (t.status === "loading") {
    const l = t.loadId !== null ? w.loads.get(t.loadId) : undefined;
    return l?.readyT !== undefined && l.readyT > w.t ? { name: "shp-detention", rig: false } : { name: "dock", rig: false };
  }
  if (t.status === "unloading") return { name: "dock", rig: false };
  if (t.status === "loaded" || t.status === "toPickup" || t.status === "repositioning") {
    if (restingUntil(w, t, c) !== null) return { name: "truckstop", rig: false };
    if ((t.pauseMin ?? 0) > 0.5) return { name: "plan-restarea", rig: false };
    const [lat, lon] = truckLatLon(w, t);
    const minute = w.t;
    const wx = weatherAt(lon, lat, Math.floor(minute / 1440), (minute / 60) % 24, w.seed);
    return wx.kind === "snow" ? { name: "plan-winter-road", rig: false } : { name: "road-golden", rig: true };
  }
  return { name: "yard", rig: true };
}

/** The brokerage's stage, by its level (1–4; UX §3.1): the kitchen table to the floor. */
export const brokerageWindow = (stage: number): string => ["brk-stage1-kitchen", "brk-stage2-office", "brk-stage3-room", "brk-stage4-floor"][Math.max(0, Math.min(3, stage - 1))]!;

/** A screen's window: the name, its night painting where the screen has its own (the board), and a fallback scene. */
export interface ScreenWin {
  name: string;
  night?: string;
  fallback?: string;
}
/**
 * Each tab's window (UX's picks §3.1), at the top of the rack on a laptop and the sheet's body on a phone; null where a
 * screen has none. Loads shows the open load's facility while a load sheet is open; the first entry (choosing a hub)
 * shows the skyline.
 */
export function screenWindow(tab: string, w: World | null, openLoad: number | null, picking: boolean): ScreenWin | null {
  if (picking) return { name: "plan-skyline", fallback: "office" };
  switch (tab) {
    case "fleet":
      return { name: "yard" };
    case "loads": {
      const l = openLoad !== null && w ? w.loads.get(openLoad) : undefined;
      return l ? { name: facilityWindow(l), fallback: "dock" } : { name: "office", night: "bg-board-s2" };
    }
    case "money":
      return { name: "bank" };
    case "finance":
      return { name: "mkt-loan", fallback: "bank" };
    case "iuliia":
      return { name: "bg-iuliia-s2", fallback: "guide" };
    case "guide":
      return { name: "guide" };
    case "company":
      return { name: "brk-corner-office", fallback: "office" };
    case "intel":
      return { name: "lounge" };
    case "staff":
      return { name: "plan-hiring", fallback: "lounge" };
    case "market":
      return { name: "dealer" };
    case "brokerage":
      return { name: brokerageWindow(1), fallback: "office" };
    case "book":
      return { name: "brk-board", fallback: "office" };
    case "carriers":
      return { name: "brk-handshake-carrier", fallback: "lounge" };
    default:
      return null;
  }
}
