"use strict";
(() => {
  const root = document.querySelector('.page-atmosphere');
  const scene = root?.querySelector('[data-background-scene="emperor"]');
  const stage = scene?.querySelector('[data-emperor-tableau]');
  if (!stage) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const wide = matchMedia('(min-width:1041px)');
  const portrait = stage.querySelector('[data-emperor-portrait]');
  const body = stage.querySelector('[data-emperor-body]');
  const nodes = [...stage.querySelectorAll('[data-emperor-flame]')];
  const back = stage.querySelector('[data-emperor-fire-back]');
  const front = stage.querySelector('[data-emperor-fire-front]');
  const backCtx = back.getContext('2d'), frontCtx = front.getContext('2d');
  const plates = new Map();
  let raf = 0, clock = 0, last = 0, lastPaint = 0, loading = false;
  let volumeBytes, volumePending, decoder, decoding = false, count = 0, frameIndex = -1, paints = 0;
  let observed = true;
  const metrics = {ticks:0, totalMs:0, maxMs:0};
  function selected() { return root.dataset.backgroundCurrent === 'emperor' && (wide.matches || root.dataset.artScope === 'gallery'); }
  function moving() { return selected() && observed && !document.hidden && !reduced.matches && root.dataset.artMotion !== 'still'; }
  const observer = new IntersectionObserver(([entry]) => { observed = entry.isIntersecting; wake(); });
  observer.observe(stage);

  function orbit(t) {
    nodes.slice(1).forEach((node, i) => {
      const band = i % 2, index = Math.floor(i / 2);
      const angle = index / 11 * Math.PI * 2 - Math.PI / 2 + band * .27 + t * (band ? -.044 : .035);
      const depth = Math.sin(angle + .45);
      const x = .5 + (band ? .265 : .41) * Math.cos(angle);
      const y = .5 + (band ? .315 : .423) * Math.sin(angle) + .009 * Math.sin(t * .8 + i * 1.7);
      node.style.left = (x * 100) + '%';
      node.style.top = (y * 100) + '%';
      node.style.transform = `translate(-50%,-50%) scale(${.83 + (depth + 1) * .12})`;
      node.style.zIndex = depth > .12 ? '12' : '6';
      node.style.opacity = plates.has(node.dataset.flamePlate) && plates.get(node.dataset.flamePlate).complete ? String(.72 + (depth + 1) * .12) : '0';
    });
    body.style.transform = `translateY(${Math.sin(t * .48) * 4}px)`;
  }

  function attach() {
    if (!window.JiaArtLoops || !moving()) return;
    nodes.forEach(node => {
      const image = plates.get(node.dataset.flamePlate);
      if (image?.naturalWidth) window.JiaArtLoops.emperorFlame(node, image, Number(node.dataset.emperorFlame));
    });
    if (portrait.naturalWidth) window.JiaArtLoops.emperor?.(body, portrait);
    window.JiaArtLoops.wake();
  }

  async function loadArt() {
    if (loading) return;
    loading = true;
    try {
      if (!portrait.src) {
        portrait.src = portrait.dataset.emperorPortrait;
        await portrait.decode();
      }
      const urls = [...new Set(nodes.map(node => node.dataset.flamePlate))];
      // Two workers keep the selected character ahead of the four shared atlases.
      async function worker() {
        while (urls.length) {
          const url = urls.shift();
          if (plates.get(url)?.naturalWidth) continue;
          const image = new Image();
          image.src = url;
          try {
            await image.decode();
            plates.set(url, image);
            nodes.filter(node => node.dataset.flamePlate === url).forEach(node => { node.style.backgroundImage = `url("${url}")`; });
            attach();
            orbit(clock);
          } catch (_) { /* Other atlas cells and the intact portrait remain usable. */ }
        }
      }
      await Promise.all([worker(), worker()]);
      stage.dataset.ready = String(plates.size === 4 && portrait.naturalWidth > 0);
      attach();
    } catch (_) { stage.dataset.ready = 'error'; }
    finally { loading = false; }
  }

  async function openVolume() {
    if (decoder || volumePending || !window.ImageDecoder || !moving()) return;
    volumePending = (async () => {
      if (!volumeBytes) {
        const response = await fetch(stage.dataset.emperorFire, {priority:'low'});
        if (!response.ok) throw Error('Emperor Flame unavailable');
        volumeBytes = await response.arrayBuffer();
      }
      if (!moving()) return;
      decoder = new ImageDecoder({data:volumeBytes.slice(0), type:'image/webp', preferAnimation:true});
      await decoder.tracks.ready;
      count = decoder.tracks.selectedTrack.frameCount;
      frameIndex = -1;
      stage.dataset.volume = 'ready';
    })().catch(() => { decoder?.close(); decoder = null; stage.dataset.volume = 'fallback'; })
      .finally(() => { volumePending = null; });
  }

  function volumeFrame() {
    if (!decoder || decoding || !backCtx || !frontCtx) return;
    decoding = true;
    const activeDecoder = decoder, next = (frameIndex + 1) % count;
    activeDecoder.decode({frameIndex:next}).then(({image}) => {
      try {
        if (decoder !== activeDecoder || !moving()) return;
        const w = Math.max(1,Math.ceil(stage.clientWidth * devicePixelRatio));
        const h = Math.max(1,Math.ceil(stage.clientHeight * devicePixelRatio));
        for (const canvas of [back,front]) if (canvas.width !== w || canvas.height !== h) {canvas.width=w;canvas.height=h;}
        backCtx.clearRect(0,0,w,h);frontCtx.clearRect(0,0,w,h);
        function emit(ctx,x,y,width,alpha) {
          ctx.globalAlpha=alpha;
          // The source was ray-marched for the approved lotus. Its hot root is
          // anchored here to the torso, open palms and hem, rather than the face.
          const s=w*width;
          ctx.drawImage(image,x*w-s*.45,y*h-s*.48,s,s);
        }
        emit(backCtx,.50,.46,1.12,.55);
        emit(backCtx,.22,.58,.48,.56);
        emit(backCtx,.79,.57,.48,.56);
        emit(backCtx,.50,.90,.86,.48);
        emit(frontCtx,.23,.59,.32,.32);
        emit(frontCtx,.79,.58,.31,.32);
        emit(frontCtx,.49,.91,.62,.23);
        backCtx.globalAlpha=frontCtx.globalAlpha=1;
        frameIndex=next;paints++;
      } finally { image.close(); }
    }).catch(() => {
      if (decoder===activeDecoder) {decoder.close();decoder=null;stage.dataset.volume='fallback';}
    }).finally(() => {decoding=false;});
  }

  function tick(now) {
    raf=0;
    if (!moving()) {last=0;return;}
    if (last) clock+=Math.min(.12,(now-last)/1000);
    last=now;
    if (now-lastPaint>=1000/24-.5) {
      const start=performance.now();
      orbit(clock);volumeFrame();
      const spent=performance.now()-start;
      metrics.ticks++;metrics.totalMs+=spent;metrics.maxMs=Math.max(metrics.maxMs,spent);
      lastPaint=now;
    }
    raf=requestAnimationFrame(tick);
  }
  function wake() {
    if (selected()) void loadArt();
    if (moving()) {
      attach();
      if (stage.dataset.volume!=='fallback') void openVolume();
      back.hidden=front.hidden=false;
      if (!raf) raf=requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);raf=0;last=0;
      back.hidden=front.hidden=true;
      if (!selected() && decoder && !decoding) {decoder.close();decoder=null;delete stage.dataset.volume;}
      orbit(clock);
    }
  }
  window.JiaEmperorScene={wake,inspect:()=>({selected:selected(),running:!!raf,clock,outerFlames:nodes.length-1,bodyIsEmperorFlame:true,
    plates:plates.size,portraitLoaded:!!portrait.naturalWidth,volume:stage.dataset.volume,volumeFrames:count,volumePaints:paints,metrics,
    ranks:nodes.map(node=>Number(node.dataset.emperorFlame)),coreAnchors:['torso','left-palm','right-palm','robe-hem']})};
  new MutationObserver(wake).observe(root,{attributes:true,attributeFilter:['data-background-current','data-art-motion','data-art-runtime','class']});
  document.addEventListener('visibilitychange',wake);
  reduced.addEventListener('change',wake);wide.addEventListener('change',wake);
  addEventListener('resize',wake,{passive:true});
  orbit(0);wake();
})();
