/* toon-make.mjs — fabrique une pub à personnages AMAZER à partir d'un script JSON, en une commande.
 *
 *   node toon-make.mjs scripts/toon2.json            film complet (voix, images 120 i/s + flou, sons, MP4 HD + léger)
 *   node toon-make.mjs scripts/toon2.json --apercu   voix + 12 images de contrôle (planche) en ~1 min, sans rendu complet
 *   options : --fps 60 (plus rapide, sans flou de mouvement) · --workers 6
 *
 * Script : { id, titre, voix?, vitesse?, tenue?, scenes: [ { type, voix: "texte dit", ...paramètres de la scène } ] }
 * Types : rue_chaleur, maison_ombre, ecrans, boutique, moto, portail, fin (voir TOON.md).
 * Sortie (dernière ligne, JSON) : { video, leger, planche, duree }.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const has = n => argv.includes('--' + n);
const FFMPEG = path.join(ROOT, '..', '..', 'jde-motion', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
const PY = process.env.PYTHON || 'python';
const run = (cmd, args, o = {}) => execFileSync(cmd, args, { cwd: ROOT, stdio: o.quiet ? 'pipe' : 'inherit', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
const log = m => console.log('· ' + m);

const file = argv.find(a => !a.startsWith('--'));
if (!file) { console.error('Usage : node toon-make.mjs scripts/<id>.json [--apercu]'); process.exit(1); }
const script = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf-8'));
const id = String(script.id || path.basename(file, '.json')).replace(/[^a-z0-9_-]/gi, '');
if (!/^toon/.test(id)) throw new Error("L'identifiant du film doit commencer par « toon » (ex. toon2).");

/* durée minimale de chaque type de scène (s) : la voix peut être plus longue, la scène suit */
const MIN = { rue_chaleur: 4.0, maison_ombre: 2.3, boutique: 4.4, moto: 4.8, portail: 4.6, fin: 5.5 };
const minFor = sc => {
  if (sc.type === 'ecrans') { const e = sc.ecrans ?? []; return Math.max(2.5, (e.length ? e[e.length - 1].de ?? 0 : 0) + (sc.fin ?? 1.6)); }
  if (sc.type === 'moto' && !sc.ecran) return 3.4;
  return MIN[sc.type] ?? 3;
};

// 1. voix off : une phrase par scène, chaque scène garde au moins sa durée minimale
const guide = {
  title: script.titre ?? id, voice: script.voix ?? 'fr-FR-DeniseNeural', rate: script.vitesse ?? '+6%', lead: .35,
  segments: script.scenes.map((sc, i) => {
    const seg = { id: 's' + (i + 1), text: sc.voix || '…', pause: .3, slot: sc.duree ?? minFor(sc) };
    if (sc.sous_titres_voix) seg.captions = sc.sous_titres_voix;
    return seg;
  }),
};
fs.mkdirSync(path.join(ROOT, 'guides'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'guides', id + '.json'), JSON.stringify(guide, null, 1));
log('voix off…');
run(PY, ['audio/voice.py', id]);

// 2. cibles nommées -> coordonnées (assets/screens/positions.json, relevé au tournage des vrais écrans)
const POS = fs.existsSync(path.join(ROOT, 'assets', 'screens', 'positions.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'screens', 'positions.json'), 'utf-8')) : {};
const plain = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const where = (img, cible) => {
  const key = path.basename(String(img)).replace(/\.png$/, '').replace(/-long$/, '');
  const pos = POS[key] || {};
  const want = plain(cible);
  const hit = Object.keys(pos).find(k => plain(k) === want) || Object.keys(pos).find(k => plain(k).startsWith(want)) || Object.keys(pos).find(k => plain(k).includes(want));
  if (!hit) throw new Error(`Cible « ${cible} » introuvable sur l'écran ${key}. Cibles : ${Object.keys(pos).slice(0, 40).join(' | ')}`);
  return pos[hit];
};
const resolveItem = (it, img) => {
  const o = { ...it };
  o.img = String(img || '').startsWith('assets/') ? img : `assets/screens/${img}`;
  // écran demandé en version courte mais tourné seulement en page entière : on prend la page entière
  if (!fs.existsSync(path.join(ROOT, o.img)) && fs.existsSync(path.join(ROOT, o.img.replace(/\.png$/, '-long.png')))) o.img = o.img.replace(/\.png$/, '-long.png');
  if (!fs.existsSync(path.join(ROOT, o.img))) throw new Error(`Écran introuvable : ${img}`);
  if (o.scroll && !Array.isArray(o.scroll)) { const y = where(img, o.scroll.vers)[1]; const to = Math.max(0, y - (o.scroll.place ?? 520)); o.scroll = [o.scroll.depuis ?? 0, to, o.scroll.de ?? 0, o.scroll.a ?? (o.scroll.de ?? 0) + .8]; }
  o.taps = (o.taps || []).map(tp => (tp.cible ? { x: where(img, tp.cible)[0], y: where(img, tp.cible)[1], at: tp.at } : tp));
  return o;
};
const resolved = script.scenes.map(sc => {
  const o = { ...sc };
  if (Array.isArray(o.ecrans)) o.ecrans = o.ecrans.map(e => resolveItem(e, e.img));
  if (o.ecran) {
    const r = resolveItem({ scroll: o.scroll, taps: o.tap ? [{ ...o.tap, at: 0 }] : [] }, o.ecran);
    o.ecran = r.img; o.scroll = r.scroll; if (o.tap) o.tap = { x: r.taps[0].x, y: r.taps[0].y };
  }
  if (o.recu) { const r = resolveItem({ scroll: o.recuVers ? { vers: o.recuVers, place: 420 } : undefined }, o.recu); o.recu = r.img; if (r.scroll) o.recuScroll = r.scroll[1]; }
  if (o.confirme) o.confirme = resolveItem({}, o.confirme).img;
  return o;
});

// 3. script du film (chargé par toon.html + src/kit/toon-film.js)
const filmScript = { ...script, id, scenes: resolved.map((sc, i) => ({ ...sc, vo: 's' + (i + 1) })) };
fs.writeFileSync(path.join(ROOT, 'films', id + '.script.js'), 'window.TOON_SCRIPT = ' + JSON.stringify(filmScript, null, 1) + ';\n');

const sheet = (dir, out) => run(PY, ['-c', `
import glob
from PIL import Image
fs = sorted(glob.glob(r'${dir}/*.png'))
W, H, cols = 270, 480, 6
rows = (len(fs) + cols - 1) // cols
sh = Image.new('RGB', (cols * W, rows * H), 'white')
for i, f in enumerate(fs): sh.paste(Image.open(f).convert('RGB').resize((W, H)), ((i % cols) * W, (i // cols) * H))
sh.save(r'${out}')
`]);

const timing = JSON.parse(fs.readFileSync(path.join(ROOT, 'films', id + '.timing.js'), 'utf-8').replace(/^window\.GUIDE_TIMING = /, '').replace(/;\s*$/, ''));
const duration = timing.duration + (script.tenue ?? 1.6);

if (has('apercu')) {
  const times = Array.from({ length: 12 }, (_, i) => ((i + .5) * duration / 12).toFixed(2)).join(',');
  fs.rmSync(path.join(ROOT, 'qa', id), { recursive: true, force: true });
  run('node', ['render/render.js', '--film', id, '--times', times]);
  const out = path.join(ROOT, 'qa', id + '_apercu.png');
  sheet(path.join(ROOT, 'qa', id), out);
  console.log(JSON.stringify({ planche: out, duree: +duration.toFixed(1) }));
  process.exit(0);
}

// 3. images (120 i/s : flou de mouvement à l'encodage), sons, mixage, encodage
const fps = +opt('fps', 120);
log(`images (${Math.round(duration * fps)} à ${fps} i/s)…`);
run('node', ['render/render.js', '--film', id, '--fps', String(fps), '--workers', opt('workers', '6')]);
run('node', ['render/render.js', '--film', id, '--cues']);
run(PY, ['audio/sfx.py', id]);
run(PY, ['audio/mix.py', id]);
const name = 'AMAZER_' + (script.nom ?? id);
run('node', ['render/compile.js', '--film', id, '--fps', String(fps), '--name', name]);
const video = path.join(ROOT, 'out', name + '.mp4');
const leger = path.join(ROOT, 'out', name + '_leger.mp4');
run(FFMPEG, ['-v', 'error', '-y', '-i', video, '-vf', 'scale=720:-2:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-r', '30', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', leger]);
// planche de contrôle tirée de la vidéo finale
const qa = path.join(ROOT, 'qa', id + '_final');
fs.rmSync(qa, { recursive: true, force: true }); fs.mkdirSync(qa, { recursive: true });
run(FFMPEG, ['-v', 'error', '-i', video, '-vf', `fps=24/${duration.toFixed(2)},scale=270:480`, path.join(qa, 'c%02d.png')]);
const planche = path.join(ROOT, 'qa', id + '_planche.png');
sheet(qa, planche);
console.log(JSON.stringify({ video, leger, planche, duree: +duration.toFixed(1) }));
