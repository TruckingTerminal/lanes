/**
 * The world minute the panels last drew (client batch 8a item 66, QA's reload hunt): the page loop redraws the panels
 * whenever the world's minute differs from the one they last drew, and on its one-second timer otherwise. Returns true
 * once per new minute.
 */
let panelsT = -1;
export function panelsMoved(t: number): boolean {
  if (t === panelsT) return false;
  panelsT = t;
  return true;
}
