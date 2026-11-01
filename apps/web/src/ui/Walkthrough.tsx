import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { dayOf, layerBlock, type Layer, type World } from "@lanes/engine";
import { GAME_CONFIG } from "../game.js";
import { walkProgress, walkSteps, type Mood } from "../walkthrough.js";
import { ASSETS, hasAsset } from "../mapart.js";
import { bumpData, S, setTab, setWalkHidden, toast, useData, type Tab } from "../state.js";
import { Btn, Card } from "./bits.js";
import { Loop } from "./Loop.js";

/** Iuliia's portrait: the step's loop when it's drawn (assets/people/iuliia-*.loop.png), the still, or a placeholder until the art lands. */
function Iuliia({ mood }: { mood: Mood }): JSX.Element {
  const file = mood === "idle" ? "people/iuliia" : `people/iuliia-${mood}`;
  const base = hasAsset(`${file}.png`) ? file : hasAsset("people/iuliia.png") ? "people/iuliia" : null;
  if (!base) {
    return (
      <span class="portrait placeholder" title="Iuliia, your trainer" aria-label="Iuliia">
        I
      </span>
    );
  }
  return <Loop name={base} still={`${ASSETS}${base}.png`} w={128} h={128} scale={0.5} smooth class="portrait" alt="Iuliia" />;
}

/** The walkthrough card (walkthrough.ts): Iuliia's current step, read from the world; the player can read ahead; hidden per browser. */
export function Walkthrough(): JSX.Element | null {
  useData();
  const g = S.game;
  const c = g?.player;
  if (!g || !c || S.walkHidden) return null;
  const steps = walkSteps(GAME_CONFIG);
  const { index, done, total } = walkProgress(GAME_CONFIG, g.w, c);
  const current = index >= 0 ? index : total;
  const view = S.walkView ?? current;
  const hide = <Btn sm ghost title="Hide the walkthrough; the Guide tab brings it back" onClick={() => setWalkHidden(true)}>Hide</Btn>;
  const browse = (i: number) => {
    S.walkView = i === current ? null : Math.max(0, Math.min(total, i));
    bumpData();
  };
  if (view >= total) {
    return (
      <Card class="walk" title="You're running a fleet" right={hide}>
        <div class="walkbody">
          <Iuliia mood="laugh" />
          <div>
            <p class="small">Every step on my clipboard is ticked, in pen. Standing orders run the trucks while you sleep, the Guide has every system and every number, and the locked tabs are what comes next. I'll still be here when something breaks. Something always breaks; that's not pessimism, that's maintenance.</p>
            <div class="row">
              <Btn sm ghost onClick={() => browse(total - 1)}>Back</Btn>
            </div>
          </div>
        </div>
      </Card>
    );
  }
  const step = steps[view]!;
  const isDone = step.done(g.w, c);
  return (
    <Card class="walk" title={`${view + 1} of ${total}: ${step.title}${isDone ? " ✓" : ""}`} right={hide}>
      <div class="walkbody">
        <Iuliia mood={step.mood} />
        <div class="walktext">
          {step.say.map((line, i) => (
            <p class="small" key={i}>
              {line}
            </p>
          ))}
          <p class="small">
            <b>Do:</b> {step.do}
          </p>
          <p class="muted small">
            <b>Why:</b> {step.why}
          </p>
          <div class="row">
            {S.tab !== step.tab ? (
              <Btn sm primary onClick={() => setTab(step.tab)}>
                Go to {TAB_NAME[step.tab]}
              </Btn>
            ) : null}
            {view > 0 ? <Btn sm ghost onClick={() => browse(view - 1)}>Back</Btn> : null}
            <Btn sm ghost onClick={() => browse(view + 1)}>{view + 1 < total ? "Read ahead" : "The end"}</Btn>
            {S.walkView !== null ? <Btn sm ghost onClick={() => browse(current)}>Now</Btn> : null}
            <span class="muted small">{done} of {total} done</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export const TAB_NAME: Record<Tab, string> = { fleet: "Fleet", loads: "Loads", staff: "Staff", market: "Dealer", money: "Money", finance: "Finance", business: "Business", logbook: "Logbook", backlot: "Back Lot", rates: "Rates", economy: "Economy", company: "Company", guide: "Guide" };

/** A locked tab's teaser: what the layer is and when the ladder opens it. */
export interface Teaser {
  title: string;
  text: string;
  opens: string;
}

/** Why a tab is locked, or null when it's open. The Back Lot waits for its switch; the ladder's layers for their day. */
export function tabLock(w: World, tab: Tab): Teaser | null {
  const L = w.cfg.unlockLadder.layers;
  const when = (layer: Layer, afterDays: number) => {
    const block = layerBlock(w, layer);
    return block ? `Opens ${afterDays} game days after the token's launch (day ${(w.token.launchDay ?? 0) + afterDays}).` : "";
  };
  if (tab === "backlot") {
    const lot = w.cfg.robbery.enabled && w.cfg.robbery.lot.enabled;
    const block = lot ? layerBlock(w, "robbery") : "This layer is still in the simulator.";
    if (!block) return null;
    return {
      title: "The Back Lot",
      text: "Crews for hire off a board, each with a skill, a discretion and a price; a fence and a chop shop that post what they're buying and what they pay; bounties; heat, the law's interest in a company that hires too often. Player against player, in the open: a bare truck is an easy mark, a fitted one isn't, and the hirer can't see which. Channel 19 on the Logbook tab hears of every hit.",
      opens: lot ? when("robbery", L.robbery.afterDays) : `Opens with the ladder's crews' layer, ${L.robbery.afterDays} game days after the token's launch. Until then, it's on the drawing board: tell us what you'd want from it.`,
    };
  }
  if (tab === "business" && layerBlock(w, "businesses")) {
    return { title: "Businesses", text: "Shops, fuel stations, truck stops on the interstates, dealerships and warehouses that ship their own freight: an FD price through the catalogue, a staked bond, weekly upkeep, and the hub's trade for income.", opens: when("businesses", L.businesses.afterDays) };
  }
  return null;
}

export function TeaserPanel({ teaser }: { teaser: Teaser }): JSX.Element {
  return (
    <div class="stack">
      <Card class="teaser" title={teaser.title}>
        <p>{teaser.text}</p>
        <p class="muted small">{teaser.opens}</p>
        <div class="row">
          <Btn sm onClick={() => { S.reporting = true; bumpData(); }}>Tell us what you'd want here</Btn>
          <Btn sm ghost onClick={() => { S.guidePage = "roadmap"; setTab("guide"); }}>The road ahead</Btn>
        </div>
      </Card>
    </div>
  );
}

/** The report form (live.ts Report): a bug or an idea, with the day, the tab and the last orders attached. */
export function ReportCard(): JSX.Element | null {
  useData();
  const [kind, setKind] = useState<"bug" | "idea">("bug");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!S.reporting || !S.game) return null;
  const g = S.game;
  const close = () => {
    S.reporting = false;
    bumpData();
  };
  const send = async () => {
    const body = text.trim();
    if (body.length < 3) return toast("Say a little more than that.", true);
    const r = { kind, text: body.slice(0, 2000), atMs: Date.now(), day: dayOf(g.w.t, g.w.cfg), t: g.w.t, tab: S.tab, company: g.player?.name ?? null, truckId: S.selTruck, ua: navigator.userAgent.slice(0, 120) };
    if (g.kind !== "live") {
      try {
        await navigator.clipboard.writeText(JSON.stringify(r));
        toast("Test world: reports aren't sent from here. Copied to your clipboard instead.");
      } catch {
        toast("Test world: reports aren't sent from here.", true);
      }
      setText("");
      return close();
    }
    setBusy(true);
    try {
      await g.report(r);
      toast(kind === "bug" ? "Thanks. The bug is filed with the day and your last orders." : "Thanks. The idea is filed.");
      setText("");
      close();
    } catch (e) {
      toast(`Couldn't send it: ${e instanceof Error ? e.message : "the store refused the write"}. Try again in a moment.`, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card class="report" title="Report a bug or an idea" right={<Btn sm ghost onClick={close}>Close</Btn>}>
      <div class="row">
        <Btn sm on={kind === "bug"} onClick={() => setKind("bug")}>A bug</Btn>
        <Btn sm on={kind === "idea"} onClick={() => setKind("idea")}>An idea</Btn>
      </div>
      <textarea rows={4} value={text} placeholder={kind === "bug" ? "What you did, what you saw, what you expected. A truck's number if one is involved." : "What you'd want, and why. A dispatcher's or a broker's eye is exactly what we need."} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} aria-label="Your report" />
      <p class="muted small">Sent with the day, your company, the tab you're on and your last few orders. No email, no wallet.</p>
      <div class="row">
        <Btn primary disabled={busy} onClick={() => void send()}>
          {busy ? "Sending…" : "Send"}
        </Btn>
      </div>
    </Card>
  );
}
