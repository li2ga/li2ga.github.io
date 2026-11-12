"""Cultural imagery with depth and scene-specific upward terminology."""
import hashlib
from pathlib import Path
import runpy

ROOT=Path(__file__).resolve().parents[1]
SUBJECTS={
    'ziwei-cinematic':('ziwei',['moon','sun','palace','scroll','star-sword','crane']),
    'ganzhi-cinematic':('ganzhi',['pine','blade','water-dragon','lamp','vine','mountain'])
}


def scene(name):
    theme,subjects=SUBJECTS[name]
    objects=[]
    # Unequal sizes and different paths make a scene, rather than an icon grid.
    for index in [0,2,5,1,3,4]:
        subject=subjects[index]
        source=f'assets/backgrounds/imagery-v2/{theme}-{subject}.png'
        digest=hashlib.sha256((ROOT/source).read_bytes()).hexdigest()[:12]
        objects.append(f'<div class="imagery-object imagery-object-{index}" data-imagery-object="{subject}"><div class="imagery-flight"><div class="imagery-turn"><img data-imagery-src="{source}?v={digest}" alt="" width="512" height="512" decoding="async" fetchpriority="low" draggable="false"></div></div></div>')
    # Silk, mist and traveling light connect the independently moving objects.
    atmosphere='''<svg class="imagery-weather" viewBox="0 0 1600 1000" preserveAspectRatio="none" focusable="false"><g class="imagery-currents"><path d="M-90 720C115 780 290 450 168 298S15 128 342-80"/><path d="M1290-80C1550 67 1345 273 1469 455S1568 801 1358 1090"/><path d="M-45 715C182 773 244 488 160 310"/><path d="M1345 1090C1537 827 1484 650 1458 472"/></g><g class="imagery-glints"><path d="M-90 720C115 780 290 450 168 298S15 128 342-80" pathLength="1"/><path d="M1290-80C1550 67 1345 273 1469 455S1568 801 1358 1090" pathLength="1"/></g><g class="imagery-dust"><circle cx="160" cy="138" r="1.8"/><circle cx="273" cy="390" r="1.2"/><circle cx="116" cy="612" r="2"/><circle cx="299" cy="881" r="1.3"/><circle cx="1430" cy="210" r="1.3"/><circle cx="1306" cy="558" r="1.8"/><circle cx="1485" cy="806" r="1.5"/></g></svg>'''
    terms=runpy.run_path(str(Path(__file__).with_name('cultural_terms.py')))['procession'](name)
    return f'<div class="atmosphere-theme imagery-scene" data-background-scene="{name}">{atmosphere}{"".join(objects)}{terms}</div>'


def scenes():
    return ''.join(scene(name) for name in SUBJECTS)
