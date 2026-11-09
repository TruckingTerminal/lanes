/**
 * After a deploy, the page a returning player gets (QA, client pass 2): GitHub Pages serves every file with its own
 * ten-minute cache and lets a site set no headers, so the plain URL kept the old client until a query string forced the
 * new one. The site build stamps its build (CI's commit) into the page and writes it beside it as version.json
 * (build.mjs); on load the page asks for that file past every cache, and when the deployed build is another, it reloads
 * once at `?v={build}`, a URL no cache has seen. Once per build, so a CDN still serving the old page can never loop it.
 * Local builds and previews carry "local" and never ask.
 */
declare const __LANES_BUILD__: string | undefined;
export const BUILD: string = typeof __LANES_BUILD__ !== "undefined" ? __LANES_BUILD__ : "local";
const RELOADED = "lanes.build.reloaded";

/** The URL to reload at for a newer build, or null to stay: same build, a local one, or this build already tried once. */
export function reloadTarget(here: string, mine: string, deployed: unknown, tried: string | null): string | null {
  if (mine === "local" || typeof deployed !== "string" || deployed === "" || deployed === mine || tried === deployed) return null;
  const u = new URL(here);
  u.searchParams.set("v", deployed);
  return u.toString();
}

export async function checkVersion(): Promise<void> {
  if (BUILD === "local") return;
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return;
    const deployed = ((await r.json()) as { build?: unknown } | null)?.build;
    const to = reloadTarget(location.href, BUILD, deployed, sessionStorage.getItem(RELOADED));
    if (!to) return;
    sessionStorage.setItem(RELOADED, deployed as string);
    location.replace(to);
  } catch {
    /* offline, a private window's storage, a page with no version.json beside it: play on this build */
  }
}
