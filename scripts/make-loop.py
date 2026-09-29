"""Make a seamless loop from a clip by crossfading its tail into its head.

usage: python3 scripts/make-loop.py in.mp4 out.mp4 [fade_seconds=1.0]

The last `fade` seconds are blended over the first `fade` seconds, and the
output is shortened by `fade`, so frame N-1 flows straight into frame 0.
Also prints mean frame-to-frame change (motion) and the seam difference.
"""
import subprocess
import sys

import numpy as np


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                          'stream=width,height,r_frame_rate', '-of', 'csv=p=0', path],
                         capture_output=True, text=True).stdout.strip().split(',')
    w, h = int(out[0]), int(out[1])
    num, den = out[2].split('/')
    return w, h, float(num) / float(den)


def frames(path, w, h):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)


def motion(fr):
    g = fr[:, ::8, ::8].mean(axis=3)
    return float(np.abs(np.diff(g, axis=0)).mean())


def main():
    src, dst = sys.argv[1], sys.argv[2]
    fade = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    w, h, fps = probe(src)
    fr = frames(src, w, h)
    n = int(round(fade * fps))
    body = fr[:len(fr) - n].astype(np.float32)
    tail = fr[len(fr) - n:].astype(np.float32)
    for i in range(n):
        a = (i + 1) / (n + 1)  # 0 → tail, 1 → head
        body[i] = tail[i] * (1 - a) + body[i] * a
    out = body.clip(0, 255).astype(np.uint8)
    seam = float(np.abs(out[-1].astype(float) - out[0].astype(float)).mean())
    print(f'{src}: {len(fr)} frames @ {fps:g}fps, motion {motion(fr):.2f}, loop {len(out)} frames, seam diff {seam:.2f}')
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}',
                          '-r', f'{fps:g}', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14',
                          '-pix_fmt', 'yuv420p', dst], stdin=subprocess.PIPE)
    p.stdin.write(out.tobytes())
    p.stdin.close()
    p.wait()


if __name__ == '__main__':
    main()
