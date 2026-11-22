"""A frontal golden fire lotus unfolds into first-visit trajectories."""

TRACE_DURATION_MS = 3600
PRELUDE_DURATION_MS = 14400
INTRO_DURATION_MS = PRELUDE_DURATION_MS + TRACE_DURATION_MS


def fire_lotus():
    """Inline blossom also covers slow downloads, disabled WebGL and context loss."""
    import hashlib
    from pathlib import Path
    bundle = Path(__file__).resolve().parents[1] / 'assets/entrance/golden-lotus-v1.js'
    version = hashlib.sha256(bundle.read_bytes()).hexdigest()[:12]
    petals = []
    for tier, (count, length, width, start, end) in enumerate([
        (16, 202, 32, 3300, 5450), (16, 179, 30, 4700, 6850),
        (16, 151, 27, 6250, 8350), (12, 121, 25, 7850, 9750),
        (12, 90, 20, 9200, 10850), (8, 59, 16, 10350, 11750)
    ]):
        row = []
        for i in range(count):
            delay = i % 3 * 140
            d = f'M7 0 C{length*.3:.1f} {-width:.1f} {length*.72:.1f} {-width*1.1:.1f} {length} 0 C{length*.72:.1f} {width*1.1:.1f} {length*.3:.1f} {width:.1f} 7 0Z'
            row.append(f'<g transform="rotate({i*360/count+tier*14.3-90:.2f})"><g class="lotus-fallback-petal" style="--open-start:{start+delay}ms;--open-duration:{end-start}ms"><path class="lotus-fallback-body" d="{d}"/><path class="lotus-fallback-vein" d="M9 0 Q{length*.55:.1f} -5 {length-2} 0 M{length*.28:.1f} 0 Q{length*.45:.1f} {-width*.78:.1f} {length*.7:.1f} {-width*.58:.1f} M{length*.42:.1f} 0 Q{length*.6:.1f} {width*.72:.1f} {length*.8:.1f} {width*.42:.1f}"/></g></g>')
        petals.append('<g class="lotus-fallback-tier">'+''.join(row)+'</g>')
    return f'''<div class="entrance-lotus" data-runtime="assets/entrance/golden-lotus-v1.js?v={version}">
      <div class="lotus-entrance-halo"></div><canvas class="entrance-lotus-canvas"></canvas>
      <svg class="lotus-entrance-fallback" viewBox="-240 -240 480 480" focusable="false">
        <defs><linearGradient id="entry-lotus-gold" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#fff6d7"/><stop offset=".2" stop-color="#e9bd65"/><stop offset=".38" stop-color="#b8dfdb"/><stop offset=".51" stop-color="#bea3d3"/><stop offset=".64" stop-color="#e5b5ad"/><stop offset=".8" stop-color="#f8daa0"/><stop offset="1" stop-color="#fff0c4"/></linearGradient></defs>
        {''.join(petals)}<circle class="lotus-fallback-heart" r="12"/>
      </svg>
    </div>'''


def entrance():
    groups=[]
    for side in ['left','right']:
        lines=[]
        for i in range(6):
            x=90+i*32 if side=='left' else 1350-i*32
            bend=480+i*28 if side=='left' else 960-i*28
            d=f'M{x} {-70+i*26} C{x-170 if side=="left" else x+170} {210+i*10} {bend} {170+i*33} 720 450 C{bend} {710-i*22} {x} {705-i*6} {x+85 if side=="left" else x-85} 960'
            lines.append(f'<path d="{d}" pathLength="1" style="--trace-delay:{i*TRACE_DURATION_MS//75}ms"/>')
        groups.append(f'<g class="entrance-traces entrance-{side}">{"".join(lines)}</g>')
    return f'<div class="site-entrance" data-duration="{INTRO_DURATION_MS}" style="--intro-duration:{INTRO_DURATION_MS}ms;--intro-prelude:{PRELUDE_DURATION_MS}ms;--intro-trace-duration:{TRACE_DURATION_MS}ms" aria-hidden="true">'+fire_lotus()+'<svg viewBox="0 0 1440 900" preserveAspectRatio="none" focusable="false">'+''.join(groups)+'</svg><div class="entrance-name"><span>Jia Li</span><i>|</i><span lang="zh-CN">李嘉</span></div></div>'


def bootstrap():
    # Release the page even if its primary script cannot finish initializing.
    return '''<script>(()=>{try{const preview=new URLSearchParams(location.search).get('intro')==='preview';const repeated=localStorage.getItem('jia-li-intro-seen');const internal=document.referrer&&new URL(document.referrer).origin===location.origin;if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!location.hash&&(preview||(!repeated&&!internal))){document.documentElement.classList.add('intro-pending');window.setTimeout(()=>document.documentElement.classList.remove('intro-pending'),DURATION);}}catch(_){}})();</script>'''.replace('DURATION', str(INTRO_DURATION_MS+1000))
