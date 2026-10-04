/* ============================================================================
 *  render_pipeline.js — rendu frame par frame de index.html via Puppeteer
 *  ----------------------------------------------------------------------------
 *  Pour chaque frame i de 0 a 1799 :
 *      window.seek(i / 60)  ->  capture 1920x1080  ->  frames/frame_%05d.png
 *
 *  Le temps est pilote exclusivement depuis Node : aucune horloge dans la page.
 *  Le script est reprenable (les frames deja valides sont ignorees) et
 *  auto-verifiant (echec si une frame manque ou pese moins de 1 Ko).
 *
 *  Usage :
 *    node render_pipeline.js                 rendu complet (reprise auto)
 *    node render_pipeline.js --force         re-rend tout
 *    node render_pipeline.js --frames 0,300,900,1799   frames de controle
 *    node render_pipeline.js --range 600-900 plage de frames
 *    node render_pipeline.js --workers 2     nombre d'onglets paralleles
 *    node render_pipeline.js --out preview   dossier de sortie alternatif
 * ========================================================================== */

const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = __dirname;
const FPS = 60;
const DURATION = 30.0;
const TOTAL = Math.round(FPS * DURATION);      // 1800
const WIDTH = 1920, HEIGHT = 1080;
const MIN_BYTES = 1024;

/* ------------------------------- arguments ------------------------------- */
const argv = process.argv.slice(2);
function flag(name) { return argv.includes('--' + name); }
function opt(name, dflt) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}

const FORCE = flag('force');
const OUT_DIR = path.join(ROOT, opt('out', 'frames'));
const WORKERS = Math.max(1, Math.min(6, parseInt(opt('workers', String(
  Math.max(1, Math.min(4, Math.floor((os.cpus().length || 4) / 2)))
)), 10) || 1));

let FRAME_LIST;
if (opt('frames', null)) {
  FRAME_LIST = opt('frames').split(',').map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n) && n >= 0 && n < TOTAL);
} else if (opt('range', null)) {
  const m = /^(\d+)-(\d+)$/.exec(opt('range'));
  if (!m) { console.error('--range attend le format debut-fin'); process.exit(2); }
  FRAME_LIST = [];
  for (let i = +m[1]; i <= Math.min(+m[2], TOTAL - 1); i++) FRAME_LIST.push(i);
} else {
  FRAME_LIST = Array.from({ length: TOTAL }, (_, i) => i);
}

/* ------------------------------- utilitaires ----------------------------- */
const pad5 = n => String(n).padStart(5, '0');
const framePath = i => path.join(OUT_DIR, 'frame_' + pad5(i) + '.png');

function isValidFrame(i) {
  try { return fs.statSync(framePath(i)).size >= MIN_BYTES; }
  catch (e) { return false; }
}
function fmtDur(s) {
  if (!isFinite(s)) return '--';
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return m > 0 ? m + ' min ' + String(r).padStart(2, '0') + ' s' : r + ' s';
}

/* ----------------------------- rendu principal --------------------------- */
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const indexPath = path.join(ROOT, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('index.html absent — lancer d abord : node build.js');
    process.exit(2);
  }

  const todo = FORCE ? FRAME_LIST.slice() : FRAME_LIST.filter(i => !isValidFrame(i));
  const skipped = FRAME_LIST.length - todo.length;

  console.log('— JDE · pipeline de rendu ———————————————————————————');
  console.log('  sortie      : ' + path.relative(ROOT, OUT_DIR) + path.sep);
  console.log('  resolution  : ' + WIDTH + 'x' + HEIGHT + ' @ ' + FPS + ' fps');
  console.log('  frames      : ' + FRAME_LIST.length + ' demandees, ' +
              skipped + ' deja presentes, ' + todo.length + ' a rendre');
  console.log('  onglets     : ' + WORKERS);
  console.log('———————————————————————————————————————————————————————');

  if (!todo.length) { console.log('Rien a faire.'); return verify(); }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--allow-file-access-from-files',
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--force-color-profile=srgb',
      '--disable-gpu-vsync',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-sandbox',
      '--disable-dev-shm-usage'
    ],
    defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 }
  });

  const url = 'file:///' + indexPath.replace(/\\/g, '/') + '?render=1';
  const pageErrors = [];
  let done = 0;
  const t0 = Date.now();
  let cursor = 0;
  const lock = { next: () => (cursor < todo.length ? todo[cursor++] : null) };

  async function makeWorker(id) {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    page.on('pageerror', e => pageErrors.push('[page ' + id + '] ' + e.message));
    page.on('console', m => {
      const txt = m.text();
      // l'absence de assets/logo-men.* est un cas nominal (lockup de substitution)
      const benign = /ERR_FILE_NOT_FOUND/.test(txt) || /logo-men/.test(txt);
      if (m.type() === 'error' && !benign) pageErrors.push('[console ' + id + '] ' + txt);
      else if (id === 0 && /^\[JDE\]/.test(txt)) console.log('  ' + txt);
    });
    page.on('requestfailed', r => {
      // les polices/logos absents sont tolerables, on les signale une fois
      if (id === 0) console.log('  · ressource non chargee : ' + r.url().split('/').pop());
    });

    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('window.__READY__ === true', { timeout: 60000 });

    const initErr = await page.evaluate('window.__INIT_ERROR__');
    if (initErr) pageErrors.push('[init ' + id + '] ' + initErr);

    const cdp = await page.createCDPSession();

    let i;
    while ((i = lock.next()) !== null) {
      await page.evaluate('window.seek(' + (i / FPS) + ')');
      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 },
        captureBeyondViewport: false,
        optimizeForSpeed: true
      });
      fs.writeFileSync(framePath(i), Buffer.from(shot.data, 'base64'));
      done++;
      if (done % 25 === 0 || done === todo.length) {
        const el = (Date.now() - t0) / 1000;
        const rate = done / el;
        process.stdout.write('\r  ' + String(done).padStart(4) + '/' + todo.length +
          '  (' + (100 * done / todo.length).toFixed(1) + '%)  ' +
          rate.toFixed(1) + ' f/s  reste ~' + fmtDur((todo.length - done) / rate) + '      ');
      }
    }
    await page.close();
  }

  const workers = [];
  for (let k = 0; k < WORKERS; k++) workers.push(makeWorker(k));
  await Promise.all(workers);
  await browser.close();

  process.stdout.write('\n');
  console.log('  rendu termine en ' + fmtDur((Date.now() - t0) / 1000));

  if (pageErrors.length) {
    console.error('\n!! erreurs rapportees par la page :');
    [...new Set(pageErrors)].slice(0, 20).forEach(e => console.error('   ' + e));
    process.exitCode = 1;
  }
  return verify();
}

/* ------------------------------ verification ----------------------------- */
function verify() {
  const missing = [], tiny = [];
  for (const i of FRAME_LIST) {
    let st = null;
    try { st = fs.statSync(framePath(i)); } catch (e) { missing.push(i); continue; }
    if (st.size < MIN_BYTES) tiny.push(i);
  }
  if (missing.length || tiny.length) {
    console.error('!! verification echouee — ' + missing.length + ' frame(s) manquante(s), ' +
                  tiny.length + ' frame(s) suspecte(s)');
    if (missing.length) console.error('   manquantes : ' + missing.slice(0, 12).join(', ') +
                                      (missing.length > 12 ? ' …' : ''));
    process.exitCode = 1;
    return false;
  }
  const total = FRAME_LIST.reduce((a, i) => a + fs.statSync(framePath(i)).size, 0);
  console.log('  verification OK — ' + FRAME_LIST.length + ' frames, ' +
              (total / 1048576).toFixed(0) + ' Mo');
  return true;
}

main().catch(e => {
  console.error('\n!! echec du pipeline :\n' + (e && e.stack || e));
  process.exit(1);
});
