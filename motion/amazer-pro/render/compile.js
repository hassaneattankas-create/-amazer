/* compile.js — frames 120 i/s -> MP4 60 i/s avec flou de mouvement (fusion de 2 images), grain, bruitages.
 *   node render/compile.js --film pub1 --name AMAZER_pub1_la-marque
 */
const path = require('path');
const { execFileSync } = require('child_process');
const ffmpeg = require(path.join(__dirname, '../../../jde-motion/node_modules/ffmpeg-static'));
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const film = opt('film', 'pub1'), name = opt('name', film), fps = +opt('fps', 120), dur = opt('duration', null);
const out = path.join(ROOT, 'out', name + '.mp4');
// Guides : voix off + bruitages mixés (audio/<film>_mix.wav) ; sinon les bruitages seuls.
const mixed = path.join(ROOT, 'audio', film + '_mix.wav');
const audio = require('fs').existsSync(mixed) ? mixed : path.join(ROOT, 'audio', film + '_sfx.wav');
const vf = (fps === 120 ? "tmix=frames=2:weights='1 1',fps=60," : '') + 'format=yuv420p,noise=c0s=5:c0f=t+u:all_seed=42';
const args = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(ROOT, 'frames', film, 'f%05d.png'),
  '-i', audio, '-filter_complex', `[0:v]${vf}[v]`, '-map', '[v]', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest'];
// Voix off : volume normalisé pour le web et les réseaux (-16 LUFS, crête vraie -1,5 dB).
if (audio === mixed) args.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000');
if (dur) args.push('-t', dur);
args.push(out);
execFileSync(ffmpeg, args, { stdio: 'inherit' });
console.log('OK', path.relative(ROOT, out));
