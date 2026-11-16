"""mix.py — voix off + bruitages -> audio/<film>_mix.wav (utilisé par render/compile.js s'il existe).

    python audio/mix.py guide1

Les bruitages baissent automatiquement quand la voix parle (ducking), pour qu'elle reste claire.
Pas de musique (règle AMAZER). Crête finale à -1 dBFS.
"""

import os
import sys

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d, uniform_filter1d

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000


def load(path):
    sr, x = wavfile.read(path)
    assert sr == SR, f'{path} : {sr} Hz attendu {SR}'
    x = x.astype(np.float64) / (32768.0 if x.dtype == np.int16 else 1.0)
    return x if x.ndim == 2 else np.stack([x, x], axis=1)


def main(film):
    voice = load(os.path.join(HERE, f'{film}_voice.wav'))
    sfx = load(os.path.join(HERE, f'{film}_sfx.wav'))
    n = max(len(voice), len(sfx))
    voice = np.pad(voice, ((0, n - len(voice)), (0, 0)))
    sfx = np.pad(sfx, ((0, n - len(sfx)), (0, 0)))
    # enveloppe de la voix (lissée, avec un peu d'anticipation) -> gain des bruitages 1 -> 0,35
    env = maximum_filter1d(np.abs(voice[:, 0]), size=int(.05 * SR))
    env = uniform_filter1d(env, size=int(.25 * SR))
    env = np.clip(env / (np.percentile(env[env > 1e-4], 90) if np.any(env > 1e-4) else 1), 0, 1)
    duck = 1 - .65 * env
    mix = voice * 1.0 + sfx * .5 * duck[:, None]
    mix = mix / (np.max(np.abs(mix)) or 1) * 0.89
    out = os.path.join(HERE, f'{film}_mix.wav')
    wavfile.write(out, SR, (mix * 32767).astype(np.int16))
    print(f'ok {out} · {n / SR:.1f} s')


if __name__ == '__main__':
    main(sys.argv[1])
