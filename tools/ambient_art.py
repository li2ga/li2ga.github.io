"""Decoded transparent character art; the first vector study is archived beside it."""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = {
    'pikachu': ('pikachu-smash-v1.png', 986, 1226),
    'dimo-royal': ('dimo-royal-v1.png', 1311, 1200),
    'miris-light': ('miris-light-v1.png', 2024, 1496),
    'ruler': ('ruler-emperor-v2.svg', 418, 440),
    'emperor': ('emperor-v2.png', 1086, 1448),
    'seven-star': ('xiaoyan-seven-star-v4-lossless.webp', 1122, 1402),
    'young-emperor': ('xiaoyan-young-emperor-v2-lossless.webp', 1199, 1312),
    'lindong-six': ('lindong-six-v1-lossless.webp', 1154, 1363),
    'lindong-seven': ('lindong-seven-v1-lossless.webp', 1086, 1448),
}


def definitions():
    return ''


def raster(name):
    filename, width, height = ASSETS[name]
    source = f'assets/backgrounds/anime-v2/{filename}'
    version = hashlib.sha256((ROOT / source).read_bytes()).hexdigest()[:12]
    return f'<img class="ambient-raster" data-imagery-src="{source}?v={version}" width="{width}" height="{height}" alt="" decoding="async" fetchpriority="low" draggable="false">'


def artwork(name):
    if name == 'seven-star':
        return ('<div class="ambient-presence seven-star-art" data-seven-star>'
                '<canvas data-thunder-back aria-hidden="true"></canvas>'
                + raster(name) + '<canvas data-thunder-front aria-hidden="true"></canvas></div>')
    if name in {'young-emperor', 'lindong-six', 'lindong-seven'}:
        return (f'<div class="ambient-presence character-energy" data-character-energy="{name}">'
                + raster(name) + '<canvas data-character-flow aria-hidden="true"></canvas></div>')
    return f'<div class="ambient-presence">{raster(name)}</div>'


def character_group(side, names):
    return f'<div class="character-cycle" data-character-cycle="{side}">' + ''.join(
        f'<div class="character-form" data-character-form="{name}"{(" hidden" if index else "")}>{artwork(name)}</div>'
        for index, name in enumerate(names)) + '</div>'


def line_parade():
    tracks = []
    for side in ['left', 'right']:
        frames = ''.join(f'<div class="line-visitor line-visitor-{index}" data-line-figure="{name}">{artwork(name)}</div>'
                         for index, name in enumerate(['pikachu', 'dimo-royal', 'miris-light', 'ruler']))
        tracks.append(f'<div class="line-procession line-procession-{side}"><div class="line-procession-depth"><div class="line-scan"></div>{frames}</div></div>')
    return ''.join(tracks)


def lotus_companions():
    return ''.join(f'<div class="lotus-companion lotus-companion-{index}" data-lotus-companion="{name}"><div class="companion-depth">'
                   + (character_group('left', ['seven-star', 'young-emperor']) if index == 4 else
                      character_group('right', ['lindong-six', 'lindong-seven', 'emperor']) if index == 1 else artwork(name))
                   + '</div></div>'
                   for index, name in enumerate(['ruler', 'emperor', 'ruler', 'emperor', 'seven-star']))


def meteors():
    return '<div class="sky-meteors" aria-hidden="true">' + ''.join(f'<div class="meteor-flight meteor-flight-{i}"><span class="meteor-streak"></span></div>' for i in range(4)) + '</div>'


def autumn_leaves():
    """Small original vector leaves; fall, gust and tumbling use separate layers."""
    definitions = '''<svg class="autumn-definitions" aria-hidden="true"><defs>
      <symbol id="autumn-maple" viewBox="0 0 64 68"><path class="leaf-silhouette" d="M31 56 28 43 13 48 16 38 5 30 18 27 14 14 26 22 32 4 39 23 51 15 47 29 60 31 48 40 50 49 36 43 34 57Z"/><path class="leaf-veins" d="M32 54 32 14 M32 37 19 24 M32 40 45 27 M31 44 20 43 M34 45 45 45"/><path class="leaf-stem" d="M33 54Q35 61 30 66"/></symbol>
      <symbol id="autumn-ginkgo" viewBox="0 0 64 68"><path class="leaf-silhouette" d="M32 55C25 42 9 42 5 27 1 15 11 7 21 9Q29 11 32 18Q34 10 42 9C53 6 64 16 59 28 55 41 39 43 34 55Z"/><path class="leaf-veins" d="M33 52Q17 29 12 20 M33 52 22 17 M33 52 32 25 M33 52 43 18 M33 52Q46 31 53 21"/><path class="leaf-stem" d="M33 52Q36 59 31 66"/></symbol>
      <symbol id="autumn-birch" viewBox="0 0 64 68"><path class="leaf-silhouette" d="M31 55C13 46 10 26 24 6 39 7 55 19 48 37 45 46 40 52 31 55Z"/><path class="leaf-veins" d="M31 53Q35 31 24 8 M32 45 21 35 M33 35 23 24 M33 42 44 32 M31 29 40 22"/><path class="leaf-stem" d="M31 53Q33 60 28 66"/></symbol>
    </defs></svg>'''
    positions = [3,14,26,35,45,57,68,76,86,94,22,82]
    sizes = [17,22,14,18,15,20,16,24,17,15,13,19]
    durations = [32,41,35,46,38,33,44,36,42,39,47,34]
    phases = [-6,-28,-15,-34,-4,-20,-31,-13,-38,-22,-10,-25]
    drift = [150,95,180,110,145,170,75,140,110,70,185,90]
    kinds = [('maple','#c58751'),('ginkgo','#c3a04f'),('birch','#ad8058')]
    leaves = []
    for i, x in enumerate(positions):
        kind, color = kinds[i%3]
        style = (f'--leaf-x:{x}%;--leaf-size:{sizes[i]}px;--leaf-time:{durations[i]}s;'
                 f'--leaf-phase:{phases[i]}s;--leaf-drift:{drift[i]}px;--leaf-color:{color};'
                 f'--leaf-alpha:{.35+.05*(i%4):.2f};--sway-time:{5.3+.7*(i%5):.1f}s;--turn-time:{8.1+1.1*(i%4):.1f}s')
        leaves.append(f'<span class="leaf-flight" style="{style}"><span class="leaf-sway"><span class="leaf-turn"><svg class="autumn-leaf" viewBox="0 0 64 68" focusable="false"><use href="#autumn-{kind}"/></svg></span></span></span>')
    return '<div class="sky-leaves" aria-hidden="true">'+definitions+''.join(leaves)+'</div>'
