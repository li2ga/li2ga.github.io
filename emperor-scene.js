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
  const rulerChannels = ruler?.querySelector('[data-ruler-channels]');
  const channelCtx = rulerChannels?.getContext('2d');
  const nodes = [...stage.querySelectorAll('[data-emperor-flame]')];
  const back = stage.querySelector('[data-emperor-fire-back]');
  const front = stage.querySelector('[data-emperor-fire-front]');
  const backCtx = back.getContext('2d'), frontCtx = front.getContext('2d');
  const plates = new Map();
  const rulerFrames = [];
  let rulerPaints = 0;
  const fusedPaints = Array(22).fill(0);
  let flameProfiles;
  const profiles=()=>flameProfiles||(flameProfiles=window.JiaArtLoops?.emperorProfiles());
  // Rank 1 is the Emperor's own body. Ranks 2–23 bind to the two forged flanks.
  // Hue is only for the connecting current; the native artwork and motion are
  // copied from each distinct live flame, not recolored from one generic fire.
  const fusedColors=['#705396','#ffd7ed','#ffd36b','#8dffb2','#f9ac48',
    '#edbf67','#ff455c','#bd7aff','#9bb5e4','#c7faff','#dbd5ff',
    '#c0ad5e','#ffb8ba','#57ccff','#dfb2ff','#ff7543','#a6d27a',
    '#65f5db','#a9e75b','#f7f6ff','#eeac5c','#e6b459'];
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
    // Metal is the intact native PNG. The 22 live fires and forged-channel
    // currents have their own canvases; a second GPU copy of this rigid body
    // adds no necessary motion and can fail during staggered texture uploads.
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
        if (rulerCtx && rulerImage.naturalWidth) prepareRulerPlume(image);
        paintRulerFire();
        backCtx.globalAlpha=frontCtx.globalAlpha=1;
        frameIndex=next;paints++;
      } finally { image.close(); }
    }).catch(() => {
      if (decoder===activeDecoder) {decoder.close();decoder=null;stage.dataset.volume='fallback';}
    }).finally(() => {decoding=false;});
  }

  function prepareRulerPlume(image) {
    const canvas=rulerFrames.length<8?document.createElement('canvas'):rulerFrames.pop();
    if (canvas.width!==214 || canvas.height!==225) {canvas.width=214;canvas.height=225;}
    const c=canvas.getContext('2d',{willReadFrequently:true});
    c.clearRect(0,0,214,225);
    c.drawImage(image,122,0,214,225,0,0,214,225);
    const pixels=c.getImageData(0,0,214,225),rgba=pixels.data;
    // Keep the simulated filament density, but map its cool/pink palette to
    // clear amber heat. A sepia filter made thin flames look like brown vapor.
    for (let i=0;i<rgba.length;i+=4) {
      if (!rgba[i+3]) continue;
      const heat=(rgba[i]*.30+rgba[i+1]*.55+rgba[i+2]*.15)/255;
      const q=Math.max(0,Math.min(1,(heat-.14)/.20));
      rgba[i]=255;rgba[i+1]=94+161*Math.pow(heat,.8);rgba[i+2]=12+220*heat*heat*heat;
      const density=rgba[i+3]/255*q*q*(3-2*q);
      rgba[i+3]=255*(1-Math.pow(1-density,2.05));
    }
    c.putImageData(pixels,0,0);
    // Tint a small shared plume six times, not the full-size target 22 times.
    // Each native fire keeps its own original artwork; these are only the
    // extra finite fluid tongues that support the same hot roots.
    const filters=['none','hue-rotate(95deg)','hue-rotate(155deg)',
      'hue-rotate(235deg)','hue-rotate(310deg)','grayscale(1)'];
    canvas.tints||=[];
    filters.forEach((filter,i)=>{
      const tint=canvas.tints[i]||document.createElement('canvas');
      if(tint.width!==214||tint.height!==225){tint.width=214;tint.height=225;}
      const tc=tint.getContext('2d');tc.clearRect(0,0,214,225);
      tc.filter=filter;tc.drawImage(canvas,0,0);tc.filter='none';
      canvas.tints[i]=tint;
    });
    rulerFrames.unshift(canvas);
  }

  function paintRulerFire() {
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
    if (rulerChannels.width!==w || rulerChannels.height!==h) {rulerChannels.width=w;rulerChannels.height=h;}
    channelCtx.clearRect(0,0,w,h);
    rulerCtx.save();channelCtx.save();
    rulerCtx.translate(ox,oy);channelCtx.translate(ox,oy);
    rulerCtx.scale(iw*devicePixelRatio,ih*devicePixelRatio);
    channelCtx.scale(iw*devicePixelRatio,ih*devicePixelRatio);
    for (let i=0;i<22;i++) {
      const p=fusedFlame(i,clock),node=nodes[p.rank-1];
      const live=node?.querySelector('.art-loop-canvas');
      const plate=plates.get(node?.dataset.flamePlate);
      if (!plate?.naturalWidth) continue;
      rulerCtx.save();
      rulerCtx.translate(p.x,p.y);
      // Roots remain welded to the blade. Only the native flame bends, grows
      // and sheds; no independent orbit or floating icon is introduced here.
      rulerCtx.rotate(p.side?.22:-.22);
      const profile=profiles()?.[p.rank-1];
      const anchor=profile?.anchor||[.5,.25];
      const width=p.width,height=p.height;
      rulerCtx.globalAlpha=.88;
      if (live&&!live.hidden&&live.width) {
        rulerCtx.drawImage(live,-anchor[0]*width,-(1-anchor[1])*height,width,height);
      } else {
        const cell=(p.rank-1)%6;
        rulerCtx.drawImage(plate,(cell%3)*512,Math.floor(cell/3)*512,512,512,-anchor[0]*width,-(1-anchor[1])*height,width,height);
      }
      // A short, finite fluid tongue emerges at the very same hot root.
      // Its hue supplements, rather than replacing, the distinct native body.
      const fluid=rulerFrames[(i*3)%Math.max(1,rulerFrames.length)];
      if (fluid) {
        rulerCtx.globalAlpha=p.alpha*(p.rank===2||p.rank===21?.18:.56);
        const tint=[3,4,0,1,0,0,4,3,2,2,3,0,4,2,3,0,1,2,1,5,0,0][i];
        rulerCtx.drawImage(fluid.tints?.[tint]||fluid,-.044,-p.tongueHeight,.088,p.tongueHeight);
      }
      rulerCtx.restore();
      drawFusionChannel(channelCtx,p,clock);
      fusedPaints[i]++;
    }
    rulerCtx.restore();channelCtx.restore();
    rulerPaints++;
  }

  function fusedFlame(index,t) {
    const side=index>=11?1:0,row=side?21-index:index;
    const rank=index+2,profile=profiles()?.[rank-1];
    const speed=profile?.speed||1;
    const duration=1.25+1.10/speed,life=(t/duration+index*.381966)%1;
    const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
    return {index,rank,side,row,x:side?.650:.350,y:.108+row*.052,
      width:.225,height:.122+(rank===9||rank===18?.025:0),
      duration,life,alpha:smooth(life/.14)*(1-smooth((life-.64)/.36)),
      tongueHeight:(.045+.060*smooth(life/.55))*(rank===4?1.25:1),
      color:fusedColors[index],motion:profile?.motion,paints:fusedPaints[index]};
  }

  function drawFusionChannel(c,p,t) {
    const side=p.side?1:-1,phase=(t*.46+p.index*.213)%1;
    c.save();
    // Narrow currents follow the forged recess; the opaque spine is never
    // displaced, erased or covered by a luminous blanket.
    c.lineWidth=.0018;c.strokeStyle=p.color;c.globalAlpha=.24;
    c.beginPath();c.moveTo(p.x,p.y);
    c.bezierCurveTo(p.x-side*.055,p.y+.012,.5+side*.055,p.y-.014,.5+side*.043,p.y-.032);c.stroke();
    const sx=p.x+(side*.043+.5-p.x)*phase,sy=p.y-.032*phase;
    const g=c.createRadialGradient(sx,sy,0,sx,sy,.012);
    g.addColorStop(0,p.color);g.addColorStop(.22,p.color+'b0');g.addColorStop(1,p.color+'00');
    c.globalAlpha=.7;c.fillStyle=g;c.fillRect(sx-.012,sy-.012,.024,.024);
    c.translate(p.x+side*.045,p.y-.03);
    if(p.rank===11){
      // Local cold plume stays behind the snow, close to its own blade root.
      for(let j=0;j<12;j++){
        const age=(t/(2.2+j*.11)+j*.618)%1;
        const x=(Math.sin(j*13.7)*.066)+Math.sin(t*.65+j)*.010,y=-.105+age*.155;
        const r=.0027+(j%3)*.00065;
        c.globalAlpha=Math.sin(age*Math.PI)*.9;c.strokeStyle='#dcfaff';c.lineWidth=.001;
        c.beginPath();for(let arm=0;arm<3;arm++){const a=arm*Math.PI/3+t*.07;const dx=Math.cos(a)*r,dy=Math.sin(a)*r;c.moveTo(x-dx,y-dy);c.lineTo(x+dx,y+dy);}c.stroke();
      }
    }else if(p.rank===12){
      const flash=Math.pow(Math.max(0,Math.sin(t*9.7)),9);
      c.globalAlpha=.25+.7*flash;c.strokeStyle='#e5deff';c.lineWidth=.002;
      c.beginPath();for(let j=0;j<9;j++){const y=-j*.010,x=Math.sin(j*17+Math.floor(t*12))*.012; j?c.lineTo(x,y):c.moveTo(0,0);}c.stroke();
    }else if(p.rank===2||p.rank===21){
      for(let a=0;a<2;a++){
        c.strokeStyle=p.rank===2?'#524069':a?'#f9fcff':'#251e38';c.globalAlpha=.8;c.lineWidth=.0023;
        c.beginPath();for(let j=0;j<24;j++){const u=j/23,angle=u*5.5+t*(p.rank===2?-1.6:1.1)+a*Math.PI,r=(1-u)*.023,x=Math.cos(angle)*r,y=-u*.084; j?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
      }
    }else if(p.rank===4||p.rank===5||p.rank===20){
      // Gold filaments rise quickly; life/poison sparks branch more slowly.
      for(let j=0;j<5;j++){
        const age=(t*(p.rank===4?1.7:.55)+j*.27)%1;
        c.globalAlpha=Math.sin(age*Math.PI)*.8;c.strokeStyle=p.color;c.lineWidth=.0013;
        const x=Math.sin(j*3.6+age*4)*.018;
        c.beginPath();c.moveTo(x,-age*.09);c.lineTo(x+Math.sin(j)*.003,-age*.09-.006);c.stroke();
      }
    }
    c.restore();
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
      if (rulerChannels) rulerChannels.hidden=false;
      if (!raf) raf=requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);raf=0;last=0;
      back.hidden=front.hidden=true;
      if (rulerFire) rulerFire.hidden=true;
      if (rulerChannels) rulerChannels.hidden=true;
      if (!selected() && decoder && !decoding) {decoder.close();decoder=null;delete stage.dataset.volume;}
      if (!selected()) rulerFrames.length=0;
      orbit(clock);
    }
  }
  window.JiaEmperorScene={wake,rulerTongues:t=>Array.from({length:22},(_,i)=>fusedFlame(i,t)),inspect:()=>({selected:selected(),running:!!raf,clock,outerFlames:nodes.length-1,bodyIsEmperorFlame:true,
    plates:plates.size,portraitLoaded:!!portrait.naturalWidth,volume:stage.dataset.volume,volumeFrames:count,volumePaints:paints,metrics,
    ranks:nodes.map(node=>Number(node.dataset.emperorFlame)),coreAnchors:['torso','left-palm','right-palm','robe-hem'],
    ruler:{revision:'twenty-two-fused-v1',loaded:!!rulerImage?.naturalWidth,source:rulerImage?.currentSrc,ready:ruler?.dataset.ready,edgeEmitters:22,fusedRanks:Array.from({length:22},(_,i)=>i+2),fusion:Array.from({length:22},(_,i)=>fusedFlame(i,clock)),volumeLayer:'22 native shape-directed fires and finite fluid tongues rooted in blade flanks; narrow front-channel currents and local cold/lightning/dual-flow accents',paints:rulerPaints,phaseFrames:rulerFrames.length,lifetimeSeconds:[1.7,3.1],pose:rulerFloat?.style.transform}})};
  new MutationObserver(wake).observe(root,{attributes:true,attributeFilter:['data-background-current','data-art-motion','data-art-runtime','class']});
  document.addEventListener('visibilitychange',wake);
  reduced.addEventListener('change',wake);wide.addEventListener('change',wake);
  addEventListener('resize',wake,{passive:true});
  orbit(0);wake();
})();
