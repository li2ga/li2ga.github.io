"use strict";

// Play the actual generated frames; the original PNG/SVG remains the fallback.
(() => {
  const root = document.querySelector('.page-atmosphere');
  if (!root) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const wide = matchMedia('(min-width: 1041px)');
  const entries = new Map(), clips = new Map();
  const surface = document.createElement('canvas');
  let manifest, gl, program, position, texture, picture, frame = 0, lastPaint = 0;
  let unavailable = false;
  const observer = new IntersectionObserver(() => wake());

  function enabled() {
    return root.dataset.artMotion !== 'still' && !reduced.matches && !document.hidden
      && (wide.matches || root.dataset.artScope === 'gallery');
  }
  function visible(entry) {
    if (!entry.host.isConnected || !entry.element.closest('[data-background-scene][data-active]')) return false;
    const box = entry.host.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.left < innerWidth && box.right > 0 && box.top < innerHeight && box.bottom > 0;
  }
  function show(entry, ready) {
    entry.host.classList.toggle('has-art-loop', ready);
    entry.canvas.hidden = !ready;
  }
  function state(entry, value) {
    if (entry.element.dataset.lotusVideoState === value) return;
    entry.element.dataset.lotusVideoState = value;
    root.dispatchEvent(new CustomEvent('lotusvideostate', {detail: {stage: entry.stage, state: value}}));
  }
  function setup() {
    if (gl) return true;
    if (unavailable) return false;
    try {
      gl = surface.getContext('webgl', {alpha: true, premultipliedAlpha: true, antialias: false});
      if (!gl) throw new Error('WebGL unavailable');
      function shader(type, source) {
        const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Video shader unavailable');
        return s;
      }
      program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, 'attribute vec2 point;varying vec2 uv;void main(){uv=point*.5+.5;gl_Position=vec4(point,0.,1.);}'));
      gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `precision mediump float;
        uniform sampler2D picture; varying vec2 uv;
        void main(){
          vec3 color=texture2D(picture,uv).rgb;
          float value=max(color.r,max(color.g,color.b));
          // Key only the black conditioning matte at presentation time.
          float mask=smoothstep(.01,.035,value);
          float alpha=value*mask;
          float edge=smoothstep(0.,.025,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));
          gl_FragColor=vec4(color*mask*edge,alpha*edge);
        }`));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Video program unavailable');
      gl.useProgram(program);
      const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
      position = gl.getAttribLocation(program, 'point');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      picture = gl.getUniformLocation(program, 'picture'); gl.uniform1i(picture, 0);
      texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      surface.addEventListener('webglcontextlost', event => {
        event.preventDefault(); unavailable = true; gl = null;
        entries.forEach(entry => { show(entry, false); state(entry, 'fallback'); });
        clips.forEach(clip => clip.video.pause());
      });
      return true;
    } catch (_) { unavailable = true; gl = null; return false; }
  }
  function sources() {
    return manifest ||= fetch('assets/backgrounds/motion/manifest.json?v=20261111-v1')
      .then(response => { if (!response.ok) throw new Error('Video manifest unavailable'); return response.json(); })
      .then(data => data.videos).catch(error => { manifest = null; throw error; });
  }
  async function prepare(stage) {
    const list = await sources(), source = list.find(item => item.stage === stage);
    if (!source) throw new Error('Unknown lotus video');
    if (clips.has(stage)) return clips.get(stage).promise;
    const video = document.createElement('video');
    video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true;
    video.preload = 'auto'; video.setAttribute('playsinline', '');
    const clip = {video, source, ready: false, failed: false, promise: null};
    clips.set(stage, clip);
    clip.promise = new Promise((resolve, reject) => {
      const deadline = setTimeout(() => finish(new Error('Video load timed out')), 90000);
      function finish(error) {
        clearTimeout(deadline); video.removeEventListener('loadeddata', loaded); video.removeEventListener('error', failed);
        if (error) { clip.failed = true; reject(error); }
        else { clip.ready = true; resolve(clip); }
        wake();
      }
      const loaded = () => finish(), failed = () => finish(new Error('Video unavailable'));
      video.addEventListener('loadeddata', loaded, {once: true}); video.addEventListener('error', failed, {once: true});
      video.src = source.src; video.load();
    });
    return clip.promise;
  }
  function load(entry) {
    if (entry.loading || entry.clip || entry.failed) return;
    entry.loading = true; state(entry, 'loading');
    prepare(entry.stage).then(clip => {
      if (entries.get(entry.element) !== entry) return;
      entry.clip = clip; entry.loading = false;
      entry.canvas.style.scale = String(1 / clip.source.scale);
      state(entry, 'ready'); wake();
    }).catch(() => {
      if (entries.get(entry.element) !== entry) return;
      entry.loading = false; entry.failed = true; state(entry, 'fallback'); show(entry, false);
    });
  }
  function paint(entry) {
    const video = entry.clip.video, source = entry.clip.source;
    if (video.readyState < 2) return;
    const box = entry.host.getBoundingClientRect(), aspect = video.videoWidth / video.videoHeight;
    const displayWidth = Math.min(box.width, box.height * aspect), dpr = devicePixelRatio || 1;
    const width = Math.max(1, Math.min(video.videoWidth, Math.ceil(displayWidth * dpr / source.scale)));
    const height = Math.max(1, Math.round(width / aspect));
    if (surface.width !== width || surface.height !== height) { surface.width = width; surface.height = height; }
    if (entry.canvas.width !== width || entry.canvas.height !== height) { entry.canvas.width = width; entry.canvas.height = height; }
    gl.viewport(0, 0, width, height); gl.useProgram(program); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    entry.context.clearRect(0,0,width,height); entry.context.drawImage(surface,0,0);
    if (entry.stage === 1) snow(entry, width, height);
    show(entry, true); entry.paints++;
    root.dataset.lotusRenderer = 'model-video';
  }
  function snow(entry, width, height) {
    const context = entry.context, clock = performance.now() / 1000;
    context.strokeStyle = 'rgba(134,207,232,.75)'; context.lineWidth = Math.max(.6, width/500);
    for (let i=0;i<24;i++) {
      const phase = (clock*(.022+(i%5)*.004)+i*.618)%1;
      const x = width*((i*.7549+.035*Math.sin(clock*.7+i*2)+.02*Math.sin(clock*1.3+i))%1);
      const y = height*(phase*1.16-.08), size = width*(.004+(i%4)*.0015);
      context.save(); context.translate(x,y); context.rotate(clock*.3+i);
      context.globalAlpha = Math.sin(phase*Math.PI)*.8; context.beginPath();
      for (let arm=0;arm<6;arm++) {
        const a=arm*Math.PI/3, dx=Math.cos(a),dy=Math.sin(a);
        context.moveTo(0,0); context.lineTo(dx*size,dy*size);
        for (const side of [-1,1]) { context.moveTo(dx*size*.62,dy*size*.62); context.lineTo(dx*size*.43+Math.cos(a+side*Math.PI/2)*size*.23,dy*size*.43+Math.sin(a+side*Math.PI/2)*size*.23); }
      }
      context.stroke(); context.restore();
    }
  }
  function tick(now) {
    frame = 0;
    if (!enabled() || !setup()) { wake(); return; }
    const active = new Set(); let continueDrawing = false;
    for (const entry of entries.values()) {
      if (!visible(entry) || entry.failed) continue;
      load(entry);
      if (!entry.clip) continue;
      state(entry, 'ready');
      const video = entry.clip.video; active.add(video); continueDrawing = true;
      if (video.paused && !entry.playBlocked) video.play().catch(() => { entry.playBlocked = true; state(entry, 'fallback'); show(entry, false); });
      if (now-lastPaint >= 1000/24-.5 && !entry.playBlocked) {
        try { paint(entry); } catch (_) { entry.failed = true; state(entry, 'fallback'); show(entry, false); }
      }
    }
    clips.forEach(clip => { if (!active.has(clip.video)) clip.video.pause(); });
    if (now-lastPaint >= 1000/24-.5) lastPaint = now;
    if (continueDrawing) frame = requestAnimationFrame(tick);
  }
  function wake() {
    if (!enabled() || unavailable) {
      cancelAnimationFrame(frame); frame = 0;
      clips.forEach(clip => clip.video.pause());
      entries.forEach(entry => { show(entry, false); state(entry, 'idle'); });
      return;
    }
    if (!frame && entries.size) frame = requestAnimationFrame(tick);
  }
  function lotus(element, stage, image) {
    const host = element.querySelector(`[data-lotus-frame="${stage}"]`);
    if (!host) return;
    const old = entries.get(element);
    if (old?.host === host && old.stage === stage) return;
    if (old) { observer.unobserve(old.host); show(old, false); old.canvas.remove(); }
    const canvas = document.createElement('canvas'); canvas.className = 'art-loop-canvas lotus-video-canvas';
    canvas.hidden = true; canvas.setAttribute('aria-hidden', 'true');
    const context = canvas.getContext('2d', {alpha: true});
    if (!context) return;
    const entry = {element, host, canvas, context, stage, image, paints: 0, loading: false, failed: false};
    entries.set(element, entry); host.classList.add('art-loop-host'); host.appendChild(canvas);
    state(entry, 'idle'); observer.observe(host);
    if (enabled() && visible(entry)) load(entry);
    wake();
  }
  function retry() {
    for (const [stage, clip] of clips) if (clip.failed) clips.delete(stage);
    entries.forEach(entry => { entry.failed = false; entry.playBlocked = false; entry.loading = false; }); wake();
  }
  window.JiaLotusVideos = {lotus, prepare, wake, retry,
    inspect() { return {revision: 'video-20261111-v1', enabled: enabled(), unavailable, running: !!frame,
      entries: [...entries.values()].map(entry => ({stage: entry.stage, state: entry.element.dataset.lotusVideoState,
        paints: entry.paints, visible: visible(entry), failed: entry.failed, width: entry.canvas.width, height: entry.canvas.height,
        currentTime: entry.clip?.video.currentTime, duration: entry.clip?.video.duration,
        paused: entry.clip?.video.paused, source: entry.clip?.source.src, model: entry.clip?.source.model})),
      clips: [...clips.values()].map(clip => ({stage: clip.source.stage, ready: clip.ready, failed: clip.failed, paused: clip.video.paused}))}; }
  };
  new MutationObserver(wake).observe(root, {attributes: true, attributeFilter: ['data-art-motion', 'data-background-current', 'data-background-layout']});
  document.addEventListener('visibilitychange', wake); window.addEventListener('scroll', wake, {passive: true});
  window.addEventListener('resize', wake, {passive: true}); reduced.addEventListener('change', wake); wide.addEventListener('change', wake);
})();
