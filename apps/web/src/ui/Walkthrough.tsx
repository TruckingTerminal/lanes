import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { dayOf } from "@lanes/engine";
import { GAME_CONFIG } from "../game.js";
import { skippedSteps, stepDo, stepKey, stepText, walkProgress, walkSteps, type Mood, type WalkStep } from "../walkthrough.js";
import { iuliiaMuted, iuliiaNow, setIuliiaMuted } from "../iuliia.js";
import { ASSETS, hasAsset } from "../mapart.js";
import { drawPortrait } from "../portrait.js";
import { bumpData, S, setOnboard, setTab, toast, useData } from "../state.js";
import { ARRIVAL, CAPTION, DISPATCHER, INTEL, NOW } from "../copy.js";
import { pct } from "../format.js";
import { TAB_NAME, type Tab } from "../tabs.js";
import { Btn, Card } from "./bits.js";
import { financeLine } from "./panels/Finance.js";
import { letDispatcherBid } from "../logic.js";
import { Loop } from "./Loop.js";
import { CompanySoFar, milestoneHeld, MilestoneLine, milestoneScope } from "./Milestones.js";
import { WhatNowAnswer, WhatNowChip } from "./WhatNow.js";
import { kindInView } from "../companies.js";

let poster: HTMLImageElement | null = null;

/**
 * Iuliia, drawn live (portrait.ts, Graphics 2026-11-02): one canvas that draws her every animation frame on the page
 * clock, so she blinks and glances on no cycle; the poster (people/iuliia.png, which is her rest frame) until her sheet
 * decodes, so there is no flash between them. 96 px in the sheet, 64 in a caption, 128 on her tab.
 */
export function Iuliia({ mood, size = 128 }: { mood: Mood; size?: 64 | 96 | 128 }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!poster) {
      poster = new Image();
      poster.src = `${ASSETS}people/iuliia.png`;
    }
    let raf = 0;
    let drawn = false;
    const frame = (t: number) => {
      const px = Math.round(size * (window.devicePixelRatio || 1));
      if (cv.width !== px) cv.width = cv.height = px;
      const live = drawPortrait(ctx, 0, 0, px, mood, reduced ? 0 : t);
      if (!live && poster!.complete && poster!.naturalWidth) {
        ctx.imageSmoothingEnabled = px % poster!.naturalWidth !== 0;
        ctx.drawImage(poster!, 0, 0, px, px);
      }
      drawn = live;
      // Under reduced motion she rests once drawn; otherwise she lives.
      if (!reduced || !drawn) raf = requestAnimationFrame(frame);
    };
    // The first frame now, not on the next animation frame, so she is never an empty box; the poster stands in when the
    // sheet isn't decoded yet, and repaints itself the moment it is.
    frame(performance.now());
    poster.addEventListener("load", () => frame(performance.now()), { once: true });
    return () => cancelAnimationFrame(raf);
  }, [mood, size]);
  return <canvas ref={ref} class={size === 64 ? "portrait md" : size === 96 ? "portrait lg" : "portrait xl"} role="img" aria-label="Iuliia" />;
}

/** The walkthrough card (walkthrough.ts), on the Iuliia tab: her current step in full, read from the world; the player can read ahead. */
export function Walkthrough(): JSX.Element | null {
  useData();
  const g = S.game;
  const c = g?.player;
  if (!g || !c) return null;
  const steps = walkSteps(GAME_CONFIG, g.w.net.hubs[c.homeHub]?.name);
  const skipped = skippedSteps(S.onboard.seen, g.w, c);
  const { index, done, total } = walkProgress(GAME_CONFIG, g.w, c, skipped);
  // "The truck rolls" waits for the load itself, as the caption does (QA's Iuliia replay): until then the board step stays current.
  const loaded = (g.w.trucksByCompany.get(c.id) ?? []).some((t) => t.loadId !== null) || c.delivered > 0;
  const current = index < 0 ? total : steps[index]!.id === "haul" && !loaded && index > 0 ? index - 1 : index;
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
  const isSkipped = !isDone && skipped.includes(step.id);
  // The welcome strip (scenes/welcome, from the Graphics session): her office, on the first step, when it's drawn.
  const strip = step.id === "welcome" && hasAsset("scenes/welcome.png");
  return (
    <Card class="walk" title={`${view + 1} of ${total}: ${step.title}${isDone ? " ✓" : isSkipped ? ` · ${CAPTION.skipped}` : ""}`}>
      {strip ? <Loop name="scenes/welcome" still={`${ASSETS}scenes/welcome.png`} w={256} h={128} scale={Math.max(1, Math.min(2, Math.floor(((window.innerWidth - 64) / 256) * 10) / 10))} class="welcome" alt="Iuliia's office" /> : null}
      <div class="walkbody">
        <Iuliia mood={step.mood} />
        <div class="walktext">
          {stepText(step, g.w, c).say.map((line, i) => (
            <p class="small" key={i}>
              {line}
            </p>
          ))}
          <p class="small">
            <b>Do:</b> {stepDo(step, g.w, c)}
          </p>
          <p class="muted small">
            <b>Why:</b> {stepText(step, g.w, c).why}
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
            {!isDone && !isSkipped ? <Btn sm ghost onClick={() => skipStep(step.id)}>{CAPTION.skip}</Btn> : null}
            <span class="muted small">{done} of {total} done</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Skips a step (R2): it stays in the list as skipped, not done, and What now? passes over it. */
function skipStep(id: string): void {
  const g = S.game!;
  const k = stepKey(g.w, g.player!, `skip:${id}`);
  if (!S.onboard.seen.includes(k)) setOnboard({ seen: [...S.onboard.seen, k] });
  S.walkView = null;
  bumpData();
}

/** The current step for the caption and the screens: the first neither done nor skipped, "the truck rolls" waiting for its load. */
function currentStep(): WalkStep | null {
  const g = S.game!;
  const c = g.player!;
  const steps = walkSteps(GAME_CONFIG, g.w.net.hubs[c.homeHub]?.name);
  const p = walkProgress(GAME_CONFIG, g.w, c, skippedSteps(S.onboard.seen, g.w, c));
  return p.index >= 0 && !p.skipped ? steps[p.index]! : null;
}

/**
 * A step's full line on the screen where its event happens (the director's R5): "Getting paid" on the first settlement
 * card, "The law" on the Truck tab where the inspection shows, the rest on their own screens. It plays once, at the
 * moment the step becomes current, with Next and Skip; the caption keeps quiet about it meanwhile, and the list under
 * More › Iuliia stays for rereading. `only` places one step's moment inside its card (the settlement card).
 */
export function StepMoment({ only }: { only?: string }): JSX.Element | null {
  useData();
  const g = S.game;
  const c = g?.player;
  if (!g || !c || kindInView(g) === "brokerage" || c.liquidatingSince !== null) return null;
  const step = currentStep();
  if (!step || !momentHere(step) || (only ? step.id !== only : step.id === "paid")) return null;
  const mark = () => {
    setOnboard({ seen: [...S.onboard.seen, stepKey(g.w, c, `say:${step.id}`)] });
    bumpData();
  };
  const t = stepText(step, g.w, c);
  return (
    <Card class="walk moment" title={step.title}>
      <div class="walkbody">
        <Iuliia mood={step.mood} size={96} />
        <div class="walktext">
          {t.say.map((line, i) => (
            <p class="small" key={i}>
              {line}
            </p>
          ))}
          <div class="row">
            <Btn sm primary onClick={mark}>
              {CAPTION.next}
            </Btn>
            {step.id === "law" && S.tab !== "company" ? (
              <Btn sm onClick={() => (mark(), setTab("company"))}>
                {CAPTION.seeRecord}
              </Btn>
            ) : null}
            <Btn sm ghost onClick={() => skipStep(step.id)}>
              {CAPTION.skip}
            </Btn>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * The screen where the step's moment would play now, if the player went there; null when it has none yet (the board's
 * steps, a settlement card already closed, a truck not yet rolling). QA's R5 replay: the caption's brief with Next spent
 * the moment while the player was elsewhere, so it never played where its event happened.
 */
function momentScreen(step: WalkStep): Tab | null {
  const g = S.game!;
  const c = g.player!;
  if (step.id === "board" || step.id === "welcome") return null;
  if (step.id === "law") return "company";
  if (step.id === "haul") return (g.w.trucksByCompany.get(c.id) ?? []).some((t) => t.loadId !== null) || c.delivered > 0 ? "fleet" : null;
  if (step.id === "paid") return S.delivered !== null ? "fleet" : null;
  return (step.at ?? step.tab) as Tab;
}

/** Whether the step's moment plays here, now: on its event's screen, not yet said, its event come ("you won one" needs the load). */
function momentHere(step: WalkStep): boolean {
  const g = S.game!;
  const c = g.player!;
  if (S.onboard.seen.includes(stepKey(g.w, c, `say:${step.id}`)) || currentStep()?.id !== step.id) return false;
  // The law (guidance-ux.md section 1's table): at the company's first inspection, on Truck, or on the first visit to
  // Company, whichever comes first; never on Truck merely because the step is current.
  if (step.id === "law") return S.tab === "company" || (S.tab === "fleet" && c.safety.inspections.length > 0);
  if (S.tab !== ((step.at ?? step.tab) as Tab)) return false;
  if (step.id === "board" || step.id === "welcome") return false; // the arrival line and the board's own first visit say these
  if (step.id === "haul") return (g.w.trucksByCompany.get(c.id) ?? []).some((t) => t.loadId !== null) || c.delivered > 0;
  if (step.id === "paid") return S.delivered !== null;
  return true;
}

/** How long an unasked line without a button may stand (R2: `{iuliia.captionMinutes}`, 5 real minutes); joins ui.iuliia in the config on the economy's next pass. */
const CAPTION_MINUTES = 5;
/** When each unasked line first showed in this sitting, by key. */
const lineSince = new Map<string, number>();
/**
 * R2: an unasked line without a button retires after CAPTION_MINUTES real minutes, or once the player acts on another
 * screen than its own. A line with a button holds until it's answered, or until it's false (R10). Returns whether it stands.
 */
function lineStands(key: string, screen: string, retire: () => void): boolean {
  const now = performance.now();
  const since = lineSince.get(key) ?? (lineSince.set(key, now), now);
  const acted = S.lastAct !== null && S.lastAct.at > since && S.lastAct.tab !== screen;
  const left = CAPTION_MINUTES * 60_000 - (now - since);
  if (acted || left <= 0) {
    queueMicrotask(() => {
      retire();
      bumpData();
    });
    return false;
  }
  setTimeout(bumpData, left + 50);
  return true;
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
  // Her walkthrough, milestones and What now? are the carrier's; the brokerage's lines come with its build.
  if (kindInView(g) === "brokerage") return null;
  // A What now? answer takes the caption's place: one caption, one portrait (guidance-ux.md section 1).
  const answer = WhatNowAnswer();
  if (answer) return answer;
  // Only her face and the chip, when she has nothing to say: being wound up (U3), or no line now.
  const bare = (mood: Mood = "idle") => (
    <div class="caption">
      <Iuliia mood={mood} size={64} />
      <span class="grow" />
      <WhatNowChip />
    </div>
  );
  if (c.liquidatingSince !== null) return bare();
  // A step's moment playing on this screen (R5) is her voice here; the caption stands back to her face and the chip.
  const playing = currentStep();
  if (playing && momentHere(playing)) return bare(playing.mood);
  // A milestone line once shown keeps the caption for its full seconds, even when a new step begins meanwhile (QA).
  if (milestoneHeld()) {
    const ms = MilestoneLine();
    if (ms) return ms;
  }
  const steps = walkSteps(GAME_CONFIG, g.w.net.hubs[c.homeHub]?.name);
  const progress = walkProgress(GAME_CONFIG, g.w, c, skippedSteps(S.onboard.seen, g.w, c));
  const index = progress.index;
  // A skipped step is silent (R2): her other lines and milestones may speak, it doesn't.
  const step = index >= 0 && !progress.skipped ? steps[index]! : null;
  // This company's marks (stepKey): a new world in the same browser starts its walkthrough fresh.
  const seen = (k: string) => S.onboard.seen.includes(stepKey(g.w, c, k));
  const mark = (k: string) => setOnboard({ seen: [...S.onboard.seen, stepKey(g.w, c, k)] });
  // Every line has its seconds (QA's guidance replays). Steps queue: each step's line holds ui.iuliia.showSeconds, and
  // steps that tick within moments of each other are shown in order, each for its seconds, until the caption catches up
  // with the current one. Once a standing step's line has had its seconds, a milestone line that is due takes its turn,
  // then the step's line returns. Nothing starves.
  const showMs = GAME_CONFIG.ui.iuliia.showSeconds * 1000;
  const now = performance.now();
  const scope = milestoneScope(g.w, c);
  if (stepShown && stepShown.scope !== scope) stepShown = null;
  const shownIdx = stepShown ? steps.findIndex((x) => x.id === stepShown!.id) : -1;
  const behind = shownIdx >= 0 && shownIdx < (index >= 0 ? index : steps.length);
  const holding = behind && now - stepShown!.at < showMs;
  // Skipped steps never take a turn in the queue (R2).
  const skips = skippedSteps(S.onboard.seen, g.w, c);
  const end = index >= 0 ? index : steps.length;
  const nextInQueue = steps.slice(shownIdx + 1, end).find((x) => !skips.includes(x.id)) ?? (index >= 0 && !progress.skipped ? steps[index] : undefined);
  const queued = behind ? (holding ? steps[shownIdx] : nextInQueue) : undefined;
  if (!behind && step && stepShown?.id === step.id && now - stepShown.at >= showMs) {
    const ms = MilestoneLine();
    if (ms) return ms;
  }
  const say = (line: string, action: JSX.Element | null, mood: Mood = "point") => (
    <div class="caption iuliia">
      <Iuliia mood={mood} size={96} />
      <span class="small">{line}</span>
      {action}
      <WhatNowChip />
    </div>
  );
  // On Finance and Intel, the screen's own line first (one line at most, in the caption strip), once each.
  const fin = S.tab === "finance" ? financeLine() : S.tab === "intel" && !seen("intel:first") ? { key: "intel:first", line: INTEL.iuliia } : null;
  if (fin) return say(fin.line, <Btn sm onClick={() => mark(fin.key)}>{CAPTION.next}</Btn>);
  // The arrival (S1): once, after the company is created, her line about the lease and one button to the board. It
  // retires once a load is the truck's, by the player's bid or booking or the dispatcher's (Jeff, 2026-11-02: it
  // still said "Let's find one" with the truck loaded and rolling).
  const hasLoad = c.firstHandBidDay !== null || (g.w.trucksByCompany.get(c.id) ?? []).some((t) => t.loadId !== null) || c.delivered > 0;
  // R1: with the dispatcher off, a fleet start's first line offers the choice, with its one button.
  const dispatcherOff = !c.orders.some((o) => o.kind === "bid");
  const fleetStart = !(g.w.trucksByCompany.get(c.id) ?? []).some((t) => t.lease === "npc");
  if (step?.id === "board" && !seen("arrival") && !hasLoad && dispatcherOff && fleetStart) {
    return say(
      DISPATCHER.offerFleet,
      <Btn sm primary onClick={() => (mark("arrival"), letDispatcherBid())}>
        {DISPATCHER.letBid}
      </Btn>,
      "wave",
    );
  }
  // R1: the first time the player runs faster than Day a minute with the dispatcher off, she offers it (a line with a
  // button: it holds until answered, or until the dispatcher is on and it's false).
  if (dispatcherOff && S.speed > 2 && !seen("offer:speed") && hasLoad) {
    return say(
      DISPATCHER.offerSpeed,
      <Btn sm primary onClick={() => (mark("offer:speed"), letDispatcherBid())}>
        {DISPATCHER.letBid}
      </Btn>,
    );
  }
  if (step?.id === "board" && !seen("arrival") && !hasLoad) {
    const showBoard = () => {
      mark("arrival");
      S.sheet = "full";
      setTab("loads");
    };
    return say(
      // A small fleet starts on its own two trucks, not the lessor's (QA, carry-over row 3).
      `${(g.w.trucksByCompany.get(c.id) ?? []).some((t) => t.lease === "npc") ? ARRIVAL.line(g.w.net.hubs[c.homeHub]!.name, pct(GAME_CONFIG.costs.npcLeaseShareOfGross)) : ARRIVAL.lineFleet(g.w.net.hubs[c.homeHub]!.name)} ${ARRIVAL.fd}`,
      <Btn sm primary onClick={showBoard}>
        {ARRIVAL.showBoard}
      </Btn>,
      "wave",
    );
  }
  // After the first bid by hand (S9): once, the dispatcher is now on, and where its rules are.
  // Re-checked against the world (R2): with the dispatcher switched off the line is false, and it retires for good.
  if (c.firstHandBidDay !== null && g.w.cfg.freeEntry.firstBidByHand && !seen("dispatcher") && !c.orders.some((o) => o.kind === "bid")) queueMicrotask(() => (mark("dispatcher"), bumpData()));
  else if (c.firstHandBidDay !== null && g.w.cfg.freeEntry.firstBidByHand && !seen("dispatcher")) {
    return say(
      DISPATCHER.afterFirst,
      <Btn
        sm
        primary
        onClick={() => {
          mark("dispatcher");
          S.sheet = "full";
          setTab("fleet");
          requestAnimationFrame(() => document.querySelector(".dispatcher")?.scrollIntoView({ block: "start" }));
        }}
      >
        {DISPATCHER.seeDispatcher}
      </Btn>,
    );
  }
  // Her tab-and-card line (iuliia.ts) takes the Do line's place for a few seconds, only where the walkthrough's own line
  // isn't speaking; called only when it would show, so its seconds start when it does.
  const her = (mood: Mood = "point") => {
    // Caption rule 3: a milestone's line comes before her tab-and-card lines.
    const ms = MilestoneLine();
    if (ms) return ms;
    const text = iuliiaNow();
    return text ? (
      <div class="caption">
        <Iuliia mood={mood} size={64} />
        <span class="small">{text}</span>
        <WhatNowChip />
      </div>
    ) : null;
  };
  if (!step && !queued) return her() ?? bare();
  // "You won one" waits for the win: the board step ticks on the bid itself, twelve hours before the round clears.
  // (A bid alone retires the arrival line, but this line needs the load itself.)
  const loaded = (g.w.trucksByCompany.get(c.id) ?? []).some((t) => t.loadId !== null) || c.delivered > 0;
  if (!queued && step!.id === "haul" && !loaded) return her() ?? bare(step!.mood);
  // The line on show: the next step in the queue, else the current one; its seconds start when it shows.
  const st = (queued ?? step)!;
  if (stepShown?.id !== st.id) {
    stepShown = { id: st.id, at: now, scope };
    setTimeout(bumpData, showMs + 50);
  } else if (holding) setTimeout(bumpData, showMs - (now - stepShown.at) + 50);
  // A step speaks once (its Say, then Next), then shows its Do until hidden; More opens her tab for the rest.
  const stepLine = (step: WalkStep): JSX.Element => {
  // On the screen where its event happens the step's moment plays in the panel (R5), so the caption keeps quiet about it.
  if (!seen(`say:${step.id}`) && momentHere(step)) return her(step.mood) ?? bare(step.mood);
  // Elsewhere, the brief points to the screen where the moment plays instead of spending it with Next.
  const screen = !seen(`say:${step.id}`) && currentStep()?.id === step.id ? momentScreen(step) : null;
  if (screen && S.tab !== screen) return say(step.doNow?.(g.w, c) ?? stepText(step, g.w, c).brief, <Btn sm onClick={() => setTab(screen)}>{NOW.stepButton(TAB_NAME[screen])}</Btn>, step.mood);
  if (!seen(`say:${step.id}`)) {
    // A step that reads the company's state (step 9) speaks that state, not its fixed brief (QA's step-9 replay).
    return say(
      step.doNow?.(g.w, c) ?? stepText(step, g.w, c).brief,
      <Btn sm onClick={() => mark(`say:${step.id}`)}>
        {CAPTION.next}
      </Btn>,
      step.mood,
    );
  }
  if (seen(`hide:${step.id}`)) return her(step.mood) ?? bare(step.mood);
  const hers = her(step.mood);
  if (hers) return hers;
  // The Do line is unasked and has no answer to wait for: it retires as R2 says, as if hidden.
  if (!lineStands(`do:${step.id}`, step.tab, () => mark(`hide:${step.id}`))) return bare(step.mood);
  return (
    <div class="caption">
      <Iuliia mood={step.mood} size={64} />
      <span class="small">{stepDo(step, g.w, c)}</span>
      <Btn sm ghost onClick={() => mark(`hide:${step.id}`)}>
        {CAPTION.hide}
      </Btn>
      {S.tab !== "iuliia" ? (
        <Btn sm ghost onClick={() => setTab("iuliia")}>
          {CAPTION.more}
        </Btn>
      ) : null}
      <WhatNowChip />
    </div>
  );
  };
  return stepLine(st);
}

/** The step whose line last reached the caption, when (its seconds run from then), and whose company it was. */
let stepShown: { id: string; at: number; scope: string } | null = null;

/** Her tab-and-card line where the caption strip isn't (the hub screens, before a company exists). */
export function IuliiaLine(): JSX.Element | null {
  useData();
  const text = iuliiaNow();
  return text ? (
    <div class="caption iuliia">
      <Iuliia mood="point" size={64} />
      <span class="small">{text}</span>
    </div>
  ) : null;
}

/** The Iuliia tab: her current step in full, and the road ahead. */
export function IuliiaPanel(): JSX.Element {
  useData();
  return (
    <div class="stack">
      <Walkthrough />
      <CompanySoFar />
      <label class="row switchrow">
        <input type="checkbox" role="switch" checked={iuliiaMuted()} onChange={(e) => setIuliiaMuted((e.currentTarget as HTMLInputElement).checked)} />
        <span>{CAPTION.quiet}</span>
      </label>
      <p class="muted small">{CAPTION.quietNote}</p>
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
