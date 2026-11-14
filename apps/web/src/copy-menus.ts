/**
 * The menu system's words (studio/specs/menu-system.md; engineering's placeholders for the writer, who words them in one
 * pass). Every figure comes from the engine or the page; these are the frames around them.
 */
export const MENUS = {
  // §2.6 The Motion setting, in the ≡ menu: its label, its three choices, and the one-line help under them.
  motionLabel: "Motion",
  motionChoice: { full: "Full", calm: "Calm", still: "Still" } as const,
  motionHelp: "Full plays the scenes and the little moments; Calm keeps only quick fades; Still moves nothing. It starts from your device's setting.",
};
