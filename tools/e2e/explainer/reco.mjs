// Repérage : lit les textes et les boutons réels d'écrans, avec un personnage de démonstration.
// Usage : node explainer/reco.mjs <personnage> <route> [route…]
import { Film, wait } from "./lib.mjs";
import * as personas from "./personas.mjs";

const [who, ...routes] = process.argv.slice(2);
const film = new Film(`reco-${who}`, personas[who]);
await film.open();
for (const route of routes) {
  await film.goto(route);
  await wait(2500);
  const out = await film.page.evaluate(() => {
    const vis = (e) => e.offsetParent !== null && !e.closest("#xp-root");
    const text = (document.querySelector("main") ?? document.body).innerText.replace(/\n{2,}/g, "\n");
    const ctrls = [...document.querySelectorAll("button,a,[role=tab],input,select,textarea")].filter(vis)
      .map((e) => `${e.tagName.toLowerCase()}${e.getAttribute("aria-expanded") ? `[${e.getAttribute("aria-expanded")}]` : ""}:${(e.innerText || e.placeholder || e.getAttribute("aria-label") || e.value || "").replace(/\s+/g, " ").trim().slice(0, 50)}`)
      .filter((s) => !s.endsWith(":"));
    return { url: location.pathname + location.hash, text: text.slice(0, 2600), ctrls: [...new Set(ctrls)].slice(0, 70) };
  });
  console.log(`\n===== ${route} -> ${out.url}\n${out.text}\n--- contrôles : ${out.ctrls.join(" | ")}`);
}
await film.browser.close();
