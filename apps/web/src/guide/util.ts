/** One page of the guide. `section` groups pages in the navigation. */
export interface GuidePage {
  id: string;
  section: string;
  title: string;
  html: string;
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const n = (x: number) => Math.round(x).toLocaleString("en-US");
export const p = (s: string) => `<p>${s}</p>`;
export const ul = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
export const h = (s: string) => `<h4>${s}</h4>`;
export const table = (head: string[], rows: (string | number)[][]) =>
  `<table><tr>${head.map((x) => `<th>${x}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join("")}</tr>`).join("")}</table>`;
/** A link to another page of the guide. */
export const see = (id: string, title: string) => `<a href="#${id}" data-act="guide" data-page="${id}">${title}</a>`;
