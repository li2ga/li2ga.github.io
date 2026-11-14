(() => {
  const root = document.querySelector('.page-atmosphere');
  const config = document.querySelector('#lotus-atmosphere-data');
  if (!root || !config || !window.ImageDecoder) return;

  const sources = JSON.parse(config.textContent);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const wide = matchMedia('(min-width: 1041px)');
  const entries = new Map();
  const fps = 24;
  const observer = new IntersectionObserver(wake);
  let animation = 0;
  let loading = null;

  function enabled() {
    return wide.matches && !reduced.matches && !document.hidden
      && root.dataset.backgroundCurrent === 'lotus' && root.dataset.artMotion !== 'still';
  }

  function visible({host}) {
    const box = host.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.right > 0 && box.left < innerWidth
      && box.bottom > 0 && box.top < innerHeight;
  }

  function show(entry, active) {
    entry.host.classList.toggle('has-art-loop', active);
    entry.canvas.hidden = !active;
  }

  function announce(entry, state) {
    if (entry.element.dataset.lotusParticleState === state) return;
    entry.element.dataset.lotusParticleState = state;
    root.dispatchEvent(new CustomEvent('lotusparticlesstate'));
  }

  async function load(entry) {
    const controller = new AbortController();
    loading = {entry, controller};
    const timeout = setTimeout(() => controller.abort('timeout'), 90000);
    let decoder;
    try {
      const response = await fetch(entry.source.media, {
        signal: controller.signal,
        priority: 'low'
      });
      if (!response.ok) throw new Error('Lotus effect unavailable');
      const bytes = await response.arrayBuffer();
      if (controller.signal.aborted) return;
      decoder = new ImageDecoder({data: bytes, type: 'image/webp', preferAnimation: true});
      await decoder.tracks.ready;
      if (controller.signal.aborted || entries.get(entry.element) !== entry) {
        decoder.close();
        return;
      }
      entry.count = decoder.tracks.selectedTrack.frameCount;
      entry.decoder = decoder;
    } catch (_) {
      decoder?.close();
      if (!controller.signal.aborted || controller.signal.reason === 'timeout') entry.failed = true;
      if (entry.failed) announce(entry, 'fallback');
    } finally {
      clearTimeout(timeout);
      loading = null;
      wake();
    }
  }

  function render(entry, now) {
    if (entry.decoding || now < entry.nextPaint) return;
    const {decoder, context, canvas, host, source} = entry;
    const next = entry.index < 0 ? 0 : (entry.index + 1) % entry.count;
    entry.nextPaint = Math.max(now - 1000 / fps, entry.nextPaint) + 1000 / fps;
    entry.decoding = true;
    decoder.decode({frameIndex: next}).then(({image}) => {
      try {
        if (entries.get(entry.element) !== entry || !enabled() || !visible(entry)) return;
        const pixels = Math.max(1, Math.min(1280, Math.ceil(Math.min(host.clientWidth, host.clientHeight) * devicePixelRatio)));
        if (canvas.width !== pixels || canvas.height !== pixels) canvas.width = canvas.height = pixels;
        const scale = pixels / 1280;
        context.setTransform(scale, 0, 0, scale, 0, 0);
        LotusReviewComposite.paint(context, {
          body: entry.image, profile: source.profile, mask: entry.mask,
          fire: image, cold: source.cold, t: entry.paints / fps + entry.phase
        });
        entry.index = next;
        entry.paints++;
        show(entry, true);
        announce(entry, 'ready');
      } finally {
        image.close();
      }
    }).catch(() => {
      if (entries.get(entry.element) !== entry) return;
      entry.failed = true;
      decoder.close();
      entry.decoder = null;
      show(entry, false);
      announce(entry, 'fallback');
    }).finally(() => { entry.decoding = false; });
  }

  function wake() {
    if (!enabled()) {
      cancelAnimationFrame(animation);
      animation = 0;
      entries.forEach(entry => show(entry, false));
      return;
    }
    if (!animation && entries.size) animation = requestAnimationFrame(tick);
  }

  function tick(now) {
    animation = 0;
    if (!enabled()) return;
    const active = [...entries.values()].filter(entry => !entry.failed && visible(entry));
    if (!loading) {
      const next = active.find(entry => !entry.decoder);
      if (next) void load(next);
    }
    for (const entry of active) if (entry.decoder) render(entry, now);
    if (active.some(entry => entry.decoder)) animation = requestAnimationFrame(tick);
  }

  function lotus(element, stage, image) {
    if (!element.matches('.motif-top-right, .motif-lower-right')) return false;
    const source = sources[stage];
    const host = element.querySelector('[data-lotus-frame="' + stage + '"]');
    if (!host) return false;
    const old = entries.get(element);
    if (old) {
      if (source && old.stage === stage && old.image === image && !old.failed) return true;
      if (loading?.entry === old) loading.controller.abort();
      observer.unobserve(old.host);
      old.decoder?.close();
      show(old, false);
      old.canvas.remove();
      entries.delete(element);
    }
    // Native image stages have no pre-rendered WebP fuel clip. Release the
    // previous stage's decoder, then let the original-image renderer take over.
    if (!source) {
      element.dataset.lotusParticleState = 'native';
      root.dispatchEvent(new CustomEvent('lotusparticlesstate'));
      return false;
    }
    const canvas = document.createElement('canvas');
    canvas.className = 'art-loop-canvas lotus-particle-canvas';
    canvas.hidden = true;
    canvas.setAttribute('aria-hidden', 'true');
    const context = canvas.getContext('2d');
    if (!context) return false;
    const entry = {
      element, stage, host, image, source, canvas, context,
      mask: source.cold ? null : LotusReviewComposite.cupMask(source.profile.cup),
      phase: Number(element.dataset.lotusInstance) * .31,
      index: -1, paints: 0, nextPaint: 0
    };
    entries.set(element, entry);
    host.appendChild(canvas);
    observer.observe(host);
    announce(entry, 'loading');
    wake();
    return true;
  }

  window.JiaLotusAtmosphere = {
    lotus,
    inspect: () => [...entries.values()].map(entry => ({
      instance: Number(entry.element.dataset.lotusInstance),
      stage: entry.stage, ready: !!entry.decoder, visible: visible(entry),
      paints: entry.paints, frame: entry.index, fallback: !!entry.failed
    }))
  };
  new MutationObserver(wake).observe(root, {
    attributes: true, attributeFilter: ['data-art-motion', 'data-background-current', 'data-background-layout']
  });
  document.addEventListener('visibilitychange', wake);
  reduced.addEventListener('change', wake);
  wide.addEventListener('change', wake);
})();
