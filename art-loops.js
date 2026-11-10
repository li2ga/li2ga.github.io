"use strict";

// Internal image motion. Originals remain the still/reduced-motion fallback.
(() => {
  const root = document.querySelector('.page-atmosphere');
  if (!root) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const wide = matchMedia('(min-width: 1041px)');
  const entries = new Map();
  const textures = new Map();
  const surface = document.createElement('canvas');
  const period = 8000;
  let gl, program, locations, attempted = false;
  let frame = 0, elapsed = 0, last = 0, lastPaint = 0, serial = 0;
  const stats = { paints: 0, ticks: 0, totalMs: 0, maxMs: 0 };
  const crossings = 'IntersectionObserver' in window
    ? new IntersectionObserver(changes => { if (changes.some(change => change.isIntersecting)) wake(); }) : null;
  let visibilityWake = 0;

  const vertex = `attribute vec2 position; varying vec2 uv;
    void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
  const fragment = `precision mediump float;
    uniform sampler2D picture;
    uniform float phase, mode, variant;
    varying vec2 uv;
    void main(){
      vec2 p=uv;
      float t=phase;
      float light=0.;
      if(mode<.5){
        // Branches and feathers flex locally, rather than moving a rigid card.
        float edge=smoothstep(.1,.9,uv.y);
        p.x+=.006*edge*sin(uv.y*19.+t)*sin(uv.x*8.-t);
        p.y+=.0025*sin(uv.x*21.+t*2.)*edge;
        light=.025*sin(uv.y*28.-t*2.);
      }else if(mode<1.5){
        // Upward tongues of fire and traveling light within the original petals.
        float height=smoothstep(.05,.9,uv.y);
        float wave=sin(uv.y*34.-t*3.)+.55*sin(uv.y*67.-uv.x*9.-t*5.);
        p.x+=.009*wave*height;
        p.y+=.0045*sin(uv.x*27.+t*2.)*height;
        light=.1*sin(uv.y*39.-t*4.+uv.x*13.)+.035*sin(t*3.);
        if(variant>4.5&&variant<6.5){
          float a=atan(uv.y-.42,uv.x-.5);
          light+=.07*pow(max(0.,cos(a*3.-t*2.)),12.);
        }
      }else if(mode<2.5){
        // Water/mist ripples travel through the dragon and river details.
        p.x+=.009*sin(uv.y*40.-t*3.)+.003*sin(uv.y*77.+t*2.);
        p.y+=.004*sin(uv.x*27.-t*2.);
        light=.055*sin(uv.y*42.+uv.x*18.-t*3.);
      }else if(mode<3.5){
        // A narrow glint crosses rigid architecture and metal without bending it.
        float line=sin(uv.x*5.+uv.y*8.-t);
        light=.16*pow(max(0.,line),20.);
      }else if(mode<4.5){
        // The moon remains solid; its luminous detail shimmers gently.
        float radius=length(uv-vec2(.5));
        light=.035*sin(t)+.07*pow(max(0.,sin(radius*37.-t*2.)),12.);
      }else{
        // Soft paper, cloud and petals retain their center with a living edge.
        float edge=smoothstep(.08,.42,abs(uv.x-.5));
        p.y+=.008*edge*sin(uv.x*18.+t);
        p.x+=.0025*sin(uv.y*24.-t*2.);
        light=.035*sin(uv.x*17.+uv.y*8.-t);
      }
      vec4 c=texture2D(picture,clamp(p,0.,1.));
      float brightness=dot(c.rgb,vec3(.2126,.7152,.0722));
      vec3 tint=mix(c.rgb,vec3(1.),.35);
      c.rgb=clamp(c.rgb+tint*light*(.25+.75*brightness),0.,1.);
      gl_FragColor=vec4(c.rgb*c.a,c.a);
    }`;

  function setup() {
    if (attempted) return !!gl;
    attempted = true;
    try {
      gl = surface.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
      if (!gl) { root.dataset.artRenderer='still-fallback'; return false; }
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Image motion shader unavailable');
        return shader;
      };
      program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Image motion program unavailable');
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      locations = Object.fromEntries(['picture','phase','mode','variant'].map(name => [name, gl.getUniformLocation(program,name)]));
      gl.uniform1i(locations.picture, 0);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      surface.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        gl = null;
        textures.clear();
        root.dataset.artRenderer='still-fallback';
        entries.forEach(entry => show(entry, false));
      });
      root.dataset.artRenderer = 'webgl';
      return true;
    } catch (_) {
      gl = null;
      root.dataset.artRenderer = 'still-fallback';
      return false;
    }
  }

  function texture(image) {
    if (textures.has(image)) return textures.get(image);
    const next = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, next);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    textures.set(image, next);
    return next;
  }

  function show(entry, ready) {
    entry.host.classList.toggle('has-art-loop', ready);
    entry.canvas.hidden = !ready;
  }

  function enabled() {
    return root.dataset.artMotion !== 'still' && !document.hidden && !reduced.matches && wide.matches;
  }

  function visible(entry) {
    if (!entry.key.isConnected || !entry.key.closest('[data-background-scene][data-active]')) return false;
    const box = entry.host.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.right > 0 && box.left < innerWidth && box.bottom > 0 && box.top < innerHeight;
  }

  function draw(entry, time) {
    try {
      const image = entry.image;
      if (surface.width !== image.naturalWidth || surface.height !== image.naturalHeight) {
        surface.width = image.naturalWidth;
        surface.height = image.naturalHeight;
      }
      gl.viewport(0, 0, surface.width, surface.height);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture(image));
      gl.uniform1f(locations.phase, ((time / period + entry.seed) % 1) * Math.PI * 2);
      gl.uniform1f(locations.mode, entry.mode);
      gl.uniform1f(locations.variant, entry.variant);
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      if (gl.getError() !== gl.NO_ERROR) throw new Error('Image motion rendering failed');
      entry.context.clearRect(0,0,entry.canvas.width,entry.canvas.height);
      entry.context.drawImage(surface,0,0);
      if (entry.key.matches('img') && !entry.fullyRevealed) {
        const opacity=getComputedStyle(entry.image).opacity;
        entry.canvas.style.opacity=opacity;
        entry.fullyRevealed=Number(opacity)>=.999;
      }
      show(entry,true);
      entry.paints++;
      stats.paints++;
    } catch (_) {
      entry.failed = true;
      show(entry,false);
    }
  }

  function tick(now) {
    frame = 0;
    if (!enabled()) {
      entries.forEach(entry => show(entry,false));
      last = 0;
      return;
    }
    if (last) elapsed += Math.min(120, now-last);
    last = now;
    if (now-lastPaint >= 1000/24) {
      const start = performance.now();
      let uploads=0;
      for (const entry of entries.values()) {
        if (entry.failed || !visible(entry)) continue;
        if (!textures.has(entry.image)) {
          if (uploads>=1) continue;
          uploads++;
        }
        if (setup()) draw(entry,elapsed);
      }
      const duration = performance.now()-start;
      stats.ticks++;
      stats.totalMs += duration;
      stats.maxMs = Math.max(stats.maxMs,duration);
      lastPaint = now;
    }
    if (attempted && !gl) { last=0; return; }
    if ([...entries.values()].some(entry => !entry.failed && visible(entry))) frame = requestAnimationFrame(tick);
    else {
      last = 0;
      if (!crossings && [...entries.values()].some(entry=>entry.key.closest('[data-background-scene][data-active]'))) {
        visibilityWake=setTimeout(wake,500);
      }
    }
  }

  function wake() {
    clearTimeout(visibilityWake);
    if (!enabled()) {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      entries.forEach(entry => show(entry,false));
    } else if (!frame && entries.size) frame = requestAnimationFrame(tick);
  }

  function install(key,host,image,mode,variant=0) {
    if (entries.get(key)?.image === image && entries.get(key)?.host === host) return;
    let entry = entries.get(key);
    if (entry) {
      crossings?.unobserve(entry.host);
      show(entry,false);
      entry.canvas.remove();
    } else {
      const canvas=document.createElement('canvas');
      canvas.className='art-loop-canvas';
      canvas.setAttribute('aria-hidden','true');
      canvas.hidden=true;
      const context=canvas.getContext('2d',{alpha:true});
      if (!context) return;
      entry={key,canvas,context,seed:(serial++*.173)%1,paints:0};
      entries.set(key,entry);
    }
    entry.host=host;
    entry.image=image;
    entry.mode=mode;
    entry.variant=variant;
    entry.failed=false;
    entry.fullyRevealed=false;
    entry.canvas.width=image.naturalWidth;
    entry.canvas.height=image.naturalHeight;
    host.classList.add('art-loop-host');
    host.appendChild(entry.canvas);
    crossings?.observe(host);
    wake();
  }

  const subjects = { moon:4, sun:0, palace:3, scroll:5, 'star-sword':3, crane:0,
                     pine:0, blade:3, 'water-dragon':2, lamp:1, vine:5, mountain:2 };
  window.JiaArtLoops = {
    lotus(element,stage,image) {
      const host=element.querySelector(`[data-lotus-frame="${stage}"]`);
      if (host && image) install(element,host,image,1,stage);
    },
    imagery(image) {
      const object=image.closest('.imagery-object');
      if (object) install(image,image.parentElement,image,subjects[object.dataset.imageryObject]??0);
    },
    wake,
    inspect() {
      return {renderer:root.dataset.artRenderer||'not-needed',enabled:enabled(),periodMs:period,running:!!frame,ticks:stats.ticks,
              textureCount:textures.size,paints:stats.paints,meanTickMs:stats.ticks?stats.totalMs/stats.ticks:0,maxTickMs:stats.maxMs,
              entries:[...entries.values()].map(entry=>({type:entry.key.matches('[data-lotus-instance]')?'lotus':'imagery',subject:entry.key.closest('.imagery-object')?.dataset.imageryObject,
                stage:entry.variant,source:entry.image.currentSrc||entry.image.src,paints:entry.paints,visible:visible(entry),failed:!!entry.failed,width:entry.canvas.width,height:entry.canvas.height}))};
    },
    renderAt(milliseconds) {
      cancelAnimationFrame(frame); frame=0; last=0;
      if (setup()) entries.forEach(entry=>{if(!entry.failed&&visible(entry))draw(entry,milliseconds);});
    }
  };
  new MutationObserver(wake).observe(root,{attributes:true,attributeFilter:['data-background-current','data-background-layout','data-art-motion']});
  document.addEventListener('visibilitychange',wake);
  window.addEventListener('scroll',wake,{passive:true});
  window.addEventListener('resize',wake,{passive:true});
  reduced.addEventListener('change',wake);
  wide.addEventListener('change',wake);
})();
