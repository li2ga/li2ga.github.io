"""Reference-led, independently rendered transparent trailer ornaments."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORMS = {
    'vortex': ('violet-vortex-v2-lossless.webp', '紫焰旋涡', 'Violet Vortex'),
    'suns': ('golden-suns-v1-lossless.webp', '赤金多日阵', 'Golden Suns'),
    'filaments': ('golden-filaments-v1-lossless.webp', '金色万丝展开', 'Golden Filaments'),
    'dragon': ('cyan-dragon-v1-lossless.webp', '青龙光焰', 'Azure Dragon'),
    'strings': ('scarlet-strings-v1-lossless.webp', '赤弦流光', 'Scarlet Strings'),
}


def version(path):
    return path + '?v=' + hashlib.sha256((ROOT / path).read_bytes()).hexdigest()[:12]


def sources():
    return {key: version('assets/backgrounds/trailer-vfx/' + item[0]) for key, item in FORMS.items()}


def host(key, side):
    return (f'<div class="trailer-placement" data-trailer-side="{side}"><div class="trailer-depth">'
            f'<div class="trailer-art" data-trailer-art="{key}"><img alt="" decoding="async" fetchpriority="low">'
            '<canvas data-trailer-flow aria-hidden="true"></canvas></div></div></div>')


def scene():
    return ('<div class="atmosphere-theme trailer-scene" data-background-scene="trailer">'
            '<div class="background-presence">' + host('vortex', 'left') + host('suns', 'right') + '</div></div>'
            '<script type="application/json" id="trailer-art-sources">' + json.dumps(sources()) + '</script>')


def preview():
    buttons = ''.join(f'<button data-trailer-select="{key}" aria-pressed="{str(key=="vortex").lower()}">{item[1]}</button>' for key,item in FORMS.items())
    return '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>武动 · 光焰 | Jia Li</title><link rel="icon" href="assets/favicon.png"><style>
*{box-sizing:border-box}body{margin:0;background:#080c15;color:#e6dfd3;font:15px/1.6 Georgia,'Microsoft YaHei',serif}body.light{background:#faf9f6;color:#26313b}header,footer{max-width:1500px;margin:auto;padding:24px 32px}header{display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}h1{font-size:32px;letter-spacing:.15em;font-weight:400;margin:0}p{margin:5px 0;opacity:.68}nav{display:flex;gap:10px;flex-wrap:wrap}button,a{color:inherit;font:inherit}button{border:1px solid #9e987b66;background:transparent;border-radius:24px;padding:7px 16px;cursor:pointer}button[aria-pressed=true]{border-color:#d4ad6e;color:#d4ad6e}a{text-decoration:none;border-bottom:1px solid #9e987b}button:focus-visible,a:focus-visible{outline:2px solid #d4ad6e;outline-offset:4px}.page-atmosphere{position:relative;max-width:1500px;margin:auto;min-height:560px;height:calc(100svh - 220px)}.trailer-art{position:absolute;inset:0}.trailer-art img,.trailer-art canvas{position:absolute;width:100%;height:100%;object-fit:contain;display:block}.trailer-art canvas{pointer-events:none}.trailer-art:not([data-flow-active]) canvas{visibility:hidden}.trailer-art[data-flow-active] img{visibility:hidden}footer{font-size:13px}footer p{max-width:1000px}#load-note{color:#bba27b;opacity:1}[hidden]{display:none!important}@media(max-width:700px){header,footer{padding:18px}.page-atmosphere{height:65svh;min-height:350px}h1{font-size:26px}button{padding:6px 11px}}
</style><header><div><h1>武动 · 光焰</h1><p>紫焰回旋 · 赤金聚日 · 金丝绽开 · 青龙光焰 · 赤弦流光</p></div><nav><a href="./?background=trailer">回到主页</a><button id="tone">浅色背景</button><button id="motion" aria-pressed="true">暂停动态</button></nav></header><nav style="justify-content:center;padding:0 20px">''' + buttons + '''</nav><main class="page-atmosphere" data-art-scope="gallery" data-background-current="trailer" data-art-motion="loop"><div class="trailer-art" data-trailer-art="vortex"><img alt="紫焰旋涡" decoding="async"><canvas data-trailer-flow aria-hidden="true"></canvas></div></main><footer><p id="load-note" role="status">正在加载…</p><p>参考：<a href="https://www.youtube.com/watch?v=3dBEJgBg_fc" target="_blank" rel="noopener">武动乾坤第七季官方 PV</a>。依据参考帧独立重绘，实时二维光焰，保留原生纹理。</p><button data-trailer-retry hidden>重试加载</button></footer><script type="application/json" id="trailer-art-sources">''' + json.dumps(sources()) + '''</script><script src="''' + version('trailer-effects.js') + '''"></script><script>
const root=document.querySelector('.page-atmosphere');document.querySelector('#tone').onclick=e=>{const light=document.body.classList.toggle('light');e.currentTarget.textContent=light?'深色背景':'浅色背景'};document.querySelector('#motion').onclick=e=>{const play=root.dataset.artMotion==='still';root.dataset.artMotion=play?'loop':'still';e.currentTarget.setAttribute('aria-pressed',String(play));e.currentTarget.textContent=play?'暂停动态':'播放动态'};
</script></html>'''
