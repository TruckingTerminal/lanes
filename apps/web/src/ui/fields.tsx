import type { JSX } from "preact";
import { useRef, useState } from "preact/hooks";

/**
 * Small field behaviours the page shares (the 2026-11-24 player round): a name box whose suggestion is a placeholder, so
 * the first key starts the name instead of adding to the suggestion, and which counts its characters instead of dropping
 * the ones past the limit; a figure box that selects what it holds on focus, so typing replaces it; and a list that holds
 * its rows still while the pointer or the focus is in it.
 */

/** The longest company or brokerage name (game.ts formCompany cuts there too). */
export const NAME_MAX = 32;

/** The name a name box gives: what's typed, trimmed, else the suggestion; over the limit it's refused, never cut. */
export function nameOf(typed: string, suggestion: string, max = NAME_MAX): { name: string; over: boolean; length: number } {
  const t = typed.trim();
  return { name: t || suggestion, over: t.length > max, length: t.length };
}

/**
 * A name box: empty, with the suggestion as its placeholder (nothing typed, the suggestion is the name), and its count of
 * characters under it, red past the limit. No maxLength: a key past the limit is kept and the count says so, where the
 * browser's limit dropped keys without a word.
 */
export function NameField(p: { id: string; typed: string; suggestion: string; max?: number; onTyped: (text: string) => void }): JSX.Element {
  const max = p.max ?? NAME_MAX;
  const { over, length } = nameOf(p.typed, p.suggestion, max);
  return (
    <>
      <input
        key={p.id}
        type="text"
        id={p.id}
        placeholder={p.suggestion}
        value={p.typed}
        autoComplete="off"
        aria-invalid={over}
        aria-describedby={`${p.id}-count`}
        onInput={(e) => p.onTyped((e.currentTarget as HTMLInputElement).value)}
      />
      <span id={`${p.id}-count`} class={over ? "bad small namecount" : "muted small namecount"}>{`${length}/${max}`}</span>
    </>
  );
}

/** Inputs focused by this press: their mouseup is the one that would undo the selection. */
const focusedByPress = new WeakSet<EventTarget>();

/**
 * Select-on-focus for a figure box: focused by a tap, a click or the keyboard, the box selects what it holds, so the first
 * key replaces it (the player's "5.5.3030": typing added to the figure). The mouseup of the press that focused it would
 * put the caret back, so that one mouseup is held.
 */
export const selectOnFocus = {
  onFocus: (e: FocusEvent): void => {
    const el = e.currentTarget as HTMLInputElement | null;
    if (!el) return;
    el.select();
    focusedByPress.add(el);
  },
  onMouseUp: (e: MouseEvent): void => {
    if (e.currentTarget && focusedByPress.delete(e.currentTarget)) e.preventDefault();
  },
  onBlur: (e: FocusEvent): void => {
    if (e.currentTarget) focusedByPress.delete(e.currentTarget);
  },
};

/** The rows a held list shows: the ones held while the pointer or the focus is in it, else the fresh ones. */
export const heldRows = (held: readonly number[] | null, fresh: readonly number[]): readonly number[] => held ?? fresh;

/**
 * A list whose rows hold still under the pointer (the hire tables: rows moved under the pointer as the pool changed). While
 * the pointer is over the list, or a field in it has the focus (a finger's tap focuses the select or the Hire button), the
 * rows and their order stay as they were when it came in; they catch up when both leave. A row whose person has gone stays
 * in place, and Hire on it gets the engine's own refusal.
 */
export function useHeldRows(): { rows: (fresh: readonly number[]) => readonly number[]; on: Record<string, (e: Event) => void> } {
  const st = useRef<{ pointer: boolean; focus: boolean; held: readonly number[] | null; last: readonly number[] }>({ pointer: false, focus: false, held: null, last: [] });
  const [, redraw] = useState(0);
  const hold = () => {
    if (st.current.held === null) st.current.held = st.current.last;
  };
  const release = () => {
    if (st.current.pointer || st.current.focus || st.current.held === null) return;
    st.current.held = null;
    redraw((n) => n + 1);
  };
  return {
    rows: (fresh) => {
      const shown = heldRows(st.current.held, fresh);
      st.current.last = shown;
      return shown;
    },
    on: {
      onPointerEnter: () => {
        st.current.pointer = true;
        hold();
      },
      onPointerLeave: () => {
        st.current.pointer = false;
        release();
      },
      onFocusIn: () => {
        st.current.focus = true;
        hold();
      },
      onFocusOut: (e: Event) => {
        const next = (e as FocusEvent).relatedTarget as Node | null;
        if (next && (e.currentTarget as Node | null)?.contains(next)) return;
        st.current.focus = false;
        release();
      },
    },
  };
}
