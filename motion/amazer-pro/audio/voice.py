"""voice.py — voix off d'un guide : texte (guides/<id>.json) -> audio/<id>_voice.wav + films/<id>.timing.js.

    python audio/voice.py guide1            # voix du fichier, sinon Henri (neuronale Microsoft, française)
    python audio/voice.py guide1 --voice fr-FR-DeniseNeural

Chaque segment est dit séparément ; ses phrases sont horodatées (SentenceBoundary) pour caler les sous-titres
et les animations sur la voix. Les segments sont mis bout à bout avec une respiration entre eux.

Voix : service neuronal de Microsoft via edge-tts (gratuit). Pour une diffusion publicitaire, utiliser la même
voix via Azure Speech (licence commerciale) ou ElevenLabs : seul ce fichier change, le reste du film suit.
"""

import asyncio
import json
import re
import os
import subprocess
import sys

import edge_tts
import numpy as np
from scipy.io import wavfile

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FFMPEG = os.path.join(ROOT, '..', '..', 'jde-motion', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
LEAD, GAP, TAIL = 0.6, 0.45, 0.4
DEFAULT_VOICE = 'fr-FR-HenriNeural'  # voix uniquement française : pas de bascule vers l'accent anglais

# Prononciation : forme écrite -> forme dite (« AMAZER » se dit « Amazère » : avec « è », la voix ne peut pas dire « Amazé »). Les sous-titres gardent l'écrit.
SAY = [
    (r'\bamazer point store\b', 'Amazère point store', 'amazer.store'),
    (r'\bamazer\.store\b', 'Amazère point store', 'amazer.store'),
    (r'\bAMAZER\b', 'Amazère', 'AMAZER'),
    (r'\bAmanaTa\b', 'Amana Ta', 'AmanaTa'),
]


def spoken(text):
    for pat, say, _ in SAY:
        text = re.sub(pat, say, text, flags=re.IGNORECASE)
    return text


def written(text):
    for _, say, write in SAY:
        text = text.replace(say, write)
    return text


async def speak(text, voice, rate, pitch, mp3):
    """Synthèse d'un segment ; renvoie les phrases [(début s, fin s, texte)]."""
    com = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary='SentenceBoundary')
    sentences = []
    with open(mp3, 'wb') as f:
        async for chunk in com.stream():
            if chunk['type'] == 'audio':
                f.write(chunk['data'])
            elif chunk['type'] == 'SentenceBoundary':
                start = chunk['offset'] / 1e7
                sentences.append((start, start + chunk['duration'] / 1e7, chunk['text']))
    return sentences


def decode(mp3):
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', mp3, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def trim(x, threshold=0.004):
    """Silences de début et de fin retirés (la respiration est remise par GAP)."""
    idx = np.flatnonzero(np.abs(x) > threshold)
    if not len(idx):
        return x, 0.0
    a, b = max(0, idx[0] - int(.02 * SR)), min(len(x), idx[-1] + int(.08 * SR))
    return x[a:b], a / SR


def main(guide, voice_override=None):
    spec = json.load(open(os.path.join(ROOT, 'guides', f'{guide}.json'), encoding='utf-8'))
    voice = voice_override or spec.get('voice', DEFAULT_VOICE)
    rate, pitch = spec.get('rate', '+0%'), spec.get('pitch', '+0Hz')
    tmp = os.path.join(HERE, 'tmp_voice')
    os.makedirs(tmp, exist_ok=True)
    lead = spec.get('lead', LEAD)
    pieces, segments, t = [np.zeros(int(lead * SR))], {}, lead
    for seg in spec['segments']:
        mp3 = os.path.join(tmp, f"{guide}_{seg['id']}.mp3")
        for attempt in range(6):  # réseau instable : on retente avant d'abandonner
            try:
                sentences = asyncio.run(speak(spoken(seg['text']), voice, rate, pitch, mp3))
                break
            except Exception as err:
                if attempt == 5:
                    raise
                print(f"  {seg['id']}: nouvelle tentative ({type(err).__name__})")
        audio, cut = trim(decode(mp3))
        dur = len(audio) / SR
        captions = seg.get('captions') or [written(s[2]) for s in sentences]
        # Une ligne de sous-titre par phrase prononcée (texte écrit si fourni : « amazer.store », etc.).
        times = [(max(0.0, s0 - cut), min(dur, s1 - cut)) for s0, s1, _ in sentences] or [(0.0, dur)]
        if len(captions) != len(times):
            # Découpage écrit différent : réparti au prorata de la longueur du texte.
            total = sum(len(c) for c in captions) or 1
            acc, times = 0.0, []
            for c in captions:
                d = dur * len(c) / total
                times.append((acc, acc + d))
                acc += d
        segments[seg['id']] = {
            'start': round(t, 3), 'end': round(t + dur, 3),
            'captions': [{'a': round(t + a, 3), 'b': round(t + b, 3), 'text': c} for (a, b), c in zip(times, captions)],
        }
        # « slot » : durée minimale réservée à la scène (du début de la phrase au début de la suivante)
        pause = max(seg.get('pause', GAP), seg.get('slot', 0) - dur)
        pieces += [audio, np.zeros(int(pause * SR))]
        t += dur + pause
        print(f"  {seg['id']:<12} {dur:5.1f} s  {len(sentences)} phrase(s)")
    pieces.append(np.zeros(int(TAIL * SR)))
    voice_track = np.concatenate(pieces)
    peak = np.max(np.abs(voice_track)) or 1
    voice_track = voice_track / peak * 0.89
    out = os.path.join(HERE, f'{guide}_voice.wav')
    wavfile.write(out, SR, (voice_track * 32767).astype(np.int16))
    timing = {'voice': voice, 'duration': round(len(voice_track) / SR, 3), 'segments': segments}
    with open(os.path.join(ROOT, 'films', f'{guide}.timing.js'), 'w', encoding='utf-8') as f:
        f.write('window.GUIDE_TIMING = ' + json.dumps(timing, ensure_ascii=False, indent=1) + ';\n')
    print(f"ok {out} · {timing['duration']:.1f} s · voix {voice}")


if __name__ == '__main__':
    override = sys.argv[sys.argv.index('--voice') + 1] if '--voice' in sys.argv else None
    main(sys.argv[1], override)
