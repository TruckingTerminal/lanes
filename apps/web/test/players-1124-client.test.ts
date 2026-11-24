import "./seed.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Load } from "@lanes/engine";
import { bidFieldWhy } from "../src/board.js";
import { BROKERAGE } from "../src/copy.js";
import { formOf, ordersFrom } from "../src/dispatcherform.js";
import { heldRows, NAME_MAX, NameField, nameOf, selectOnFocus } from "../src/ui/fields.js";
import { brokerageSuggestion } from "../src/ui/panels/Brokerage.js";
import { clearDraft, draftOf, fieldOf, recordDraft, recordSent, sentOf, shownOrders } from "../src/ui/panels/Dispatcher.js";
import { DEFAULT_ORDERS } from "../src/game.js";
import { resetWorldState } from "../src/state.js";

/** The player round of 2026-11-24 (studio/playtests/play-2026-11-24-*.md): the page fixes a test can hold. */

const src = (...p: string[]) => readFileSync(join(__dirname, "..", "src", ...p), "utf8");
type Node = { type: unknown; props: Record<string, unknown> & { children?: unknown } };
const kids = (v: Node): Node[] => {
  const c = v.props.children;
  return (Array.isArray(c) ? c : [c]).filter((x): x is Node => typeof x === "object" && x !== null);
};

describe("a name box: the suggestion is a placeholder, and nothing typed is dropped (items 1 and 2)", () => {
  const field = (typed: string, onTyped: (t: string) => void = () => {}) => kids(NameField({ id: "cname", typed, suggestion: "Harbor Gate Transport", onTyped }) as unknown as Node);

  it("starts empty with the suggestion as its placeholder, and has no length limit to drop keys", () => {
    const [input, count] = field("");
    expect(input!.type).toBe("input");
    expect(input!.props.value).toBe("");
    expect(input!.props.placeholder).toBe("Harbor Gate Transport");
    expect(input!.props.maxLength).toBeUndefined();
    expect(count!.props.children).toBe(`0/${NAME_MAX}`);
  });

  it("nothing typed, the suggestion is the name; typed, the typed name alone, never the suggestion with it", () => {
    expect(nameOf("", "Harbor Gate Transport").name).toBe("Harbor Gate Transport");
    expect(nameOf("   ", "Harbor Gate Transport").name).toBe("Harbor Gate Transport");
    expect(nameOf(" Big Rig Empire ", "Harbor Gate Transport").name).toBe("Big Rig Empire");
  });

  it("past the limit the name is refused and the count turns red; it is never cut", () => {
    const long = "Harbor Gate Transport Big Rig Empire"; // 36
    const r = nameOf(long, "x");
    expect(r).toEqual({ name: long, over: true, length: 36 });
    const [input, count] = field(long);
    expect(input!.props["aria-invalid"]).toBe(true);
    expect(count!.props.class).toContain("bad");
    expect(count!.props.children).toBe(`36/${NAME_MAX}`);
    expect(nameOf("x".repeat(NAME_MAX), "y").over).toBe(false);
  });

  it("each key is handed over as typed", () => {
    const seen: string[] = [];
    const [input] = field("", (t) => seen.push(t));
    const onInput = (input!.props.onInput ?? input!.props.oninput) as (e: unknown) => void;
    onInput({ currentTarget: { value: "B" } });
    expect(seen).toEqual(["B"]);
  });

  it("the new world's box and the brokerage's step 1 use it; the new world refuses a name past the limit, and Next waits on it", () => {
    const choose = src("ui", "ChooseHub.tsx");
    expect(choose).toContain("<NameField");
    expect(choose).not.toContain("maxLength={32}");
    expect(choose).toContain("if (field.over) return;");
    const broker = src("ui", "panels", "Brokerage.tsx");
    expect(broker).toContain('<NameField id="bname" typed={typed} suggestion={suggestion} onTyped={setTyped} />');
    expect(broker).toContain("(step === 1 && nameOver)");
  });
});

describe("the brokerage's suggested name is never the carrier's (items 2 and 6)", () => {
  it("a carrier name at the limit keeps the template's word, cut at a word", () => {
    // The broker's round: a 32-character carrier name made the suggestion the carrier's own.
    expect(brokerageSuggestion("Middle Lane FreightMiddle Lane F")).toBe("Middle Lane Logistics");
    expect(brokerageSuggestion("Peachtree Freight Exchange")).toBe("Peachtree Freight Logistics");
    expect(brokerageSuggestion("Ana Freight")).toBe(BROKERAGE.defaultName("Ana Freight"));
  });

  it("for any carrier name up to the limit, the suggestion fits and differs from it", () => {
    for (const name of ["A", "Lakefront Hauling", "Harbor Gate TransportBig Rig Emp", "Supercalifragilisticexpialidocio", "Twenty Two Characters"]) {
      const s = brokerageSuggestion(name);
      expect(s.length).toBeLessThanOrEqual(NAME_MAX);
      expect(s).not.toBe(name);
    }
  });

  it("step 2's second cash-after line, the confirm and the order name the brokerage (the typed name, else the suggestion)", () => {
    const broker = src("ui", "panels", "Brokerage.tsx");
    expect(broker).toContain("const { name, over: nameOver } = nameOf(typed, suggestion);");
    expect(broker).toContain("BROKERAGE.brokerCashAfter(name,");
    expect(broker).toContain('order({ type: "form_brokerage", name, capitalFd: capital }');
  });
});

describe("the dispatcher's form keeps what's typed (item 3; part A question 5)", () => {
  it("each field's change lands in the company's draft, a box as true or false; other fields are no part of it", () => {
    clearDraft(901);
    expect(recordDraft(901, { id: "o-pct", type: "number", value: "-5" })).toBe(true); // new: the form says it isn't saved
    expect(recordDraft(901, { id: "o-bn", type: "checkbox", checked: true })).toBe(false);
    expect(recordDraft(901, { id: "", type: "checkbox", checked: true })).toBe(false); // the switch has no id
    expect(recordDraft(901, { id: "cname", type: "text", value: "x" })).toBe(false);
    expect(draftOf(901)).toEqual({ "o-pct": "-5", "o-bn": true });
    clearDraft(901);
    expect(draftOf(901)).toBeUndefined();
  });

  it("a negative markup is saved as 0 (dispatcherform.ts), and the form is remounted on Save so it shows the 0", () => {
    const f = { ...formOf([]), pct: -5 };
    const bid = ordersFrom(f, true, []).find((o) => o.kind === "bid")!;
    expect(bid.kind === "bid" && bid.price.pct).toBe(0);
    const panel = src("ui", "panels", "Dispatcher.tsx");
    expect(panel).toContain("key={`${c.orders.length}:${on}:${saves}`}");
    expect(panel).toContain("setSaves((n) => n + 1);");
  });

  it("the fields show the draft over the saved orders, the switch takes the draft with it, and the switches say their state", () => {
    const panel = src("ui", "panels", "Dispatcher.tsx");
    expect(panel).toContain('defaultValue={text("o-pct", f0.pct)}');
    expect(panel).toContain('defaultChecked={tick("o-ct", f0.ct)}');
    expect(panel).toContain('<div class="stack dispatcherform" onInput={record} onChange={record}>');
    expect(panel).toContain("if (!waiting && (draftOf(c.id) || sentOf(c.id))) {");
    expect(panel).toContain("{draft ? <p class=\"small warn dispatcherunsaved\">{PENDING.dispatcherUnsaved}</p> : null}");
    expect(panel).toContain("checked={switchOn} aria-checked={switchOn}");
    expect(panel).toContain('aria-checked={c.nightStop === "town"}');
  });
});

describe("the dispatcher's form after a save, before the order takes effect (live: in effect at a later game minute)", () => {
  // The saved orders as they were before the save: a 20% markup, 100 mi empty, home after 14 days.
  const old = ordersFrom({ ...formOf([]), pct: 20, dh: 100, homeAfter: 14 }, true, []);
  const typed = { ...formOf(old), pct: -5, dh: 90, homeAfter: 10 };

  it("after a save whose orders are not yet the saved ones, the fields show the sent ones (a −5 reads 0)", () => {
    recordDraft(905, { id: "o-pct", type: "number", value: "-5" });
    const sentOrders = ordersFrom(typed, true, old);
    recordSent(905, sentOrders);
    expect(draftOf(905)).toBeUndefined(); // written, so not "unsaved"
    const f0 = formOf(shownOrders(905, old));
    expect([f0.pct, f0.dh, f0.homeAfter]).toEqual([0, 90, 10]);
    expect(fieldOf(draftOf(905), "o-pct", f0.pct)).toBe("0");
    expect(fieldOf(draftOf(905), "o-bn", f0.bn)).toBe(f0.bn);
    expect(sentOf(905)).toBe(sentOrders); // still waiting on the saved orders
    const panel = src("ui", "panels", "Dispatcher.tsx");
    expect(panel).toContain("const view = shownOrders(c.id, shown);");
    expect(panel).toContain("const f0 = formOf(view);");
    expect(panel).toContain("recordSent(c.id, rules);");
    expect(panel).toContain("recordSent(c.id, typed);");
    expect(panel).toContain("recordSent(c.id, DEFAULT_ORDERS);");
  });

  it("once the saved orders read the same, what was sent is let go and the form is shown from the saved ones", () => {
    const nowSaved = structuredClone(sentOf(905)!) as typeof old;
    expect(shownOrders(905, nowSaved)).toBe(nowSaved);
    expect(sentOf(905)).toBeUndefined();
    expect(formOf(shownOrders(905, old)).pct).toBe(20); // nothing over the saved orders any more
  });

  it("a draft typed after a save wins over what was sent, field by field, and only the draft is unsaved", () => {
    recordSent(906, ordersFrom(typed, true, old));
    expect(recordDraft(906, { id: "o-pct", type: "number", value: "40" })).toBe(true);
    recordDraft(906, { id: "o-bn", type: "checkbox", checked: true });
    const f0 = formOf(shownOrders(906, old));
    expect(fieldOf(draftOf(906), "o-pct", f0.pct)).toBe("40");
    expect(fieldOf(draftOf(906), "o-bn", f0.bn)).toBe(true);
    expect(fieldOf(draftOf(906), "o-dh", f0.dh)).toBe("90"); // untyped: what was sent
    expect(fieldOf(undefined, "o-dh", formOf(old).dh)).toBe("100"); // nothing typed or sent: the saved orders
    expect(sentOf(906)).toBeDefined();
  });

  it("Defaults shows the defaults' form before they are saved", () => {
    recordDraft(907, { id: "o-dh", type: "number", value: "40" });
    recordSent(907, DEFAULT_ORDERS);
    expect(draftOf(907)).toBeUndefined();
    expect(formOf(shownOrders(907, old))).toEqual(formOf(DEFAULT_ORDERS));
    expect(formOf(shownOrders(907, old))).not.toEqual(formOf(old));
  });

  it("a world reset clears what was sent, with the drafts", () => {
    recordSent(908, DEFAULT_ORDERS);
    recordDraft(908, { id: "o-pct", type: "number", value: "7" });
    resetWorldState();
    expect(sentOf(908)).toBeUndefined();
    expect(sentOf(906)).toBeUndefined();
    expect(draftOf(908)).toBeUndefined();
    expect(shownOrders(908, old)).toBe(old);
  });
});

describe("the hire tables (item 4)", () => {
  it("a held list shows the rows it held, else the fresh ones", () => {
    expect(heldRows(null, [1, 2])).toEqual([1, 2]);
    expect(heldRows([3, 1], [1, 2])).toEqual([3, 1]);
  });

  it("both lists hold under the pointer and the focus", () => {
    const staff = src("ui", "panels", "Staff.tsx");
    expect(staff).toContain('<table class="pooltable" {...driversHeld.on}>');
    expect(staff).toContain('<div class="stack poachrows" {...poachHeld.on}>');
  });

  it("each person is a wrapping row at every width, not only on a phone", () => {
    const page = src("page.html");
    expect(page).toMatch(/\n\.pooltable tr \{ display: flex; flex-wrap: wrap;/);
    expect(page).toMatch(/\n\.pooltable, \.pooltable tbody \{ display: block; width: 100%; \}/);
    expect(page).not.toMatch(/\n {2}\.pooltable tr \{/); // no longer inside the phone query
    expect(page).toContain(".pooltable select, .poachrow select { max-width: 100%; min-width: 0; }");
  });
});

describe("the bid box (item 5)", () => {
  const l = { ceiling: 3 } as unknown as Load;

  it("a BID the field shuts says why: not a rate, over the ceiling, or nothing to bid", () => {
    expect(bidFieldWhy(l, "5.5.3030", null)).toBe("bad");
    expect(bidFieldWhy(l, "4.00", null)).toBe("ceiling");
    expect(bidFieldWhy(l, null, null)).toBe("empty");
    expect(bidFieldWhy(l, "", null)).toBe("empty");
    expect(bidFieldWhy(l, "2.50", null)).toBeNull();
    expect(bidFieldWhy(l, "abc", 2.4)).toBeNull(); // BID takes the bid the field started from
    const board = src("ui", "panels", "Board.tsx");
    expect(board).toContain("const fieldWhy = bidFieldWhy(l, bidText, bid);");
    expect(board).toContain("{bidWhy && !bidShut && !bidOut && note?.text !== bidWhy ?");
  });

  it("focused, the box selects its figure so typing replaces it; the focusing press's mouseup is held once", () => {
    const el = { select: vi.fn() };
    selectOnFocus.onFocus({ currentTarget: el } as unknown as FocusEvent);
    expect(el.select).toHaveBeenCalledTimes(1);
    const prevent = vi.fn();
    selectOnFocus.onMouseUp({ currentTarget: el, preventDefault: prevent } as unknown as MouseEvent);
    selectOnFocus.onMouseUp({ currentTarget: el, preventDefault: prevent } as unknown as MouseEvent);
    expect(prevent).toHaveBeenCalledTimes(1);
    expect(src("ui", "panels", "Board.tsx")).toContain("onFocus={selectOnFocus.onFocus}");
  });
});

describe("phone width (item 6)", () => {
  it("the Rates tables break inside a word before running past the card; a town's card wraps; a hero's city picture fits", () => {
    const page = src("page.html");
    expect(page).toContain("table.mini th, table.mini td { overflow-wrap: anywhere; }");
    expect(page).toContain(".townhead { flex-wrap: wrap; }");
    expect(page).toContain(".townhead .towntitle { flex: 1 1 200px; min-width: 0; overflow-wrap: anywhere; }");
    expect(page).toContain(".herocard > canvas.pic { width: 100%; height: auto; display: block; image-rendering: pixelated; }");
    expect(page).toContain("grid-template-columns: minmax(0, 1fr); gap: 10px;");
  });
});
