from __future__ import annotations

import math
import struct
import subprocess
import wave
from pathlib import Path


ROOT = Path(r"C:\Users\User\Desktop\amazer donnee")
OUTPUT_DIR = ROOT / "marketing-kit" / "exports-recordings"
FFMPEG = Path(
    r"C:\Users\User\AppData\Roaming\Python\Python314\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
)
POWERSHELL = Path(r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe")
FONT_REGULAR = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")

REC_1 = ROOT / "AMAZER - Google Chrome 2026-03-30 21-10-25.mp4"
REC_2 = ROOT / "AMAZER - Google Chrome 2026-03-30 21-20-37.mp4"

FPS = 30


AD_DEFINITIONS = [
    {
        "slug": "master",
        "title": "AMAZER_PUBLICITE_MASTER",
        "voice_text": (
            "AMAZER arrive avec une experience digitale moderne pensee pour les Nigeriens. "
            "Explorez les produits, valorisez les boutiques, commandez vos repas, payez plus simplement "
            "et suivez vos achats au meme endroit. Cote vendeurs, un vrai back office permet de publier, "
            "gerer et developper son activite. AMAZER. Une plateforme locale, elegante et prete pour la croissance."
        ),
        "segments": [
            {
                "file": REC_1,
                "start": 18.0,
                "duration": 5.0,
                "headline": "Marketplace moderne",
                "subtitle": "Produits, recherche et navigation rapide",
            },
            {
                "file": REC_1,
                "start": 118.0,
                "duration": 5.0,
                "headline": "Boutiques valorisees",
                "subtitle": "Des vitrines premium pour mieux vendre",
            },
            {
                "file": REC_1,
                "start": 298.0,
                "duration": 5.0,
                "headline": "Mini site professionnel",
                "subtitle": "Galerie, services et image de marque",
            },
            {
                "file": REC_2,
                "start": 23.0,
                "duration": 5.0,
                "headline": "Paiement simplifie",
                "subtitle": "Reference courte et QR code",
            },
            {
                "file": REC_2,
                "start": 78.0,
                "duration": 5.0,
                "headline": "Recu et confiance",
                "subtitle": "Un parcours plus clair pour le client",
            },
        ],
    },
    {
        "slug": "commerce",
        "title": "AMAZER_PUBLICITE_COMMERCE",
        "voice_text": (
            "AMAZER reunit marketplace, vitrines premium et mini sites vendeurs dans une interface moderne. "
            "Les clients trouvent plus vite. Les boutiques presentent mieux leurs produits. "
            "Et toute l experience gagne en valeur, en clarte et en impact visuel."
        ),
        "segments": [
            {
                "file": REC_1,
                "start": 18.0,
                "duration": 4.5,
                "headline": "Accueil puissant",
                "subtitle": "Une premiere impression nette et premium",
            },
            {
                "file": REC_1,
                "start": 118.0,
                "duration": 4.5,
                "headline": "Boutiques visibles",
                "subtitle": "Les enseignes gagnent en presence",
            },
            {
                "file": REC_1,
                "start": 298.0,
                "duration": 4.5,
                "headline": "Experience vendeur",
                "subtitle": "Des pages plus riches et plus credibles",
            },
            {
                "file": REC_1,
                "start": 118.0,
                "duration": 4.5,
                "headline": "AMAZER",
                "subtitle": "La plateforme locale nouvelle generation",
            },
        ],
    },
    {
        "slug": "paiement",
        "title": "AMAZER_PUBLICITE_PAIEMENT",
        "voice_text": (
            "Avec AMAZER, le paiement devient plus clair. "
            "Reference courte, QR code, acces direct au paiement mobile et recu numerique. "
            "Une experience locale plus simple, plus rassurante et plus professionnelle."
        ),
        "segments": [
            {
                "file": REC_2,
                "start": 23.0,
                "duration": 4.5,
                "headline": "Finaliser vite",
                "subtitle": "Le paiement guide le client sans friction",
            },
            {
                "file": REC_2,
                "start": 27.5,
                "duration": 4.5,
                "headline": "Reference courte",
                "subtitle": "Moins de confusion, plus de fluidite",
            },
            {
                "file": REC_2,
                "start": 78.0,
                "duration": 4.5,
                "headline": "Recu numerique",
                "subtitle": "Preuve de paiement claire et immediate",
            },
            {
                "file": REC_2,
                "start": 84.0,
                "duration": 4.5,
                "headline": "AMAZER",
                "subtitle": "Paiement mobile plus simple et plus pro",
            },
        ],
    },
]


def ffmpeg_filter_path(path: Path) -> str:
    return str(path).replace("\\", "/").replace(":", "\\:")


def ffmpeg_escape_text(text: str) -> str:
    escaped = text
    replacements = {
        "\\": "\\\\",
        ":": "\\:",
        "'": "\\'",
        ",": "\\,",
        "[": "\\[",
        "]": "\\]",
        ";": "\\;",
        "%": "\\%",
    }
    for old, new in replacements.items():
        escaped = escaped.replace(old, new)
    return escaped


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def generate_voiceover(text: str, output_path: Path) -> None:
    ps_script = f"""
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice('Microsoft Hortense Desktop')
$speaker.Rate = -1
$speaker.Volume = 100
$speaker.SetOutputToWaveFile('{str(output_path)}')
$speaker.Speak(@'
{text}
'@)
$speaker.Dispose()
"""
    subprocess.run(
        [str(POWERSHELL), "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script],
        check=True,
    )


def build_music_bed(duration_seconds: float, output_path: Path) -> None:
    sample_rate = 44_100
    total_samples = int(duration_seconds * sample_rate)
    chords = [
        (220.0, 277.18, 329.63),
        (246.94, 311.13, 369.99),
        (196.0, 246.94, 293.66),
        (220.0, 277.18, 329.63),
    ]
    segment_seconds = max(duration_seconds / max(len(chords), 1), 1.0)
    audio: list[tuple[float, float]] = []

    for index in range(total_samples):
        t = index / sample_rate
        chord = chords[min(int(t / segment_seconds), len(chords) - 1)]
        left = 0.0
        right = 0.0
        for note_index, freq in enumerate(chord):
            amp = 0.08 / (note_index + 1)
            phase = 2 * math.pi * freq * t
            tone = math.sin(phase) * amp
            pad = math.sin(phase * 0.5) * (amp * 0.35)
            if note_index % 2 == 0:
                left += tone + pad
                right += tone * 0.75 + pad
            else:
                right += tone + pad
                left += tone * 0.75 + pad
        pulse = math.sin(2 * math.pi * 1.4 * t) * 0.015
        audio.append((left + pulse, right + pulse))

    peak = max(max(abs(l), abs(r)) for l, r in audio) or 1.0
    scale = 0.42 / peak

    with wave.open(str(output_path), "wb") as wav_file:
        wav_file.setnchannels(2)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        frames = bytearray()
        for left, right in audio:
            frames.extend(struct.pack("<hh", int(left * scale * 32767), int(right * scale * 32767)))
        wav_file.writeframes(bytes(frames))


def mix_audio(voice_path: Path, bed_path: Path, output_path: Path, duration_seconds: float) -> None:
    filter_complex = (
        f"[0:a]aformat=sample_rates=44100:channel_layouts=stereo,apad=pad_dur={duration_seconds}[voice];"
        f"[1:a]volume=0.10[bed];"
        f"[voice][bed]amix=inputs=2:duration=longest,atrim=duration={duration_seconds}[aout]"
    )
    subprocess.run(
        [
            str(FFMPEG),
            "-y",
            "-i",
            str(voice_path),
            "-i",
            str(bed_path),
            "-filter_complex",
            filter_complex,
            "-map",
            "[aout]",
            str(output_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def landscape_segment_filter(index: int, segment: dict) -> str:
    duration = float(segment["duration"])
    headline = ffmpeg_escape_text(segment["headline"])
    subtitle = ffmpeg_escape_text(segment["subtitle"])
    font_bold = ffmpeg_filter_path(FONT_BOLD)
    font_regular = ffmpeg_filter_path(FONT_REGULAR)
    return (
        f"[{index}:v]"
        f"fps={FPS},"
        f"scale=1920:1080:force_original_aspect_ratio=increase,"
        f"crop=1920:1080,"
        f"setsar=1,"
        f"drawbox=x=58:y=48:w=310:h=76:color=0xFF8C1A@0.92:t=fill,"
        f"drawtext=fontfile='{font_bold}':text='AMAZER':fontcolor=white:fontsize=38:x=86:y=70,"
        f"drawbox=x=58:y=820:w=1804:h=180:color=0xFFF8F0@0.88:t=fill,"
        f"drawtext=fontfile='{font_bold}':text='{headline}':fontcolor=0x1f2937:fontsize=54:x=90:y=850,"
        f"drawtext=fontfile='{font_regular}':text='{subtitle}':fontcolor=0x475569:fontsize=30:x=94:y=920,"
        f"fade=t=in:st=0:d=0.35,"
        f"fade=t=out:st={max(duration - 0.4, 0.1)}:d=0.4"
        f"[v{index}]"
    )


def vertical_segment_filter(index: int, segment: dict) -> str:
    duration = float(segment["duration"])
    headline = ffmpeg_escape_text(segment["headline"])
    subtitle = ffmpeg_escape_text(segment["subtitle"])
    font_bold = ffmpeg_filter_path(FONT_BOLD)
    font_regular = ffmpeg_filter_path(FONT_REGULAR)
    return (
        f"[{index}:v]fps={FPS},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=18:2[bg{index}];"
        f"[{index}:v]fps={FPS},scale=1000:1440:force_original_aspect_ratio=decrease[fg{index}];"
        f"[bg{index}][fg{index}]overlay=(W-w)/2:(H-h)/2-90,"
        f"drawbox=x=56:y=70:w=290:h=76:color=0xFF8C1A@0.94:t=fill,"
        f"drawtext=fontfile='{font_bold}':text='AMAZER':fontcolor=white:fontsize=36:x=84:y=92,"
        f"drawbox=x=40:y=1520:w=1000:h=230:color=0xFFF8F0@0.90:t=fill,"
        f"drawtext=fontfile='{font_bold}':text='{headline}':fontcolor=0x1f2937:fontsize=54:x=74:y=1560,"
        f"drawtext=fontfile='{font_regular}':text='{subtitle}':fontcolor=0x475569:fontsize=28:x=78:y=1640,"
        f"drawtext=fontfile='{font_regular}':text='Disponible au Niger via Vercel':fontcolor=0xFF8C1A:fontsize=24:x=78:y=1700,"
        f"fade=t=in:st=0:d=0.35,"
        f"fade=t=out:st={max(duration - 0.4, 0.1)}:d=0.4"
        f"[v{index}]"
    )


def render_video(
    *,
    output_path: Path,
    audio_path: Path,
    segments: list[dict],
    variant: str,
) -> None:
    cmd = [str(FFMPEG), "-y"]
    for segment in segments:
        cmd.extend(
            [
                "-ss",
                str(segment["start"]),
                "-t",
                str(segment["duration"]),
                "-i",
                str(segment["file"]),
            ]
        )
    cmd.extend(["-i", str(audio_path)])

    filters: list[str] = []
    concat_inputs: list[str] = []
    for index, segment in enumerate(segments):
        if variant == "vertical":
            filters.append(vertical_segment_filter(index, segment))
        else:
            filters.append(landscape_segment_filter(index, segment))
        concat_inputs.append(f"[v{index}]")

    filters.append(f"{''.join(concat_inputs)}concat=n={len(segments)}:v=1:a=0[vout]")
    cmd.extend(
        [
            "-filter_complex",
            ";".join(filters),
            "-map",
            "[vout]",
            "-map",
            f"{len(segments)}:a",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "20",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-r",
            str(FPS),
            "-movflags",
            "+faststart",
            str(output_path),
        ]
    )
    subprocess.run(cmd, check=True)


def write_summary(ad: dict, total_duration: float) -> None:
    summary_path = OUTPUT_DIR / f"{ad['title']}_SCRIPT.txt"
    lines = [
        ad["title"],
        "",
        f"Duree cible: {total_duration:.1f}s",
        "",
        "Voix off:",
        ad["voice_text"],
        "",
        "Plans:",
    ]
    for segment in ad["segments"]:
        lines.append(
            f"- {Path(segment['file']).name} | {segment['start']}s | {segment['duration']}s | "
            f"{segment['headline']} | {segment['subtitle']}"
        )
    summary_path.write_text("\n".join(lines), encoding="utf-8")


def build_ad(ad: dict) -> None:
    total_duration = sum(float(segment["duration"]) for segment in ad["segments"])
    voice_path = OUTPUT_DIR / f"{ad['title']}_voice.wav"
    bed_path = OUTPUT_DIR / f"{ad['title']}_bed.wav"
    mix_path = OUTPUT_DIR / f"{ad['title']}_mix.wav"

    generate_voiceover(ad["voice_text"], voice_path)
    build_music_bed(total_duration + 1.0, bed_path)
    mix_audio(voice_path, bed_path, mix_path, total_duration)

    render_video(
        output_path=OUTPUT_DIR / f"{ad['title']}_16x9.mp4",
        audio_path=mix_path,
        segments=ad["segments"],
        variant="landscape",
    )
    render_video(
        output_path=OUTPUT_DIR / f"{ad['title']}_9x16.mp4",
        audio_path=mix_path,
        segments=ad["segments"],
        variant="vertical",
    )

    write_summary(ad, total_duration)


def main() -> None:
    ensure_output_dir()
    for ad in AD_DEFINITIONS:
        build_ad(ad)


if __name__ == "__main__":
    main()
