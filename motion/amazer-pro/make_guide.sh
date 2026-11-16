#!/usr/bin/env bash
# Guide complet : repères de son -> bruitages -> mixage voix + bruitages -> rendu 60 i/s -> MP4 -> dossier de livraison.
#   bash make_guide.sh guide1 AMAZER_guide1_acheter
set -euo pipefail
cd "$(dirname "$0")"
FILM="$1"; NAME="$2"; PY="${PY:-/c/Python314/python.exe}"
node render/render.js --film "$FILM" --cues
"$PY" audio/sfx.py "$FILM"
"$PY" audio/mix.py "$FILM"
node render/render.js --film "$FILM" --fps 60 --workers 4
node render/compile.js --film "$FILM" --name "$NAME" --fps 60
cp "out/$NAME.mp4" "/c/Users/User/Desktop/Videos AMAZER/"
echo "LIVRE $NAME"
