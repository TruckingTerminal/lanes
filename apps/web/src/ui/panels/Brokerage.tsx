import type { JSX } from "preact";
import { companyAccount } from "@lanes/engine";
import { BROKERAGE } from "../../copy.js";
import { fdFull } from "../../format.js";
import { nextRoundHour } from "../../logic.js";
import { me, S, useData } from "../../state.js";
import { Card, Panel } from "../bits.js";

/**
 * The brokerage's bar (specs/brokerage-ux.md section 2): Book · Carriers · Money · More. Shells for now: each place, its
 * cards and its empty state, so the bar and the switch can be built and tested. Their contents come with the brokerage
 * build, once the economy has sized it.
 */
export function Book(): JSX.Element {
  useData();
  const c = me();
  return (
    <Panel title={BROKERAGE.bookHeader(c.name, c.openBrokerLoads, fdFull(0))}>
      {BROKERAGE.groups.map((g) => (
        <Card key={g} title={g}>
          {null}
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
