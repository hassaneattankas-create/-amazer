"""Musique d'ambiance douce, libre de droits, fabriquée par calcul (aucun fichier extérieur).

Nappe chaude + petit arpège léger, 4 accords en boucle (32 s), pensée pour rester sous une voix off.
Usage : python musique.py sortie.wav
"""
import sys
import wave

import numpy as np

SR = 44100
BAR = 4.0  # secondes par accord
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def hz(name: str) -> float:
    step = NOTE[name[0]] + (1 if "#" in name else 0)
    octave = int(name[-1])
    return 440.0 * 2 ** ((step + 12 * (octave - 4) - 9) / 12)


# Accords : la mineur 7 · fa majeur 7 · do majeur · sol 6 — doux et optimiste
CHORDS = [
    ["A2", "E3", "G3", "C4", "E4"],
    ["F2", "C3", "E3", "A3", "C4"],
    ["C3", "G3", "C4", "E4", "G4"],
    ["G2", "D3", "G3", "B3", "E4"],
]
ARP = [
    ["A4", "C5", "E5", "C5"],
    ["A4", "C5", "F5", "C5"],
    ["G4", "C5", "E5", "C5"],
    ["G4", "B4", "D5", "B4"],
]


def pad(freqs, dur):
    t = np.arange(int(SR * dur)) / SR
    out = np.zeros_like(t)
    for f in freqs:
        for detune in (-0.12, 0.12):  # léger chorus
            ff = f * 2 ** (detune / 12)
            out += np.sin(2 * np.pi * ff * t) + 0.18 * np.sin(4 * np.pi * ff * t)
    env = np.minimum(1, t / 1.2) * np.minimum(1, (dur - t) / 1.4)
    return out * env / len(freqs)


def pluck(f, dur):
    t = np.arange(int(SR * dur)) / SR
    tone = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    return tone * np.exp(-t * 3.2) * np.minimum(1, t / 0.01)


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def main(path: str) -> None:
    rounds = 2
    total = int(SR * BAR * len(CHORDS) * rounds)
    mix = np.zeros(total + SR * 3)
    for r in range(rounds):
        for c, chord in enumerate(CHORDS):
            start = int(SR * BAR * (r * len(CHORDS) + c))
            p = pad([hz(n) for n in chord], BAR + 1.4)
            mix[start:start + len(p)] += 0.55 * p
            step = BAR / 8
            for k in range(8):
                note = ARP[c][k % 4]
                pl = pluck(hz(note), 1.6) * (0.16 if k % 2 == 0 else 0.11)
                s = start + int(SR * step * k)
                mix[s:s + len(pl)] += pl
    # la queue déborde : on la replie au début pour une boucle sans couture
    tail = mix[total:]
    mix = mix[:total]
    mix[:len(tail)] += tail
    mix = lowpass(mix, 2600)
    # petite réverbération : quelques échos atténués
    for delay, gain in ((0.113, 0.22), (0.271, 0.15), (0.419, 0.09)):
        d = int(SR * delay)
        mix[d:] += gain * mix[:-d]
    mix /= np.max(np.abs(mix)) * 1.12
    stereo = np.stack([mix, np.roll(mix, int(SR * 0.012))], axis=1)
    data = (stereo * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f"musique : {path} ({total / SR:.0f} s)")


if __name__ == "__main__":
    main(sys.argv[1])
