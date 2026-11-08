// Exploration pas à pas : node explainer/explore.mjs <personnage> "goto:/x" "click:Texte" "dump" …
import { Film, wait } from "./lib.mjs";
import * as personas from "./personas.mjs";

const [who, ...steps] = process.argv.slice(2);
const f = new Film(`explore-${who}`, personas[who]);
await f.open();
const dump = async () => {
  const out = await f.page.evaluate(() => {
    const vis = (e) => e.offsetParent !== null && !e.closest("#xp-root");
    const text = (document.querySelector("main") ?? document.body).innerText.replace(/\n{2,}/g, "\n");
    const ctrls = [...document.querySelectorAll("button,a,[role=tab],input,select,textarea,label")].filter(vis)
      .map((e) => `${e.tagName.toLowerCase()}:${(e.innerText || e.placeholder || e.getAttribute("aria-label") || e.value || "").replace(/\s+/g, " ").trim().slice(0, 45)}`).filter((s) => !s.endsWith(":"));
    return { url: location.pathname + location.search + location.hash, text: text.slice(0, 2200), ctrls: [...new Set(ctrls)].filter((c) => !/Installer l|amazer.niger2|Conditions d|Politique de|Suppression de|Signaler un|Devenir livreur|Guide du vendeur|Espace station|Formations gratuites|Affiliation|Revendre sans stock|Devenir vendeur|Comment ça marche|Stations-essence|^a:Pharmacies$|Premium : hôtels|^a:Restaurants$|^a:Promotions$|^a:Boutiques$|^a:AMAZER$|^button:Menu$|Pays, devise|^a:Notifications$|^a:Panier$/.test(c)).slice(0, 60) };
  });
  console.log(`\n===== ${out.url}\n${out.text}\n--- contrôles : ${out.ctrls.join(" | ")}`);
};
for (const s of steps) {
  const [k, ...rest] = s.split(":");
  const v = rest.join(":");
  if (k === "goto") await f.goto(v);
  else if (k === "click") console.log(`clic ${v} :`, await f.click(v, { selector: "button,a,[role=tab],[role=radio],label,summary,input" }));
  else if (k === "type") { const [field, val] = v.split("="); await f.type(field, val); }
  else if (k === "wait") await wait(Number(v));
  else if (k === "dump") await dump();
}
await f.browser.close();
