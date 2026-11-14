"""Create a clean publish ZIP containing only this homepage's public files."""

import argparse
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = [
    "README.md", "index.html", "site.css", "script.js", "background-runtime.js", "art-loops.js", "lotus-videos.js", "analytics.js", "cv.html", "cv.css", ".nojekyll",
    "assets/backgrounds/motion/manifest.json",
    *[str(path.relative_to(ROOT)).replace('\\', '/') for path in sorted((ROOT/'assets/backgrounds/motion').glob('*.webm'))],
    "motion-preview.html", "assets/previews/blue-flame-loop.gif",
    "volumetric-preview.html", "assets/backgrounds/fire-lotus-cold-body-v1.png",
    "lotus-review.js", "lotus-review-effects.js", "lotus-review-composite.js", "lotus-atmosphere.js", "background-music.js",
    *[f"assets/previews/lotus-flames/{lotus}-{file}"
      for lotus in ('blue', 'jade', 'fusion', 'pearl', 'rings', 'gold', 'emperor',
                    'destruction', 'radial', 'formation', 'refined', 'branches')
      for file in ('flame-v2.webp', 'flame-poster-v2.png')],
    *[f"assets/backgrounds/lotus-effects/{name}-448-v1.webp" for name in (
        'blue', 'cold', 'jade', 'fusion', 'pearl', 'rings', 'gold', 'emperor',
        'destruction', 'radial', 'formation', 'refined', 'branches')],
    "assets/audio/our-adventure-v1.mp3", "assets/audio/chi-nian-v1.mp3",
    "assets/audio/our-adventure-instrumental-v1.flac",
    "assets/audio/rebirth-instrumental-v1.flac",
    "assets/audio/far-beyond-us-instrumental-v1.flac",
    "assets/audio/dominate-instrumental-v2.mp3",
    "assets/audio/zhi-wo-instrumental-v1.flac",
    "assets/audio/zong-ma-ta-ge-xing-v1.flac",
    "assets/audio/bu-mie-instrumental-v1.mp3",
    "assets/audio/xin-ji-instrumental-v1.flac",
    "assets/audio/qian-hui-v1.flac",
    "assets/audio/zhu-guang-v1.flac",
    "assets/audio/xian-zai-huan-wo-v1.flac",
    "assets/audio/wu-yang-v1.flac",
    "assets/audio/wen-ding-v1.flac",
    "assets/audio/zhan-ge-v1.flac",
    "assets/audio/wo-jiu-shi-wo-v1.flac",
    "assets/audio/wen-v1.flac",
    "assets/audio/wen-xing-v1.flac",
    "assets/audio/shou-ni-suo-wang-v1.flac",
    "emperor-scene.js", "emperor-scene.css", "emperor-preview.html", "emperor-flames.html",
    "assets/backgrounds/tuoshe-emperor-v1.png",
    "assets/backgrounds/heavenly-flame-ruler-v1.png",
    "assets/backgrounds/heavenly-flame-ruler-v3.png",
    "assets/previews/cold-volumetric-fire-v1.webp", "assets/previews/cold-volumetric-fire-still-v1.png",
    "lotus-duel-light.js", "assets/previews/cold-volumetric-fire-v2.webp", "assets/previews/cold-volumetric-fire-still-v2.png",
    "lotus-cold-core.js", "assets/previews/cold-volumetric-fire-v3.webp", "assets/previews/cold-volumetric-fire-still-v3.png",
    "heavenly-flames.html", "heavenly-flames.css", "heavenly-flames.js",
    *[f"assets/heavenly-flames/plate-{i:02}-v1.png" for i in range(1,5)],
    "assets/favicon.svg", "assets/favicon.png", "assets/favicon.ico",
    "assets/icons/lotus-pink-gold.svg", "assets/icons/jl-square.svg",
    "assets/icons/lotus-pink-gold-transparent.svg",
    "assets/icons/yin-yang.svg",
    "assets/icons/yin-yang-counter-rotate.svg",
    *[f"assets/backgrounds/anime-v2/{name}" for name in ['miris-v2.png', 'pikachu-official-v1.png', 'ruler-official-v1.svg', 'emperor-v2.png']],
    *[f"assets/backgrounds/anime-v2/{name}" for name in ['pikachu-smash-v1.png', 'miris-light-v1.png', 'dimo-royal-v1.png']],
    "assets/backgrounds/anime-v2/ruler-emperor-v2.svg",
    "seven-star.js", "seven-star-preview.html", "assets/backgrounds/anime-v2/xiaoyan-seven-star-v3.png",
    "character-art.js",
    *[f"assets/backgrounds/anime-v2/{name}-lossless.webp" for name in (
        'xiaoyan-seven-star-v4', 'xiaoyan-young-emperor-v1', 'lindong-six-v1', 'lindong-seven-v1')],
    "vault-preview.html", "assets/entrance/vault-preview-v1.js", "assets/entrance/THREE-LICENSE.txt",
    "assets/backgrounds/fire-lotus-emperor-v1.svg",
    "assets/backgrounds/fire-lotus-tuoshe-v1.png",
    "assets/backgrounds/fire-lotus-destruction-v1.png",
    "assets/backgrounds/fire-lotus-radial-v1.png",
    "assets/backgrounds/fire-lotus-formation-v1.png",
    "assets/backgrounds/fire-lotus-refined-v1.png",
    "assets/backgrounds/fire-lotus-branches-v1.png",
    *[f"assets/backgrounds/fire-lotus-{name}-v1-lossless.webp" for name in (
        'blue', 'cold', 'jade', 'fusion', 'pearl', 'rings', 'gold', 'destruction',
        'radial', 'formation', 'refined', 'branches')],
    "assets/analytics/summary.json", "assets/analytics/visitor-map.svg",
    "tools/update_public_stats.py", ".github/workflows/update-public-stats.yml",
    "assets/profile/jia-li-portrait.jpg", "assets/profile/wechat-qr.jpg",
    "assets/profile/jia-li-portrait-progressive-v1.jpg",
    "assets/effects/sparkling-moon.png",
    "assets/backgrounds/fire-lotus-evolution-v1.png",
    "assets/backgrounds/fire-lotus-evolution-v1.webp",
    "assets/backgrounds/fire-lotus-cold-v1.png",
    "assets/backgrounds/fire-lotus-cold-v1.webp",
    *[f"assets/backgrounds/fire-lotus-{name}-v1.png" for name in ['blue', 'jade', 'fusion', 'pearl', 'rings', 'gold']],
    *[f"assets/backgrounds/imagery-v2/ziwei-{name}.png" for name in ['moon', 'sun', 'palace', 'scroll', 'star-sword', 'crane']],
    *[f"assets/backgrounds/imagery-v2/ganzhi-{name}.png" for name in ['pine', 'blade', 'water-dragon', 'lamp', 'vine', 'mountain']],
    "assets/research/mimicall.png", "assets/research/ufo.png",
    "assets/research/sugar.png", "assets/research/i2e.png",
    "assets/documents/Jia-Li-CV.pdf",
    "assets/fonts/lato-regular.woff2", "assets/fonts/lato-bold.woff2",
    "assets/fonts/lato-italic.woff2", "assets/fonts/lato-bold-italic.woff2", "assets/fonts/OFL.txt",
    "assets/institutions/roboparty.png", "assets/institutions/pku.png", "assets/institutions/hust-seal.svg",
    "assets/fonts/name-latin.ttf", "assets/fonts/name-chinese.ttf",
    "assets/fonts/name-classic.otf", "assets/fonts/GUST-FONT-LICENSE.txt",
    "assets/fonts/README-TeX-Gyre-Termes.txt", "assets/fonts/LPPL-1.3c.txt",
    "assets/fonts/CormorantGaramond-OFL.txt", "assets/fonts/NotoSerifSC-OFL.txt",
    "assets/research/ufo-demo.mp4", "assets/research/sugar-demo.mp4",
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="ZIP path; use a path outside the source repository")
    args = parser.parse_args()
    output = args.output.resolve()
    if output == ROOT or ROOT in output.parents:
        parser.error("Choose an output outside the source repository.")
    missing = [name for name in PUBLIC_FILES if not (ROOT / name).is_file()]
    if missing:
        parser.error("Build the site and CV first; missing: " + ", ".join(missing))
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in PUBLIC_FILES:
            archive.write(ROOT / name, name)
    print(f"Packaged {len(PUBLIC_FILES)} public files: {output}")
    print("Legacy template folders, verification tokens and private source materials are excluded.")


if __name__ == "__main__":
    main()
