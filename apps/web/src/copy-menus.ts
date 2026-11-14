/**
 * The menu system's words (studio/specs/menu-system.md; engineering's placeholders for the writer, who words them in one
 * pass). Every figure comes from the engine or the page; these are the frames around them.
 */
export const MENUS = {
  // §2.6 The Motion setting, in the ≡ menu: its label, its three choices, and the one-line help under them.
  motionLabel: "Motion",
  motionChoice: { full: "Full", calm: "Calm", still: "Still" } as const,
  motionHelp: "Full plays every scene and flourish. Calm keeps only quick fades. Still moves nothing. It starts at your device's own setting.",
  // §2.3 The stamps' words, drawn over the ink ring (short, capitals, Pixelify Sans).
  stampBidIn: "BID IN",
  stampBooked: "BOOKED",
  stampWon: "WON",
  stampLost: "LOST",
  stampPaid: "HAULED",
  // §2.4 The pay landing's toast: where it came from and what reached you ("Yours"), the figure still from its first frame.
  paidToast: (from: string, to: string, fd: string) => `Delivered · ${from} → ${to} · ${fd} FD yours`,
  // §2.4 The chip under the cash when costs leave: one cost names itself; several in one tick are counted.
  costChipOne: (fd: string, what: string) => `−${fd} FD · ${what}`,
  costChipMany: (fd: string, n: number) => `−${fd} FD · ${n} costs`,
  // §3 The board: new loads at a round wait behind this pill rather than push the list.
  newLoads: (n: number) => (n === 1 ? "1 new load" : `${n} new loads`),
  // §2.4 Money: new invoices wait behind this pill while the screen is open.
  newEntries: (n: number) => (n === 1 ? "1 new entry" : `${n} new entries`),
  // §1.3 The hero moments: a truck bought, the brokerage reaching a stage (the producer's thresholds: 15, 60, 180 loads
  // in 30 days), and the button that closes them.
  heroTruck: (truck: number) => `Truck ${truck} has arrived. The keys are on the desk.`,
  heroStage: (stage: number) => ["Your brokerage: a phone at the kitchen table.", "Your brokerage has outgrown the kitchen table. It has an office now.", "Your brokerage fills a room: desks, phones, a board on the wall.", "Your brokerage runs a whole floor. Every phone is ringing."][Math.max(0, Math.min(3, stage - 1))]!,
  heroOk: "Back to work",
  // Engineering's placeholder, batch M1 (the player's pass: "clear near 4.31" above "too few have cleared"): with no
  // suggested bid because this lane has too few clears of its own, the bid line points at the market's figure the sheet
  // shows rather than seeming to deny it.
  bidMarketGuide: (rate: string) => `Too few loads have cleared on this lane to suggest a bid. Loads like it in this market clear near ${rate}/mi; Book now is the sure price.`,
  // Engineering's placeholder, batch M2 (QA: the home-time line said "starting now" every day): after the days off's
  // first day, the line counts down.
  homeDaysLeft: (who: string, place: string, market: string, days: number) => `${who} home (${place}, ${market} market): ${days} ${days === 1 ? "day" : "days"} off left.`,
};
