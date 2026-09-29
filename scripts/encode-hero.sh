#!/bin/sh
# Re-encode the hero film from the Higgsfield master (art/hero/takeA-spray.mp4,
# 10 s, first frame = last frame). Drops the final frame so the loop is seamless.
set -e
cd "$(dirname "$0")/.."
IN=art/hero/takeA-spray.mp4; O=public/assets/video; N=240
X264="-c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -profile:v high -movflags +faststart"
ffmpeg -v error -y -i $IN -frames:v $N -an $X264 $O/cabine-1920.mp4
# Phones: dedicated vertical take (art/hero/takeA-phone-loop.mp4, made seamless with
# scripts/make-loop.py), 540x960 with a capped bitrate so it stays light on mobile data.
PHONE=art/hero/takeA-phone-loop.mp4
ffmpeg -v error -y -i $PHONE -an -vf "scale=540:960:flags=lanczos" -c:v libx264 -preset slow -crf 24 -maxrate 1000k -bufsize 2000k -pix_fmt yuv420p -profile:v high -movflags +faststart $O/cabine-portrait.mp4
ffmpeg -v error -y -ss 0 -i $IN -frames:v 1 -q:v 3 $O/cabine-poster-1920.jpg
ffmpeg -v error -y -ss 0 -i $PHONE -frames:v 1 -vf "scale=540:960:flags=lanczos" -q:v 4 $O/cabine-poster-portrait.jpg
