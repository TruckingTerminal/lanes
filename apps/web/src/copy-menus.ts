/**
 * The menu system's words (studio/specs/menu-system.md; engineering's placeholders for the writer, who words them in one
 * pass). Every figure comes from the engine or the page; these are the frames around them.
 */
export const MENUS = {
  // §2.6 The Motion setting, in the ≡ menu: its label, its three choices, and the one-line help under them.
  motionLabel: "Motion",
  motionChoice: { full: "Full", calm: "Calm", still: "Still" } as const,
  motionHelp: "Full plays the scenes and the little moments; Calm keeps only quick fades; Still moves nothing. It starts from your device's setting.",
  // §2.3 The stamps' words, drawn over the ink ring (short, capitals, Pixelify Sans).
  stampBidIn: "BID IN",
  stampBooked: "BOOKED",
  stampWon: "WON",
  stampLost: "LOST",
  stampPaid: "PAID",
  // §2.4 The pay landing's toast: where it came from and what reached you ("Yours"), the figure still from its first frame.
  paidToast: (from: string, to: string, fd: string) => `Paid · ${from} → ${to} · +${fd} FD`,
  // §2.4 The chip under the cash when costs leave: one cost names itself; several in one tick are counted.
  costChipOne: (fd: string, what: string) => `−${fd} FD · ${what}`,
  costChipMany: (fd: string, n: number) => `−${fd} FD · ${n} costs`,
  // §3 The board: new loads at a round wait behind this pill rather than push the list.
  newLoads: (n: number) => (n === 1 ? "1 new load" : `${n} new loads`),
};
