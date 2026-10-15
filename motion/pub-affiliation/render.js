/* Rendu image par image de index.html (window.seek), reprenable et auto-verifiant.
 * Reutilise puppeteer de jde-motion/ (aucune installation supplementaire).
 * Usage : node render.js [--workers 4] [--frames 0,600,1799] [--out frames] [--force]
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require(path.join(__dirname, '../../jde-motion/node_modules/puppeteer'));

const FPS = 60, DURATION = 30, TOTAL = FPS * DURATION;
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = path.join(__dirname, opt('out', 'frames'));
const WORKERS = parseInt(opt('workers', '4'), 10);
const FORCE = argv.includes('--force');
const list = opt('frames', null)
  ? opt('frames').split(',').map(Number)
  : Array.from({ length: TOTAL }, (_, i) => i);
const file = i => path.join(OUT, 'frame_' + String(i).padStart(5, '0') + '.png');
const valid = i => { try { return fs.statSync(file(i)).size >= 1024; } catch { return false; } };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const todo = list.filter(i => FORCE || !valid(i));
  console.log(`${todo.length} image(s) a rendre (${list.length - todo.length} deja valides).`);
  const browser = await puppeteer.launch({ headless: true, args: ['--allow-file-access-from-files'] });
  const url = pathToFileURL(path.join(__dirname, 'index.html')).href;
  let next = 0, done = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: 'load' });
    const ok = await page.evaluate(() => window.ready);
    if (!ok) throw new Error('logo introuvable (mark.svg)');
    while (next < todo.length) {
      const i = todo[next++];
      const data = await page.evaluate(t => { window.seek(t); return document.getElementById('c').toDataURL('image/png'); }, i / FPS);
      fs.writeFileSync(file(i), Buffer.from(data.split(',')[1], 'base64'));
      if (++done % 120 === 0) console.log(`  ${done}/${todo.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    await page.close();
  }));
  await browser.close();
  const bad = list.filter(i => !valid(i));
  if (bad.length) { console.error(`!! ${bad.length} image(s) invalide(s) : ${bad.slice(0, 10).join(', ')}`); process.exit(2); }
  console.log(`OK ${list.length} images verifiees en ${((Date.now() - t0) / 1000).toFixed(0)} s.`);
})().catch(e => { console.error(e); process.exit(1); });
