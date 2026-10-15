# Voix off provisoire : voix Windows « Hortense » (fr-FR), une phrase par fichier WAV.
# Usage : powershell -File tts.ps1 [-Rate 1]
param([int]$Rate = 1)
Add-Type -AssemblyName System.Speech
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
New-Item -ItemType Directory -Force (Join-Path $dir "vo") | Out-Null
$lines = Get-Content (Join-Path $dir "voice_lines.txt") -Encoding UTF8 | Where-Object { $_.Trim() }
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$i = 1
foreach ($line in $lines) {
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SelectVoice("Microsoft Hortense Desktop")
  $s.Rate = $Rate
  $s.SetOutputToWaveFile((Join-Path $dir ("vo\line{0}.wav" -f $i)), $fmt)
  $s.Speak($line)
  $s.Dispose()
  $i++
}
"ok $($i - 1) lignes"
