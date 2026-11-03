import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { apCapBlock, brokerageLog, brokerBooks, brokerLicensed, canFormBrokerage, companyAccount, creditBand, crewed, dayOf, laneRate, MANUAL_BID_MAX_DEADHEAD_MI, ownBand, placeMiles, type Company, type Load, type World } from "@lanes/engine";
import { BROKERAGE } from "../../copy.js";
import { hasTwo, kindInView, switchCompany } from "../../companies.js";
import { fdFull, hhmm, pct, shortDate, TRAILER_NAME } from "../../format.js";
import { nextRoundHour } from "../../logic.js";
import { bumpData, isPhone, me, openIntel, order, S, toast, useData } from "../../state.js";
import { layerDay } from "../../tabs.js";
import { Btn, Card, Kv, Panel } from "../bits.js";
import { InvoiceRows } from "./CashNow.js";

/**
 * A player's brokerage (specs/brokerage-rule.md, brokerage-ux.md draft 2, the writer's brokerage-strings.md), on the
 * engine's rule (brokerage.ts): starting one from the carrier, its bar (Book · Carriers · Money · More), Move money
 * between the owner's two companies, and Pass to the brokerage on the carrier's direct-contract tender. Behind
 * `brokerage.enabled`; with it off none of this is reachable.
 */

const cash = (w: World, c: Company): number => w.ledger.balance(companyAccount(c.id));
const fd = (x: number): string => fdFull(x);
const lane = (w: World, l: Load): string => `${w.net.places[l.originPlace]!.name} → ${w.net.places[l.destPlace]!.name}`;

/**
 * Why the owner's carrier can't take a tender now, in the writer's words, or null (brokerage-ux.md section 7): the same
 * test as the carrier's own tender card, an idle crewed truck of the trailer within reach of the pickup.
 */
export function carrierCantTake(w: World, carrier: Company, load: Load): string | null {
  if (carrier.authority.status !== "active" || carrier.liquidatingSince !== null) return BROKERAGE.refuseCarrierCant(carrier.name, "its authority isn't active");
  const free = (w.trucksByCompany.get(carrier.id) ?? []).some((t) => t.status === "idle" && crewed(t) && t.trailer === load.equipment && placeMiles(w, t.place, load.originPlace) <= MANUAL_BID_MAX_DEADHEAD_MI);
  return free ? null : BROKERAGE.refuseNoTruck(carrier.name);
}

/** What the standing order's "offer first" finds at the window's end (brokerage.ts holdsAtEnd): an idle crewed truck of the trailer at the pickup's hub. */
const ownFirstFinds = (w: World, carrier: Company, load: Load): boolean =>
  (w.trucksByCompany.get(carrier.id) ?? []).some((t) => t.status === "idle" && t.driverId !== 0 && t.trailer === load.equipment && t.hub === load.origin);

/** The rate a load was offered to the own carrier at, once that tender lapsed and it went to the board (S4; the engine's Load.ownTenderLapsed). */
const lapsedAt = (l: Load): number | undefined => l.ownTenderLapsed;

/** The brokerage's loads by state: offered (held), tendered to its own carrier, on the board, moving (S1: posted and offered are two counts). */
export function bookStates(w: World, c: Company) {
  const mine = [...w.loads.values()].filter((l) => l.brokerId === c.id);
  const open = mine.filter((l) => l.status === "open");
  return {
    mine,
    held: open.filter((l) => l.hold?.brokerId === c.id),
    tendered: open.filter((l) => !l.hold && l.ownTenderRate !== undefined && l.tenderedTo !== 0),
    onBoard: open.filter((l) => !l.hold && !(l.ownTenderRate !== undefined && l.tenderedTo !== 0)),
    moving: mine.filter((l) => l.status === "assigned" || l.status === "inTransit"),
  };
}

/** The game minute of the next board round. */
function roundAt(w: World): number {
  const perDay = w.cfg.time.gameMinutesPerDay;
  const today = Math.floor(w.t / perDay);
  const hour = (w.t % perDay) / 60;
  const next = w.cfg.time.boardRoundHours.find((h) => h > hour);
  return (next !== undefined ? today : today + 1) * perDay + (next ?? w.cfg.time.boardRoundHours[0]!) * 60;
}

/** A new brokerage's first-year surety premium and its credit band: it starts with its own credit (credit.ts, a new record). */
function newSurety(w: World): { fd: number; band: string } {
  const k = w.cfg.token.credit;
  const score = Math.max(0, Math.min(100, k.base + k.recordPoints * k.newRecord));
  const [best, worst] = w.cfg.permits.suretyPctPerYear;
  return { fd: w.cfg.permits.brokerBondFd * (worst - (worst - best) * (score / 100)), band: creditBand(score) };
}


/** The tab More opens: "Start a brokerage" from its layer, or, once started, the switch to it. */
export function BrokerageTab(): JSX.Element {
  useData();
  const g = S.game!;
  if (hasTwo(g))
    return (
      <Panel title={BROKERAGE.startCard}>
        <button type="button" class="morerow" onClick={() => switchCompany("brokerage")}>
          <span>{BROKERAGE.moreRow(g.brokerage!.name)}</span>
        </button>
      </Panel>
    );
  return <StartBrokerage />;
}

/** The engine's reason, in the writer's words (brokerage-strings.md, "Refusals"). */
function startRefusal(w: World, why: string): string {
  if (why.startsWith("one carrier and one")) return BROKERAGE.refuseHasOne;
  if (why === "the carrier's authority isn't active") return BROKERAGE.refuseActive;
  if (why === "the carrier is being wound up") return BROKERAGE.refuseWinding;
  if (why.startsWith("the carrier must be")) return BROKERAGE.refuseAge(w.cfg.brokerage.minCarrierAgeDays);
  if (why.startsWith("the capital must cover")) return BROKERAGE.nextDisabled;
  if (why === "the carrier hasn't that much FD") return BROKERAGE.nextDisabled;
  // The ladder's layer still closed.
  return BROKERAGE.refuseBefore(layerDay(w, "brokerage"));
}

/** Starting a brokerage (brokerage-ux.md section 3): three steps, the costs and the funding on one sheet before the button. */
function StartBrokerage(): JSX.Element {
  const g = S.game!;
  const w = g.w;
  const carrier = g.carrier!;
  const k = w.cfg;
  const bond = k.token.staking.roles.broker;
  const licence = k.permits.brokerLicenseRenewalFd;
  const surety = newSurety(w);
  const feePct = k.brokerage.transferFeePct;
  const [step, setStep] = useState(1);
  const [name, setName] = useState(BROKERAGE.defaultName(carrier.name).slice(0, 32));
  // Prefilled with the engine's figure: the bond, the licence and brokerage.startCashFd of working cash (formationCostFd
  // adds the fee on top). Step 3 starts from the first order formBrokerage sets, and only a change is sent.
  const [capital, setCapital] = useState(bond + licence + k.brokerage.startCashFd);
  const [margin, setMargin] = useState<number>(k.brokerage.defaultMarginPct);
  const [open, setOpen] = useState<number>(k.brokerage.defaultOpenLoads);
  const [vet, setVet] = useState<0 | 1 | 2>(k.brokerage.defaultVetting as 0 | 1 | 2);
  const [note, setNote] = useState<string | null>(null);
  // Full on a phone (brokerage-ux.md section 3): step 2's rows don't fit the lower panel.
  useEffect(() => {
    if (isPhone() && S.sheet !== "full") {
      S.sheet = "full";
      bumpData();
    }
  }, []);
  const blocked = canFormBrokerage(w, carrier);
  const fee = capital * feePct;
  const short = capital + fee - cash(w, carrier);
  const tooSmall = capital - licence < bond;
  const hub = w.net.hubs[carrier.homeHub]!.name;
  const lines = BROKERAGE.vettingLines(k.fraud.vetting.standard.minAuthorityDays, k.fraud.vetting.strict.minAuthorityDays, k.fraud.vetting.strict.minDelivered);
  const earned = (
    <button type="button" class="linkish" onClick={() => openIntel({ brokers: true, sort: "month" })}>
      {BROKERAGE.earnedLink}
    </button>
  );
  const start = async () => {
    setNote(null);
    const r = await order({ type: "form_brokerage", name: name.trim() || BROKERAGE.defaultName(carrier.name), capitalFd: capital }, BROKERAGE.switched(name), "carrier");
    if (!r.ok) return setNote(startRefusal(w, r.reason.charAt(0).toLowerCase() + r.reason.slice(1)));
    // formBrokerage sets its first order and vetting from config; the terms are sent, as the brokerage, only if changed.
    if (margin !== k.brokerage.defaultMarginPct || open !== k.brokerage.defaultOpenLoads) await order({ type: "set_standing_orders", orders: [{ kind: "broker", marginPct: margin, maxOpenLoads: open }] }, BROKERAGE.save, "brokerage");
    if (vet !== k.brokerage.defaultVetting) await order({ type: "set_vetting", tier: vet }, BROKERAGE.save, "brokerage");
    if (r.at === null) {
      switchCompany("brokerage");
      toast(BROKERAGE.switched(g.brokerage?.name ?? name));
    } else {
      S.brokerSwitch = true;
      toast(`Sent · in effect ${hhmm(r.at)}`);
    }
    bumpData();
  };
  return (
    <Panel title={BROKERAGE.startCard}>
      {step <= 3 ? <p class="label">{BROKERAGE.stepCounter(step)}</p> : null}
      {blocked ? <p class="bad small">{startRefusal(w, blocked)}</p> : null}
      {step === 1 ? (
        <Card title={BROKERAGE.step1}>
          <label class="field">
            <span class="label">{BROKERAGE.nameField}</span>
            <input type="text" maxLength={32} value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <p class="small">{BROKERAGE.homeHub(hub)}</p>
          <p class="muted small">{BROKERAGE.homeFixed}</p>
        </Card>
      ) : step === 2 ? (
        <Card title={BROKERAGE.step2}>
          <p class="small">{BROKERAGE.rowLicenceCost(fd(licence))}</p>
          <p class="small">{BROKERAGE.rowBondHeld(fd(bond))}</p>
          <p class="small">{BROKERAGE.rowSurety(fd(surety.fd), surety.band)}</p>
          <p class="muted small">{BROKERAGE.bondNote}</p>
          <p class="muted small">{BROKERAGE.graceNote(k.token.staking.graceDays)}</p>
          {w.token.launchDay === null ? <p class="muted small">{BROKERAGE.betaNote}</p> : null}
          <label class="field">
            <span class="label">{BROKERAGE.moving(carrier.name, fd(capital))}</span>
            <input type="text" inputMode="numeric" value={fd(capital)} onChange={(e) => setCapital(Math.max(0, Number((e.currentTarget as HTMLInputElement).value.replace(/[^\d]/g, "")) || 0))} />
          </label>
          <p class="small">{BROKERAGE.feeRow(pct(feePct), fd(fee))}</p>
          <p class="small">{BROKERAGE.licenceFromIt(fd(licence))}</p>
          <p class="small">{BROKERAGE.cashAfter(carrier.name, fd(cash(w, carrier) - capital - fee))}</p>
          <p class="small">{BROKERAGE.brokerCashAfter(name, fd(capital - licence), fd(bond))}</p>
          <p class="muted small">{BROKERAGE.capitalNote}</p>
          <p class="muted small">{BROKERAGE.noGrant}</p>
          <p class="muted small">{BROKERAGE.ownCredit}</p>
          {short > 0.5 ? (
            <>
              <p class="bad small">{BROKERAGE.wouldBeShort(carrier.name, fd(short))}</p>
              {earned}
            </>
          ) : null}
        </Card>
      ) : step === 3 ? (
        <Card title={BROKERAGE.step3}>
          <Terms margin={margin} setMargin={setMargin} open={open} setOpen={setOpen} vet={vet} setVet={setVet} lines={lines} />
        </Card>
      ) : (
        <Card title={BROKERAGE.confirmTitle(name)}>
          <p class="small">{BROKERAGE.sumName(name, hub)}</p>
          <p class="small">{BROKERAGE.sumFunding(fd(capital), carrier.name, fd(fee))}</p>
          <p class="small">{BROKERAGE.sumTerms(pct(margin), open, BROKERAGE.vetting[vet])}</p>
          <Btn primary disabled={blocked !== null || short > 0.5 || tooSmall} onClick={() => void start()}>
            {BROKERAGE.startButton(name)}
          </Btn>
          {note ? <p class="bad small">{note}</p> : null}
        </Card>
      )}
      <div class="row">
        {step > 1 ? (
          <Btn sm ghost onClick={() => setStep(step - 1)}>
            {BROKERAGE.back}
          </Btn>
        ) : null}
        {step < 4 ? (
          <Btn sm primary disabled={blocked !== null || (step === 2 && (short > 0.5 || tooSmall))} onClick={() => setStep(step + 1)}>
            {BROKERAGE.next}
          </Btn>
        ) : null}
        {step === 2 && (short > 0.5 || tooSmall) ? <span class="muted small">{BROKERAGE.nextDisabled}</span> : null}
      </div>
      {blocked ? earned : null}
    </Panel>
  );
}

/** The terms: the margin, the cap on open loads, and who may haul (step 3, and Carriers' standing order). */
function Terms(p: { margin: number; setMargin: (x: number) => void; open: number; setOpen: (x: number) => void; vet?: 0 | 1 | 2; setVet?: (x: 0 | 1 | 2) => void; lines?: readonly string[] }): JSX.Element {
  return (
    <div class="stack">
      <label class="field">
        <span class="label">{BROKERAGE.rowMargin(pct(p.margin))}</span>
        <input type="number" min={0} max={90} step={1} value={Math.round(p.margin * 100)} onInput={(e) => p.setMargin(Math.max(0, Math.min(90, Number((e.currentTarget as HTMLInputElement).value) || 0)) / 100)} />
      </label>
      <label class="field">
        <span class="label">{BROKERAGE.rowOpenLoads(p.open)}</span>
        <input type="number" min={1} max={200} step={1} value={p.open} onInput={(e) => p.setOpen(Math.max(1, Math.min(200, Math.round(Number((e.currentTarget as HTMLInputElement).value) || 1))))} />
      </label>
      {p.vet !== undefined && p.setVet && p.lines ? <Vetting vet={p.vet} setVet={p.setVet} lines={p.lines} /> : null}
    </div>
  );
}

/** Who may haul: Open · Standard · Strict, a line under each. */
function Vetting({ vet, setVet, lines }: { vet: 0 | 1 | 2; setVet: (x: 0 | 1 | 2) => void; lines: readonly string[] }): JSX.Element {
  return (
    <div class="stack">
      <span class="label">{BROKERAGE.whoMayHaulRow}</span>
      <div class="row" role="radiogroup" aria-label={BROKERAGE.whoMayHaulRow}>
        {BROKERAGE.vetting.map((v, i) => (
          <Btn key={v} sm on={vet === i} onClick={() => setVet(i as 0 | 1 | 2)}>
            {v}
          </Btn>
        ))}
      </div>
      <p class="muted small">{lines[vet]}</p>
      <p class="muted small">{BROKERAGE.tighter}</p>
    </div>
  );
}

/** The brokerage's margin since this month's mark (intel.ts monthMark): its operating result, less fines kept outside costs, as the month record counts. */
function marginThisMonth(c: Company): number {
  const m = c.monthMark;
  return c.operating.revenueFd - (m?.revenueFd ?? 0) - (c.operating.costFd - (m?.costFd ?? 0)) - ((c.finesOffCostsFd ?? 0) - (m?.finesFd ?? 0));
}

/** Book (brokerage-ux.md section 2): its loads on the board, moving, and waiting for pay. */
export function Book(): JSX.Element {
  useData();
  const g = S.game!;
  const w = g.w;
  const c = me();
  const partner = hasTwo(g) ? g.carrier : null;
  const { mine, held, tendered, onBoard, moving } = bookStates(w, c);
  const owed = w.receivables.filter((r) => r.holder === c.id && r.amountFd > 0.005);
  const hours = Math.max(1, Math.round((roundAt(w) - w.t) / 60));
  const feePct = w.cfg.board.posterFeePct;
  const [tendering, setTendering] = useState<number | null>(S.openLoad);
  return (
    <Panel title={BROKERAGE.bookHeader(c.name, tendered.length + onBoard.length + moving.length, fd(marginThisMonth(c)))}>
      {held.length ? (
        <Card title={BROKERAGE.offered}>
          {held.map((l) => (
            <OfferedCard key={l.id} load={l} partner={partner} />
          ))}
        </Card>
      ) : null}
      {/* S3: a load tendered to the own carrier is tendered, not posted, until the carrier takes it or lets it lapse. */}
      {tendered.length && partner ? (
        <Card title={BROKERAGE.tendered(partner.name)}>
          {tendered.map((l) => (
            <div class="stack bookcard" key={l.id}>
              <b>{lane(w, l)}</b>
              <span class="small">
                {BROKERAGE.tendered(partner.name)} · {l.ownTenderRate!.toFixed(2)}/mi · {hhmm(l.tenderUntil)}
              </span>
            </div>
          ))}
        </Card>
      ) : null}
      <Card title={BROKERAGE.groups[0]}>
        {onBoard.map((l) => {
          const cant = partner ? carrierCantTake(w, partner, l) : null;
          return (
            <div class={`stack bookcard${l.id === S.openLoad ? " sel" : ""}`} key={l.id}>
              <b>{lane(w, l)}</b>
              <span class="small muted">{BROKERAGE.onBoard(l.ceiling.toFixed(2), nextRoundHour(), `${hours} h`)}</span>
              {partner && lapsedAt(l) !== undefined ? <span class="small">{BROKERAGE.lapsed(partner.name, lapsedAt(l)!.toFixed(2))}</span> : null}
              {partner && l.tenderedTo === 0 && lapsedAt(l) === undefined && l.shipperId === null && l.passedBy !== partner.id ? (
                tendering === l.id && !cant ? (
                  <TenderSheet load={l} carrier={partner} onDone={() => setTendering(null)} />
                ) : (
                  <>
                    <Btn sm disabled={!!cant} onClick={() => setTendering(l.id)}>
                      {BROKERAGE.tenderButton(partner.name)}
                    </Btn>
                    {cant ? <span class="muted small">{cant}</span> : null}
                  </>
                )
              ) : null}
            </div>
          );
        })}
      </Card>
      <Card title={BROKERAGE.groups[1]}>
        {moving.map((l) => {
          const hauler = l.carrierId ? w.companies[l.carrierId - 1] : undefined;
          const shipper = l.shipperRate * l.miles;
          const carrierPay = l.clearedRate * l.miles;
          const fee = shipper * feePct;
          const [a, b] = BROKERAGE.cardLine2(fd(shipper), fd(carrierPay), fd(fee), fd(shipper - carrierPay - fee));
          return (
            <div class="stack bookcard" key={l.id}>
              <b>{lane(w, l)}</b>
              <span class="small">
                {BROKERAGE.takenBy(hauler?.name ?? "", l.clearedRate.toFixed(2))}
                {partner && l.carrierId === partner.id ? (
                  <>
                    {" "}
                    <span class="badge">{BROKERAGE.yoursChip}</span>
                  </>
                ) : null}
              </span>
              <span class="small">
                {a}
                <b class={shipper - carrierPay - fee < 0 ? "bad" : ""}>{b}</b>
              </span>
            </div>
          );
        })}
      </Card>
      <Card title={BROKERAGE.groups[2]}>
        {owed.map((r) => (
          <p class="small" key={r.id}>
            {fd(r.amountFd)} FD · due {shortDate(r.dueDay)}
          </p>
        ))}
      </Card>
      {mine.length || owed.length ? null : <p class="muted">{BROKERAGE.bookEmpty(nextRoundHour())}</p>}
    </Panel>
  );
}

/**
 * A held tender (brokerage.ts startHold): what the shipper pays, what you'd post at, the board fee, the window's end and
 * what the standing order does then; Post it at a margin, Tender to the carrier, or Decline. A load the carrier passed
 * shows its chip and Post only (it can't be declined, nor go back).
 */
function OfferedCard({ load, partner }: { load: Load; partner: Company | null }): JSX.Element {
  const w = S.game!.w;
  const c = me();
  const o = c.orders.find((x) => x.kind === "broker");
  const [margin, setMargin] = useState<number>(o && o.kind === "broker" ? o.marginPct : w.cfg.brokerage.defaultMarginPct);
  const [tendering, setTendering] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const shipper = load.shipperRate * load.miles;
  const passed = load.passedBy !== undefined && partner !== null && load.passedBy === partner.id;
  const hours = Math.max(0, Math.round((load.hold!.until - w.t) / 60));
  const ownFirst = !!(o && o.kind === "broker" && o.ownFirst && partner && !passed);
  const ifNot = o && o.kind === "broker" ? (ownFirst ? BROKERAGE.ifNotOwn(partner!.name) : BROKERAGE.ifNotPost(pct(o.marginPct))) : load.hold!.declinable ? BROKERAGE.ifNotDecline : BROKERAGE.ifNotPost(pct(w.cfg.brokerage.defaultMarginPct));
  // S2: Tender is greyed with the reason when the carrier can't take it now; the offer-first order says when it would skip.
  const cant = partner && !passed ? carrierCantTake(w, partner, load) : null;
  const skips = ownFirst && !ownFirstFinds(w, partner!, load);
  const act = async (a: Parameters<typeof order>[0], ok: string) => {
    const r = await order(a, ok, "brokerage");
    if (!r.ok) setNote(r.reason);
  };
  return (
    <div class="stack bookcard">
      <b>
        {lane(w, load)} · {load.equipment}
        {passed ? (
          <>
            {" "}
            <span class="badge">{BROKERAGE.fromChip(partner!.name)}</span>
          </>
        ) : null}
      </b>
      <span class="small">
        {BROKERAGE.shipperPays(fd(shipper))} · {BROKERAGE.wouldPost(fd(shipper * (1 - margin)), pct(margin))} · {BROKERAGE.boardFee(fd(shipper * w.cfg.board.posterFeePct))}
      </span>
      <span class="small">{BROKERAGE.decideBy(hhmm(load.hold!.until), hours)}</span>
      <span class="muted small">{ifNot}</span>
      {skips ? <span class="muted small">{BROKERAGE.ownFirstSkips(partner!.name, TRAILER_NAME[load.equipment].toLowerCase(), w.net.hubs[load.origin]!.name)}</span> : null}
      {tendering && partner && !cant ? (
        <TenderSheet load={load} carrier={partner} onDone={() => setTendering(false)} />
      ) : (
        <div class="row">
          <label class="field">
            <span class="label">{BROKERAGE.marginField}</span>
            <input type="number" min={0} max={90} step={1} value={Math.round(margin * 100)} onInput={(e) => setMargin(Math.max(0, Math.min(90, Number((e.currentTarget as HTMLInputElement).value) || 0)) / 100)} />
          </label>
          <Btn sm primary onClick={() => void act({ type: "post_tender", loadId: load.id, marginPct: margin }, BROKERAGE.postIt)}>
            {BROKERAGE.postIt}
          </Btn>
          {partner && !passed ? (
            <Btn sm disabled={!!cant} onClick={() => setTendering(true)}>
              {BROKERAGE.tenderButton(partner.name)}
            </Btn>
          ) : null}
          {load.hold!.declinable ? (
            <Btn sm ghost onClick={() => void act({ type: "decline_tender", loadId: load.id }, BROKERAGE.decline)}>
              {BROKERAGE.decline}
            </Btn>
          ) : null}
        </div>
      )}
      {cant ? <p class="muted small">{cant}</p> : null}
      {note ? <p class="bad small">{note}</p> : null}
    </div>
  );
}

/** Tender to the owner's carrier (Rule B): the hauler's pay inside the lane's band, then the carrier accepts or lets it lapse. */
function TenderSheet({ load, carrier, onDone }: { load: Load; carrier: Company; onDone: () => void }): JSX.Element {
  const w = S.game!.w;
  const [lo, hi] = ownBand(w, load);
  // Whole cents inside the engine's band (QA's brokerage gate: the form opened at 2.7715 of a 2.7781 top and sent 2.78,
  // which the band check refused). It opens at the lane's market rate (brokerage.ts laneRate, the band's own centre)
  // and sends exactly what it shows. A band narrower than a cent offers its floor.
  const cLo = Math.min(Math.ceil(lo * 100 - 1e-6) / 100, hi);
  const cHi = Math.max(Math.floor(hi * 100 + 1e-6) / 100, cLo);
  const [rate, setRate] = useState(Math.min(cHi, Math.max(cLo, Math.round(laneRate(w, load) * 100) / 100)));
  const [note, setNote] = useState<string | null>(null);
  const shipper = load.shipperRate * load.miles;
  const [r1, r2] = BROKERAGE.tenderRows(fd(shipper), carrier.name);
  const send = async () => {
    const r = await order({ type: "tender_own", loadId: load.id, rate }, BROKERAGE.tenderAt(rate.toFixed(2)), "brokerage");
    if (r.ok) return onDone();
    const why = r.reason.toLowerCase();
    setNote(
      why.includes("outside the lane's band")
        ? BROKERAGE.refuseBand(cLo.toFixed(2), cHi.toFixed(2))
        : why.includes("never goes back")
          ? BROKERAGE.refusePassedBack(carrier.name)
          : why.includes("isn't trading")
            ? BROKERAGE.refuseCarrierCant(carrier.name, "its authority isn't active")
            : why.includes("only an open load")
              ? BROKERAGE.refuseNotDirect
              : r.reason,
    );
  };
  return (
    <div class="stack sheetcard">
      <b>{BROKERAGE.tenderButton(carrier.name)}</b>
      <p class="small">{r1}</p>
      <label class="field">
        <span class="small">
          {r2} · <b>{rate.toFixed(2)}</b>/mi
        </span>
        <input type="range" min={cLo} max={cHi} step={0.01} value={rate} onInput={(e) => setRate(Math.min(cHi, Math.max(cLo, Math.round(Number((e.currentTarget as HTMLInputElement).value) * 100) / 100)))} />
      </label>
      <p class="small">{BROKERAGE.allowed(cLo.toFixed(2), cHi.toFixed(2))}</p>
      <p class="small">{BROKERAGE.yourMargin(fd(shipper - rate * load.miles - shipper * w.cfg.board.posterFeePct))}</p>
      <p class="muted small">{BROKERAGE.tenderNote1(w.cfg.token.payment.termsDays)}</p>
      <p class="muted small">{BROKERAGE.tenderNote2}</p>
      <div class="row">
        <Btn sm primary onClick={() => void send()}>
          {BROKERAGE.tenderAt(rate.toFixed(2))}
        </Btn>
        <Btn sm ghost onClick={onDone}>
          {BROKERAGE.notNow}
        </Btn>
      </div>
      {note ? <p class="bad small">{note}</p> : null}
    </div>
  );
}

/** Carriers (brokerage-ux.md section 2): who may haul, who has hauled, and the standing order. */
export function Carriers(): JSX.Element {
  useData();
  const g = S.game!;
  const w = g.w;
  const c = me();
  const k = w.cfg.fraud.vetting;
  const lines = BROKERAGE.vettingLines(k.standard.minAuthorityDays, k.strict.minAuthorityDays, k.strict.minDelivered);
  const o = c.orders.find((x) => x.kind === "broker");
  const [margin, setMargin] = useState<number>(o && o.kind === "broker" ? o.marginPct : w.cfg.brokerage.defaultMarginPct);
  const [open, setOpen] = useState<number>(o && o.kind === "broker" ? o.maxOpenLoads : w.cfg.brokerage.defaultOpenLoads);
  const [ownFirst, setOwnFirst] = useState<boolean>(!!(o && o.kind === "broker" && o.ownFirst));
  const partner = hasTwo(g) ? g.carrier : null;
  const counts = new Map<number, number>();
  for (const l of w.loads.values()) if (l.brokerId === c.id && l.carrierId) counts.set(l.carrierId, (counts.get(l.carrierId) ?? 0) + 1);
  return (
    <Panel title="Carriers">
      <Card title={BROKERAGE.whoMayHaul}>
        <Vetting vet={c.vetting} setVet={(t) => void order({ type: "set_vetting", tier: t }, BROKERAGE.save, "brokerage")} lines={lines} />
      </Card>
      <Card title={BROKERAGE.haulers}>
        {[...counts].map(([id, n]) => (
          <button type="button" class="morerow" key={id} onClick={() => openIntel({ card: id })}>
            <span>{BROKERAGE.haulerRow(w.companies[id - 1]!.name, n)}</span>
            {partner && id === partner.id ? <span class="badge">{BROKERAGE.yoursChip}</span> : null}
            <span class="chev" aria-hidden="true">›</span>
          </button>
        ))}
      </Card>
      <Card title={BROKERAGE.standingOrder}>
        <Terms margin={margin} setMargin={setMargin} open={open} setOpen={setOpen} />
        {partner ? (
          <>
            <label class="row switchrow">
              <span class="grow">{BROKERAGE.ownFirst(partner.name)}</span>
              <input type="checkbox" role="switch" checked={ownFirst} onChange={(e) => setOwnFirst((e.currentTarget as HTMLInputElement).checked)} />
            </label>
            <p class="muted small">{BROKERAGE.ownFirstRate(partner.name)}</p>
          </>
        ) : null}
        <Btn sm primary onClick={() => void order({ type: "set_standing_orders", orders: [...c.orders.filter((x) => x.kind !== "broker"), { kind: "broker", marginPct: margin, maxOpenLoads: open, ...(ownFirst ? { ownFirst: true } : {}) }] }, BROKERAGE.saved, "brokerage").then((r) => (r.ok ? r.at === null && toast(BROKERAGE.saved) : toast(r.reason, true)))}>
          {BROKERAGE.save}
        </Btn>
      </Card>
    </Panel>
  );
}

/** Money for the brokerage in view: cash, what shippers owe it, what it owes carriers against its bond, Move money, transfers. */
export function BrokerMoney(): JSX.Element {
  useData();
  const g = S.game!;
  const w = g.w;
  const c = me();
  const partner = hasTwo(g) ? g.carrier : null;
  const bond = w.cfg.token.staking.roles.broker;
  const used = brokerBooks(w).get(c.id)?.apFd ?? 0;
  const share = used / Math.max(1, bond);
  const owedBy = w.receivables.filter((r) => r.payer === c.id && r.amountFd > 0.005);
  const pair = brokerageLog(w).formed.find((f) => f.brokerId === c.id);
  return (
    <Panel title="Money">
      <p class="bigcash num">{BROKERAGE.cash(fd(cash(w, c)))}</p>
      <Card title={BROKERAGE.owedToYou}>
        <InvoiceRows c={c} />
        <p class="muted small">{BROKERAGE.riskLine(pct(w.cfg.brokerRisk.defaultRate))}</p>
      </Card>
      <Card title={BROKERAGE.owedByYou}>
        <p class={`small ${share >= 1 ? "bad" : share > 0.8 ? "warn" : ""}`}>{BROKERAGE.bondMeter(fd(used), fd(bond))}</p>
        {share >= 1 ? <p class="bad small">{BROKERAGE.atBond}</p> : null}
        {owedBy.map((r) => (
          <p class="small" key={r.id}>
            {w.companies[r.payeeId - 1]?.name ?? ""} · {fd(r.amountFd)} · due {shortDate(r.dueDay)}
            {partner && r.payeeId === partner.id ? (
              <>
                {" "}
                <span class="badge">{BROKERAGE.yoursChip}</span>
              </>
            ) : null}
          </p>
        ))}
        {partner && owedBy.some((r) => r.payeeId === partner.id) ? <p class="muted small">{BROKERAGE.ownPaper(w.cfg.token.payment.termsDays)}</p> : null}
      </Card>
      {partner ? <MoveMoneyLink /> : null}
      {partner && pair ? (
        <details class="fold">
          <summary>{BROKERAGE.transfersFold}</summary>
          <p class="small">{BROKERAGE.capitalFrom(partner.name, fd(pair.capitalFd + pair.toBrokerFd))}</p>
          <p class="small">{BROKERAGE.capitalTo(partner.name, fd(pair.toCarrierFd))}</p>
        </details>
      ) : null}
    </Panel>
  );
}

/** "Move money ›" and its sheet, on either company's Money when the player has both. */
export function MoveMoneyLink(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  if (!hasTwo(S.game)) return null;
  return open ? (
    <MoveMoney onDone={() => setOpen(false)} />
  ) : (
    <button type="button" class="morerow" onClick={() => setOpen(true)}>
      <span>{BROKERAGE.moveLink}</span>
    </button>
  );
}

/** Why money can't leave `from` now, in the writer's words (brokerage.ts transferCapital's guards), or null. */
function moveRefusal(w: World, from: Company, fdAmount: number): string | null {
  const fee = fdAmount * w.cfg.brokerage.transferFeePct;
  const paper = from.role === "broker" && (from.openBrokerLoads > 0 || w.receivables.some((r) => r.payer === from.id));
  if (from.liquidatingSince !== null) return BROKERAGE.refuseMoveWinding(from.name);
  if (from.tierGraceDay !== null && (dayOf(w.t, w.cfg) < from.tierGraceDay || paper || from.role !== "broker")) return BROKERAGE.refuseMoveStake(from.name);
  if (from.role === "broker" && !brokerLicensed(w, from) && paper) return BROKERAGE.refuseMoveBond(fd(0));
  if (from.weeksInDebt > 0) return BROKERAGE.refuseMoveOverdue(from.name);
  if (cash(w, from) < fdAmount + fee) return BROKERAGE.refuseMoveNegative(from.name);
  return null;
}

/** Move money (brokerage-ux.md section 8): the owner's capital, either way, for the fee; equity, never revenue. */
function MoveMoney({ onDone }: { onDone: () => void }): JSX.Element {
  useData();
  const g = S.game!;
  const w = g.w;
  const [fromKind, setFromKind] = useState(kindInView(g));
  const from = fromKind === "brokerage" ? g.brokerage! : g.carrier!;
  const to = fromKind === "brokerage" ? g.carrier! : g.brokerage!;
  const feePct = w.cfg.brokerage.transferFeePct;
  const all = Math.max(0, Math.floor(cash(w, from) / (1 + feePct)));
  const [amount, setAmount] = useState(Math.min(1_000, all));
  const fee = amount * feePct;
  const why = amount > 0 ? moveRefusal(w, from, amount) : null;
  const send = async () => {
    const r = await order({ type: "transfer_capital", fd: amount }, BROKERAGE.moveButton(fd(amount)), fromKind);
    if (r.ok) onDone();
  };
  return (
    <Card title={BROKERAGE.moveTitle}>
      <div class="row">
        <span class="small">{BROKERAGE.moveDirection(from.name, to.name)}</span>
        <Btn sm ghost onClick={() => setFromKind(fromKind === "brokerage" ? "carrier" : "brokerage")}>
          ⇅ {BROKERAGE.swap}
        </Btn>
      </div>
      <label class="field">
        <span class="label">{BROKERAGE.amount}</span>
        <input type="number" min={0} step={100} value={amount} onInput={(e) => setAmount(Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0))} />
      </label>
      <div class="row">
        <Btn sm onClick={() => setAmount(Math.min(1_000, all))}>1,000</Btn>
        <Btn sm onClick={() => setAmount(Math.min(5_000, all))}>5,000</Btn>
        <Btn sm onClick={() => setAmount(all)}>{BROKERAGE.allYouCan}</Btn>
      </div>
      <Kv
        rows={[
          [BROKERAGE.moveFee(pct(feePct), fd(fee)), ""],
          [BROKERAGE.arrives(fd(amount)), ""],
          [BROKERAGE.moveAfter(from.name, fd(cash(w, from) - amount - fee)), ""],
          [BROKERAGE.moveAfter(to.name, fd(cash(w, to) + amount)), ""],
        ]}
      />
      <p class="muted small">{BROKERAGE.moveNote1}</p>
      <p class="muted small">{BROKERAGE.moveNote2}</p>
      {why ? <p class="bad small">{why}</p> : null}
      <div class="row">
        <Btn sm primary disabled={!(amount > 0) || why !== null} onClick={() => void send()}>
          {BROKERAGE.moveButton(fd(amount))}
        </Btn>
        <Btn sm ghost onClick={onDone}>
          {BROKERAGE.notNow}
        </Btn>
      </div>
    </Card>
  );
}

/** Pass to the brokerage (Rule A), on the carrier's direct-contract tender: the shipper's payable moves with the load. */
export function PassToBrokerage({ load }: { load: Load }): JSX.Element | null {
  const g = S.game!;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!hasTwo(g) || load.contractId === 0) return null;
  const w = g.w;
  const b = g.brokerage!;
  const contract = w.contracts.find((k) => k.id === load.contractId);
  const o = b.orders.find((x) => x.kind === "broker");
  const ceiling = (contract?.ratePerMile ?? 0) * (1 - (o && o.kind === "broker" ? o.marginPct : 0));
  const bond = w.cfg.token.staking.roles.broker;
  const books = brokerBooks(w);
  const usedAfter = (books.get(b.id)?.apFd ?? 0) + ceiling * load.miles;
  // Greyed out, with the reason, when a check fails (the engine's passTender checks, read ahead).
  const grey = !brokerLicensed(w, b)
    ? BROKERAGE.refusePassClosed(b.name, "it isn't bonded at its stake")
    : b.authority.status !== "active" || b.liquidatingSince !== null
      ? BROKERAGE.refusePassClosed(b.name, "its authority isn't active")
      : apCapBlock(w, b, books.get(b.id), ceiling * load.miles, true)
        ? BROKERAGE.refusePassBond(b.name)
        : w.t >= load.tenderUntil
          ? BROKERAGE.refusePassWindow
          : null;
  const [r1, r2] = BROKERAGE.passRows(b.name, fd((contract?.ratePerMile ?? 0) * load.miles), fd(usedAfter), fd(bond));
  const [t1, t2] = BROKERAGE.passThen(b.name);
  const send = async () => {
    const r = await order({ type: "pass_tender", loadId: load.id }, BROKERAGE.passButton(b.name), "carrier");
    if (r.ok) return setOpen(false);
    const why = r.reason.toLowerCase();
    setNote(why.includes("bond cap") ? BROKERAGE.refusePassBond(b.name) : why.includes("window") ? BROKERAGE.refusePassWindow : why.includes("only a direct contract") ? BROKERAGE.refusePassBoard : BROKERAGE.refusePassClosed(b.name, r.reason.toLowerCase()));
  };
  if (!open)
    return (
      <div class="stack">
        <Btn disabled={grey !== null} onClick={() => setOpen(true)}>
          {BROKERAGE.passButton(b.name)}
        </Btn>
        <span class="muted small">{grey ?? BROKERAGE.passUnder(b.name)}</span>
      </div>
    );
  return (
    <div class="stack sheetcard">
      <b>{BROKERAGE.passButton(b.name)}</b>
      <p class="small">{r1}</p>
      <p class="small">{r2}</p>
      <p class="small">{t1}</p>
      <p class="small">{t2}</p>
      <div class="row">
        <Btn sm primary onClick={() => void send()}>
          {BROKERAGE.passButton(b.name)}
        </Btn>
        <Btn sm ghost onClick={() => setOpen(false)}>
          {BROKERAGE.notNow}
        </Btn>
      </div>
      {note ? <p class="bad small">{note}</p> : null}
    </div>
  );
}
