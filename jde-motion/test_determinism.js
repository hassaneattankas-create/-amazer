/* ============================================================================
 *  test_determinism.js — verifie le contrat de RULES.md §1
 *  ----------------------------------------------------------------------------
 *  Pour chaque instant teste, on compare :
 *    A. le rendu obtenu par un seek(t) direct sur une page fraiche ;
 *    B. le rendu obtenu apres un parcours desordonne (29.9 -> 0 -> 17.3 -> t).
 *  Les deux images doivent etre strictement identiques (hash SHA-256).
 *
 *  Usage : node test_determinism.js
 * ========================================================================== */

const crypto = require('crypto');
const path = require('path');
const puppeteer = require('puppeteer');

const TIMES = [0, 2.5, 4.6, 4.9, 7.0, 9.45, 9.7, 12.55, 15.5, 15.7,
               18.05, 21.5, 22.4, 25.3, 26.03, 29.9];
const W = 1920, H = 1080;

(async () => {
  const url = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/') + '?render=1';
  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 180000,
    args: ['--allow-file-access-from-files', '--font-render-hinting=none', '--disable-lcd-text',
           '--force-color-profile=srgb', '--no-sandbox', '--disable-dev-shm-usage',
           '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
           '--disable-background-timer-throttling'],
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 }
  });

  async function openPage() {
    const p = await browser.newPage();
    await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await p.goto(url, { waitUntil: 'load', timeout: 60000 });
    await p.waitForFunction('window.__READY__ === true', { timeout: 60000 });
    return { page: p, cdp: await p.createCDPSession() };
  }

  async function shot(cdp, page) {
    // un onglet en arriere-plan est throttle : on le ramene devant avant capture
    await page.bringToFront();
    const s = await cdp.send('Page.captureScreenshot', {
      format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 },
      captureBeyondViewport: false, optimizeForSpeed: true
    });
    return crypto.createHash('sha256').update(Buffer.from(s.data, 'base64')).digest('hex');
  }

  const a = await openPage();   // parcours direct
  const b = await openPage();   // parcours desordonne

  let ok = 0, fail = 0;
  console.log('— test de determinisme ————————————————————————————');
  for (const t of TIMES) {
    await a.page.evaluate('window.seek(' + t + ')');
    const ha = await shot(a.cdp, a.page);

    await b.page.evaluate('window.seek(29.9); window.seek(0); window.seek(17.3); window.seek(' + t + ');');
    const hb = await shot(b.cdp, b.page);

    const same = ha === hb;
    if (same) ok++; else fail++;
    console.log('  t = ' + String(t).padStart(6) + ' s  ' + (same ? 'identique' : '!! DIVERGENT') +
                '   ' + ha.slice(0, 12) + (same ? '' : ' != ' + hb.slice(0, 12)));
  }
  console.log('———————————————————————————————————————————————————————');
  console.log('  ' + ok + ' identiques, ' + fail + ' divergents');

  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
