/* contact_sheet.js — planche-contact : rend N frames reparties sur la duree
 * et les assemble en une seule image pour relecture rapide.
 * Usage : node contact_sheet.js [nb=24] [cols=4]
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('ffmpeg-static');

const N = parseInt(process.argv[2] || '24', 10);
const COLS = parseInt(process.argv[3] || '4', 10);
const TOTAL = 1800;
const dir = path.join(__dirname, 'preview');

const frames = [];
for (let i = 0; i < N; i++) frames.push(Math.min(TOTAL - 1, Math.round(i * (TOTAL - 1) / (N - 1))));

execFileSync(process.execPath,
  [path.join(__dirname, 'render_pipeline.js'), '--out', 'preview', '--frames', frames.join(','), '--workers', '3'],
  { stdio: 'inherit' });

// renumerotation sequentielle pour le motif ffmpeg
const tmp = path.join(dir, 'seq');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
frames.forEach((f, k) => {
  fs.copyFileSync(path.join(dir, 'frame_' + String(f).padStart(5, '0') + '.png'),
                  path.join(tmp, 'c_' + String(k).padStart(3, '0') + '.png'));
});
const rows = Math.ceil(N / COLS);
execFileSync(ffmpeg, [
  '-y', '-framerate', '1', '-i', path.join(tmp, 'c_%03d.png'),
  '-vf', `scale=480:-1,tile=${COLS}x${rows}:margin=6:padding=4:color=0x111820`,
  '-frames:v', '1', path.join(__dirname, 'contact_sheet.png')
], { stdio: 'ignore' });
console.log('planche-contact : contact_sheet.png (' + frames.join(', ') + ')');
