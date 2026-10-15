/* Determinisme : seek(t) apres un saut doit donner exactement la meme image qu'a froid. */
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const puppeteer = require(path.join(__dirname, '../../jde-motion/node_modules/puppeteer'));

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--allow-file-access-from-files'] });
  const url = pathToFileURL(path.join(__dirname, 'index.html')).href;
  const shot = async (seq) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => window.ready);
    let data;
    for (const t of seq) data = await page.evaluate(x => { window.seek(x); return document.getElementById('c').toDataURL('image/png'); }, t);
    await page.close();
    return crypto.createHash('sha256').update(data).digest('hex');
  };
  let fail = 0;
  for (const t of [1.2, 7.6, 12.0, 16.8, 20.5, 29.98]) {
    const cold = await shot([t]);
    const warm = await shot([29, 3.3, t]);
    const ok = cold === warm;
    if (!ok) fail++;
    console.log(`${ok ? 'OK ' : 'ECHEC'} t=${t}s ${cold.slice(0, 12)}`);
  }
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
