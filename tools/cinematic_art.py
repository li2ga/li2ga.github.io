"""Original celestial-space and fire-lotus vector studies, not reproduced film frames."""
from math import sin, cos, pi
from pathlib import Path
import runpy


def project(r,theta,z):
    return 200+r*cos(theta), 275+.38*r*sin(theta)-z


def lotus_world():
    petals=[]
    for ring,(count,radius,height,width) in enumerate([(12,150,75,46),(10,107,133,39),(7,52,144,29)]):
        for n in range(count):
            theta=2*pi*(n+.25*(ring%2))/count
            tip=project(radius,theta,height)
            base=project(7,theta,0)
            c1=project(radius*.35,theta,height*.06)
            c2=project(radius*.96,theta,height*.53)
            # A petal has a broad translucent belly and one pointed flame tip.
            side=(-sin(theta)*width,cos(theta)*width*.38)
            d=(f'M{base[0]:.2f} {base[1]:.2f} C{c1[0]+side[0]:.2f} {c1[1]+side[1]:.2f} '
               f'{c2[0]+side[0]:.2f} {c2[1]+side[1]:.2f} {tip[0]:.2f} {tip[1]:.2f} '
               f'C{c2[0]-side[0]:.2f} {c2[1]-side[1]:.2f} {c1[0]-side[0]:.2f} {c1[1]-side[1]:.2f} {base[0]:.2f} {base[1]:.2f}Z')
            # The reference is the pink/white lotus after Pure Lotus Demon Flame,
            # rather than the earlier green multi-flame lotus.
            vein=f'M{base[0]:.2f} {base[1]:.2f}Q{c1[0]:.2f} {c1[1]:.2f} {tip[0]:.2f} {tip[1]:.2f}'
            petals.append((sin(theta)-ring*.06,f'<g><path class="demon-petal" d="{d}" fill="url(#demon-petal)" style="--petal-light:{.76+.15*cos(theta):.2f}"/><path class="demon-petal-vein" d="{vein}"/></g>'))
    petals.sort(key=lambda item:item[0])
    wisps=[]
    for i in range(9):
        x=74+i*31; y=232-88*sin(pi*i/8)
        wisps.append(f'<path d="M{x} {y+43:.1f}Q{x-32} {y-6:.1f} {x+3} {y-36:.1f}Q{x+22} {y-62:.1f} {x+7} {y-84:.1f}" style="--wisp-delay:{-i*1.4}s"/>')
    sparks=''.join(f'<circle cx="{52+(i*47)%296}" cy="{46+(i*29)%263}" r="{.8+(i%3)*.4}" style="--wisp-delay:{-i*.7}s"/>' for i in range(19))
    return f'''<symbol id="background-demon-lotus" viewBox="0 0 400 400">
      <ellipse cx="200" cy="224" rx="179" ry="146" fill="url(#demon-aura)"/>
      <g class="demon-pressure"><ellipse cx="200" cy="296" rx="162" ry="32"/><ellipse cx="200" cy="298" rx="139" ry="24"/><path d="M12 293Q200 355 388 293"/></g>
      <g class="demon-wisps">{''.join(wisps)}</g>
      <g class="demon-flower">{''.join(p for _,p in petals)}
      <path class="demon-heart" d="M200 265C177 246 185 213 196 198C186 217 210 220 207 193C230 223 221 248 200 265Z"/>
      <path class="demon-filament" d="M64 241Q202 339 340 236M87 223Q200 310 313 218M174 168Q194 210 199 252Q201 210 225 167"/>
      </g>
      <ellipse cx="200" cy="278" rx="32" ry="6" fill="url(#demon-core)"/>
      <g class="demon-sparks">{sparks}</g>
    </symbol>'''


def definitions():
    return f'''<svg class="atmosphere-definitions" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>
      <radialGradient id="demon-aura"><stop stop-color="#f3b4d4" stop-opacity=".34"/><stop offset=".6" stop-color="#e4c9eb" stop-opacity=".15"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="demon-petal" x1=".2" y1="0" x2=".7" y2="1"><stop stop-color="#fffaff"/><stop offset=".28" stop-color="#ffdff7"/><stop offset=".56" stop-color="#e99ed2" stop-opacity=".76"/><stop offset=".83" stop-color="#dab6ee" stop-opacity=".57"/><stop offset="1" stop-color="#fff7fb"/></linearGradient>
      <linearGradient id="demon-jade" x2=".5" y2="1"><stop stop-color="#fff"/><stop offset=".57" stop-color="#b5e5de" stop-opacity=".66"/><stop offset="1" stop-color="#d4b6e5" stop-opacity=".5"/></linearGradient>
      <radialGradient id="demon-core"><stop stop-color="#fff"/><stop offset=".5" stop-color="#ffd6eb"/><stop offset="1" stop-color="#ea9dc6" stop-opacity="0"/></radialGradient>
      <linearGradient id="celestial-platinum" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".5" stop-color="#e7dfc9"/><stop offset=".7" stop-color="#fff"/><stop offset="1" stop-color="#a8b8ca"/></linearGradient>{lotus_world()}
    </defs></svg>'''


def evolution_scene():
    motifs=[]
    for index,position in enumerate(['top-left','top-right','lower-left','lower-right']):
        frames=''.join(f'<span class="lotus-frame" data-lotus-frame="{index}"></span>' for index in range(14))
        energy='<svg class="lotus-energy" viewBox="0 0 400 400" focusable="false"><g class="lotus-evolving-rings"><ellipse cx="200" cy="255" rx="173" ry="38"/><ellipse cx="200" cy="249" rx="157" ry="34" transform="rotate(-18 200 249)"/></g><g class="lotus-evolving-sparks"><circle cx="85" cy="98" r="1.5"/><circle cx="291" cy="82" r="1.2"/><circle cx="342" cy="211" r="1.4"/><circle cx="73" cy="281" r="1.6"/></g></svg>'
        motifs.append(f'<div class="atmosphere-motif lotus-evolution motif-{position}" data-lotus-instance="{index}" data-lotus-stage=""><div class="lotus-float"><div class="lotus-hover">{frames}{energy}</div></div></div>')
    companions=runpy.run_path(str(Path(__file__).with_name('ambient_art.py')))['lotus_companions']()
    return '<div class="atmosphere-theme cinematic-scene has-raster-art" data-background-scene="lotus" data-lotus-stage="0">'+''.join(motifs)+companions+'</div>'


def scenes():
    result=[]
    for name,symbol in [('lotus-still','background-demon-lotus')]:
        motifs=''.join(f'<svg class="atmosphere-motif motif-{position}" viewBox="0 0 400 400" focusable="false"><use href="#{symbol}"/></svg>' for position in ['top-left','top-right','lower-left','lower-right'])
        result.append(f'<div class="atmosphere-theme cinematic-scene" data-background-scene="{name}">{motifs}</div>')
    imagery=runpy.run_path(str(Path(__file__).with_name('imagery_art.py')))['scenes']()
    return definitions()+''.join(result)+imagery+evolution_scene()
