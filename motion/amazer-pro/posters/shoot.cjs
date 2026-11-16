// Rend chaque affiche en PNG 1080×1080 (et une version 2160×2160 nette pour l'impression).
const path = require("path");
const { pathToFileURL } = require("url");
const puppeteer = require(path.join(__dirname, "../../../jde-motion/node_modules/puppeteer"));
(async () => {
  const out = process.argv[2];
  const b = await puppeteer.launch({ headless: true, args: ["--allow-file-access-from-files"] });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 2200, deviceScaleFactor: 2 });
  await p.goto(pathToFileURL(path.join(__dirname, "poster.html")).href, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  for (const id of ["stations", "pharmacies"]) {
    const el = await p.$(`#${id}`);
    await el.screenshot({ path: path.join(out, `AMAZER_${id}.png`) });
  }
  await b.close();
  console.log("ok");
})();
