import type { JSX } from "preact";
import { GAME_CONFIG } from "../../game.js";
import { guidePages } from "../../guide.js";
import { bumpData, S, TEST_BUILD, useData } from "../../state.js";
import { Btn, Panel } from "../bits.js";
import { SCENES } from "../../assets.js";
import { Scene } from "../Loop.js";

const DOCS_URL = TEST_BUILD ? "docs.html" : "https://truckingterminal.github.io/lanes-play/docs.html";

export function Guide(): JSX.Element {
  useData();
  const pages = guidePages(GAME_CONFIG);
  const page = pages.find((p) => p.id === S.guidePage) ?? pages[0]!;
  const sections = [...new Set(pages.map((p) => p.section))];
  const i = pages.indexOf(page);
  const go = (id: string) => {
    S.guidePage = id;
    bumpData();
    document.querySelector(".panelbox")?.scrollTo(0, 0);
  };
  const step = (p: (typeof pages)[number] | undefined, label: string) => (p ? <Btn onClick={() => go(p.id)}>{label}: {p.title}</Btn> : null);
  const onClick = (ev: MouseEvent) => {
    // Links between guide pages inside the page's own HTML.
    const el = (ev.target as HTMLElement).closest<HTMLElement>("[data-page]");
    if (el?.dataset.page) {
      ev.preventDefault();
      go(el.dataset.page);
    }
  };
  return (
    <Panel title="Guide">
      <Scene name="guide" still={SCENES.guide} alt="A diner booth with the road atlas" />
      <section class="card guide" onClick={onClick}>
        <span class="label">{page.section}</span>
        <h3>{page.title}</h3>
        <div dangerouslySetInnerHTML={{ __html: page.html }} />
        <div class="row">
          {step(pages[i - 1], "Back")}
          {step(pages[i + 1], "Next")}
        </div>
      </section>
      {sections.map((s) => (
        <div class="guidenav" key={s}>
          <span class="label">{s}</span>
          {pages
            .filter((p) => p.section === s)
            .map((p) => (
              <Btn sm key={p.id} on={p.id === page.id} onClick={() => go(p.id)}>
                {p.title}
              </Btn>
            ))}
        </div>
      ))}
      <p class="muted small">
        Every page, on one screen:{" "}
        <a href={DOCS_URL} target="_blank" rel="noopener">
          the LANES docs
        </a>
        .
      </p>
    </Panel>
  );
}
