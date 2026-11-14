"""An isolated view of the same figure and live thunder used by Lotus mode."""
import hashlib
from pathlib import Path
import runpy

ROOT=Path(__file__).resolve().parents[1]

def preview():
    art=runpy.run_path(str(ROOT/'tools/ambient_art.py'))['artwork']('seven-star')
    script=(ROOT/'seven-star.js').read_text(encoding='utf-8')
    # This page is a gallery. It does not contain the homepage analytics client.
    return '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>七星 · 金雷</title><link rel="icon" href="assets/favicon.png"><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#f7f9fc;color:#283b4a;font:14px/1.7 system-ui,'Microsoft YaHei',sans-serif;transition:background .5s,color .5s}body.dark{background:#101a25;color:#e3e9ef}header{position:fixed;z-index:3;top:22px;left:30px;right:30px;display:flex;align-items:start;justify-content:space-between;gap:20px}h1{font:500 23px/1.4 Georgia,'Noto Serif CJK SC',serif;margin:0 0 4px}p{margin:0;opacity:.65;font-size:12px}nav{display:flex;gap:10px;align-items:center}button,a{font:inherit;color:inherit}button{border:1px solid #9ba8b455;background:transparent;border-radius:24px;padding:7px 18px;cursor:pointer}a{margin-left:12px;text-decoration:none;border-bottom:1px solid #b2a17c}button:focus-visible,a:focus-visible{outline:2px solid #c99a3e;outline-offset:5px}.page-atmosphere{min-height:100vh;display:grid;place-items:center}.figure{width:min(560px,90vw,calc((100vh - 110px)*2/3));aspect-ratio:2/3;position:relative;margin:70px auto 15px;isolation:isolate}.ambient-presence{width:100%;height:100%;position:relative;isolation:isolate}.ambient-raster{width:100%;height:100%;object-fit:contain;position:relative;z-index:1}.seven-star-art canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}[data-thunder-back]{z-index:0}[data-thunder-front]{z-index:2}footer{position:fixed;bottom:14px;left:25px;color:#a18a55;font-size:11px;letter-spacing:.12em}@media(max-width:600px){header{top:15px;left:18px;right:18px}h1{font-size:19px}nav{gap:6px}button{padding:6px 10px;font-size:12px}nav a{font-size:12px;margin-left:0}header p{max-width:180px;font-size:10px}.figure{margin-top:90px}}
</style><header><div><h1>七星 · 金雷</h1><p>第219集结尾 · 七星斗圣最终形态重绘</p></div><nav><button id="motion" aria-pressed="true">动态</button><button id="theme">深色</button><a href="./?background=lotus&amp;artmotion=loop">回到火莲主页</a></nav></header><main class="page-atmosphere" data-background-current="lotus" data-art-scope="gallery" data-art-motion="loop"><div class="figure">'''+art+'''</div></main><footer>GOLDEN THUNDER · LIVE</footer><script>
const img=document.querySelector('img[data-imagery-src]');img.onload=()=>{img.setAttribute('data-art-ready','');window.JiaSevenStar?.wake()};img.src=img.dataset.imagerySrc;
document.querySelector('#motion').onclick=e=>{const root=document.querySelector('.page-atmosphere'),on=root.dataset.artMotion==='still';root.dataset.artMotion=on?'loop':'still';e.target.textContent=on?'动态':'静态';e.target.setAttribute('aria-pressed',String(on))};document.querySelector('#theme').onclick=e=>{document.body.classList.toggle('dark');e.target.textContent=document.body.classList.contains('dark')?'浅色':'深色'};
</script><script>'''+script+'''</script></html>'''

if __name__=='__main__':
    (ROOT/'seven-star-preview.html').write_text(preview(),encoding='utf-8')
    print('Seven-star gallery built from homepage source.')
