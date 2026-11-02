import type { JSX } from "preact";
import { askingPay, crewed, dispatchProfile, poolOf, spanOf, type Staff as StaffT, type Truck } from "@lanes/engine";
import { fd, pct, TRAILER_NAME } from "../../format.js";
import { GAME_CONFIG } from "../../game.js";
import { atHub, marketPayOf, moraleClass, moraleWord, staffPay, Stars } from "../../logic.js";
import { act, me, myTrucks, S, truckNo, useData } from "../../state.js";
import { Btn, Card, Kv, Panel } from "../bits.js";
import { SCENES, driverFace } from "../../assets.js";
import { Portrait, Scene } from "../Loop.js";
import { PendingCard } from "./Fleet.js";

const num = (id: string): number => Number((document.getElementById(id) as HTMLInputElement | null)?.value);
const sel = (id: string): string | undefined => (document.getElementById(id) as HTMLSelectElement | null)?.value;

function TruckOptions({ pick }: { pick: (t: Truck) => boolean }): JSX.Element {
  return (
    <>
      {myTrucks().map((t, i) =>
        pick(t) ? (
          <option value={t.id} key={t.id}>
            Truck {i + 1} · {TRAILER_NAME[t.trailer]}
          </option>
        ) : null,
      )}
    </>
  );
}

export function Staff(): JSX.Element {
  useData();
  const w = S.game!.w;
  const c = me();
  const trucks = myTrucks();
  const operating = trucks.filter((t) => t.status !== "parked" && t.status !== "listed").length;
  const prof = dispatchProfile(w, c, operating);
  const team = w.staffByCompany.get(c.id) ?? [];
  const owner = team.find((s) => s.owner);
  const hired = team.filter((s) => !s.owner);
  const openSeat = (t: Truck) => !crewed(t) && atHub(t);
  const teamSeat = (t: Truck) => crewed(t) && t.coDriverId === 0 && atHub(t);
  const seatsOpen = trucks.some(openSeat);
  const value = (s: StaffT) => askingPay(w, s) - (s.kind === "driver" ? 0.35 * s.skill : 0);
  const poolDrivers = poolOf(w, "driver").sort((a, b) => value(a) - value(b) || a.id - b.id).slice(0, 10);
  const poolDispatchers = poolOf(w, "dispatcher").sort((a, b) => askingPay(w, a) / spanOf(w, a) - askingPay(w, b) / spanOf(w, b) || a.id - b.id).slice(0, 6);
  const managersOn = w.cfg.labor.managers.enabled;
  const poolManagers = (kind: "opsManager" | "maintManager") => poolOf(w, kind).sort((a, b) => askingPay(w, a) * (1 - 0.4 * a.skill) - askingPay(w, b) * (1 - 0.4 * b.skill) || a.id - b.id).slice(0, 4);
  const kindLabel = (k: StaffT["kind"]) => (k === "driver" ? "Driver" : k === "dispatcher" ? "Dispatcher" : k === "opsManager" ? "Operations manager" : "Maintenance manager");
  const poachable = w.staff
    .filter((s) => s.status === "employed" && !s.owner && s.companyId !== c.id && s.skill >= 0.55 && !s.offer)
    .sort((a, b) => b.skill - a.skill || a.id - b.id)
    .slice(0, 8);

  const offerLine = (s: StaffT) => {
    if (!s.offer) return null;
    if (s.offer.companyId === 0) return <p class="bad">Leaving once their truck is at a hub.</p>;
    const from = w.companies[s.offer.companyId - 1]!;
    const pay = s.offer.pay;
    return (
      <div class="row">
        <span class="bad">
          {from.name} offered {staffPay(s, pay)}. They go unless you match.
        </span>
        <Btn primary onClick={() => act({ type: "set_staff_pay", staffId: s.id, pay }, "Pay changed")}>
          Match
        </Btn>
      </div>
    );
  };
  const setPay = (s: StaffT) => {
    const pay = Math.min(s.kind === "driver" ? 20 : 50_000, Math.max(0.01, num(`pay-${s.id}`)));
    act({ type: "set_staff_pay", staffId: s.id, pay }, "Pay changed");
  };
  const seat = (s: StaffT, team: boolean) => {
    const truckId = Number(sel(`${team ? "team" : "seat"}-${s.id}`));
    act({ type: "assign_driver", staffId: s.id, truckId, team }, team ? "Co-driver seated: the truck runs as a team" : "Driver seated");
  };
  const hire = (s: StaffT, pay: number, kind: "hire" | "poach") => {
    const v = sel(`${kind}-${s.id}`);
    act({ type: "offer_staff", staffId: s.id, pay, truckId: v ? Number(v) : undefined }, kind === "hire" ? "Hired" : "Offer made: their employer has two days to match");
  };

  const PersonCard = ({ s }: { s: StaffT }) => {
    const seatText =
      s.kind === "dispatcher" ? (
        <>runs up to {spanOf(w, s)} trucks</>
      ) : s.kind === "opsManager" || s.kind === "maintManager" ? (
        <>{s.kind === "opsManager" ? "runs the office" : "runs the shop"}</>
      ) : s.truckId ? (
        <>
          truck {truckNo(s.truckId)}
          {w.trucks[s.truckId - 1]!.coDriverId === s.id ? " (co-driver)" : ""}
        </>
      ) : (
        <span class="bad">no truck</span>
      );
    const canSeat = s.kind === "driver" && trucks.some(openSeat);
    const canTeam = s.kind === "driver" && trucks.some((t) => teamSeat(t) && t.driverId !== s.id);
    return (
      <Card key={s.id}>
        <div class="row">
          {s.kind === "driver" ? <Portrait file={driverFace(s)} /> : <Portrait who="dispatcher" />}
          <b>{s.name}</b>
          <Stars skill={s.skill} />
          <span class="muted">{kindLabel(s.kind)}</span>
          <span class={moraleClass(s.morale)}>{moraleWord(s.morale)}</span>
          {s.kind === "driver" ? (
            <span class="muted">
              {s.homeUntilDay !== null ? "on home time" : s.awayDays ? `${s.awayDays} d out` : "home"}
              {s.fatigue >= GAME_CONFIG.fatigue.tiredAt / 2 ? (
                <>
                  {" · "}
                  <span class={s.fatigue >= GAME_CONFIG.fatigue.tiredAt ? "bad" : "warn"}>fatigue {pct(s.fatigue)}</span>
                </>
              ) : null}
            </span>
          ) : null}
        </div>
        <p>
          {seatText} · paid {staffPay(s, s.pay)} · market {staffPay(s, marketPayOf(s))}
          {s.violations || s.crashes ? (
            <span class="warn">
              {" "}
              · {s.violations} violations, {s.crashes} crashes on record
            </span>
          ) : null}
        </p>
        {offerLine(s)}
        <div class="row">
          <input type="number" id={`pay-${s.id}`} step={s.kind === "driver" ? "0.01" : "10"} min="0" defaultValue={s.kind === "driver" ? s.pay.toFixed(2) : String(Math.round(s.pay))} aria-label="Pay" />
          <Btn onClick={() => setPay(s)}>Set pay</Btn>
          {canSeat ? (
            <>
              <select id={`seat-${s.id}`} aria-label="Truck to drive">
                <TruckOptions pick={openSeat} />
              </select>
              <Btn onClick={() => seat(s, false)}>Drive it</Btn>
            </>
          ) : null}
          {canTeam ? (
            <>
              <select id={`team-${s.id}`} aria-label="Truck to co-drive">
                <TruckOptions pick={(t) => teamSeat(t) && t.driverId !== s.id} />
              </select>
              <Btn onClick={() => seat(s, true)}>Co-drive</Btn>
            </>
          ) : null}
          <Btn onClick={() => act({ type: "release_staff", staffId: s.id }, "Let go")}>Let go</Btn>
        </div>
      </Card>
    );
  };

  const PoolRow = ({ s }: { s: StaffT }) => {
    const ask = askingPay(w, s);
    const driver = s.kind === "driver";
    const can = !driver || seatsOpen;
    return (
      <tr key={s.id}>
        <td>
          <span class="row">
            {driver ? <Portrait file={driverFace(s)} sm /> : <Portrait who="dispatcher" sm />}
            {s.name}
          </span>
        </td>
        <td>
          <Stars skill={s.skill} />
        </td>
        <td class="num">{staffPay(s, ask)}</td>
        <td>{driver ? `${s.violations}/${s.crashes}` : s.kind === "dispatcher" ? `${spanOf(w, s)} trucks` : s.kind === "opsManager" ? `${w.cfg.labor.managers.ops.span} trucks` : "the shop"}</td>
        <td>
          {can ? (
            <div class="row">
              {driver ? (
                <select id={`hire-${s.id}`} aria-label="Truck">
                  <TruckOptions pick={openSeat} />
                </select>
              ) : null}
              <Btn sm onClick={() => hire(s, ask, "hire")}>
                Hire
              </Btn>
            </div>
          ) : (
            <span class="muted">no open seat</span>
          )}
        </td>
      </tr>
    );
  };
  const PoachRow = ({ s }: { s: StaffT }) => {
    const lo = w.cfg.labor.morale.loyalty[0];
    const hi = w.cfg.labor.morale.loyalty[1];
    const needed = Math.max(askingPay(w, s), s.pay * (1 + lo + (hi - lo) * s.morale));
    const driver = s.kind === "driver";
    const can = !driver || seatsOpen;
    return (
      <tr key={s.id}>
        <td>
          {s.name}
          <br />
          <span class="muted">{w.companies[s.companyId - 1]!.name}</span>
        </td>
        <td>
          <Stars skill={s.skill} />
        </td>
        <td class="num">{staffPay(s, s.pay)}</td>
        <td class={moraleClass(s.morale)}>{moraleWord(s.morale)}</td>
        <td>
          {can ? (
            <div class="row">
              {driver ? (
                <select id={`poach-${s.id}`} aria-label="Truck">
                  <TruckOptions pick={openSeat} />
                </select>
              ) : null}
              <Btn sm onClick={() => hire(s, needed, "poach")}>
                Offer {staffPay(s, needed)}
              </Btn>
            </div>
          ) : (
            <span class="muted">no open seat</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <Panel title="Staff">
      <Scene name="lounge" still={SCENES.lounge} alt="The drivers' lounge" />
      <PendingCard />
      <Card title="You">
        <div class="row">
          <Portrait who="driverM" />
          <Portrait who="dispatcher" />
          <span class="muted small">You drive and you dispatch, until you hire.</span>
        </div>
        <Kv
          rows={[
            ["Driving", owner ? <><Stars skill={owner.skill} /> · {owner.truckId ? `truck ${truckNo(owner.truckId)}` : "not driving"} · {fd(owner.experience + owner.pending)} mi driven</> : "–"],
            ["Dispatching", <><Stars skill={c.ownerDispatch.skill} /> · {Math.round(c.ownerDispatch.experience)} loads booked · you can run {w.cfg.labor.owner.span} trucks</>],
          ]}
        />
      </Card>
      <Card title="Dispatch">
        <Kv
          rows={[
            ["Coverage", <span class={prof.coverage < 1 ? "bad" : "good"}>{prof.span} trucks for the {operating} you run{prof.coverage < 1 ? ` · about ${Math.round((1 - prof.coverage) * 100)}% of idle trucks sit out each round` : ""}</span>],
            ["Skill", <><Stars skill={prof.skill} /> · costs misread by ~{Math.round(prof.noise * 100)}% · {prof.reloadWeight.toFixed(2)}× the reload run priced in · {prof.foresightDays} days of season foresight</>],
          ]}
        />
        <p class="muted small">Your bids by hand aren't limited by any of this.</p>
        <label class="row">
          <input type="checkbox" checked={c.autoStaff} onChange={(ev) => act({ type: "set_auto_staff", on: (ev.currentTarget as HTMLInputElement).checked }, (ev.currentTarget as HTMLInputElement).checked ? "Auto-staff on" : "Auto-staff off")} /> Auto-staff: fill empty seats and hire or let go a dispatcher as the fleet changes
        </label>
      </Card>
      {hired.length ? hired.map((s) => <PersonCard s={s} key={s.id} />) : <p class="muted">Nobody on the payroll yet. You drive your own truck and dispatch it yourself.</p>}
      <Card title="Hire a driver">
        <p class="muted small">Market pay rises with skill (wage index {w.labor.wageIndex.toFixed(2)}). Drivers improve with every mile, and expect a raise as they do.</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Skill</th>
              <th>Asks</th>
              <th>Viol./crashes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {poolDrivers.map((s) => (
              <PoolRow s={s} key={s.id} />
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Hire a dispatcher">
        <p class="muted small">Pay is quoted for a full span and billed for the trucks they run past your own {w.cfg.labor.owner.span}, with a quarter as a retainer.</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Skill</th>
              <th>Asks</th>
              <th>Runs</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {poolDispatchers.map((s) => (
              <PoolRow s={s} key={s.id} />
            ))}
          </tbody>
        </table>
      </Card>
      {managersOn ? (
        <Card title="Hire a manager">
          <p class="muted small">
            Past {w.cfg.labor.managers.ops.requiredAbove} trucks you need an operations manager, one for every {w.cfg.labor.managers.ops.span} beyond, or the extra trucks park after {w.cfg.token.staking.graceDays} days. A maintenance manager past {w.cfg.labor.managers.maint.requiredAbove}. Their skill sets the edge; pay is a full week's.
          </p>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Skill</th>
                <th>Asks</th>
                <th>Runs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {poolManagers("opsManager").map((s) => (
                <PoolRow s={s} key={s.id} />
              ))}
              {poolManagers("maintManager").map((s) => (
                <PoolRow s={s} key={s.id} />
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
      <Card title="Hire away from other companies">
        <p class="muted small">Their employer gets {w.cfg.labor.morale.noticeDays} days to match. Unhappy people come cheaper.</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Skill</th>
              <th>Paid</th>
              <th>Mood</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {poachable.map((s) => (
              <PoachRow s={s} key={s.id} />
            ))}
          </tbody>
        </table>
      </Card>
    </Panel>
  );
}
