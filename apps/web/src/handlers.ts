import type { StartKind } from "./game.js";

/** What the title screen and the top bar ask the boot code to do; main.tsx fills these in. */
export const H = {
  /** A new test world, which opens with no company: the hub is chosen inside it. */
  openTest: (): void => {},
  /** The hub chosen inside the world (test or live): the company joins there. */
  choose: (_name: string, _hub: string, _start: StartKind): void => {},
  backToLive: (): void => {},
  backToTest: (): void => {},
  openWorld: (): void => {},
  takeover: (): void => {},
  join: (_name: string, _hub: string): void => {},
  showTestMenu: (): void => {},
  /** The test build: replay the world saved in this browser (the title shows a Continue button when there is one). */
  continueTest: (): void => {},
  /** The title's "Continue" or "Enter the world": into the live world, caught up behind the title. */
  enterWorld: (): void => {},
  /** The title's "Sign in" and "Retry": connect again. */
  retry: (): void => {},
  /** The Menu button in the top bar: the title screen, with the game still running underneath. */
  showMenu: (): void => {},
};
