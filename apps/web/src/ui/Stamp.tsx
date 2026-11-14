import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { atlasUrl, kitData } from "../menuart.js";
import { motion } from "../motion.js";
import { stage, type AccentKind } from "../stage.js";

/**
 * The stamps (studio/specs/menu-system.md §2.3): one empty ink ring from the kit, the word drawn over it in Pixelify Sans,
 * the ink by CSS: red for the player's own acts (BID IN, BOOKED, PAID), green for WON, grey for LOST. It lands in a
 * corner, clear of every figure (the parent places it: `.stamp` sits in the ticket's top-left), through the accent stage:
 * in Full it lands with scale 1.25 → 1 over 160 ms and then the dust puff (6 frames at 12 fps); in Calm it fades in over
 * 120 ms; in Still it's simply there. Until the kit is in, the ring is a CSS circle.
 */
export type Ink = "red" | "green" | "grey";
/** Stamps that have landed this sitting, by id: one seen again (a screen reopened) is simply there, no accent. */
const landedIds = new Set<string>();
export function Stamp({ word, id, ink = "red", kind = "own", size = 64 }: { word: string; id: string; ink?: Ink; kind?: AccentKind; size?: number }): JSX.Element {
  const [landed, setLanded] = useState<"waiting" | "landing" | "landed">(landedIds.has(id) ? "landed" : "waiting");
  useEffect(() => {
    if (landedIds.has(id)) return;
    landedIds.add(id);
    let live = true;
    stage.add({
      kind,
      maxMs: 900,
      play: (done) => {
        if (!live) return done();
        setLanded("landing");
        setTimeout(() => {
          if (live) setLanded("landed");
          done();
        }, motion() === "full" ? 160 + 500 : motion() === "calm" ? 120 : 0);
      },
    });
    return () => {
      live = false;
    };
  }, [id]);
  const k = kitData();
  const ring = k?.kit?.pieces?.["stamp-ring"];
  const dust = k?.fx?.pieces?.dust;
  const ringStyle: JSX.CSSProperties = ring && k ? { backgroundImage: `url("${atlasUrl(k.kit.image)}")`, backgroundPosition: `${(-ring.x * size) / ring.w}px ${(-ring.y * size) / ring.h}px`, backgroundSize: `${(k.kit.w * size) / ring.w}px ${(k.kit.h * size) / ring.h}px` } : {};
  return (
    <span class={`stamp ink-${ink} ${landed} ${ring ? "painted" : ""}`} style={{ width: `${size}px`, height: `${size}px`, ...ringStyle }} aria-label={word} role="img">
      <span class="stampword">{word}</span>
      {dust && k && landed === "landing" && motion() === "full" ? <span class="stampdust" style={{ backgroundImage: `url("${atlasUrl(k.fx.image)}")`, "--dust-x": `${-dust.x}px`, "--dust-y": `${-dust.y}px`, "--dust-run": `${-(dust.x + (dust.frames ?? 6) * (dust.step ?? 48))}px` } as JSX.CSSProperties} /> : null}
    </span>
  );
}

/** A stamp due on another screen after an act (BOOKED on the truck card after Book now): its id while it's recent. */
const recent = new Map<string, number>();
export function markStamp(key: string): void {
  recent.set(key, Date.now());
}
/** The stamp id for `key` while it's within `ms` of its act, else null. */
export function recentStamp(key: string, ms = 8000): string | null {
  const at = recent.get(key);
  return at !== undefined && Date.now() - at < ms ? `${key}:${at}` : null;
}
