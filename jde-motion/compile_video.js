/* ============================================================================
 *  compile_video.js — assemblage FFmpeg des frames en output.mp4
 *  ----------------------------------------------------------------------------
 *  - verifie que les 1800 frames sont presentes
 *  - detecte une piste audio a la racine : voice.* puis music.* puis audio.*
 *    (si voix ET musique sont presentes, elles sont mixees, musique a -16 dB)
 *  - sinon injecte une piste silencieuse pour garantir l'encodage
 *  - encode en H.264 / yuv420p / CRF 16 / 60 fps, +faststart
 *
 *  Usage :
 *    node compile_video.js                sortie output.mp4
 *    node compile_video.js --out foo.mp4  autre nom de sortie
 *    node compile_video.js --crf 18       qualite
 *    node compile_video.js --no-audio     aucune piste audio du tout
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const ROOT = __dirname;
const FPS = 60, TOTAL = 1800;
const FRAMES = path.join(ROOT, 'frames');

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const flag = n => argv.includes('--' + n);

const OUT = path.resolve(ROOT, opt('out', 'output.mp4'));
const CRF = opt('crf', '16');

/* ---------------------------- verifications ------------------------------ */
const missing = [];
for (let i = 0; i < TOTAL; i++) {
  const f = path.join(FRAMES, 'frame_' + String(i).padStart(5, '0') + '.png');
  let st = null;
  try { st = fs.statSync(f); } catch (e) { missing.push(i); continue; }
  if (st.size < 1024) missing.push(i);
}
if (missing.length) {
  console.error('!! ' + missing.length + ' frame(s) manquante(s) ou invalide(s) : ' +
                missing.slice(0, 15).join(', ') + (missing.length > 15 ? ' …' : ''));
  console.error('   relancer : node render_pipeline.js');
  process.exit(2);
}
console.log('  ' + TOTAL + ' frames verifiees.');

/* ------------------------------ piste audio ------------------------------ */
function findAudio(base) {
  for (const ext of ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'flac']) {
    const p = path.join(ROOT, base + '.' + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const voice = flag('no-audio') ? null : findAudio('voice');
const music = flag('no-audio') ? null : findAudio('music');
const generic = flag('no-audio') ? null : findAudio('audio');

const args = ['-y', '-hide_banner', '-loglevel', 'error', '-stats',
              '-framerate', String(FPS),
              '-i', path.join(FRAMES, 'frame_%05d.png')];

let audioDesc, filter = null, amap = null;

if (voice && music) {
  args.push('-i', voice, '-i', music);
  filter = '[2:a]volume=-16dB[m];[1:a][m]amix=inputs=2:duration=first:dropout_transition=0[aout]';
  amap = '[aout]';
  audioDesc = 'voix (' + path.basename(voice) + ') + musique (' + path.basename(music) + ', -16 dB)';
} else if (voice || music || generic) {
  const a = voice || music || generic;
  args.push('-i', a);
  audioDesc = path.basename(a);
} else {
  args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
  audioDesc = 'piste silencieuse generee (aucun fichier voice/music/audio trouve)';
}

if (filter) args.push('-filter_complex', filter, '-map', '0:v', '-map', amap);
else args.push('-map', '0:v', '-map', '1:a');

args.push(
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', CRF,
  '-pix_fmt', 'yuv420p',
  '-r', String(FPS),
  '-g', '120',
  '-profile:v', 'high', '-level', '4.2',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-shortest',
  '-movflags', '+faststart',
  OUT
);

console.log('  audio      : ' + audioDesc);
console.log('  encodage   : H.264 CRF ' + CRF + ', yuv420p, ' + FPS + ' fps');
console.log('  sortie     : ' + OUT);
console.log('———————————————————————————————————————————————————————');

const r = spawnSync(ffmpegPath, args, { stdio: 'inherit' });
if (r.status !== 0) {
  console.error('!! FFmpeg a echoue (code ' + r.status + ')');
  process.exit(r.status || 1);
}

const size = fs.statSync(OUT).size;
console.log('\n  ✓ ' + path.basename(OUT) + ' — ' + (size / 1048576).toFixed(1) + ' Mo, ' +
            (TOTAL / FPS).toFixed(2) + ' s, 1920x1080 @ ' + FPS + ' fps');
