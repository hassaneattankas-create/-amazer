/* render.js — rendu image par image d'un film (window.seek) en PNG 1080×1080.
 *   node render/render.js --film pub1                    rendu complet -> frames/pub1/
 *   node render/render.js --film pub1 --times 1,4.5,9    images de contrôle -> qa/pub1/
 *   node render/render.js --film pub1 --cues             écrit audio/pub1.cues.json
 * Reprenable (images valides ignorées). Le navigateur est relancé régulièrement :
 * Chrome finit par se bloquer après une centaine de captures.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require(path.join(__dirname, '../../../jde-motion/node_modules/puppeteer'));

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const has = n => argv.includes('--' + n);
const FILM = opt('film', 'pub1'), FPS = +opt('fps', 60), WORKERS = +opt('workers', 4), BATCH = +opt('batch', 60);
const times = opt('times', null);
const OUT = path.join(ROOT, times ? 'qa' : 'frames', FILM);
// Films à personnages (verticaux) : --page toon.html --w 1080 --h 1920
const PAGE = opt('page', FILM.startsWith('toon') ? 'toon.html' : 'index.html');
const VW = +opt('w', 1080), VH = +opt('h', PAGE === 'toon.html' ? 1920 : 1080);
const url = pathToFileURL(path.join(ROOT, PAGE)).href + '?film=' + FILM;
const launch = () => puppeteer.launch({ headless: true, protocolTimeout: 90000, args: ['--allow-file-access-from-files'] });

async function openPage(browser) {
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('pageerror:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
  await page.setViewport({ width: VW, height: VH });
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => window.JDE_READY);
  return page;
}

(async () => {
  if (has('cues')) {
    const b = await launch(); const page = await openPage(b);
    const info = await page.evaluate(() => ({ duration: FILM.duration, cues: FILM.cues }));
    fs.mkdirSync(path.join(ROOT, 'audio'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'audio', FILM + '.cues.json'), JSON.stringify(info, null, 1));
    console.log(`${info.cues.length} sons -> audio/${FILM}.cues.json`);
    await b.close(); return;
  }
  fs.mkdirSync(OUT, { recursive: true });
  let duration = +opt('duration', 0);
  if (!duration) { const b = await launch(); const p = await openPage(b); duration = await p.evaluate(() => FILM.duration); await b.close(); }
  const T0 = +opt('from', 0), T1 = +opt('to', duration);
  const jobs = times
    ? times.split(',').map(Number).map(t => ({ t, file: `t${t.toFixed(2).padStart(6, '0')}.png` }))
    : Array.from({ length: Math.round((T1 - T0) * FPS) }, (_, k) => { const i = Math.round(T0 * FPS) + k; return { t: i / FPS, file: `f${String(i).padStart(5, '0')}.png` }; });
  const todo = times ? jobs : jobs.filter(j => { try { return fs.statSync(path.join(OUT, j.file)).size < 1024; } catch { return true; } });
  console.log(`${todo.length} image(s) a rendre -> ${path.relative(ROOT, OUT)}`);
  const t0 = Date.now(); let done = 0;
  for (let i = 0; i < todo.length; i += BATCH * WORKERS) {
    const slice = todo.slice(i, i + BATCH * WORKERS);
    for (let attempt = 1; ; attempt++) {
      const browser = await launch();
      try {
        let next = 0;
        await Promise.all(Array.from({ length: Math.min(WORKERS, slice.length) }, async () => {
          const page = await openPage(browser);
          const stage = await page.$('#stage');
          while (next < slice.length) {
            const j = slice[next++];
            const f = path.join(OUT, j.file);
            if (!times && attempt > 1 && fs.existsSync(f) && fs.statSync(f).size > 1024) continue;
            await page.evaluate(t => window.seek(t), j.t);
            await stage.screenshot({ path: f, optimizeForSpeed: true });
            done++;
          }
          await page.close();
        }));
        await browser.close();
        break;
      } catch (e) {
        await browser.close().catch(() => {});
        if (attempt >= 3) throw e;
        console.log(`  relance du navigateur (essai ${attempt + 1}) : ${e.message.slice(0, 80)}`);
      }
    }
    console.log(`  ${Math.min(i + slice.length, todo.length)}/${todo.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  console.log(`OK ${todo.length} image(s) en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
})().catch(e => { console.error(e); process.exit(1); });
