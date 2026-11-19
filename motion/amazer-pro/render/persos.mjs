// Images des personnages (PNG, fond transparent) pour les présentations de l'Assistant et d'autres montages.
// Usage : node render/persos.mjs [dossier de sortie]   (défaut : assets/persos)
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
const puppeteer = createRequire(import.meta.url)(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../jde-motion/node_modules/puppeteer'));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'assets', 'persos'));
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ headless: true, args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  const url = (pose) => `${pathToFileURL(path.join(ROOT, 'persos.html')).href}?pose=${pose}`;
  await page.goto(url('trio'));
  await page.waitForFunction(() => window.READY);
  const poses = await page.evaluate(() => window.POSES);
  for (const pose of poses) {
    await page.goto(url(pose));
    await page.waitForFunction(() => window.READY);
    const box = await page.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { w: r.width, h: r.height }; });
    await page.setViewport({ width: Math.ceil(box.w), height: Math.ceil(box.h), deviceScaleFactor: 1 });
    await (await page.$('#stage')).screenshot({ path: path.join(OUT, `${pose}.png`), omitBackground: true });
    console.log('ok', pose);
  }
} finally {
  await browser.close();
}
