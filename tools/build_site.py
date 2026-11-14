"""Build Jia Li's static homepage in the supplied Haoran Geng template style."""
import html
import base64
import hashlib
import json
import re
import runpy
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'content.json').read_text(encoding='utf-8'))
LOTUS_STAGES = [
    ('blue', 'Blue flame', '青焰'), ('cold', 'Blue & white', '青白双色'),
    ('jade', 'Jade glass', '琉璃'), ('fusion', 'Fusion', '融合'),
    ('pearl', 'Pearl flame', '净莲'), ('rings', 'Bound in rings', '环莲'),
    ('gold', 'Golden bloom', '金焰'), ('emperor', 'Emperor flame', '帝炎'),
    ('destruction', 'Destruction lotus', '毁灭火莲'), ('radial', 'Metal structure', '金属结构'),
    ('formation', 'Formation', '凝聚形态'), ('refined', 'Reforged flame', '重铸流焰'),
    ('branches', 'Golden veins', '金粉脉络'),
    ('tuoshe', 'Tuoshe lotus', '古帝火莲'),
]


def lotus_artworks():
    for stage, (slug, en, zh) in enumerate(LOTUS_STAGES):
        extension = 'svg' if slug == 'emperor' else 'png'
        source = f'assets/backgrounds/fire-lotus-{slug}-v1.{extension}'
        lossless = f'assets/backgrounds/fire-lotus-{slug}-v1-lossless.webp'
        if slug == 'branches':
            source = 'assets/backgrounds/fire-lotus-branches-v2.png'
            lossless = 'assets/backgrounds/fire-lotus-branches-v2-lossless.webp'
        if (ROOT/lossless).exists():
            source = lossless
        version = hashlib.sha256((ROOT/source).read_bytes()).hexdigest()[:12]
        yield stage, slug, en, zh, f'{source}?v={version}'


def refresh_motion_preview():
    """Keep the comparison on the exact same artwork and renderer as the homepage."""
    path = ROOT/'motion-preview.html'
    if not path.exists():
        return
    page = path.read_text(encoding='utf-8')
    artworks = list(lotus_artworks())
    options = ''.join(f'<option value="{slug}">{esc(en)}</option>' for _, slug, en, _, _ in artworks)
    choices = {slug: {'stage': stage, 'src': src} for stage, slug, _, _, src in artworks}
    version = hashlib.sha256((ROOT/'art-loops.js').read_bytes()).hexdigest()[:12]
    replacements = [
        (r'(<select id="variant">).*?(</select>)', lambda m: m[1]+options+m[2]),
        (r'const choices=\{.*?\};', lambda _: 'const choices='+json.dumps(choices)+';'),
        (r'art-loops\.js\?v=[a-f0-9]+', lambda _: 'art-loops.js?v='+version),
    ]
    for pattern, replacement in replacements:
        page, count = re.subn(pattern, replacement, page)
        if count != 1:
            raise ValueError(f'Motion preview needs exactly one match for {pattern}')
    path.write_text(page, encoding='utf-8', newline='\n')


def refresh_flame_gallery():
    """Version the shared transport renderer and the gallery's own resources."""
    path = ROOT/'heavenly-flames.html'
    if not path.exists():
        return
    page = path.read_text(encoding='utf-8')
    for name in ['art-loops.js','heavenly-flames.js','heavenly-flames.css']:
        version = hashlib.sha256((ROOT/name).read_bytes()).hexdigest()[:12]
        page, count = re.subn(re.escape(name)+r'(?:\?v=[a-f0-9]+)?', name+'?v='+version, page)
        if count != 1:
            raise ValueError(f'Flame gallery needs exactly one reference to {name}')
    path.write_text(page,encoding='utf-8',newline='\n')


def esc(value):
    return html.escape(str(value), quote=True)


def favicon_links():
    links = []
    for name, mime, sizes in [('favicon.ico', 'image/x-icon', '16x16 32x32 48x48'),
                               ('favicon.png', 'image/png', '64x64')]:
        path = f'assets/{name}'
        version = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()[:12]
        links.append(f'<link rel="icon" href="{path}?v={version}" type="{mime}" sizes="{sizes}">')
    return ''.join(links)


def click_icon_library():
    # These particles live for 1.1 seconds: no first-click network race.
    icons = []
    for path in ['assets/icons/lotus-pink-gold-transparent.svg', 'assets/icons/jl-square.svg', 'assets/icons/yin-yang.svg', 'assets/icons/yin-yang-counter-rotate.svg']:
        encoded = base64.b64encode((ROOT / path).read_bytes()).decode('ascii')
        icons.append(f'<img data-particle-src="{path}" src="data:image/svg+xml;base64,{encoded}" alt="">')
    return '<template id="click-icon-library">' + ''.join(icons) + '</template>'


def text(value, lang='en'):
    return value[lang] if isinstance(value, dict) else value


def bilingual(value, rich=False):
    if not isinstance(value, dict):
        return esc(value)
    en = value['en'] if rich else esc(value['en'])
    zh = value['zh'] if rich else esc(value['zh'])
    return f'<span data-lang="en" lang="en">{en}</span><span data-lang="zh" lang="zh-CN" hidden>{zh}</span>'


def pair(en, zh):
    return bilingual({'en':en,'zh':zh})


def deferred_image(source, alt, extra=''):
    # Browser-native lazy loading can still fetch several screens ahead.
    attributes = f'alt="{esc(alt)}" loading="lazy" decoding="async" fetchpriority="low"{extra}'
    return (f'<img data-src="{esc(source)}" {attributes}>'
            f'<noscript><img src="{esc(source)}" {attributes}></noscript>')


def background_art():
    """Original abstract motion studies for the margins, not experimental data."""
    original = '''<div class="page-atmosphere" aria-hidden="true">
    <svg class="trajectory-study trajectory-left" viewBox="0 0 240 620" focusable="false">
      <g class="trajectory-lines">
        <path pathLength="1" d="M182 48 C71 39 23 166 86 248 S219 316 169 414 S53 540 88 579"/>
        <path pathLength="1" d="M190 52 C86 59 49 164 105 244 S195 330 151 416 S65 526 94 572"/>
        <path pathLength="1" d="M198 58 C102 79 75 166 124 241 S171 344 134 416 S78 514 100 565"/>
        <path pathLength="1" d="M206 66 C120 99 101 170 143 240 S150 355 119 414 S92 502 106 558"/>
        <path class="trajectory-accent" pathLength="1" d="M86 248 C129 273 179 250 177 204 S118 153 93 189 S102 265 145 302"/>
      </g>
      <g class="trajectory-joints"><circle cx="86" cy="248" r="3"/><circle cx="169" cy="414" r="2.5"/></g>
    </svg>
    <svg class="trajectory-study trajectory-right" viewBox="0 0 240 620" focusable="false">
      <g class="trajectory-lines">
        <path pathLength="1" d="M62 57 C171 97 211 206 135 268 S29 411 98 464 S199 517 164 572"/>
        <path pathLength="1" d="M69 66 C165 111 188 206 122 271 S52 404 111 450 S186 512 159 564"/>
        <path pathLength="1" d="M76 75 C159 125 165 208 109 274 S75 397 124 437 S172 507 154 556"/>
        <path pathLength="1" d="M83 84 C153 139 143 212 96 277 S98 390 137 425 S159 502 149 548"/>
        <path class="trajectory-accent" pathLength="1" d="M98 464 C149 488 193 451 171 411 S98 383 85 418 S119 485 161 499"/>
      </g>
      <g class="trajectory-joints"><circle cx="135" cy="268" r="3"/><circle cx="98" cy="464" r="2.5"/></g>
    </svg>
  </div>'''
    return runpy.run_path(str(ROOT/'tools/background_art.py'))['background_art'](original)


def background_controls():
    choices=[('trajectory','Trajectories','轨迹'),('ziwei-cinematic','Celestial procession','斗数意象'),('ganzhi-cinematic','Living elements','八字意象'),
             ('lotus','Lotus evolution','火莲演变'),('emperor','Emperor & 23 flames','古帝 · 二十三异火'),('auto','Auto rotate','自动轮换')]
    buttons=''.join(f'<button type="button" data-background="{key}" aria-pressed="{str(key=="auto").lower()}">{pair(en,zh)}</button>' for key,en,zh in choices)
    older=''.join(f'<button type="button" data-background="{key}" aria-pressed="false">{pair(en,zh)}</button>' for key,en,zh in [('lotus-still','Pearl lotus study','粉白莲原版'),('lotus-classic','First lotus','初版火莲')])
    lotus_buttons=[]
    for i,slug,en,zh,source in lotus_artworks():
        reference = ''
        if slug == 'tuoshe':
            path = 'assets/backgrounds/fire-lotus-tuoshe-v2-lossless.webp'
            reference = f' data-lotus-reference-src="{path}?v={hashlib.sha256((ROOT/path).read_bytes()).hexdigest()[:12]}"'
        label = (' aria-label="Blue-white Buddha Fury Lotus: Bone Spirit Cold Fire and Green Lotus Earth Core Flame"'
                 ' data-label-en="Blue-white Buddha Fury Lotus: Bone Spirit Cold Fire and Green Lotus Earth Core Flame"'
                 ' data-label-zh="青白双色佛怒火莲：骨灵冷火与青莲地心火融合"') if i == 1 else ''
        lotus_buttons.append(f'<button type="button" data-lotus-stage="{i}" data-lotus-name="{slug}" data-lotus-src="{source}" aria-pressed="{str(i==0).lower()}"{reference}{label}>{pair(en,zh)}</button>')
    lotus_buttons=''.join(lotus_buttons)
    return f'''<details class="background-switch" hidden><summary>{pair('Background','背景')}</summary>
      <div class="background-options"><div class="background-choices" role="group" aria-label="Background scene" data-label-en="Background scene" data-label-zh="背景图案">{buttons}</div><details class="background-archive"><summary>{pair('Previous studies','之前的方案')}</summary><div class="background-choices">{older}</div></details>
      <div class="lotus-options" hidden><div class="lotus-stage-buttons" role="group" aria-label="Lotus stages" data-label-en="Lotus stages" data-label-zh="火莲形态">{lotus_buttons}</div><button type="button" class="lotus-play-toggle" data-lotus-toggle aria-pressed="false">{pair('Pause evolution','暂停演变')}</button><p class="lotus-load-status" data-lotus-status role="status" aria-live="polite" hidden></p><button type="button" data-lotus-retry hidden>{pair('Try again','重新加载')}</button></div><p class="emperor-preview-link" hidden><a href="emperor-preview.html">{pair('View the Emperor scene','展开古帝全景')}</a></p>
      <p class="seven-star-preview-link" hidden><a href="seven-star-preview.html">{pair('Xiao Yan & Lin Dong','萧炎与林动全景')}</a><br><a href="pink-lotus-comparison.html">{pair('Golden veins · compare','金粉莲新旧对比')}</a><br><a href="tuoshe-lotus-comparison.html">{pair('Tuoshe lotus · compare','古帝莲左右对比')}</a></p>
      <div class="imagery-load-options" data-imagery-options hidden><p class="lotus-load-status" data-imagery-status role="status" aria-live="polite" hidden></p><button type="button" data-imagery-retry hidden>{pair('Reload missing artwork','重试未加载的形象')}</button></div>
      <div class="background-placement" role="group" aria-label="Background placement" data-label-en="Background placement" data-label-zh="背景位置">
      <button type="button" data-background-layout="fixed" aria-pressed="true">{pair('Stay in view','固定视窗')}</button>
      <button type="button" data-background-layout="page" aria-pressed="false">{pair('Scroll with page','随页滚动')}</button></div>
      <div class="background-placement background-visibility" role="group" aria-label="Background visibility" data-label-en="Background visibility" data-label-zh="背景显淡">
      <button type="button" data-background-visibility="clear" aria-pressed="true">{pair('Clear','清晰')}</button>
      <button type="button" data-background-visibility="subtle" aria-pressed="false">{pair('Fade in/out','渐隐渐现')}</button></div>
      <div class="background-placement" data-art-motion-options role="group" aria-label="Image motion" data-label-en="Image motion" data-label-zh="图案动效" hidden><button type="button" data-art-motion="loop" aria-pressed="true">{pair('Animated','动态图')}</button><button type="button" data-art-motion="still" aria-pressed="false">{pair('Still','静态图')}</button></div><a href="heavenly-flames.html">{pair('Twenty-three flames','二十三种异火图鉴')}</a></div></details>'''


def link(url, label, extra=''):
    return f'<a href="{esc(url)}" target="_blank" rel="noopener noreferrer"{extra}>{label}</a>'


def formatted_text(value, emphasis=(), links=None):
    """Emphasize selected phrases and link labels without adding HTML to source text."""
    links = links or {}
    labels = sorted(set(emphasis) | set(links), key=len, reverse=True)
    if not labels:
        return esc(value)
    pattern = '|'.join(re.escape(esc(label)) for label in labels)
    emphasized = {esc(label) for label in emphasis}
    linked = {esc(label): url for label, url in links.items()}

    def replace(match):
        label = match[0]
        rendered = f'<strong>{label}</strong>' if label in emphasized else label
        return link(linked[label], rendered) if label in linked else rendered

    return re.sub(pattern, replace, esc(value))


def bilingual_formatted(value, emphasis=None, links=None):
    emphasis = emphasis or {}
    return bilingual({language: formatted_text(text(value, language), emphasis.get(language, ()), links)
                      for language in ['en', 'zh']}, rich=True)


def authors(paper):
    result=[]
    for author in paper['authors']:
        name=author.rstrip('*†')
        suffix=author[len(name):]
        if name==DATA['person']['name']:
            result.append(f'<strong class="self-author">{esc(author)}</strong>')
        else:
            url=DATA.get('people_links',{}).get(name)
            result.append((link(url,esc(name)) if url else esc(name))+esc(suffix))
    return ', '.join(result)


def linked_people(value):
    safe=esc(value)
    people=DATA.get('people_links',{})
    if not people:return safe
    pattern=r'(?<!\w)('+'|'.join(re.escape(name) for name in sorted(people,key=len,reverse=True))+r')(?!\w)'
    return re.sub(pattern,lambda match:link(people[match[0]],match[0]),safe)


def bilingual_people(value):
    return bilingual({language:linked_people(text(value,language)) for language in ['en','zh']},rich=True)


def contribution_list(items):
    if not items or not DATA.get('display', {}).get('contributions', True):
        return ''
    return '<details class="contribution-details"><summary>'+pair('My contributions','我的工作')+'</summary><ul>'+''.join('<li>'+bilingual(item)+'</li>' for item in items)+'</ul></details>'


def paper_row(paper):
    separators = '<span class="resource-separator" aria-hidden="true"> / </span>'
    resources = separators.join(link(item['url'],pair(item['label'],item['label_zh'])) for item in paper['links'])
    citation = ''
    if paper.get('bibtex'):
        citation = separators+f'''<details class="citation"><summary>BibTeX</summary><div class="citation-body"><pre><code>{esc(paper['bibtex'])}</code></pre><button class="copy-citation" type="button" hidden>{pair('Copy citation','复制引用')}</button></div></details>'''
    demo = ''
    media_label = ''
    if paper.get('demo'):
        demo = f'<video class="hover-video" src="{esc(paper["demo"])}" muted loop playsinline preload="none" aria-hidden="true"></video>'
        media_label = f'<button type="button" class="demo-toggle" aria-pressed="false">{pair("Play demo", "播放演示")}</button>'
    return f'''<article class="paper{' paper-featured' if paper.get('featured') else ''}" id="{esc(paper['id'])}">
      <div class="figure-column"><div class="paper-media" {'tabindex="0"' if demo else ''}>
        <a class="paper-figure" href="{esc(paper['image'])}" target="_blank" rel="noopener noreferrer" aria-label="{esc(paper['alt']['en'])}" data-label-en="{esc(paper['alt']['en'])}" data-label-zh="{esc(paper['alt']['zh'])}">{deferred_image(paper['image'],paper['alt']['en'],f' data-alt-en="{esc(paper["alt"]["en"])}" data-alt-zh="{esc(paper["alt"]["zh"])}"')}{demo}</a>
      </div>{media_label}</div>
      <div class="paper-text"><h3>{link(paper['links'][0]['url'],esc(paper['title']))}</h3>
        <p class="authors">{authors(paper)}</p>
        <div class="paper-resources">{resources}{citation}</div>
        <p class="paper-venue"><em><strong>{bilingual(paper['venue'])}</strong></em></p>
        <p class="paper-description">{bilingual(paper['summary'])}</p>
        {contribution_list(paper.get('contributions',[]))}
      </div>
    </article>'''


def news_rows():
    rows=[]
    for item in DATA['news']:
        celebrate = (' <button class="celebrate-button" type="button" data-celebrate aria-label="Celebrate the UFO technical report release" data-label-en="Celebrate the UFO technical report release" data-label-zh="庆祝 UFO 技术报告发布">'+pair('Celebrate 🎉','庆祝一下 🎉')+'</button>') if item.get('celebrate') else ''
        rows.append(f'<li><span class="news-date">[{esc(item["date"])}]</span> {bilingual(item["text"],rich=True)}{celebrate}</li>')
    return ''.join(rows)


def experience_rows():
    return ''.join(f'''<div class="experience-row"><div class="institution-logo">{link(item['url'],deferred_image(item['logo'],item['institution']['en']))}</div><div><h3>{link(item['url'],bilingual(item['institution']))}</h3><p><em>{bilingual(item['date'])}</em></p><p><strong>{bilingual(item['role'])}</strong></p><p>{bilingual_people(item['detail'])}</p></div></div>''' for item in DATA['experience'])


def engineering_rows():
    return ''.join(f'''<article class="engineering-row"><h3>{link(item['url'],bilingual(item['title'])) if item.get('url') else bilingual(item['title'])}</h3><p><em>{bilingual(item['date'])}</em> · <strong>{bilingual(item['role'])}</strong></p><p>{bilingual(item['detail'])}</p>{contribution_list(item.get('contributions',[]))}</article>''' for item in DATA['engineering'])


def honors_list(items):
    rows=''.join(f'<li><span class="honor-year">{esc(item["year"])}:</span> {bilingual_formatted(item["text"], item.get("emphasis"))}</li>' for item in items)
    return f'<ul class="honors-list">{rows}</ul>' if rows else ''


def music_control():
    tracks = (
        ('shou-ni-suo-wang', '守你所望 · 刘端端', 'shou-ni-suo-wang-v1.flac'),
        ('chi-nian', '炽念 · 柯淳', 'chi-nian-v1.mp3'),
        ('far-beyond-us-instrumental', '远不止你我 · 伴奏', 'far-beyond-us-instrumental-v1.flac'),
        ('our-adventure-instrumental', '我们的冒险 · 伴奏（AI分离）', 'our-adventure-instrumental-v1.flac'),
        ('bu-mie-instrumental', '不灭 · 伴奏', 'bu-mie-instrumental-v1.mp3'),
        ('qian-hui', '千回 · 袁艺菲', 'qian-hui-v1.flac'),
        ('zhu-guang', '逐光 · 韩富Richard', 'zhu-guang-v1.flac'),
        ('xian-zai-huan-wo', '现在换我 · 许哲', 'xian-zai-huan-wo-v1.flac'),
        ('wo-jiu-shi-wo', '我就是我 · 墨绛', 'wo-jiu-shi-wo-v1.flac'),
        ('xin-ji-instrumental', '心寄 · 伴奏', 'xin-ji-instrumental-v1.flac'),
        ('wen-xing', '问星 · Mr.mo', 'wen-xing-v1.flac'),
        ('rebirth-instrumental', '重生 · 伴奏（AI分离）', 'rebirth-instrumental-v1.flac'),
        ('dominate-instrumental', '主宰 · 伴奏', 'dominate-instrumental-v2.mp3'),
        ('zhi-wo-instrumental', '知我 · 伴奏', 'zhi-wo-instrumental-v1.flac'),
        ('zong-ma-ta-ge-xing', '纵马踏歌行 · 刘宇宁', 'zong-ma-ta-ge-xing-v1.flac'),
        ('wu-yang', '无恙 · 徐均朔', 'wu-yang-v1.flac'),
        ('wen-ding', '问鼎 · 黄子弘凡', 'wen-ding-v1.flac'),
        ('zhan-ge', '战歌 · CoCo李玟', 'zhan-ge-v1.flac'),
        ('wen', '问 · 陈家淇', 'wen-v1.flac'),
        ('our-adventure', '我们的冒险 · 曹寅', 'our-adventure-v1.mp3'),
    )
    choices = ''.join(
        f'<option value="{key}" data-music-src="assets/audio/{file}?v={hashlib.sha256((ROOT / "assets/audio" / file).read_bytes()).hexdigest()[:10]}">{esc(title)}</option>'
        for key, title, file in tracks
    )
    return f'''<div class="music-tools"><button type="button" data-music-toggle aria-pressed="false" aria-label="Background music" data-label-en="Background music" data-label-zh="背景音乐">♪</button><button type="button" data-music-settings aria-label="Choose music" data-label-en="Choose music" data-label-zh="选择背景音乐">⌄</button></div><dialog class="music-panel" data-music-panel aria-labelledby="music-heading"><header><h2 id="music-heading">{pair('Background music','背景音乐')}</h2><form method="dialog"><button type="submit">{pair('Close','关闭')}</button></form></header><p>{pair('Play a track from the playlist or add your own audio. Your files stay on this device.','可以播放内置歌单，也可以添加自己的音频。你选择的文件只在本机播放。')}</p><label>{pair('Add your own audio','添加本机音频')}<input type="file" accept="audio/*,.flac,.opus" multiple></label><label>{pair('Track','歌曲')}<select><optgroup label="内置歌单 / Built-in tracks">{choices}</optgroup><optgroup label="本机音频 / Your files" data-local-tracks hidden></optgroup></select></label><label>{pair('Volume','音量')}<input type="range" min="0" max="1" value="0.32" step="0.01"></label><button type="button" data-music-play aria-pressed="false">{pair('Play / pause','播放／暂停')}</button><p role="status"></p><audio preload="none"></audio></dialog>'''


def runtime_bundle(name, modules):
    """Keep editable modules separate while serving one cacheable request."""
    code = '\n;\n'.join(f'/* {module} */\n'+(ROOT/module).read_text(encoding='utf-8') for module in modules)
    (ROOT/name).write_text(code, encoding='utf-8', newline='\n')
    return name+'?v='+hashlib.sha256(code.encode('utf-8')).hexdigest()[:12]


def lotus_atmosphere_scripts(runtime_source):
    """Share the approved full-artwork compositor with the right-hand background."""
    page = (ROOT/'volumetric-preview.html').read_text(encoding='utf-8')
    match = re.search(r'<script id="lotus-review-data" type="application/json">(.*?)</script>', page, re.S)
    choices = json.loads(match[1])
    config = {}
    for choice in choices.values():
        slug = LOTUS_STAGES[choice['stage']][0]
        path = f'assets/backgrounds/lotus-effects/{slug}-448-v1.webp'
        digest = hashlib.sha256((ROOT/path).read_bytes()).hexdigest()[:12]
        config[choice['stage']] = {'cold': slug == 'cold', 'media': f'{path}?v={digest}'}
        if 'profile' in choice:
            config[choice['stage']]['profile'] = choice['profile']
    return (f'<script id="lotus-atmosphere-data" data-runtime-src="{esc(runtime_source)}" type="application/json">'
            +json.dumps(config,separators=(',',':'))+'</script>')


def build_homepage():
    person, education = DATA['person'], DATA['education']
    critical_runtime = '\n;\n'.join(
        f'/* Source: {name} */\n'+(ROOT/name).read_text(encoding='utf-8')
        for name in ('script.js', 'background-music.js', 'emperor-scene.js', 'seven-star.js', 'character-art.js')
    ).replace('</script', '<\\/script')
    art_runtime = runtime_bundle('background-runtime.js', ('art-loops.js', 'lotus-duel-light.js',
        'lotus-cold-core.js', 'lotus-review-effects.js', 'lotus-review-composite.js', 'lotus-atmosphere.js'))
    portrait = 'assets/profile/jia-li-portrait-progressive-v1.jpg'
    if not (ROOT/portrait).exists():
        portrait = person['portrait']
    portrait += '?v='+hashlib.sha256((ROOT/portrait).read_bytes()).hexdigest()[:12]
    critical_styles=(ROOT/'site.css').read_text(encoding='utf-8')+'\n'+(ROOT/'emperor-scene.css').read_text(encoding='utf-8')
    analytics_version=hashlib.sha256((ROOT/'analytics.js').read_bytes()).hexdigest()[:10]
    biography = ''.join(
        '<p>' + bilingual(item, rich=True) + '</p>'
        for item in person['bio']
        if item.get('visible', True)
    )
    interests=bilingual(DATA['research_intro'],rich=True)
    current_work = ('<p class="current-work">' + bilingual(DATA['current_work'], rich=True) + '</p>') if DATA.get('display', {}).get('current_work', True) else ''
    schema={'@context':'https://schema.org','@type':'Person','name':person['name'],'alternateName':person['name_zh'],'email':person['email'],'sameAs':[person['github'],person['scholar']]}
    honors=honors_list(item for item in DATA['honors'] if item.get('featured',True))
    more_honors=[item for item in DATA['honors'] if not item.get('featured',True)]
    if more_honors:
        honors+='<details class="honors-more"><summary><span class="honors-expand">'+pair(f'More awards and honors ({len(more_honors)})',f'更多荣誉（{len(more_honors)}）')+'</span><span class="honors-collapse">'+pair('Show fewer','收起更多荣誉')+'</span></summary>'+honors_list(more_honors)+'</details>'
    community=''.join('<li>'+bilingual_formatted(item, item.get('emphasis'), item.get('links'))+'</li>' for item in DATA['community'])
    updated=date.fromisoformat(DATA.get('homepage_updated', DATA['updated']))
    page=f'''<!doctype html>
<html lang="en" data-name-font="classic"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{esc(person['name'])} | {esc(person['name_zh'])}</title><meta name="author" content="Jia Li">
  <meta name="description" content="Jia Li at HUST: robot learning, reinforcement learning, behavioral representation learning, whole-body control and humanoid loco-manipulation.">
  <meta name="theme-color" content="#ffffff">{favicon_links()}
  <link rel="preload" href="assets/fonts/lato-regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="{esc(portrait)}" as="image" fetchpriority="high">
  <script>(()=>{{let chosen=new URLSearchParams(location.search).get('namefont');if(!['classic','original','termes'].includes(chosen)){{try{{chosen=localStorage.getItem('jia-li-name-font');}}catch(_){{}}}}document.documentElement.dataset.nameFont=['original','termes'].includes(chosen)?chosen:'classic';}})();</script>
  {runpy.run_path(str(ROOT/'tools/entrance_art.py'))['bootstrap']()}
  <style id="site-styles">{critical_styles}</style>{lotus_atmosphere_scripts(art_runtime)}
  <script type="application/ld+json">{json.dumps(schema,ensure_ascii=False)}</script>
</head><body>
  {runpy.run_path(str(ROOT/'tools/entrance_art.py'))['entrance']()}
  {background_art()}
  <a class="skip-link" href="#main">{pair('Skip to content','跳到正文')}</a>
  <main class="homepage" id="main">
    <div class="page-tools">{background_controls()}{music_control()}<details class="name-font-switch" hidden><summary aria-label="English name font" data-label-en="English name font" data-label-zh="英文姓名字体">Aa</summary><div class="background-options name-font-options" role="group" aria-label="English name font" data-label-en="English name font" data-label-zh="英文姓名字体"><button type="button" data-name-font="classic" aria-pressed="true"><span class="name-font-preview name-font-classic" aria-hidden="true">Jia Li</span>{pair('Reference','参考图')}</button><button type="button" data-name-font="termes" aria-pressed="false"><span class="name-font-preview name-font-termes" aria-hidden="true">Jia Li</span>{pair('Previous','前版')}</button><button type="button" data-name-font="original" aria-pressed="false"><span class="name-font-preview name-font-original" aria-hidden="true">Jia Li</span>{pair('Original','原版')}</button></div></details><div class="language-switch" role="group" aria-label="Page language" hidden><button type="button" data-set-lang="en" aria-pressed="true" lang="en">English</button><button type="button" data-set-lang="zh" aria-pressed="false" lang="zh-CN">中文</button></div></div>
    <section class="about" id="about" aria-labelledby="name"><div class="bio"><h1 id="name"><span class="name-latin">{esc(person['name'])}</span> <span aria-hidden="true">|</span> <span lang="zh-CN">{esc(person['name_zh'])}</span></h1>{biography}
      <p class="contact-links"><a href="mailto:{esc(person['email'])}">{pair('Email','邮件')}</a> <span aria-hidden="true"> / </span> {link(person['scholar'],'Google Scholar')} <span aria-hidden="true"> / </span> {link(person['github'],'Github')} <span aria-hidden="true"> / </span> {link(person['wechat_qr'],pair('WeChat','微信'))} <span aria-hidden="true"> / </span> <a href="assets/documents/Jia-Li-CV.pdf" target="_blank" rel="noopener">{pair('CV','简历')}</a></p>
    </div><figure class="portrait"><div class="portrait-frame">
      <a href="{esc(person['portrait'])}" target="_blank" rel="noopener"><img src="{esc(portrait)}" alt="Jia Li" width="{person['portrait_width']}" height="{person['portrait_height']}" loading="eager" decoding="auto" fetchpriority="high"></a>
      <div class="portrait-decoration" data-portrait-decoration="stars" aria-hidden="true">
      <svg class="portrait-charm portrait-charm-star" viewBox="0 0 40 82" aria-hidden="true" focusable="false">
        <circle class="charm-string" cx="20" cy="4" r="3"/><path class="charm-string" d="M20 7 C13 20 27 31 20 46"/>
        <circle class="charm-bead" cx="20" cy="32" r="2.5"/><path class="charm-shape" d="M20 46 24.4 55 34.3 56.4 27.1 63.4 28.8 73.2 20 68.6 11.2 73.2 12.9 63.4 5.7 56.4 15.6 55Z"/>
      </svg>
      <svg class="portrait-charm portrait-charm-moon" viewBox="0 0 38 94" aria-hidden="true" focusable="false">
        <circle class="charm-string" cx="19" cy="4" r="3"/><path class="charm-string" d="M19 7 C26 24 12 37 19 58"/>
        <circle class="charm-bead" cx="19" cy="41" r="2"/><path class="charm-shape" d="M23 58 A15 15 0 1 0 31 83 A15 15 0 0 1 23 58Z"/>
      </svg>
      <svg class="portrait-sparkle" viewBox="0 0 28 28" aria-hidden="true" focusable="false"><path class="charm-shape" d="M14 2 17 11 26 14 17 17 14 26 11 17 2 14 11 11Z"/></svg>
      </div>
      <div class="portrait-decoration" data-portrait-decoration="planet" aria-hidden="true" hidden>
        <svg class="portrait-planet" viewBox="0 0 64 56" aria-hidden="true" focusable="false">
          <ellipse class="planet-ring" cx="32" cy="28" rx="29" ry="9" transform="rotate(-22 32 28)"/>
          <circle class="charm-shape" cx="32" cy="28" r="15"/>
          <path class="planet-band" d="M21 22 Q32 18 43 23 M19 30 Q32 26 46 31"/>
          <path class="planet-ring" d="M3 28 A29 9 0 0 0 61 28" transform="rotate(-22 32 28)"/>
          <circle class="charm-bead" cx="8" cy="9" r="2"/>
        </svg>
        <svg class="portrait-sparkle portrait-orbit-sparkle" viewBox="0 0 28 28" aria-hidden="true" focusable="false"><path class="charm-shape" d="M14 2 17 11 26 14 17 17 14 26 11 17 2 14 11 11Z"/></svg>
        <svg class="portrait-sparkle" viewBox="0 0 28 28" aria-hidden="true" focusable="false"><path class="charm-shape" d="M14 2 17 11 26 14 17 17 14 26 11 17 2 14 11 11Z"/></svg>
      </div>
    </div><div class="portrait-style-switch" role="group" aria-label="Photo decoration" data-label-en="Photo decoration" data-label-zh="照片挂件样式" hidden>
      <button type="button" data-portrait-style="stars" aria-pressed="true">{pair('Stars & moon','星月')}</button>
      <button type="button" data-portrait-style="planet" aria-pressed="false">{pair('Planet','行星')}</button>
    </div></figure></section>
    <section class="news" id="news" aria-labelledby="news-heading"><h2 id="news-heading">{pair('News','最新动态')}</h2><ul class="news-list">{news_rows()}</ul><p id="celebration-status" class="sr-only" aria-live="polite"></p></section>
    <section class="research" id="research" aria-labelledby="research-heading"><h2 id="research-heading">{pair('Research','研究')}</h2><p class="research-intro">{interests}</p>{current_work}<p class="representative-note">{pair('Representative works are','代表作以')} <span class="highlight">{pair('highlighted','浅黄色高亮')}</span>{pair('.',' 标出。')}</p><div class="paper-list">{''.join(paper_row(item) for item in DATA['papers'])}</div><p class="author-note">{pair('* Equal contribution. My name is in bold in the author lists. Hover over a demo thumbnail to play, or use its Play demo button.','* 表示共同贡献；作者列表中以粗体标出我的名字。悬停演示缩略图可播放，也可使用“播放演示”按钮。')}</p></section>
    <section id="engineering" class="inset-section" aria-labelledby="engineering-heading"><h2 id="engineering-heading">{pair('Projects','项目实践')}</h2>{engineering_rows()}</section>
    <section id="experience" aria-labelledby="experience-heading"><h2 id="experience-heading">{pair('Experience','科研经历')}</h2><div class="experience-list">{experience_rows()}</div></section>
    <section id="education" aria-labelledby="education-heading"><h2 id="education-heading">{pair('Education','教育背景')}</h2><div class="experience-row"><div class="institution-logo">{link(education['url'],deferred_image(education['logo'],'HUST'))}</div><div><h3>{link(education['url'],bilingual(education['institution']))}</h3><p><em>{bilingual(education['date'])}</em></p><p><strong>{bilingual(education['degree'])}</strong></p><p>{bilingual_formatted(education['detail'],education.get('emphasis'))}</p><p class="coursework">{bilingual(education['coursework'])}</p></div></div></section>
    <section id="honors" class="inset-section" aria-labelledby="honors-heading"><h2 id="honors-heading">{pair('Selected Awards and Honors','荣誉奖项')}</h2>{honors}</section>
    <section id="miscellaneous" class="inset-section" aria-labelledby="misc-heading"><h2 id="misc-heading">{pair('Miscellaneous','其他经历')}</h2><ul class="misc-list">{community}</ul><p><strong>{pair('Tools I work with:','常用工具：')}</strong> {esc(', '.join(DATA['skills']))}.</p></section>
    <footer class="site-footer">
      <div class="visitor-statistics" aria-label="Website statistics" data-label-en="Website statistics" data-label-zh="网站访问统计">
        <p class="stat-totals">{pair('Pageviews','浏览次数')} <strong data-stat="pageviews">—</strong><span aria-hidden="true"> · </span>{pair('Visitors','匿名访客')} <strong data-stat="visitors">—</strong></p>
        <img class="visitor-map" data-visitor-map width="540" height="255" alt="Country-level visitor map" data-alt-en="Country-level visitor map" data-alt-zh="按国家汇总的访客地图" loading="lazy">
        <p class="stat-status" data-stat-status data-state="loading"><span class="stat-unavailable">{pair('Statistics temporarily unavailable.','统计暂不可用。')}</span><span class="stat-cached">{pair('Last synced','最近同步')} <time data-cache-time></time></span><span class="stat-preview">{pair('Statistics are enabled on the published website.','访问统计仅在正式网站启用。')}</span></p>
        <div class="visitor-actions"><span class="action-hand" aria-hidden="true">☞</span>{link('https://jia-li-website-analytics.yrweexnfqa.chatgpt.site/hello',pair('Leave a hello','留个足迹'),' class="visitor-action" data-guest-entry')}{link('https://jia-li-website-analytics.yrweexnfqa.chatgpt.site/',pair('Owner dashboard','站主管理后台'),' class="visitor-action visitor-action-secondary" title="Owner sign-in required / 仅站主登录查看"')}<span class="action-hand" aria-hidden="true">☜</span></div>
        <dialog class="guest-fallback" data-guest-fallback aria-labelledby="guest-fallback-title"><button type="button" class="guest-dialog-close" data-dialog-close aria-label="Close / 关闭">×</button><h2 id="guest-fallback-title">{pair('Say hello.','留个足迹。')}</h2><p>{pair('If the guestbook will not open, you can also reach me by email.','若留言页暂时打不开，也可以通过邮件联系我。')}</p><p class="guest-contact-address"><a href="mailto:{esc(person['email'])}">{esc(person['email'])}</a></p><div class="guest-fallback-actions"><a class="visitor-action" href="mailto:{esc(person['email'])}">{pair('Email me','邮件联系')}</a>{link('https://jia-li-website-analytics.yrweexnfqa.chatgpt.site/hello',pair('Open guestbook','打开留言页'),' class="visitor-action visitor-action-secondary"')}<button class="visitor-action visitor-action-secondary" type="button" data-copy-contact="{esc(person['email'])}"><span class="copy-before">{pair('Copy email','复制邮箱')}</span><span class="copy-after">{pair('Copied','已复制')}</span></button></div></dialog>
        <p class="visitor-privacy">{link('https://jia-li-website-analytics.yrweexnfqa.chatgpt.site/privacy',pair('Privacy','隐私说明'))}</p>
      </div>
      <p>{pair('This homepage is based on the academic website templates of','本主页基于以下作者的学术网站模板：')} {link('https://geng-haoran.github.io/','Haoran Geng')} {pair('and','和')} {link('https://jonbarron.info/','Jon Barron')}.<br>{pair(f'Last updated: {updated:%B} {updated.day}, {updated.year}.',f'更新于 {updated.year} 年 {updated.month} 月 {updated.day} 日。')}</p>
    </footer><script src="analytics.js?v={analytics_version}" defer></script>
  </main>{click_icon_library()}<div id="effect-layer" aria-hidden="true"></div>
  <script id="site-bootstrap">{critical_runtime}</script>
</body></html>'''
    (ROOT/'index.html').write_text(page,encoding='utf-8',newline='\n')
    (ROOT/'emperor-preview.html').write_text(runpy.run_path(str(ROOT/'tools/emperor_art.py'))['preview'](),encoding='utf-8',newline='\n')
    (ROOT/'emperor-flames.html').write_text(runpy.run_path(str(ROOT/'tools/emperor_art.py'))['motion_preview'](),encoding='utf-8',newline='\n')
    refresh_motion_preview()
    refresh_flame_gallery()


def cv_entry(title,date,role,detail):
    return f'<article class="cv-entry"><div class="cv-row"><h3>{esc(title)}</h3><span>{esc(date)}</span></div><p class="cv-role">{esc(role)}</p><p>{linked_people(detail)}</p></article>'


def cv_page(number,content,first=False):
    header='' if first else '<header class="cv-running-header">Jia Li <span>Curriculum Vitae · October 2026</span></header>'
    return f'<section class="cv-page">{header}{content}<div class="cv-page-footer">Jia Li · Updated {esc(DATA["updated"])}<span>{number} / 3</span></div></section>'


def build_cv():
    person,edu=DATA['person'],DATA['education']
    header=f'''<header class="cv-header"><h1>Jia Li <span lang="zh-CN">李嘉</span></h1><p>Robot learning · Reinforcement learning · Whole-body control</p><p><a href="mailto:{esc(person['email'])}">{esc(person['email'])}</a> · <a href="{esc(person['github'])}">GitHub: Huster-LiShuangJia</a> · <a href="{esc(person['scholar'])}">Google Scholar</a></p></header>'''
    papers=''.join(f'''<article class="cv-publication"><h3>{esc(p['title'])}</h3><p class="cv-authors">{authors(p)}</p><p class="cv-role">{esc(p['venue']['en'])} · {esc(p['role']['en'])}</p><p>{esc(p['summary']['en'])}</p><p class="cv-url"><a href="{esc(p['links'][0]['url'])}">{esc(p['links'][0]['url'])}</a></p></article>''' for p in DATA['papers'])
    first=header+'<h2>Education</h2>'+cv_entry(text(edu['institution']),text(edu['date']),text(edu['degree']),text(edu['detail']))+'<h2>Research interests</h2><p>'+esc(', '.join(person['interests']['en']))+'.</p><h2>Selected research</h2>'+papers+'<p class="cv-note">* Equal contribution. Jia Li is highlighted in the author lists.</p>'
    experience=''.join(cv_entry(text(x['institution']),text(x['date']),text(x['role']),text(x['detail'])) for x in DATA['experience'])
    engineering=''
    for x in DATA['engineering']:
        engineering+=cv_entry(text(x['title']),text(x['date']),text(x['role']),text(x['detail']))
        engineering+='<ul class="cv-contributions">'+''.join('<li>'+esc(text(c))+'</li>' for c in x.get('contributions',[]))+'</ul>'
    second='<h2>Research experience</h2>'+experience+'<h2>Engineering projects</h2>'+engineering
    honors=''.join(f'<li><span>{esc(x["year"])}</span><div>{esc(x["text"]["en"])}</div></li>' for x in DATA['honors'])
    community=''.join('<li>'+esc(text(x))+'</li>' for x in DATA['community'])
    third='<h2>Awards and honors</h2><ul class="cv-honors">'+honors+'</ul><h2>Leadership, volunteering and independent study</h2><ul class="cv-community">'+community+'</ul><h2>Selected coursework</h2><p>'+esc(text(edu['coursework']))+'</p><h2>Technical skills</h2><p>'+esc(', '.join(DATA['skills']))+'</p>'
    page=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jia Li | Curriculum Vitae</title><meta name="description" content="Jia Li's curriculum vitae: research, engineering, awards and community activities."><link rel="stylesheet" href="cv.css">{favicon_links()}</head><body><nav class="cv-toolbar" aria-label="CV navigation"><a href="index.html">Back to homepage / 返回主页</a><a href="assets/documents/Jia-Li-CV.pdf" download>Download PDF</a></nav><main class="cv-document">{cv_page(1,first,True)}{cv_page(2,second)}{cv_page(3,third)}</main></body></html>'''
    page=page.replace('</body>', '<script src="analytics.js" defer></script></body>')
    (ROOT/'cv.html').write_text(page,encoding='utf-8',newline='\n')


if __name__=='__main__':
    build_homepage()
    (ROOT/'seven-star-preview.html').write_text(runpy.run_path(str(ROOT/'tools/seven_star_art.py'))['preview'](),encoding='utf-8')
    build_cv()
    print(f'Built template-style homepage and three-page CV: {len(DATA["papers"])} papers, {len(DATA["engineering"])} projects, {len(DATA["honors"])} honors.')
