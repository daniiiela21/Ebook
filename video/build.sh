#!/usr/bin/env bash
# Full pipeline: soundtrack -> 4 silent renders -> mux (H.264 + AAC, 1080x1920, 30 fps, 18 s)
set -euo pipefail
cd "$(dirname "$0")"
FFMPEG="${FFMPEG:-ffmpeg}"
export FFMPEG
VARIANTS="${*:-base A B C}"
mkdir -p build ../out
python3 audio/audio.py $VARIANTS
for v in $VARIANTS; do
  [ -f "build/silent_$v.mp4" ] || node render.mjs video "$v" "build/silent_$v.mp4"
  name="reel_horta_$v"; [ "$v" = base ] && name="reel_horta_principal"
  [ "$v" != base ] && name="reel_horta_hook_$v"
  "$FFMPEG" -y -loglevel error -i "build/silent_$v.mp4" -i "build/audio_$v.wav" \
    -filter:a "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000" \
    -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -t 18 -movflags +faststart "../out/$name.mp4"
  echo "ok ../out/$name.mp4"
done
