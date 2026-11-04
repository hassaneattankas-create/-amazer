// Lit le texte réel des pages publiques pour écrire une narration exacte.
import { Film, wait } from "./lib.mjs";

const film = new Film("lecture");
await film.open();
for (const route of process.argv.slice(2)) {
  await film.goto(route);
  await wait(2500);
  const text = await film.page.evaluate(() => document.querySelector("main")?.innerText ?? document.body.innerText);
  console.log(`\n===== ${route}\n${text.replace(/\n{2,}/g, "\n").slice(0, 3800)}`);
}
await film.browser.close();
