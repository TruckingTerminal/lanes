import type { StartKind } from "./game.js";

/** What the title screen and the top bar ask the boot code to do; main.tsx fills these in. */
export const H = {
  openTest: (_name: string, _start: StartKind, _hub: string): void => {},
  backToLive: (): void => {},
  backToTest: (): void => {},
  openWorld: (): void => {},
  takeover: (): void => {},
  join: (_name: string, _hub: string): void => {},
  showTestMenu: (): void => {},
  /** The test build: replay the world saved in this browser (the title shows a Continue button when there is one). */
  continueTest: (): void => {},
  /** The Menu button in the top bar: the title screen, with the game still running underneath. */
  showMenu: (): void => {},
};
