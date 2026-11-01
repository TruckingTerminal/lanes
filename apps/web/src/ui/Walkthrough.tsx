import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { dayOf } from "@lanes/engine";
import { GAME_CONFIG } from "../game.js";
import { walkProgress, walkSteps, type Mood } from "../walkthrough.js";
import { ASSETS, hasAsset } from "../mapart.js";
import { bumpData, S, setTab, toast, useData } from "../state.js";
import { TAB_NAME } from "../tabs.js";
import { Btn, Card } from "./bits.js";
import { Loop } from "./Loop.js";

/** Iuliia's portrait: the step's loop when it's drawn (assets/people/iuliia-*.loop.png), the still, or a placeholder until the art lands. */
export function Iuliia({ mood, size = 128 }: { mood: Mood; size?: 32 | 128 }): JSX.Element {
  const file = mood === "idle" ? "people/iuliia" : `people/iuliia-${mood}`;
  const base = hasAsset(`${file}.png`) ? file : hasAsset("people/iuliia.png") ? "people/iuliia" : null;
  if (!base) {
    return (
      <span class={size === 32 ? "portrait placeholder sm" : "portrait placeholder"} title="Iuliia, your trainer" aria-label="Iuliia">
        I
      </span>
    );
  }
  return <Loop name={base} still={`${ASSETS}${base}.png`} w={128} h={128} scale={size === 32 ? 0.25 : 0.5} smooth class={size === 32 ? "portrait sm" : "portrait"} alt="Iuliia" />;
}

/** The walkthrough card (walkthrough.ts), on the Iuliia tab: her current step in full, read from the world; the player can read ahead. */
export function Walkthrough(): JSX.Element | null {
  useData();
  const g = S.game;
  const c = g?.player;
  if (!g || !c) return null;
  const steps = walkSteps(GAME_CONFIG, g.w.net.hubs[c.homeHub]?.name);
  const { index, done, total } = walkProgress(GAME_CONFIG, g.w, c);
  const current = index >= 0 ? index : total;
  const view = S.walkView ?? current;
  const browse = (i: number) => {
    S.walkView = i === current ? null : Math.max(0, Math.min(total, i));
    bumpData();
  };
  if (view >= total) {
    return (
      <Card class="walk" title="You're running a fleet">
        <div class="walkbody">
          <Iuliia mood="laugh" />
          <div>
            <p class="small">Every step on my clipboard is ticked, in ink. Standing orders run the trucks while you sleep, the Guide has every system and every number, and the locked tabs are what comes next. I'll still be here when something breaks. Something always breaks; that isn't pessimism, that's maintenance.</p>
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
  // The welcome strip (scenes/welcome, from the Graphics session): her office, on the first step, when it's drawn.
  const strip = step.id === "welcome" && hasAsset("scenes/welcome.png");
  return (
    <Card class="walk" title={`${view + 1} of ${total}: ${step.title}${isDone ? " ✓" : ""}`}>
      {strip ? <Loop name="scenes/welcome" still={`${ASSETS}scenes/welcome.png`} w={256} h={128} scale={Math.max(1, Math.min(2, Math.floor(((window.innerWidth - 64) / 256) * 10) / 10))} class="welcome" alt="Iuliia's office" /> : null}
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


/**
 * Iuliia's caption (specs/first-ten-minutes.md): her portrait at 32 px, the current step's Do line, and More, which
 * opens her tab. It sits under the nav on every tab, so the full card never stands between a tab and its contents.
 */
export function Caption(): JSX.Element | null {
  useData();
  const g = S.game;
  const c = g?.player;
  if (!g || !c) return null;
  const steps = walkSteps(GAME_CONFIG, g.w.net.hubs[c.homeHub]?.name);
  const { index } = walkProgress(GAME_CONFIG, g.w, c);
  const step = index >= 0 ? steps[index]! : null;
  return (
    <div class="caption">
      <Iuliia mood={step?.mood ?? "laugh"} size={32} />
      <span class="small">{step ? step.do : "You're running a fleet."}</span>
      {S.tab !== "iuliia" ? (
        <Btn sm ghost onClick={() => setTab("iuliia")}>
          More
        </Btn>
      ) : null}
    </div>
  );
}

/** The Iuliia tab: her current step in full, and the road ahead. */
export function IuliiaPanel(): JSX.Element {
  useData();
  return (
    <div class="stack">
      <Walkthrough />
      <div class="row">
        <Btn sm ghost onClick={() => { S.guidePage = "roadmap"; setTab("guide"); }}>The road ahead</Btn>
      </div>
    </div>
  );
}

/** The report form (live.ts Report): a bug or an idea, with the day, the tab and the last orders attached. */
export function ReportCard(): JSX.Element | null {
  useData();
  const [kind, setKind] = useState<"bug" | "idea">(S.reportKind);
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
