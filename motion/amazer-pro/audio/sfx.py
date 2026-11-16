"""Bruitages synthétisés (aucun échantillon externe, libres de droits) placés sur les repères du film.

Usage : python audio/sfx.py pub1   ->  audio/pub1.cues.json  =>  audio/pub1_sfx.wav
Chaque son est généré de façon déterministe (graine = nom + rang), avec une réverbération légère commune.
"""
import json
import os
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))


def t_(d):
    return np.arange(int(d * SR)) / SR


def env(n, a=.002, r=.1, shape=6.0):
    """attaque linéaire courte puis décroissance exponentielle"""
    x = np.arange(n) / SR
    e = np.exp(-x / max(r, 1e-4) * (shape / 6))
    na = max(1, int(a * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def filt(x, kind, f, order=2):
    if kind == 'bp':
        sos = butter(order, [max(20, f[0]), min(SR / 2 - 100, f[1])], 'bandpass', fs=SR, output='sos')
    else:
        sos = butter(order, min(SR / 2 - 100, max(20, f)), kind, fs=SR, output='sos')
    return sosfilt(sos, x)


def sweep_bp(noise, f0, f1, q=1.2, steps=48):
    """bruit filtré dont la bande suit un glissando (par blocs, fondus)"""
    n = len(noise)
    out = np.zeros(n)
    hop = n // steps + 1
    win = np.hanning(2 * hop)
    for k in range(steps):
        c = f0 * (f1 / f0) ** (k / max(1, steps - 1))
        a, b = max(0, k * hop - hop // 2), min(n, k * hop + hop + hop // 2)
        seg = filt(noise[a:b], 'bp', (c / (1 + 1 / q), c * (1 + 1 / q)))
        w = np.hanning(len(seg))
        out[a:b] += seg * w
    return out


def sine(f, d, ph=0):
    t = t_(d)
    if callable(f):
        return np.sin(2 * np.pi * np.cumsum(f(t)) / SR + ph)
    return np.sin(2 * np.pi * f * t + ph)


# ------------------------------------------------------------------ sons
def s_pop(r):
    f0 = 700 + r.random() * 500
    d = .09
    x = sine(lambda t: f0 * (1 - .45 * np.minimum(1, t / .05)), d) * env(int(d * SR), .001, .025)
    click = filt(r.standard_normal(int(.006 * SR)), 'hp', 2500) * .25
    x[:len(click)] += click
    return x * .9


def s_buzz(r):
    d = .42
    t = t_(d)
    car = np.sign(np.sin(2 * np.pi * 165 * t)) * .5 + np.sin(2 * np.pi * 330 * t) * .3
    am = ((t % .2) < .13).astype(float)
    am = filt(am, 'lp', 60)
    x = filt(car * am, 'lp', 900) * env(len(t), .005, .5)
    return x * .5


def s_suck(r):
    d = 1.0
    n = int(d * SR)
    no = r.standard_normal(n)
    x = sweep_bp(no, 300, 5000, 1.5)
    t = t_(d)
    a = (t / d) ** 2.6
    a[-int(.03 * SR):] *= np.linspace(1, 0, int(.03 * SR))
    tone = sine(lambda t: 80 + 600 * (t / d) ** 2, d) * .25
    return (x * 1.4 + tone) * a


def s_impact(r):
    d = 1.6
    t = t_(d)
    boom = sine(lambda t: 38 + 70 * np.exp(-t * 18), d) * np.exp(-t * 3.2)
    body = filt(r.standard_normal(len(t)), 'lp', 900) * np.exp(-t * 14) * .6
    crack = filt(r.standard_normal(len(t)), 'hp', 3000) * np.exp(-t * 60) * .25
    return (boom * 1.1 + body + crack) * .95


def s_shimmer(r):
    d = 1.4
    n = int(d * SR)
    x = np.zeros(n)
    notes = [2093, 2637, 3136, 3951, 4186, 5274]
    for k in range(14):
        f = notes[r.integers(len(notes))] * (1 + (r.random() - .5) * .004)
        t0 = int(r.random() * .45 * SR)
        dd = .9
        s = sine(f, dd) * env(int(dd * SR), .002, .35) * (.5 + r.random() * .5)
        e = min(n, t0 + len(s))
        x[t0:e] += s[:e - t0]
    return x * .22


def s_whoosh(r):
    d = .7
    n = int(d * SR)
    x = sweep_bp(r.standard_normal(n), 400, 2600, 1.1)
    t = t_(d)
    a = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.6
    return x * a * 1.6


def s_thud(r):
    d = .35
    t = t_(d)
    return (sine(lambda t: 70 + 60 * np.exp(-t * 30), d) * np.exp(-t * 12) + filt(r.standard_normal(len(t)), 'lp', 400) * np.exp(-t * 40) * .4) * .9


def s_swipe(r):
    d = .28
    n = int(d * SR)
    x = sweep_bp(r.standard_normal(n), 1500, 6000, 1.6, 24)
    t = t_(d)
    return x * np.sin(np.pi * t / d) ** 2 * 1.3


def s_tick(r):
    d = .03
    t = t_(d)
    return (sine(2600 + r.random() * 300, d) * np.exp(-t * 260) + filt(r.standard_normal(len(t)), 'hp', 4000) * np.exp(-t * 400) * .3) * .6


def s_tap(r):
    d = .06
    t = t_(d)
    body = sine(lambda t: 420 * (1 - .3 * t / d), d) * np.exp(-t * 90)
    click = filt(r.standard_normal(len(t)), 'bp', (1500, 5000)) * np.exp(-t * 300) * .5
    return (body + click) * .8


def bell(f, d, partials=((1, 1), (2.76, .35), (5.4, .18), (8.9, .08)), decay=1.8):
    t = t_(d)
    x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * decay * (1 + m * .4)) for m, a in partials)
    na = int(.002 * SR)
    x[:na] *= np.linspace(0, 1, na)
    return x


def s_ding(r):
    d = 1.3
    x = bell(1318.5, d) * .6
    y = bell(1975.5, d - .09) * .55
    x[int(.09 * SR):] += y
    return x * .55


def s_scan(r):
    d = .8
    t = t_(d)
    f = 1400 + 800 * np.sin(np.pi * 2 * t / d) ** 2
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * (.6 + .4 * np.sin(2 * np.pi * 30 * t))
    return x * np.sin(np.pi * t / d) * .2


def s_beep(r):
    d = .32
    x = np.zeros(int(d * SR))
    for t0 in (0, .14):
        b = sine(1880, .1) * env(int(.1 * SR), .003, .05)
        i = int(t0 * SR)
        x[i:i + len(b)] += b
    return x * .45


def s_kaching(r):
    d = 1.4
    n = int(d * SR)
    x = np.zeros(n)
    for f, t0, g in ((2093, 0, .5), (2637, .06, .45), (3136, .12, .4), (4186, .12, .25)):
        b = bell(f, d - t0, decay=2.4)
        i = int(t0 * SR)
        x[i:i + len(b)] += b[:n - i] * g
    for k in range(10):  # pièces
        i = int((.02 + r.random() * .25) * SR)
        c = filt(r.standard_normal(int(.03 * SR)), 'bp', (5000, 11000)) * env(int(.03 * SR), .001, .008)
        x[i:i + len(c)] += c * .3
    return x * .7


PLINK = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093]


def s_plink(r, idx=0):
    d = .5
    f = PLINK[idx % len(PLINK)]
    t = t_(d)
    x = (np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 30)) * np.exp(-t * 9)
    na = int(.002 * SR)
    x[:na] *= np.linspace(0, 1, na)
    return x * .5


def s_shine(r):
    d = .45
    t = t_(d)
    return sine(lambda t: 3500 + 5000 * t / d, d) * np.sin(np.pi * t / d) ** 2 * .12


def s_moto(r):
    """moteur de moto 125 cm³ qui passe : train d'explosions ~38 Hz qui accélère, bruit d'échappement"""
    d = 3.6
    t = t_(d)
    f = 34 + 16 * np.clip(t / 1.2, 0, 1) + 3 * np.sin(t * 2.3)
    ph = np.cumsum(f) / SR
    pulse = np.exp(-((ph % 1.0) * 9.0)) - .12
    body = filt(pulse, 'lp', 900) * 1.3
    rasp = filt(r.standard_normal(len(t)), 'bp', (300, 1800)) * (.25 + .2 * (np.exp(-((ph % 1.0) * 6.0))))
    a = np.clip(t / .25, 0, 1) * np.clip((d - t) / .9, 0, 1)
    return (body + rasp) * a * .55


def s_knock(r):
    """toc sur un portail en métal (impact court, résonance métallique)"""
    d = .28
    t = t_(d)
    hit = filt(r.standard_normal(len(t)), 'bp', (500, 3200)) * np.exp(-t * 60) * .8
    ring = (np.sin(2 * np.pi * 410 * t) * .5 + np.sin(2 * np.pi * 1130 * t) * .25) * np.exp(-t * 18)
    return (hit + ring) * .9


def s_sigh(r):
    """souffle « ahh » (soulagement), bruit filtré qui descend"""
    d = .9
    n = int(d * SR)
    x = sweep_bp(r.standard_normal(n), 1400, 500, 1.4, 24)
    tt = t_(d)
    return x * np.sin(np.pi * np.clip(tt / d, 0, 1)) ** 1.4 * .9


SOUNDS = {k[2:]: v for k, v in globals().items() if k.startswith('s_')}

# --- Vrais bruitages (Mixkit, licence tracee : sfx-lib/LICENCES.md) ---------------------------
# Chaque repere courant utilise un enregistrement reel ; plusieurs variantes alternent pour eviter
# la repetition mecanique. Le son synthetise reste le secours (fichier absent, --synth).
SAMPLES = {
    'whoosh': ['transition/air-woosh-quick', 'transition/wind-swoosh-short'],
    'impact': ['impact/bass-hit-short', 'impact/impact-zoom-quick'],
    'swipe': ['transition/sweep-fast-small', 'transition/sweep-short'],
    'pop': ['ui/pop-electric', 'ui/ui-message-pop'],
    'tap': ['ui/ui-select-click', 'ui/switch-tap'],
    'tick': ['ui/switch-click-quick'],
    'ding': ['ui/ui-success-soft'],
    'thud': ['impact/hit-weak'],
    'shimmer': ['light/shimmer-sparkle-sweep'],
    'scan': ['data/data-scan'],
    'beep': ['ui/ui-confirm-bleep'],
    'scratch': ['film/vinyl-scratch-small'],
}
LIB = os.path.join(HERE, 'sfx-lib')
FFMPEG = os.path.join(HERE, '..', '..', '..', 'jde-motion', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
_cache = {}


def load_sample(rel):
    """MP3 -> signal mono 48 kHz, crete normalisee a 0.9 (decodage par ffmpeg, mis en cache)."""
    if rel in _cache:
        return _cache[rel]
    import subprocess
    path = os.path.join(LIB, rel + '.mp3')
    if not os.path.exists(path) or not os.path.exists(FFMPEG):
        _cache[rel] = None
        return None
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    # silence de tete retire : le son tombe exactement sur l'image
    nz = np.flatnonzero(np.abs(x) > 0.02 * (np.max(np.abs(x)) + 1e-9))
    x = x[nz[0]:] if len(nz) else x
    x = x / (np.max(np.abs(x)) + 1e-9) * .9
    _cache[rel] = x
    return x


def sample_for(name, k):
    variants = SAMPLES.get(name)
    if not variants or '--synth' in sys.argv:
        return None
    return load_sample(variants[k % len(variants)])



def reverb_ir(dur=.9, seed=3):
    r = np.random.default_rng(seed)
    t = t_(dur)
    ir = r.standard_normal(len(t)) * np.exp(-t * 6.5)
    ir = filt(ir, 'lp', 6000)
    ir[:int(.012 * SR)] = 0
    return ir / np.sqrt(np.sum(ir ** 2))


def main(film):
    info = json.load(open(os.path.join(HERE, f'{film}.cues.json'), encoding='utf-8'))
    dur = info['duration']
    n = int(dur * SR)
    L, R = np.zeros(n + SR * 2), np.zeros(n + SR * 2)
    counts = {}
    for c in info['cues']:
        name = c['s']
        k = counts.get(name, 0)
        counts[name] = k + 1
        r = np.random.default_rng(sum(map(ord, name)) * 101 + k * 31)
        real = sample_for(name, k)
        x = real * .8 if real is not None else (s_plink(r, k) if name == 'plink' else SOUNDS[name](r))
        x = x * c.get('g', .6)
        p = float(np.clip(c.get('p', 0), -1, 1))
        gl, gr = np.cos((p + 1) * np.pi / 4), np.sin((p + 1) * np.pi / 4)
        i = int(c['t'] * SR)
        e = min(len(L), i + len(x))
        L[i:e] += x[:e - i] * gl * 1.414
        R[i:e] += x[:e - i] * gr * 1.414
    ir = reverb_ir()
    wet = .16
    L = L + fftconvolve(L, ir)[:len(L)] * wet
    R = R + fftconvolve(R, ir)[:len(R)] * wet
    mix = np.stack([L[:n], R[:n]], 1)
    mix = filt(mix.T, 'hp', 25).T
    pk = np.max(np.abs(mix)) + 1e-9
    mix = np.tanh(mix / pk * 1.25) / np.tanh(1.25) * .89
    fade = np.ones(n)
    fade[-int(.8 * SR):] = np.linspace(1, 0, int(.8 * SR))
    mix *= fade[:, None]
    out = os.path.join(HERE, f'{film}_sfx.wav')
    wavfile.write(out, SR, (mix * 32767).astype(np.int16))
    print('ok', out, len(info['cues']), 'sons', counts)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'pub1')
