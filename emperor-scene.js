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
  const ruler = scene.querySelector('[data-emperor-ruler]');
  const rulerArt = ruler?.querySelector('[data-ruler-art]');
  const rulerImage = ruler?.querySelector('[data-ruler-image]');
  const rulerFloat = ruler?.querySelector('[data-ruler-float]');
  const rulerFire = ruler?.querySelector('[data-ruler-fire]');
  const rulerCtx = rulerFire?.getContext('2d');
  const nodes = [...stage.querySelectorAll('[data-emperor-flame]')];
  const back = stage.querySelector('[data-emperor-fire-back]');
  const front = stage.querySelector('[data-emperor-fire-front]');
  const backCtx = back.getContext('2d'), frontCtx = front.getContext('2d');
  const plates = new Map();
  let raf = 0, clock = 0, last = 0, lastPaint = 0, loading = false;
  let volumeBytes, volumePending, decoder, decoding = false, count = 0, frameIndex = -1, paints = 0;
  const intersections = new Map([[stage,true],...(ruler?[[ruler,true]]:[])]);
  let rulerLoading;
  const metrics = {ticks:0, totalMs:0, maxMs:0};
  function selected() { return root.dataset.backgroundCurrent === 'emperor' && (wide.matches || root.dataset.artScope === 'gallery'); }
  function moving() { return selected() && [...intersections.values()].some(Boolean) && !document.hidden && !reduced.matches && root.dataset.artMotion !== 'still'; }
  const observer = new IntersectionObserver(entries => { entries.forEach(entry=>intersections.set(entry.target,entry.isIntersecting)); wake(); });
  observer.observe(stage);
  if (ruler) observer.observe(ruler);

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
    if (rulerFloat) rulerFloat.style.transform = `translate3d(${Math.sin(t*.27)*3}px,${Math.sin(t*.42+1.3)*9}px,0) rotate(${11+Math.sin(t*.23)*1.8}deg)`;
  }

  function attach() {
    if (!window.JiaArtLoops || !moving()) return;
    nodes.forEach(node => {
      const image = plates.get(node.dataset.flamePlate);
      if (image?.naturalWidth) window.JiaArtLoops.emperorFlame(node, image, Number(node.dataset.emperorFlame));
    });
    if (portrait.naturalWidth) window.JiaArtLoops.emperor?.(body, portrait);
    if (rulerImage?.naturalWidth) window.JiaArtLoops.ruler?.(rulerArt, rulerImage);
    window.JiaArtLoops.wake();
  }

  async function loadRuler() {
    if (!rulerImage || rulerImage.naturalWidth || rulerLoading) return;
    rulerLoading = (async()=>{
      rulerImage.src=rulerImage.dataset.rulerImage;
      await rulerImage.decode();
      ruler.dataset.ready='true';
      attach();
    })().catch(()=>{rulerImage.removeAttribute('src');ruler.dataset.ready='error';})
      .finally(()=>{rulerLoading=null;});
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
    let candidate;
    volumePending = (async () => {
      if (!volumeBytes) {
        const response = await fetch(stage.dataset.emperorFire, {priority:'low'});
        if (!response.ok) throw Error('Emperor Flame unavailable');
        volumeBytes = await response.arrayBuffer();
      }
      if (!moving()) return;
      candidate = new ImageDecoder({data:volumeBytes.slice(0), type:'image/webp', preferAnimation:true});
      await candidate.tracks.ready;
      if (!moving()) {candidate.close();return;}
      const frames = candidate.tracks.selectedTrack.frameCount;
      if (!frames) throw Error('Emperor Flame has no animation frames');
      // Publish only a ready decoder. A render tick during tracks.ready used
      // to request frame NaN (count was still zero) and disable the body flame.
      decoder = candidate;
      count = frames;
      frameIndex = -1;
      stage.dataset.volume = 'ready';
    })().catch(() => { candidate?.close(); decoder?.close(); decoder = null; stage.dataset.volume = 'fallback'; })
      .finally(() => { volumePending = null; });
  }

  function volumeFrame() {
    if (!decoder || !count || decoding || !backCtx || !frontCtx) return;
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
        paintRulerFire(image);
        backCtx.globalAlpha=frontCtx.globalAlpha=1;
        frameIndex=next;paints++;
      } finally { image.close(); }
    }).catch(() => {
      if (decoder===activeDecoder) {decoder.close();decoder=null;stage.dataset.volume='fallback';}
    }).finally(() => {decoding=false;});
  }

  function paintRulerFire(image) {
    if (!rulerCtx || !rulerImage.naturalWidth) return;
    // Align emission with the contained artwork, rather than the host's box.
    // All volume fire is behind the complete rigid weapon.
    const scale=Math.min(rulerArt.clientWidth/1024,rulerArt.clientHeight/1536);
    const iw=1024*scale,ih=1536*scale;
    const w=Math.max(1,Math.ceil(rulerArt.clientWidth*devicePixelRatio));
    const h=Math.max(1,Math.ceil(rulerArt.clientHeight*devicePixelRatio));
    if (rulerFire.width!==w || rulerFire.height!==h) {rulerFire.width=w;rulerFire.height=h;}
    rulerCtx.clearRect(0,0,w,h);
    const ox=(w-iw*devicePixelRatio)/2,oy=(h-ih*devicePixelRatio)/2;
    for (let side=0;side<2;side++) for(let i=0;i<7;i++) {
      const y=.10+i*.073,x=side?.663:.337;
      const size=iw*devicePixelRatio*(.19+.035*Math.sin(clock*1.3+i*1.7+side));
      rulerCtx.globalAlpha=.16+.045*Math.sin(clock*.9+i*2.4+side*1.9);
      rulerCtx.drawImage(image,ox+x*iw*devicePixelRatio-size*.5,oy+y*ih*devicePixelRatio-size*.72,size,size);
    }
    rulerCtx.globalAlpha=1;
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
    if (selected()) {void loadArt();void loadRuler();}
    if (moving()) {
      attach();
      if (stage.dataset.volume!=='fallback') void openVolume();
      back.hidden=front.hidden=false;
      if (rulerFire) rulerFire.hidden=false;
      if (!raf) raf=requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);raf=0;last=0;
      back.hidden=front.hidden=true;
      if (rulerFire) rulerFire.hidden=true;
      if (!selected() && decoder && !decoding) {decoder.close();decoder=null;delete stage.dataset.volume;}
      orbit(clock);
    }
  }
  window.JiaEmperorScene={wake,inspect:()=>({selected:selected(),running:!!raf,clock,outerFlames:nodes.length-1,bodyIsEmperorFlame:true,
    plates:plates.size,portraitLoaded:!!portrait.naturalWidth,volume:stage.dataset.volume,volumeFrames:count,volumePaints:paints,metrics,
    ranks:nodes.map(node=>Number(node.dataset.emperorFlame)),coreAnchors:['torso','left-palm','right-palm','robe-hem'],
    ruler:{loaded:!!rulerImage?.naturalWidth,source:rulerImage?.currentSrc,ready:ruler?.dataset.ready,edgeEmitters:14,volumeLayer:'behind intact weapon',pose:rulerFloat?.style.transform}})};
  new MutationObserver(wake).observe(root,{attributes:true,attributeFilter:['data-background-current','data-art-motion','data-art-runtime','class']});
  document.addEventListener('visibilitychange',wake);
  reduced.addEventListener('change',wake);wide.addEventListener('change',wake);
  addEventListener('resize',wake,{passive:true});
  orbit(0);wake();
})();
