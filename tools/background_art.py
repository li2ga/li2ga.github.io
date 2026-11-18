"""Original decorative SVG scenes. Ziwei and Ganzhi motifs are not personal charts."""
from math import cos, sin, pi
from pathlib import Path
import runpy


def point(radius, angle, center=200):
    return center + radius*cos(angle), center + radius*sin(angle)


def ring_labels(labels, radius, class_name):
    items=[]
    for index,label in enumerate(labels):
        x,y=point(radius,2*pi*index/len(labels)-pi/2)
        items.append(f'<text x="{x:.2f}" y="{y:.2f}" class="background-text {class_name}">{label}</text>')
    return ''.join(items)


def symbols():
    ticks=[]
    for index in range(60):
        angle=2*pi*index/60-pi/2
        x1,y1=point(151 if index%5 else 145,angle)
        x2,y2=point(158,angle)
        ticks.append(f'<path d="M{x1:.2f} {y1:.2f} {x2:.2f} {y2:.2f}"/>')
    petals=[]
    petal='M200 270 C139 235 145 168 200 97 C255 168 261 235 200 270Z'
    for index,angle in enumerate([-72,-48,-24,0,24,48,72]):
        petals.append(f'<path d="{petal}" transform="rotate({angle} 200 270)" class="lotus-petal"/>')
    for angle in [-55,-28,0,28,55]:
        petals.append(f'<path d="{petal}" transform="translate(40 54) scale(.8) rotate({angle} 200 270)" class="lotus-inner-petal"/>')
    stars=[(200,105,'紫微'),(282,150,'天府'),(277,239,'太阴'),(204,290,'天相'),(119,244,'天梁'),(116,151,'武曲')]
    star_marks=''.join(f'<circle cx="{x}" cy="{y}" r="3"/><text x="{x}" y="{y-12}" class="background-text star-name">{label}</text>' for x,y,label in stars)
    element_marks=[]
    vertices=[]
    for index,label in enumerate('木火土金水'):
        x,y=point(87,2*pi*index/5-pi/2)
        vertices.append((x,y))
        element_marks.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="18"/><text x="{x:.2f}" y="{y:.2f}" class="background-text element-name">{label}</text>')
    pentagram=' '.join(f'{vertices[i][0]:.2f},{vertices[i][1]:.2f}' for i in [0,2,4,1,3,0])
    return f'''<svg class="atmosphere-definitions" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs>
      <linearGradient id="lotus-petal-ink" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff8e8"/><stop offset=".52" stop-color="#f8dfd1"/><stop offset="1" stop-color="#e6b8cb"/></linearGradient>
      <linearGradient id="lotus-jade-ink" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff5cf"/><stop offset=".65" stop-color="#d2e7df"/><stop offset="1" stop-color="#91c8bd"/></linearGradient>
      <symbol id="background-fire-lotus" viewBox="0 0 400 400">
        <g class="lotus-aura"><circle cx="200" cy="205" r="151"/><circle cx="200" cy="205" r="141" stroke-dasharray="2 11"/>
          <path d="M57 205H39 M343 205H361 M200 62V44 M200 348V366"/></g>
        <g class="lotus-bloom">{''.join(petals)}
          <path class="lotus-flame" d="M200 250 C157 224 174 188 185 168 C189 192 198 194 200 171 C203 137 223 125 216 96 C254 134 244 166 231 185 C221 201 237 202 241 188 C255 216 232 244 200 250Z"/>
          <path class="lotus-flame-core" d="M201 239 C180 221 197 205 199 188 C214 203 225 219 201 239Z"/>
          <path class="lotus-vein" d="M200 270 Q180 202 200 126 M200 270 Q142 237 114 195 M200 270 Q258 237 286 195 M95 289 Q200 329 305 289"/>
        </g>
        <g class="lotus-embers"><path d="M83 96Q96 78 92 65Q111 88 98 104Q89 113 83 96Z M302 139Q313 125 310 114Q326 132 317 145Q309 152 302 139Z M133 54Q142 42 140 33Q153 48 146 59Q140 64 133 54Z"/>
          <circle cx="274" cy="71" r="2"/><circle cx="68" cy="159" r="1.8"/><circle cx="327" cy="246" r="2.3"/></g>
        <text x="200" y="359" class="background-text motif-caption">火 莲</text>
      </symbol>
      <symbol id="background-ziwei" viewBox="0 0 400 400">
        <g class="ziwei-orbits"><circle cx="200" cy="200" r="162"/><circle cx="200" cy="200" r="144"/>
          <circle cx="200" cy="200" r="121" stroke-dasharray="1 8"/>{''.join(ticks)}</g>
        <g class="ziwei-stars"><path d="M200 105 282 150 277 239 204 290 119 244 116 151 200 105 M116 151 277 239 M200 105 204 290"/>{star_marks}</g>
        <circle class="ziwei-center" cx="200" cy="200" r="34"/>
        <text x="200" y="198" class="background-text motif-center">紫 微</text><text x="200" y="216" class="background-text motif-small">禄 · 权 · 科 · 忌</text>
        {ring_labels(['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','交友','官禄','田宅','福德','父母'],179,'palace-name')}
      </symbol>
      <symbol id="background-ganzhi" viewBox="0 0 400 400">
        <g class="ganzhi-orbits"><circle cx="200" cy="200" r="171"/><circle cx="200" cy="200" r="143"/>
          <circle cx="200" cy="200" r="112" stroke-dasharray="2 9"/>{''.join(ticks)}</g>
        {ring_labels('子丑寅卯辰巳午未申酉戌亥',187,'branch-name')}
        {ring_labels('甲乙丙丁戊己庚辛壬癸',129,'stem-name')}
        <g class="five-elements"><polyline points="{pentagram}"/>{''.join(element_marks)}</g>
        <text x="200" y="194" class="background-text motif-center">干 支</text><text x="200" y="214" class="background-text motif-small">五 行 流 转</text>
        <text x="200" y="363" class="background-text ganzhi-note">印 · 比劫 · 食伤 · 财 · 官杀</text>
      </symbol>
      <symbol id="background-lotus-detail" viewBox="0 0 400 400">
        <g class="lotus-aura"><circle cx="200" cy="200" r="120" stroke-dasharray="2 12"/><path d="M200 24V63 M200 337V376 M24 200H63 M337 200H376"/></g>
        <g class="lotus-bloom"><use href="#background-fire-lotus" x="50" y="50" width="300" height="300"/></g>
      </symbol>
    </defs></svg>'''


def scene(name, symbol):
    motifs=[]
    for position in ['top-left','top-right','lower-left','lower-right']:
        selected='background-lotus-detail' if name=='lotus' and position in ['top-right','lower-left'] else symbol
        motifs.append(f'<svg class="atmosphere-motif motif-{position}" viewBox="0 0 400 400" focusable="false"><use href="#{selected}"/></svg>')
    return f'<div class="atmosphere-theme" data-background-scene="{name}">{"".join(motifs)}</div>'


def background_art(trajectory):
    # The old trajectory SVGs are retained byte for byte inside their own scene.
    original=trajectory.split('>',1)[1].rsplit('</div>',1)[0]
    ambient=runpy.run_path(str(Path(__file__).with_name('ambient_art.py')))
    return ('<div class="page-atmosphere" data-background-current="trajectory" data-background-layout="fixed" aria-hidden="true">'
            +symbols()+ambient['definitions']()+'<div class="atmosphere-theme has-raster-art" data-background-scene="trajectory" data-active>'+original+ambient['line_parade']()+'</div>'
            +scene('lotus-classic','background-fire-lotus')
            +runpy.run_path(str(Path(__file__).with_name('cinematic_art.py')))['scenes']()
            +runpy.run_path(str(Path(__file__).with_name('emperor_art.py')))['scene']()
            +runpy.run_path(str(Path(__file__).with_name('soul_art.py')))['scene']()
            +runpy.run_path(str(Path(__file__).with_name('trailer_art.py')))['scene']()+'</div>'+ambient['meteors']()+ambient['autumn_leaves']())
