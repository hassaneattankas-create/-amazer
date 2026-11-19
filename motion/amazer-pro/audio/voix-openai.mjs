// Voix OpenAI (gpt-4o-mini-tts, payant, fraction de centime) : échantillons à écouter avant de choisir.
// Usage : node audio/voix-openai.mjs essai   -> audio/voix-pro/openai-<voix>.mp3
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = 'C:/Users/User/Desktop/Amarketing AI/amarketing-ai-v2-1 (1)/amarketing-ai-v2/backend/.env';
const KEY = process.env.OPENAI_API_KEY || (fs.readFileSync(ENV, 'utf-8').match(/^OPENAI_API_KEY=(.*)$/m) || [])[1]?.trim();
if (!KEY) throw new Error('OPENAI_API_KEY introuvable');

export async function tts(text, voice, out, instructions = "Voix féminine française chaleureuse et dynamique de publicité, accent français standard, débit vif mais clair, souriante.") {
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice, input: text, instructions, response_format: 'mp3' }),
  });
  if (!r.ok) throw new Error(`openai ${r.status} : ${(await r.text()).slice(0, 300)}`);
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  return out;
}

if (process.argv[2] === 'essai') {
  const dir = path.join(ROOT, 'audio', 'voix-pro');
  fs.mkdirSync(dir, { recursive: true });
  const text = "Une belle boutique… mais les clients se font rares ? Sur Amazère, vous pouvez commencer à vendre gratuitement. Et les commandes arrivent, directement sur votre téléphone !";
  for (const v of (process.argv[3] || 'coral,nova,shimmer,sage').split(',')) {
    try { console.log('ok', v, await tts(text, v, path.join(dir, `openai-${v}.mp3`))); } catch (e) { console.log('ECHEC', v, e.message); }
  }
}
