import type { JSX } from "preact";
import type { Company, World } from "@lanes/engine";
import { NOW } from "../copy.js";
import { fdFull, hhmm, pct, shortDate, plural } from "../format.js";
import { GAME_CONFIG } from "../game.js";
import { nextAction, type NextAction } from "../nextstep.js";
import { act, bumpData, isPhone, me, S, selectTruck, setTab, truckNo } from "../state.js";
import { TAB_NAME } from "../tabs.js";
import { skippedSteps, stepDo, stepText, walkSteps } from "../walkthrough.js";
import { Btn } from "./bits.js";
import { Iuliia } from "./Walkthrough.js";
import { kindInView } from "../companies.js";

/**
 * What now? (specs/guidance.md section 1, guidance-ux.md section 1): a chip in Iuliia's caption, in its own button row, on
 * every screen; a tap answers with one action, one reason in this company's figures and one button, in the caption's
 * place (one caption, one portrait), until the player acts, taps Not now or changes tabs. An amber dot on the chip says a
 * rule above the walkthrough's step (danger, something waiting, an idle truck that could earn) outranks it; a state, not
 * a line, so it survives Quiet. Asked, so it skips quiet time.
 */

/** The answer now, fed the last hand bid that lost (rule 2's "a better load beside it"), while its result is up. */
function currentAction(w: World, c: Company): NextAction {
  const r = S.result;
  return nextAction(GAME_CONFIG, w, c, r && !r.won ? (r.lost ?? null) : null, skippedSteps(S.onboard.seen));
}

/** Ask What now? (the chip, the "?" key, the explain sheet's foot, the debt milestone). */
export function askWhatNow(): void {
  const g = S.game;
  const c = g?.player;
  if (!g || !c || kindInView(g) === "brokerage") return;
  S.whatNow = { a: currentAction(g.w, c), tab: S.tab };
  if (isPhone() && S.sheet === "strip") S.sheet = "half";
  bumpData();
}

/** The chip, for the caption's button row. */
export function WhatNowChip(): JSX.Element | null {
  const g = S.game;
  const c = g?.player;
  if (!g || !c) return null;
  const now = currentAction(g.w, c);
  const dot = now.rule >= 1 && now.rule <= 3 && walkSteps(GAME_CONFIG).some((s) => !s.done(g.w, c));
  return (
    <Btn sm class="whatnowchip" onClick={askWhatNow} label={NOW.chip}>
      {NOW.chip}
      {dot ? <span class="amberdot" aria-hidden="true" /> : null}
    </Btn>
  );
}

/** The answer, in the caption's place, while one is asked on this tab; null otherwise. */
export function WhatNowAnswer(): JSX.Element | null {
  const g = S.game;
  const c = g?.player;
  if (!g || !c) return null;
  // The answer belongs to the tab it was asked on.
  if (S.whatNow && S.whatNow.tab !== S.tab) S.whatNow = null;
  if (!S.whatNow) return null;
  const now = currentAction(g.w, c);
  const close = () => {
    S.whatNow = null;
    bumpData();
  };
  // If the world moved and the action is no longer the one to take, say so; never a stale action.
  if (!same(S.whatNow.a, now)) {
    return (
      <div class="caption whatnow">
        <Iuliia mood="idle" size={64} />
        <span class="small">{NOW.stale}</span>
        <Btn sm onClick={askWhatNow}>
          {NOW.chip}
        </Btn>
      </div>
    );
  }
  const view = words(S.whatNow.a);
  return (
    <div class="caption whatnow">
      <Iuliia mood="point" size={64} />
      <div class="stack">
        <b class={view.red ? "bad" : ""}>{view.action}</b>
        <span class="small">{view.reason}</span>
        <div class="row">
          <Btn
            sm
            primary
            onClick={() => {
              view.go();
              close();
            }}
          >
            {view.button}
          </Btn>
          {view.button !== NOW.calmButton ? (
            <Btn sm ghost onClick={close}>
              {NOW.notNow}
            </Btn>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The same answer, still the one to give: the same rule and kind, about the same truck or load. */
function same(a: NextAction, b: NextAction): boolean {
  if (a.kind !== b.kind) return false;
  if ("loadId" in a && "loadId" in b && a.loadId !== b.loadId) return false;
  if ("truckId" in a && "truckId" in b && a.truckId !== b.truckId) return false;
  return true;
}

const fd = (x: number): string => fdFull(x);
const when = (min: number): string => {
  const h = Math.max(0, (min - S.game!.w.t) / 60);
  return h < 24 ? `${Math.max(1, Math.round(h))} h` : plural(Math.round(h / 24), "day");
};
export const openLoadOf = (truckId: number, loadId: number) => {
  selectTruck(truckId);
  S.openLoad = loadId;
  if (isPhone()) S.sheet = "full";
  setTab("loads");
};

/** The writer's strings for an answer, and what its button does. */
function words(a: NextAction): { action: string; reason: string; button: string; go: () => void; red?: boolean } {
  const g = S.game!;
  const w = g.w;
  const c = me();
  const place = (i: number) => w.net.places[i]!.name;
  const load = (id: number) => w.loads.get(id);
  switch (a.kind) {
    case "liquidating":
      return { action: NOW.liquidatingAction, reason: NOW.liquidatingReason(shortDate(a.restartDay)), button: NOW.liquidatingButton, go: () => setTab("guide") };
    case "danger": {
      const reason = a.debt.n > 0 ? NOW.dangerReason(a.debt.n, a.debt.of, shortDate(a.debt.nextDay)) : NOW.dangerWarn(shortDate(a.debt.nextDay), fd(a.debt.shortFd));
      const l = a.lever;
      if (l?.kind === "book") return { red: true, action: NOW.bookAction(truckNo(l.truckId)), reason, button: NOW.bookButton, go: () => openLoadOf(l.truckId, l.loadId) };
      if (l?.kind === "hold") return { red: true, action: NOW.holdAction(fd(-w.cfg.insolvency.debtLimitFd), shortDate(l.day)), reason, button: NOW.holdButton, go: () => setTab("money") };
      if (l?.kind === "cash")
        return {
          red: true,
          action: NOW.cashAction(shortDate(l.byDay)),
          reason: `${reason} ${l.contract ? NOW.cashReason2(fd(l.landsFd), fd(l.feeFd)) : NOW.cashReason2Spot(fd(l.landsFd), fd(l.feeFd))}`,
          button: NOW.cashButton,
          go: () => {
            S.cashPlan = l.invoiceIds;
            setTab("money");
          },
        };
      if (l?.kind === "collect")
        return {
          red: true,
          action: NOW.collectAction,
          reason: `${reason} ${NOW.collectReason2(fd(l.owedFd), shortDate(l.byDay))}${l.quickPayOpen ? ` ${NOW.collectQuick(pct(w.cfg.token.payment.quickPayPct))}` : ""}`,
          button: NOW.collectButton,
          go: () => setTab("finance"),
        };
      if (l?.kind === "lease") return { red: true, action: NOW.leaseAction(truckNo(l.truckId)), reason: `${reason} ${NOW.leaseReason2(fd(w.cfg.freeEntry.leases.minWeeklyFd))}`, button: NOW.leaseButton, go: () => act({ type: "return_lease", truckId: l.truckId }, NOW.leaseButton) };
      if (l?.kind === "sell") return { red: true, action: NOW.sellAction(truckNo(l.truckId)), reason: `${reason} ${NOW.sellReason2(fd(l.valueFd), fd(a.debt.shortFd))}`, button: NOW.sellButton, go: () => setTab("fleet") };
      return { red: true, action: NOW.noneAction, reason, button: NOW.noneButton, go: () => setTab("guide") };
    }
    case "tender": {
      const shipper = a.shipperId ? (w.companies[a.shipperId - 1]?.name ?? "") : "";
      return { action: NOW.tenderAction(shipper || "A shipper"), reason: NOW.tenderReason(hhmm(a.untilMin)), button: NOW.tenderButton, go: () => setTab("fleet") };
    }
    case "driver": {
      // "Has gone" only for a driver this page saw drive the truck; a truck nobody has driven reads differently (QA).
      const gone = S.lastDriver.get(a.truckId);
      return { action: NOW.driverAction(truckNo(a.truckId)), reason: gone ? NOW.driverReason(gone) : NOW.driverReasonNone(truckNo(a.truckId)), button: NOW.driverButton, go: () => setTab("staff") };
    }
    case "lost": {
      const l = load(a.loadId);
      return { action: NOW.lostAction(l ? place(l.originPlace) : "", l ? place(l.destPlace) : ""), reason: NOW.lostReason(a.clearsNear.toFixed(2), fd(a.profitFd)), button: NOW.lostButton, go: () => openLoadOf(a.truckId, a.loadId) };
    }
    case "idle": {
      const l = load(a.loadId);
      const t = w.trucks[a.truckId - 1]!;
      return {
        action: NOW.idleAction(l ? place(l.originPlace) : "", l ? place(l.destPlace) : ""),
        reason: NOW.idleReason(truckNo(a.truckId), w.net.hubs[t.hub]!.name, fd(a.profitFd)),
        button: NOW.idleButton,
        go: () => openLoadOf(a.truckId, a.loadId),
      };
    }
    case "step": {
      const step = walkSteps(GAME_CONFIG, w.net.hubs[c.homeHub]?.name)[a.index]!;
      return { action: `${NOW.stepPrefix(a.index + 1, a.total)}${stepDo(step, w, c)}`, reason: stepText(step, w, c).why, button: NOW.stepButton(TAB_NAME[step.tab]), go: () => setTab(step.tab) };
    }
    case "factoringEnds":
      return { action: NOW.factoringEndsAction(shortDate(a.untilDay)), reason: NOW.factoringEndsReason(a.days), button: NOW.factoringEndsButton, go: () => setTab("finance") };
    case "cushion":
      return { action: NOW.cushionAction, reason: NOW.cushionReason(a.weeks.toFixed(1)), button: NOW.cushionButton, go: () => setTab("money") };
    case "gap":
      return { action: NOW.gapAction, reason: NOW.gapReason(fd(a.gapFd), w.cfg.guide.gapCushionWeeks), button: NOW.gapButton, go: () => setTab("market") };
    case "calm": {
      const e = a.event;
      const event = e.kind === "round" ? NOW.eventRound : e.kind === "monthClose" ? NOW.eventMonthClose : e.kind === "layer" ? NOW.eventLayer(e.layer === "businesses" ? "Businesses" : "Brokerage") : NOW.eventFactoring;
      return { action: NOW.calmAction, reason: NOW.calmReason(event, when(e.atMin)), button: NOW.calmButton, go: () => {} };
    }
    default:
      return { action: NOW.noneAction, reason: NOW.noneReason, button: NOW.noneButton, go: () => setTab("guide") };
  }
}
