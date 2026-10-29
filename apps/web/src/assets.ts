import type { Equipment } from "@lanes/config";
import { PAL } from "./art.js";
import { filledUrl, frame, frameUrl, loadSheet, type Sheet, type SheetLayout } from "./sprites.js";
import vanSheetUrl from "../assets/trucks/van/van.png";
import vanLayout from "../assets/trucks/van/van.json";
import rigVan from "../assets/rigs/van.png";
import rigReefer from "../assets/rigs/reefer.png";
import rigFlatbed from "../assets/rigs/flatbed.png";
import sceneOffice from "../assets/scenes/office.png";
import sceneYard from "../assets/scenes/yard.png";
import sceneDock from "../assets/scenes/dock.png";
import sceneWeigh from "../assets/scenes/weigh.png";
import sceneTruckstop from "../assets/scenes/truckstop.png";
import sceneLounge from "../assets/scenes/lounge.png";
import sceneDealer from "../assets/scenes/dealer.png";
import sceneBank from "../assets/scenes/bank.png";
import sceneGuide from "../assets/scenes/guide.png";
import logoPng from "../assets/logo/lanes.png";
import logoTitlePng from "../assets/logo/lanes-title.png";
import driverM from "../assets/people/driver-m.png";
import driverF from "../assets/people/driver-f.png";
import dispatcher from "../assets/people/dispatcher.png";
import broker from "../assets/people/broker.png";
import mechanic from "../assets/people/mechanic.png";
import dockworker from "../assets/people/dockworker.png";

/**
 * The PixelLab assets (apps/web/assets, made with tools/pixellab.py on the LANES palette):
 * the top-down truck sheet for the map, side-view rigs for the cards, scenes, and portraits.
 */

const RIG_RAW: Record<Equipment, string> = { van: rigVan, reefer: rigReefer, flatbed: rigFlatbed };
/** The side-view rig for the cards, its trailer body filled in (the raw image until that is ready). */
export const rig = (eq: Equipment): string => filledUrl(RIG_RAW[eq], PAL.paper, () => onReady?.()) ?? RIG_RAW[eq];
export const SCENES = { office: sceneOffice, yard: sceneYard, dock: sceneDock, weigh: sceneWeigh, truckstop: sceneTruckstop, lounge: sceneLounge, dealer: sceneDealer, bank: sceneBank, guide: sceneGuide } as const;
export const PEOPLE = { driverM, driverF, dispatcher, broker, mechanic, dockworker } as const;
export type Person = keyof typeof PEOPLE;
/** The file each portrait and its loop are named after under assets/people. */
export const PEOPLE_FILE: Record<Person, string> = { driverM: "driver-m", driverF: "driver-f", dispatcher: "dispatcher", broker: "broker", mechanic: "mechanic", dockworker: "dockworker" };
/** The LANES logo: the Trucking Terminal truck mark and the name, 512 × 128, HD pixel art. */
export const LOGO = logoPng;
export const LOGO_W = 512;
export const LOGO_H = 128;
/** The title screen's logo: LANES over "by Trucking Terminal", 512 × 176. */
export const LOGO_TITLE = logoTitlePng;
export const LOGO_TITLE_H = 176;

/** A driver's portrait: the owner and the odd-numbered hires are one face, the rest the other. */
export const driverPortrait = (staffId: number): string => (staffId % 2 ? driverM : driverF);
export const driverPerson = (staffId: number): Person => (staffId % 2 ? "driverM" : "driverF");

let onReady: (() => void) | null = null;
export function whenAssetsReady(f: () => void): void {
  onReady = f;
}

/** The map truck: one sheet, eight headings; the trailer is recoloured by equipment, the cab by owner. */
export function truckSheet(): Sheet {
  return loadSheet("truck", vanSheetUrl, vanLayout as SheetLayout, () => onReady?.());
}

/** Heading names in the map's order: E, SE, S, SW, W, NW, N, NE. */
const HEADINGS = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];

const CAB: Record<"mine" | "other" | "ai", [string, string][]> = {
  mine: [],
  other: [
    [PAL.cyan, PAL.lime],
    [PAL.teal, PAL.olive],
  ],
  ai: [
    [PAL.cyan, PAL.fog],
    [PAL.teal, PAL.steel],
  ],
};
const TRAILER: Record<Equipment, [string, string][]> = {
  van: [],
  reefer: [
    [PAL.white, "#cfe6f4"],
    [PAL.paper, "#b7d6ea"],
    [PAL.mist, PAL.blueL],
  ],
  flatbed: [
    [PAL.white, PAL.sandD],
    [PAL.paper, PAL.clay],
    [PAL.mist, PAL.rust],
  ],
};

/** One heading of the map truck at `scale`, or null until the sheet has decoded. */
export function truckFrame(dir: number, scale: number, owner: "mine" | "other" | "ai", eq: Equipment): HTMLCanvasElement | null {
  return frame(truckSheet(), HEADINGS[dir] ?? "east", scale, [...CAB[owner], ...TRAILER[eq]], `${owner}|${eq}`);
}

/** The south-facing map truck as an <img> source, for legends and cards. */
export function truckFrameUrl(scale: number, owner: "mine" | "other" | "ai", eq: Equipment): string | null {
  return frameUrl(truckSheet(), "south-east", scale, [...CAB[owner], ...TRAILER[eq]], `${owner}|${eq}`);
}
