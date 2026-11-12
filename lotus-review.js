(() => {
  const $ = selector => document.querySelector(selector);
  const size = 1280, fps = 24;
  const data = JSON.parse($('#lotus-review-data').textContent);
  const c = $('#view').getContext('2d');
  const stage = $('[data-lotus-instance]');
  const host = $('.lotus-frame');
  const picker = $('#variant'), seek = $('#seek'), status = $('#status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const imageCache = new Map();
  const composite = LotusReviewComposite;
  let selected, choice, moving = !reduced.matches;
  let showFire = true, snow = true, mist = true;
  let t = 0, prev = 0, elapsed = 0;

  function image(src) {
    if (!imageCache.has(src)) {
      const item = new Image();
      item.src = src;
      imageCache.set(src, item.decode().then(() => item).catch(error => {
        imageCache.delete(src);
        throw error;
      }));
    }
    return imageCache.get(src);
  }

  function draw() {
    if (!selected?.body) return;
    const {key, body, mask, profile, frame, poster, index, count} = selected;
    const cold = key === 'cold';
    const dark = document.body.classList.contains('dark');
    const fire = frame || poster;
    c.clearRect(0, 0, size, size);
    if (cold && mist) LotusReviewEffects.coldAir(c, t, dark);
    if (showFire && cold) {
      ColdLotusCore.draw(c, fire, false);
      drawLotusLight(c, t * 1000, false, dark, true);
    } else if (showFire) {
      composite.flames(c, fire, mask, false, 1);
      LotusReviewEffects.embers(c, t, profile, dark, false);
    }
    composite.contained(c, body);
    if (showFire && cold) {
      ColdLotusCore.draw(c, fire, true);
      drawLotusLight(c, t * 1000, true, dark, true);
    } else if (showFire) {
      composite.flames(c, fire, mask, true, .70);
      LotusReviewEffects.embers(c, t, profile, dark, true);
    }
    if (cold && snow) LotusReviewEffects.flakes(c, t, dark);
    seek.value = index;
    $('#time').value = index + 1 + ' / ' + count;
  }

  function sync() {
    $('#play').textContent = moving ? '暂停动效' : '播放动效';
    $('#play').setAttribute('aria-pressed', String(moving));
    $('.page-atmosphere').dataset.artMotion = moving ? 'loop' : 'still';
    JiaArtLoops.wake();
    for (const [id, on] of [['#fire', showFire], ['#snow', snow], ['#mist', mist]]) {
      $(id).setAttribute('aria-pressed', String(on));
    }
    $('#cold-controls').hidden = choice !== 'cold';
    $('#variant-note').textContent = data[choice].note;
    seek.disabled = !selected?.ready;
  }

  function retire(model) {
    if (!model) return;
    model.abort.abort();
    model.frame?.close();
    model.decoder?.close();
  }

  async function choose(key) {
    if (!data[key]) return;
    choice = key;
    picker.value = key;
    retire(selected);
    const d = data[key], cold = key === 'cold';
    const model = {
      key, profile: d.profile, poster: null, frame: null, decoder: null,
      abort: new AbortController(), index: 0, count: cold ? 64 : 42
    };
    selected = model;
    c.clearRect(0, 0, size, size);
    elapsed = t = 0;
    sync();
    status.textContent = '正在载入这一款火莲…';
    try {
      const base = await image(d.src);
      if (selected !== model) return;
      model.body = base;
      model.mask = cold ? null : composite.cupMask(d.profile.cup);
      stage.dataset.lotusStage = d.stage;
      host.dataset.lotusFrame = d.stage;
      host.style.backgroundImage = 'url("' + d.src + '")';
      JiaArtLoops.lotus(stage, d.stage, base);
      JiaArtLoops.setColdSnow(true);
      draw();
      try {
        model.poster = await image(d.poster);
      } catch (_) {
        if (selected === model) status.textContent = '光焰图片暂未载入。';
      }
      if (selected !== model) return;
      draw();
      if (moving) await open(model);
      else status.textContent = '当前为静态预览，可手动开启动效。';
    } catch (_) {
      if (selected === model) status.textContent = '莲图暂未载入，可重新选择这一款。';
    }
  }

  async function paintFrame(model, index) {
    if (model.pending) await model.pending;
    if (model !== selected || !model.decoder) return;
    model.pending = model.decoder.decode({frameIndex: index}).then(({image: frame}) => {
      if (model !== selected) {
        frame.close();
        return;
      }
      model.frame?.close();
      model.frame = frame;
      model.index = index;
      draw();
    }).catch(() => {
      if (model !== selected) return;
      model.ready = false;
      model.decoder.close();
      model.decoder = null;
      status.textContent = '这个浏览器暂时只能显示火焰静帧。';
      sync();
    }).finally(() => { model.pending = null; });
    await model.pending;
  }

  function open(model) {
    if (!model || model.loading) return model?.loading;
    if (!window.ImageDecoder) {
      status.textContent = '这个浏览器暂时只能显示火焰静帧。';
      return;
    }
    model.loading = (async () => {
      status.textContent = '正在载入这一款的光焰…';
      const response = await fetch(data[model.key].media, {signal: model.abort.signal});
      if (!response.ok) throw Error(response.status);
      const bytes = await response.arrayBuffer();
      if (model !== selected) return;
      model.decoder = new ImageDecoder({data: bytes, type: 'image/webp', preferAnimation: true});
      await model.decoder.tracks.ready;
      if (model !== selected) return;
      model.count = model.decoder.tracks.selectedTrack.frameCount;
      seek.max = model.count - 1;
      await paintFrame(model, 0);
      if (model !== selected || !model.decoder) return;
      model.ready = true;
      status.textContent = '';
      sync();
    })().catch(() => {
      if (model !== selected) return;
      model.loading = null;
      model.decoder?.close();
      model.decoder = null;
      status.textContent = '动态光焰载入失败，重新播放可重试。';
    });
    return model.loading;
  }

  function tick(now) {
    if (moving && !document.hidden && selected) {
      if (!prev) prev = now;
      const dt = Math.min(.12, (now - prev) / 1000);
      prev = now;
      t += dt;
      elapsed += dt;
      if (elapsed >= 1 / fps && !selected.pending) {
        const advance = Math.min(4, Math.floor(elapsed * fps));
        elapsed %= 1 / fps;
        if (selected.ready && showFire) {
          void paintFrame(selected, (selected.index + advance) % selected.count);
        } else draw();
      }
    } else prev = 0;
    requestAnimationFrame(tick);
  }

  for (const [key, d] of Object.entries(data)) picker.append(new Option(d.name, key));
  picker.addEventListener('change', () => void choose(picker.value));
  for (const [id, direction] of [['#prev', -1], ['#next', 1]]) {
    $(id).addEventListener('click', () => {
      const keys = Object.keys(data), index = keys.indexOf(choice);
      void choose(keys[(index + direction + keys.length) % keys.length]);
    });
  }
  $('#play').addEventListener('click', () => {
    moving = !moving;
    sync();
    if (moving) void open(selected);
  });
  for (const [id, toggle] of [['#fire', () => {showFire = !showFire;}],
    ['#snow', () => {snow = !snow;}], ['#mist', () => {mist = !mist;}]]) {
    $(id).addEventListener('click', () => { toggle(); sync(); draw(); });
  }
  $('#tone').addEventListener('click', event => {
    const dark = document.body.classList.toggle('dark');
    event.target.textContent = dark ? '浅色背景' : '深色背景';
    draw();
  });
  async function drawAt(index) {
    moving = false;
    t = index / fps;
    sync();
    const model = selected;
    await open(model);
    await paintFrame(model, index);
  }
  seek.addEventListener('input', () => void drawAt(Number(seek.value)));
  reduced.addEventListener('change', () => {
    if (reduced.matches) { moving = false; sync(); }
  });

  window.LotusReview = {
    inspect: () => ({
      selection: selected?.key, ready: !!selected?.ready, moving,
      frame: selected?.index, frameCount: selected?.count,
      snow: choice === 'cold' && snow ? LotusReviewEffects.snowCount : 0,
      mist: choice === 'cold' && mist,
      available: Object.keys(data).length
    }), choose, drawAt
  };
  const requested = new URLSearchParams(location.search).get('lotus');
  void choose(data[requested] ? requested : 'cold');
  requestAnimationFrame(tick);
})();
