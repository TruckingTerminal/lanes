import type { JSX } from "preact";
import { atlasUrl, kitData, type Atlas, type Piece } from "../menuart.js";

/**
 * An icon from the menu atlases (UX's picks §1–2): the four phone tabs from the kit (`tab-fleet`, `tab-loads`,
 * `tab-money`, `tab-more`, each with a 5-frame lit loop), everything else from `ui/icons.png` (96 px cells). Drawn as a
 * box with the atlas as its background, smoothly scaled from 96 (UX: "smooth scaling, like the tab icons"). A lit tab
 * plays its loop once on select (Full motion) and rests on its last frame; Calm and Still show the last frame.
 * Null when the atlas or the piece isn't in yet: the caller keeps its own fallback.
 */
const KIT_TABS = new Set(["fleet", "loads", "money", "more"]);
/** The names the page uses for an icon, mapped to the atlas pieces (the Needs-you rows say "truck" for the fleet). */
const ALIAS: Record<string, string> = { truck: "fleet", switch16: "switch-32" };

export function iconPiece(name: string, lit = false): { atlas: Atlas; piece: Piece; lit: Piece | null } | null {
  const k = kitData();
  if (!k) return null;
  const n = ALIAS[name] ?? name;
  if (KIT_TABS.has(n)) {
    const piece = k.kit?.pieces?.[`tab-${n}`];
    if (!piece) return null;
    return { atlas: k.kit, piece, lit: lit ? k.kit.pieces[`tab-${n}-lit`] ?? null : null };
  }
  const piece = k.icons?.pieces?.[n];
  return piece ? { atlas: k.icons, piece, lit: null } : null;
}

/** The background that shows one cell of an atlas at `size` CSS px. */
export function cellStyle(atlas: Atlas, p: Piece, size: number, frame = 0): JSX.CSSProperties {
  const k = size / p.w;
  const x = p.x + frame * (p.step ?? p.w);
  return { width: `${size}px`, height: `${Math.round(p.h * k)}px`, backgroundImage: `url("${atlasUrl(atlas.image)}")`, backgroundSize: `${atlas.w * k}px ${atlas.h * k}px`, backgroundPosition: `${-x * k}px ${-p.y * k}px` };
}

export function KitIcon({ name, size, lit = false, class: extra }: { name: string; size: number; lit?: boolean; class?: string }): JSX.Element | null {
  const got = iconPiece(name, lit);
  if (!got) return null;
  const { atlas, piece } = got;
  if (got.lit) {
    const L = got.lit;
    const n = L.frames ?? 5;
    const k = size / L.w;
    const style = { ...cellStyle(atlas, L, size, n - 1), "--lit-x0": `${-L.x * k}px`, "--lit-x1": `${-(L.x + (n - 1) * (L.step ?? L.w)) * k}px`, "--lit-steps": String(n - 1), "--lit-ms": `${Math.round((n / (L.fps ?? 8)) * 1000)}ms` } as JSX.CSSProperties;
    return <span class={`kicon lit ${extra ?? ""}`} style={style} aria-hidden="true" />;
  }
  return <span class={`kicon ${extra ?? ""}`} style={cellStyle(atlas, piece, size)} aria-hidden="true" />;
}
