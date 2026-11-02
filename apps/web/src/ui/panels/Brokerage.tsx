import type { JSX } from "preact";
import { companyAccount, type World } from "@lanes/engine";
import { BROKERAGE } from "../../copy.js";
import { fdFull } from "../../format.js";
import { nextRoundHour } from "../../logic.js";
import { me, S, useData } from "../../state.js";

/** The game minute of the next board round. */
function roundAt(w: World): number {
  const perDay = w.cfg.time.gameMinutesPerDay;
  const today = Math.floor(w.t / perDay);
  const hour = (w.t % perDay) / 60;
  const next = w.cfg.time.boardRoundHours.find((h) => h > hour);
  return (next !== undefined ? today : today + 1) * perDay + (next ?? w.cfg.time.boardRoundHours[0]!) * 60;
}
import { Card, Panel } from "../bits.js";

/**
 * The brokerage's bar (specs/brokerage-ux.md section 2): Book · Carriers · Money · More. Shells for now: each place, its
 * cards and its empty state, so the bar and the switch can be built and tested. Their contents come with the brokerage
 * build, once the economy has sized it.
 */
export function Book(): JSX.Element {
  useData();
  const c = me();
  const w = S.game!.w;
  // A posting opened from its pin on the map shows under On the board, until the rest of the Book is built.
  const opened = S.openLoad !== null ? w.loads.get(S.openLoad) : undefined;
  const mine = opened && opened.brokerId === c.id && opened.status === "open" ? opened : null;
  const hours = Math.max(1, Math.round((roundAt(w) - w.t) / 60));
  return (
    <Panel title={BROKERAGE.bookHeader(c.name, c.openBrokerLoads, fdFull(0))}>
      {BROKERAGE.groups.map((g, i) => (
        <Card key={g} title={g}>
          {i === 0 && mine ? (
            <div class="stack sel">
              <b>
                {w.net.places[mine.originPlace]!.name} → {w.net.places[mine.destPlace]!.name}
              </b>
              <span class="small muted">{BROKERAGE.posted(mine.ceiling.toFixed(2), nextRoundHour(), `${hours} h`)}</span>
            </div>
          ) : null}
        </Card>
      ))}
      {c.openBrokerLoads ? null : <p class="muted">{BROKERAGE.bookEmpty(nextRoundHour())}</p>}
    </Panel>
  );
}

export function Carriers(): JSX.Element {
  useData();
  return (
    <Panel title="Carriers">
      <Card title={BROKERAGE.whoMayHaul}>{null}</Card>
      <Card title={BROKERAGE.haulers}>{null}</Card>
    </Panel>
  );
}

/** Money for the brokerage in view: its cash, what shippers owe it and what it owes carriers. */
export function BrokerMoney(): JSX.Element {
  useData();
  const c = me();
  return (
    <Panel title="Money">
      <p class="bigcash num">{BROKERAGE.cash(fdFull(S.game!.w.ledger.balance(companyAccount(c.id))))}</p>
      <Card title={BROKERAGE.owedToYou}>{null}</Card>
      <Card title={BROKERAGE.owedByYou}>{null}</Card>
    </Panel>
  );
}
