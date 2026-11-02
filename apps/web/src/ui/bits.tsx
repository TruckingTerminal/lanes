import type { ComponentChildren, JSX } from "preact";
import { iconUrl } from "../art.js";
import { cls } from "../format.js";

/** The small building blocks every panel is made of, styled after Trucking Terminal. */

export function Btn({
  primary,
  danger,
  ghost,
  sm,
  on,
  disabled,
  title,
  label,
  onClick,
  icon,
  type,
  children,
  class: extra,
}: {
  primary?: boolean;
  danger?: boolean;
  ghost?: boolean;
  sm?: boolean;
  on?: boolean;
  disabled?: boolean;
  title?: string;
  /** The accessible name, when the visible text alone isn't it (a ✕). */
  label?: string;
  onClick?: (ev: MouseEvent) => void;
  icon?: string;
  type?: "button" | "submit";
  children?: ComponentChildren;
  class?: string;
}): JSX.Element {
  return (
    <button type={type ?? "button"} class={cls("btn", primary && "primary", danger && "danger", ghost && "ghost", sm && "sm", on && "on", extra)} disabled={disabled} title={title} aria-label={label} aria-pressed={on} onClick={onClick}>
      {icon ? <img class="px" src={iconUrl(icon, 2)} alt="" /> : null}
      {children}
    </button>
  );
}

export function Card({ title, right, alert, sel, onClick, children, class: extra, need }: { title?: ComponentChildren; right?: ComponentChildren; alert?: boolean; sel?: boolean; onClick?: () => void; children?: ComponentChildren; class?: string; need?: string }): JSX.Element {
  return (
    <section class={cls("card", alert && "alert", sel && "sel", onClick && "clickable", extra)} onClick={onClick} data-need={need}>
      {title || right ? (
        <header class="card-head">
          {title ? <h3>{title}</h3> : <span />}
          {right ? <div class="row">{right}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** A label/value grid. */
export function Kv({ rows }: { rows: [ComponentChildren, ComponentChildren][] }): JSX.Element {
  return (
    <dl class="kv">
      {rows.map(([k, v], i) => (
        <>
          <dt key={`k${i}`}>{k}</dt>
          <dd key={`v${i}`}>{v}</dd>
        </>
      ))}
    </dl>
  );
}

export function Pixel({ src, alt, class: extra }: { src: string; alt: string; class?: string }): JSX.Element {
  return <img class={cls("px", extra)} src={src} alt={alt} />;
}

export function Num({ children, class: extra, title }: { children?: ComponentChildren; class?: string; title?: string }): JSX.Element {
  return (
    <span class={cls("num", extra)} title={title}>
      {children}
    </span>
  );
}

export function Muted({ children, small }: { children?: ComponentChildren; small?: boolean }): JSX.Element {
  return <p class={cls("muted", small && "small")}>{children}</p>;
}

export function Label({ children, for: htmlFor }: { children?: ComponentChildren; for?: string }): JSX.Element {
  return (
    <label class="label" for={htmlFor}>
      {children}
    </label>
  );
}

export function Badge({ tone, children, title }: { tone?: "live" | "test" | "warn" | "alert" | "good" | "muted"; children?: ComponentChildren; title?: string }): JSX.Element {
  return (
    <span class={cls("badge", tone)} title={title}>
      {children}
    </span>
  );
}

/** A thin bar for conditions and shares. */
export function Bar({ share, tone }: { share: number; tone?: string }): JSX.Element {
  return (
    <span class="bar">
      <i style={{ width: `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`, background: tone }} />
    </span>
  );
}

export function Panel({ title, right, children }: { title: ComponentChildren; right?: ComponentChildren; children?: ComponentChildren }): JSX.Element {
  return (
    <div class="stack">
      <header class="panel-head">
        <h2>{title}</h2>
        {right ? <div class="row">{right}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function Sparkline({ values, color }: { values: number[]; color: string }): JSX.Element | null {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 200).toFixed(1)},${(44 - ((v - lo) / span) * 40).toFixed(1)}`).join(" ");
  return (
    <svg class="spark" viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke={color} stroke-width="2" points={pts} />
    </svg>
  );
}
