"""Scene-specific, slow upward typography; the full editable banks stay in JSON."""
import json
from html import escape
from itertools import zip_longest
from pathlib import Path

CATALOG = json.loads(Path(__file__).with_suffix('.json').read_text(encoding='utf-8'))
FEATURE_GROUPS = {
    'ganzhi-cinematic': ['伤官比劫具体组合', '经典异格与奇格', '古籍短章', '制用与宾主细法',
                         '格局具体取法', '调候具体取法', '格局与结构', '用户指定文学意象'],
    'ziwei-cinematic': ['经典格名与象局', '古赋成句', '蔡氏自化细目', '梁氏飞星细目',
                        '星曜具体化象', '星系具体落宫', '星系与格局'],
}


def interleave(groups):
    return list(dict.fromkeys(word for row in zip_longest(*groups) for word in row if word))


def display_word(word):
    """Keep each half of a classical couplet readable within the side margin."""
    lines = word.replace('，', '，\n').replace('；', '；\n').splitlines()
    return '\n'.join(part for line in lines for part in
                     (line[i:i+7] for i in range(0, len(line), 7)))


def words_for(scene):
    groups = [words.split() for words in CATALOG[scene]['groups'].values()]
    if CATALOG[scene].get('include_sexagenary_cycle'):
        stems, branches = '甲乙丙丁戊己庚辛壬癸', '子丑寅卯辰巳午未申酉戌亥'
        groups.append([stems[i % 10] + branches[i % 12] for i in range(60)])
    # Interleave the subjects so a fresh viewport doesn't show just one category.
    return interleave(groups)


def pools_for(scene):
    words = words_for(scene)
    features = interleave([[w for w in CATALOG[scene]['groups'][key].split() if len(w) >= 3]
                           for key in FEATURE_GROUPS[scene]])
    # Foundational vocabulary stays distant; the detailed techniques get room up front.
    feature_set = set(features)
    distant = [word for word in words if len(word) <= 3 and word not in feature_set]
    assigned = feature_set | set(distant)
    middle = [word for word in words if word not in assigned]
    return [distant, middle, features]


def procession(scene):
    words = words_for(scene)
    pools = pools_for(scene)
    sides = []
    for side in range(2):
        slots = []
        for depth, (period, x) in enumerate([(69, 14), (53, 47), (43, 63)]):
            period += side * 4
            for slot in range(7):
                word = pools[depth][side * 7 + slot]
                phase = -(slot / 7 + .041 * depth + .067 * side) * period
                style = f'--term-period:{period}s;--term-phase:{phase:.3f}s;--term-x:{x}%;--term-drift:{(-1 if side else 1) * (5 + depth * 4)}px'
                long = ' data-term-long' if len(word) >= 7 else ''
                slots.append(f'<span class="term-word term-depth-{depth}" data-term-word="{depth}"{long} style="{style}">{escape(display_word(word))}</span>')
        sides.append(f'<div class="term-side term-side-{side}">{"".join(slots)}</div>')
    data = json.dumps(pools, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    return (f'<div class="term-procession" data-term-procession="{scene}" data-term-count="{len(words)}" lang="zh-CN" aria-hidden="true">'
            f'<script type="application/json" class="term-bank">{data}</script>{"".join(sides)}</div>')
