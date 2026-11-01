import type { JSX } from "preact";
import { BOOSTABLE, companyAccount, LAYERS, layerOpen, lockedFd, logbookCatalogue, notoriety, sellableFd, tokenLive, type Layer } from "@lanes/engine";
import { fd } from "../../format.js";
import { act, me, S, useData } from "../../state.js";
import { Btn, Card, Kv, Num, Panel } from "../bits.js";

const num = (id: string): number => Number((document.getElementById(id) as HTMLInputElement | null)?.value);
const LAYER_NAME: Record<Layer, string> = { businesses: "Businesses and facilities", brokerage: "Re-brokering", robbery: "Crews and the Back Lot" };

/**
 * The logbook (Jeff, 2026-10-31): the airdrop, paid into the game at the TGE, and the milestones that unlock it for
 * withdrawal, with the shop items that bring one forward; the unlock ladder; and Channel 19, the gossip network
 * (hires, hits, bounties), with the notoriety it gives.
 */
export function Logbook(): JSX.Element {
  useData();
  const w = S.game!.w;
  const c = me();
  const cfg = w.cfg;
  const live = tokenLive(w);
  const day = Math.floor(w.t / cfg.time.gameMinutesPerDay);
  const a = c.airdrop;
  const lb = a?.logbook;
  const k = cfg.token.airdrop.logbook;
  const cat = live && lb ? logbookCatalogue(w, c.role) : [];
  const boostPrice = lb ? Math.max(k.boost.minFd, lb.allocationFd * k.boost.share) : 0;
  const cash = w.ledger.balance(companyAccount(c.id));
  const feed = [...w.robbery.feed].reverse().slice(0, 40);
  const rk = cfg.robbery;
  const onMe = w.robbery.bounties.filter((b) => b.status === "open" && b.targetId === c.id);
  const mine = w.robbery.bounties.filter((b) => b.status === "open" && b.posterId === c.id);
  const name = (id: number) => w.companies[id - 1]?.name ?? `#${id}`;
  return (
    <Panel title="Logbook">
      {!live ? (
        <Card title="The airdrop">
          <p class="muted small">
            At the TGE your Miles become an airdrop, paid into your account at once: {Math.round(k.atLaunch * 100)}% free to withdraw, the rest spend-only in the game until the milestones below unlock it, within {Math.round(k.deadlineDays / 4 / 30)} real months. What's still locked and unspent at the deadline is burned.
          </p>
        </Card>
      ) : a && lb ? (
        <Card title="Your airdrop">
          <Kv
            rows={[
              ["Allocation", <Num>{fd(a.totalFd)} FD</Num>],
              ["Unlocked for withdrawal", <Num>{fd(a.unlockedFd)} FD ({Math.round((100 * a.unlockedFd) / Math.max(1, a.totalFd))}%)</Num>],
              ...(a.lockedFd !== undefined ? ([["Spend-only, still to unlock", <Num>{fd(a.lockedFd)} FD</Num>]] as [string, JSX.Element][]) : []),
              ["Sellable now", <Num>{fd(sellableFd(w, c))} FD (locked in all: {fd(lockedFd(w, c))})</Num>],
              ["Deadline", <Num>{lb.closed ? "closed" : `${Math.max(0, lb.deadlineDay - day)} days (${Math.max(0, Math.round((lb.deadlineDay - day) / 4))} real days)`}</Num>],
            ]}
          />
          <h3>Milestones</h3>
          <p class="muted small">
            Each one unlocks its share of the allocation for withdrawal. The honest ones add up to all of it; the criminal ones to at most {Math.round(k.criminalShare * 100)}%, only with no open case, and a conviction forfeits the rest.
            {k.boost.enabled ? ` A shop item brings a milestone forward for ${fd(boostPrice)} FD: it then asks ${Math.round(k.boost.factor * 100)}% of what it did.` : ""}
          </p>
          <table>
            <thead>
              <tr>
                <th>Milestone</th>
                <th>Path</th>
                <th>Share</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cat.map((m) => {
                const done = lb.done.includes(m.id);
                const boosted = lb.boosts?.includes(m.id) ?? false;
                return (
                  <tr key={m.id} class={done ? "good" : ""}>
                    <td>
                      {done ? "✓ " : ""}
                      {m.text}
                      {boosted ? " (bought forward)" : ""}
                    </td>
                    <td>{m.path}</td>
                    <td>{(m.share * 100).toFixed(1)}%</td>
                    <td>
                      {k.boost.enabled && !done && !boosted && !lb.closed && BOOSTABLE.has(m.id) ? (
                        <Btn sm disabled={cash < boostPrice} onClick={() => act({ type: "buy_logbook_boost", milestone: m.id }, `${m.text}: bought forward`)}>
                          Buy forward · {fd(boostPrice)}
                        </Btn>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card title="Your airdrop">
          <p class="muted small">No allocation: the airdrop went to the companies that hauled in the beta.</p>
        </Card>
      )}
      {cfg.unlockLadder.enabled && live ? (
        <Card title="The unlock ladder">
          <p class="muted small">After the TGE the game opens in layers, each at a published day.</p>
          <Kv
            rows={LAYERS.map((layer) => {
              const spec = cfg.unlockLadder.layers[layer];
              const opened = w.ladder[layer];
              return [LAYER_NAME[layer], <Num class={layerOpen(w, layer) ? "good" : ""}>{opened !== null ? `open since day ${opened}` : `opens day ${(w.token.launchDay ?? 0) + spec.afterDays}${spec.minActive > 0 ? `, with ${spec.minActive} active companies` : ""}`}</Num>];
            })}
          />
        </Card>
      ) : null}
      {rk.enabled ? (
        <Card title="Channel 19">
          <p class="muted small">
            The gossip network: every crew hired, every hit, every bounty, in the open. No police; what follows is between players. Your notoriety: {notoriety(w, c)} crew{notoriety(w, c) === 1 ? "" : "s"} hired in the last {rk.notorietyDays} days.
          </p>
          {onMe.length ? <p class="bad">Bounties on you: {onMe.map((b) => `${fd(b.fd)} FD from ${name(b.posterId)}`).join(", ")}.</p> : null}
          {mine.length ? <p class="muted small">Your bounties: {mine.map((b) => `${fd(b.fd)} FD on ${name(b.targetId)} (${Math.max(0, b.expiresDay - day)} days left)`).join(", ")}.</p> : null}
          {rk.bounty.enabled ? (
            <div class="row">
              <input type="number" id="bounty-fd" min={rk.bounty.minFd} step="500" defaultValue={String(Math.max(rk.bounty.minFd, 5_000))} aria-label="Bounty FD" />
              <span class="muted small">FD to put on whoever came for you (held {rk.bounty.days} days; paid to the crew that hits them).</span>
            </div>
          ) : null}
          {feed.length === 0 ? <p class="muted small">Quiet so far.</p> : null}
          {feed.map((f, i) => (
            <p key={i} class="small">
              <span class="muted">day {f.day}</span> {f.text}{" "}
              {rk.bounty.enabled && f.victimId === c.id && f.hirerId !== c.id && (f.kind === "hire" || f.kind === "hit") ? (
                <Btn sm disabled={cash < num("bounty-fd")} onClick={() => act({ type: "post_bounty", targetId: f.hirerId, fd: num("bounty-fd") }, `Bounty on ${name(f.hirerId)}`)}>
                  Bounty on {name(f.hirerId)}
                </Btn>
              ) : null}
            </p>
          ))}
        </Card>
      ) : null}
    </Panel>
  );
}
