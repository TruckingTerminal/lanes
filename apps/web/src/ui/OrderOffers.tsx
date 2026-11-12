import type { JSX } from "preact";
import { offeredContracts, type StandingOrder } from "@lanes/engine";
import { PENDING } from "../copy-pending.js";
import { DEFAULT_ORDERS } from "../game.js";
import { wallTrucks } from "../logic.js";
import { act, bumpData, carrierCo, markKey, S, setOnboard, useData } from "../state.js";
import { Btn } from "./bits.js";
import { Iuliia } from "./Walkthrough.js";

/**
 * The further standing orders, offered once each by Iuliia at its moment (client batch 8b item 63, the director's M): after
 * a second stranding, "move idle trucks" (reposition); at the first contract offer, "take contracts"; after a load lost
 * between rounds, "book between rounds" (bookNow). Each is offered once for the company in this world, whatever the
 * answer, and only while the dispatcher bids and the order is off. A stranding counts once per truck per idle spell.
 */
type Offer = "reposition" | "contracts" | "bookNow";
const offeredKey = (k: Offer) => markKey(`offer:${k}`);
export const strandKey = (truckId: number, since: number) => markKey(`strand:${truckId}:${since}`);
/** A load the player bid on went between rounds (logic.ts, the hand bid's result): marks the moment for bookNow's offer. */
export const lostBetweenKey = () => markKey("lostBetween");

function due(): Offer | null {
  const g = S.game;
  if (!g?.player) return null;
  const c = carrierCo();
  if (!c.orders.some((o) => o.kind === "bid")) return null;
  const seen = S.onboard.seen;
  const has = (k: StandingOrder["kind"]) => c.orders.some((o) => o.kind === k && (k !== "contracts" || (o as Extract<StandingOrder, { kind: "contracts" }>).acceptOffers));
  // Strandings, each truck's idle spell once.
  for (const t of wallTrucks()) {
    const key = strandKey(t.id, t.idleSinceT);
    if (!seen.includes(key)) queueMicrotask(() => !S.onboard.seen.includes(key) && setOnboard({ seen: [...S.onboard.seen, key] }));
  }
  const strandings = seen.filter((k) => k.startsWith(markKey("strand:"))).length;
  if (strandings >= 2 && !has("reposition") && !seen.includes(offeredKey("reposition"))) return "reposition";
  if (offeredContracts(g.w, c.id).length > 0 && !has("contracts") && !seen.includes(offeredKey("contracts"))) return "contracts";
  if (seen.includes(lostBetweenKey()) && !has("bookNow") && !seen.includes(offeredKey("bookNow"))) return "bookNow";
  return null;
}

export function OrderOffers(): JSX.Element | null {
  useData();
  const k = due();
  if (!k) return null;
  const c = carrierCo();
  const done = () => setOnboard({ seen: [...S.onboard.seen, offeredKey(k)] });
  const yes = () => {
    const base = DEFAULT_ORDERS.find((o) => o.kind === k)!;
    const order = k === "contracts" ? { ...(base as Extract<StandingOrder, { kind: "contracts" }>), acceptOffers: true } : base;
    act({ type: "set_standing_orders", orders: [...c.orders.filter((o) => o.kind !== k), order] }, PENDING.offerDone, undefined, "carrier");
    done();
    bumpData();
  };
  const text = k === "reposition" ? PENDING.offerReposition : k === "contracts" ? PENDING.offerContracts : PENDING.offerBookNow;
  return (
    <div class="caption iuliia">
      <Iuliia mood="point" size={64} />
      <div class="stack">
        <span class="small">{text}</span>
        <div class="row">
          <Btn sm primary onClick={yes}>
            {PENDING.offerYes}
          </Btn>
          <Btn sm ghost onClick={() => (done(), bumpData())}>
            {PENDING.offerNo}
          </Btn>
        </div>
      </div>
    </div>
  );
}
