// Voix « pro » ElevenLabs (via fal.ai, payant, quelques centimes) : échantillons à écouter avant de choisir.
// Usage : node audio/voix-pro.mjs essai   -> audio/voix-pro/<voix>.mp3
// Clé : FAL_API_KEY lue dans le .env de l'Assistant (jamais affichée).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = process.env.FAL_ENV || 'C:/Users/User/Desktop/Amarketing AI/amarketing-ai-v2-1 (1)/amarketing-ai-v2/backend/.env';
const KEY = process.env.FAL_API_KEY || (fs.readFileSync(ENV, 'utf-8').match(/^FAL_API_KEY=(.*)$/m) || [])[1]?.trim();
if (!KEY) throw new Error('FAL_API_KEY introuvable');
const MODEL = 'fal-ai/elevenlabs/tts/multilingual-v2';

export async function tts(text, voice, out, opts = {}) {
  const r = await fetch(`https://fal.run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, stability: opts.stability ?? 0.45, similarity_boost: opts.similarity ?? 0.8, style: opts.style ?? 0.25, speed: opts.speed ?? 1.05, language_code: 'fr' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`fal ${r.status} : ${JSON.stringify(j).slice(0, 300)}`);
  const url = j.audio?.url;
  if (!url) throw new Error('réponse sans audio : ' + JSON.stringify(j).slice(0, 200));
  fs.writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer()));
  return out;
}

if (process.argv[2] === 'essai') {
  const dir = path.join(ROOT, 'audio', 'voix-pro');
  fs.mkdirSync(dir, { recursive: true });
  const text = "Une belle boutique… mais les clients se font rares ? Sur Amazère, vous pouvez commencer à vendre gratuitement. Et les commandes arrivent, directement sur votre téléphone !";
  for (const v of (process.argv[3] || 'Charlotte,Alice,Laura,Jessica').split(',')) {
    try { console.log('ok', v, await tts(text, v, path.join(dir, `${v}.mp3`))); } catch (e) { console.log('ECHEC', v, e.message); }
  }
}
