import type { Equipment } from "@lanes/config";
import { PAL } from "./art.js";
import { filledUrl, frame, frameUrl, loadSheet, type HueShift, type Sheet, type SheetLayout } from "./sprites.js";
import vanSheetUrl from "../assets/trucks/van64/van64.png";
import vanLayout from "../assets/trucks/van64/van64.json";
import reeferSheetUrl from "../assets/trucks/reefer64/reefer64.png";
import reeferLayout from "../assets/trucks/reefer64/reefer64.json";
import flatbedSheetUrl from "../assets/trucks/flatbed64/flatbed64.png";
import flatbedLayout from "../assets/trucks/flatbed64/flatbed64.json";
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

/** The map trucks: a painted eight-heading sheet per trailer (68-px cells, their own pixels at 4×); the cab is repainted by owner. */
const SHEETS: Record<Equipment, [string, SheetLayout]> = { van: [vanSheetUrl, vanLayout as SheetLayout], reefer: [reeferSheetUrl, reeferLayout as SheetLayout], flatbed: [flatbedSheetUrl, flatbedLayout as SheetLayout] };
export function truckSheet(eq: Equipment = "van"): Sheet {
  return loadSheet(`truck-${eq}`, SHEETS[eq][0], SHEETS[eq][1], () => onReady?.());
}
/** The map truck sheets are drawn pixel for pixel at this many device pixels per level-0 art pixel. */
export const TRUCK_SCALE = 4;
/** The cab's cyan paint (hue 165–210) turned lime for other players and grey for the AI carriers. */
const CAB_HUE: Record<"mine" | "other" | "ai", HueShift | undefined> = { mine: undefined, other: { hue: [165, 210], shift: -85 }, ai: { hue: [165, 210], shift: 0, sat: 0.12 } };

/** Heading names in the map's order: E, SE, S, SW, W, NW, N, NE. */
const HEADINGS = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];

/** One heading of the map truck at `scale`, or null until the sheet has decoded. */
export function truckFrame(dir: number, scale: number, owner: "mine" | "other" | "ai", eq: Equipment): HTMLCanvasElement | null {
  return frame(truckSheet(eq), HEADINGS[dir] ?? "east", scale, undefined, `${owner}|${eq}`, CAB_HUE[owner]);
}

/** The south-facing map truck as an <img> source, for legends and cards. */
export function truckFrameUrl(scale: number, owner: "mine" | "other" | "ai", eq: Equipment): string | null {
  return frameUrl(truckSheet(eq), "south-east", scale, undefined, `${owner}|${eq}`, CAB_HUE[owner]);
}
