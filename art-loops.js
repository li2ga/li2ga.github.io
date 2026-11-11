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
  let gl, program, locations, transportProgram, transportLocations, quad, attempted = false;
  let fuelEnabled = true;
  const fieldSize = 768;
  let frame = 0, elapsed = 0, last = 0, lastPaint = 0, serial = 0;
  const stats = { paints: 0, ticks: 0, totalMs: 0, maxMs: 0 };
  const crossings = 'IntersectionObserver' in window
    ? new IntersectionObserver(changes => { if (changes.some(change => change.isIntersecting)) wake(); }) : null;
  let visibilityWake = 0;

  const vertex = `attribute vec2 position; varying vec2 uv;
    void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
  const flameLayers = `
    bool hasFramework(){return (variant>4.5&&variant<5.5)||(variant>8.5&&variant<13.);}
    float goldMaterial(vec4 c){return smoothstep(.04,.17,c.r-c.b)*smoothstep(.01,.1,c.g-c.b);}
    vec4 artwork(vec2 p){
      if(p.x<0.||p.x>1.||p.y<0.||p.y>1.)return vec4(0.);
      return texture2D(picture,imageRect.xy+clamp(p,.0005,.9995)*imageRect.zw);
    }
    float burnerRoot(float x){
      if(variant>100.){
        // Lotus forms retain their lower petals. Other flames are gas all the
        // way down and have no persistent upper silhouette.
        if(abs(variant-103.)<.1||abs(variant-108.)<.1||abs(variant-119.)<.1)return .40;
        return .12;
      }
      if(variant>11.5&&variant<12.5)return .29+.24*pow(max(0.,1.-abs(x-.5)*2.),1.15);
      if(hasFramework())return .36+.15*exp(-pow((x-.5)*2.8,2.));
      if(variant<.5)return .70;
      if(variant>5.5&&variant<6.5)return .73-.11*exp(-pow((x-.5)*6.,2.));
      return .46+.08*exp(-pow((x-.5)*2.8,2.));
    }
    float flameRegion(vec2 p){
      float root=burnerRoot(p.x);
      float region=smoothstep(root-.025,root+.045,p.y);
      if(variant<.5){
        // This blue artwork has glass-like petals around a central flame.
        float width=.055+max(0.,p.y-.70)*.32;
        float central=1.-smoothstep(width,width+.025,abs(p.x-.515));
        region*=mix(central,1.,smoothstep(.78,.86,p.y));
      }
      return region;
    }
    float rigidMaterial(vec4 c){
      if(!hasFramework())return 0.;
      return goldMaterial(c)*smoothstep(.35,.7,c.a);
    }
    float movingMaterial(vec2 p,vec4 c){
      return flameRegion(p)*(1.-rigidMaterial(c));
    }
  `;
  const fragment = `precision highp float;
    uniform sampler2D picture, noiseField, heatField;
    uniform vec4 imageRect;
    uniform float phase, mode, variant, flameClock;
    varying vec2 uv;
    ${flameLayers}
    float fireNoise(vec3 p){
      vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      vec2 q=i.xy+f.xy+.5+i.z*vec2(37.,17.);
      return mix(texture2D(noiseField,q/128.).r,texture2D(noiseField,(q+vec2(37.,17.))/128.).r,f.z);
    }
    float fireFbm(vec3 p){return fireNoise(p)*.57+fireNoise(p*2.03+7.1)*.29+fireNoise(p*4.17-3.8)*.14;}
    vec4 livingFlame(vec2 at){
      vec4 original=artwork(at);
      float rigid=rigidMaterial(original);
      if(rigid>.7)return vec4(original.rgb*original.a,original.a);
      // Remove the original flame pixels from the fixed image. This is a
      // replacement layer, not an extra plume over permanently visible tips.
      float burning=movingMaterial(at,original);
      vec4 stable=vec4(original.rgb*original.a,original.a)*(1.-burning);
      vec4 fire=texture2D(heatField,at);
      float density=fire.a;
      float alpha=smoothstep(.045,.63,density);
      alpha*=smoothstep(0.,.025,at.x)*(1.-smoothstep(.975,1.,at.x))*(1.-smoothstep(.87,.995,at.y));
      vec3 color=fire.rgb/max(density,.003);
      color*=mix(.94,1.1,smoothstep(.05,.65,density));
      fire=vec4(clamp(color,0.,1.)*alpha,alpha);
      vec4 result=stable+fire*(1.-stable.a);
      return vec4(min(result.rgb,vec3(result.a)),result.a);
    }
    void main(){
      if(mode>.5&&mode<1.5){gl_FragColor=livingFlame(uv);return;}
      vec2 p=uv;
      float t=phase;
      float light=0.;
      if(mode<.5){
        // Branches and feathers flex locally, rather than moving a rigid card.
        float edge=smoothstep(.1,.9,uv.y);
        p.x+=.006*edge*sin(uv.y*19.+t)*sin(uv.x*8.-t);
        p.y+=.0025*sin(uv.x*21.+t*2.)*edge;
        light=.025*sin(uv.y*28.-t*2.);
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

  // The state is the actual source-colored flame layer. The original upper
  // flame is excised from the stable layer before this material is composited.
  const transport = `precision highp float;
    uniform sampler2D previous, picture, noiseField;
    uniform vec4 imageRect;
    uniform vec2 texel;
    uniform float dt, clock, variant, inject, initialize;
    varying vec2 uv;
    ${flameLayers}
    float n(vec2 p){return texture2D(noiseField,p/128.).r;}
    float psi(vec2 p){
      return n(p*19.+vec2(clock*3.7,clock*2.1)+variant*9.7)*.65
        +n(p*47.-vec2(clock*4.1,clock*1.3))*.25
        +n(p*93.+vec2(clock*5.,-clock*2.))*.1;
    }
    vec2 velocity(vec2 p){
      float e=.009;
      vec2 curl=vec2(psi(p+vec2(0.,e))-psi(p-vec2(0.,e)),psi(p-vec2(e,0.))-psi(p+vec2(e,0.)))/(2.*e);
      float heat=texture2D(previous,clamp(p,0.,1.)).a;
      return vec2(-.06*(p.x-.5),.20+heat*.11)+curl*.025;
    }
    void main(){
      vec4 art=artwork(uv);
      float material=movingMaterial(uv,art);
      if(initialize>.5){gl_FragColor=vec4(art.rgb*art.a,art.a)*material;return;}
      vec2 v=velocity(uv);
      vec2 source=uv-dt*velocity(uv-v*dt*.5);
      vec4 old=texture2D(previous,clamp(source,0.,1.));
      // A bounded edge-restoration term keeps native painted flame filaments
      // from dissolving into a low-resolution, single-color smoke overlay.
      vec4 local=(texture2D(previous,clamp(source+vec2(texel.x,0.),0.,1.))
                 +texture2D(previous,clamp(source-vec2(texel.x,0.),0.,1.))
                 +texture2D(previous,clamp(source+vec2(0.,texel.y),0.,1.))
                 +texture2D(previous,clamp(source-vec2(0.,texel.y),0.,1.)))*.25;
      old=clamp(old+(old-local)*.12,0.,1.);
      old.rgb=min(old.rgb,vec3(old.a));
      if(source.y<0.||source.y>1.||source.x<0.||source.x>1.)old=vec4(0.);
      float loss=variant>100.?.85:1.75;
      float consumption=variant>100.?.08:.16;
      float cooled=max(0.,old.a*exp(-dt*loss)-dt*consumption);
      float density=floor(cooled*255.+n(uv*127.+vec2(clock*19.,-clock*23.)))/255.;
      vec3 carried=old.rgb*(density/max(old.a,.003));
      float root=burnerRoot(uv.x);
      float zone=material*(1.-smoothstep(root+.035,root+.105,uv.y));
      float fine=n(uv*91.+vec2(clock*8.3,-clock*14.4)+variant*3.);
      float pulse=.16+.84*pow(smoothstep(.24,.77,fine),2.5);
      float a=clamp(inject*dt*30.*zone*art.a*pulse,0.,1.);
      gl_FragColor=vec4(carried*(1.-a)+art.rgb*a,density*(1.-a)+a);
    }`;

  function setup() {
    if (attempted) return !!gl;
    attempted = true;
    try {
      gl = surface.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
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
      quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      locations = Object.fromEntries(['picture','phase','mode','variant','flameClock','noiseField','heatField','imageRect'].map(name => [name, gl.getUniformLocation(program,name)]));
      gl.uniform1i(locations.picture, 0);
      gl.uniform1i(locations.heatField, 2);
      transportProgram=gl.createProgram();
      gl.attachShader(transportProgram,compile(gl.VERTEX_SHADER,vertex));
      gl.attachShader(transportProgram,compile(gl.FRAGMENT_SHADER,transport));
      gl.linkProgram(transportProgram);
      if(!gl.getProgramParameter(transportProgram,gl.LINK_STATUS))throw new Error('Flame transport unavailable');
      transportLocations=Object.fromEntries(['previous','picture','noiseField','imageRect','dt','clock','variant','inject','initialize','texel'].map(name=>[name,gl.getUniformLocation(transportProgram,name)]));
      gl.useProgram(transportProgram);
      gl.uniform1i(transportLocations.picture,0);gl.uniform1i(transportLocations.noiseField,1);gl.uniform1i(transportLocations.previous,2);
      gl.useProgram(program);
      // A shared deterministic scalar field replaces hundreds of hash operations
      // per native-resolution pixel; original art textures are never resized.
      const noisePixels=new Uint8Array(128*128*4);
      let noiseSeed=0x5a17c9;
      for(let i=0;i<noisePixels.length;i+=4){noiseSeed^=noiseSeed<<13;noiseSeed^=noiseSeed>>>17;noiseSeed^=noiseSeed<<5;noisePixels[i]=noisePixels[i+1]=noisePixels[i+2]=noiseSeed&255;noisePixels[i+3]=255;}
      const noiseTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,noiseTexture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,128,128,0,gl.RGBA,gl.UNSIGNED_BYTE,noisePixels);gl.uniform1i(locations.noiseField,1);gl.activeTexture(gl.TEXTURE0);
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
    return root.dataset.artMotion !== 'still' && !document.hidden && !reduced.matches && (wide.matches||root.dataset.artScope==='gallery');
  }

  function bindQuad(next) {
    gl.useProgram(next);gl.bindBuffer(gl.ARRAY_BUFFER,quad);
    const p=gl.getAttribLocation(next,'position');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
  }

  function releaseFlow(entry) {
    if(entry.flow&&gl)entry.flow.pairs.forEach(p=>{gl.deleteFramebuffer(p.framebuffer);gl.deleteTexture(p.texture);});
    entry.flow=null;
  }

  function advanceFlow(entry,time,nativeProof) {
    if(!entry.flow){
      const width=Math.min(fieldSize,Math.max(192,entry.canvas.width));
      const height=Math.min(fieldSize,Math.max(192,entry.canvas.height));
      const pairs=Array.from({length:2},()=>{
        const t=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,t);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Flame field unavailable');
        gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
        return {texture:t,framebuffer:f};
      });
      entry.flow={pairs,index:0,time,steps:0,width,height};
    }
    const f=entry.flow;
    if(time<f.time){releaseFlow(entry);return advanceFlow(entry,time,nativeProof);}
    const span=Math.min(nativeProof?10000:140,time-f.time);
    const count=Math.max(f.steps===0?1:0,Math.ceil(span/(1000/30)));
    const dt=count?span/count/1000:0;
    bindQuad(transportProgram);
    gl.viewport(0,0,f.width,f.height);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture(entry.image));
    gl.uniform4fv(transportLocations.imageRect,entry.rect);
    gl.uniform1f(transportLocations.variant,entry.variant);
    gl.uniform1f(transportLocations.inject,fuelEnabled?1:0);
    gl.uniform2f(transportLocations.texel,1/f.width,1/f.height);
    for(let i=0;i<count;i++){
      const next=1-f.index;
      gl.bindFramebuffer(gl.FRAMEBUFFER,f.pairs[next].framebuffer);
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,f.pairs[f.index].texture);
      gl.uniform1f(transportLocations.dt,dt);
      gl.uniform1f(transportLocations.initialize,f.steps===0?1:0);
      gl.uniform1f(transportLocations.clock,(f.time+(i+1)*dt*1000)/1000+entry.seed*13.7);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);f.index=next;f.steps++;
    }
    f.time=time;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,f.pairs[f.index].texture);
  }

  function visible(entry) {
    if (!entry.key.isConnected || !entry.key.closest('[data-background-scene][data-active]')) return false;
    const box = entry.host.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.right > 0 && box.left < innerWidth && box.bottom > 0 && box.top < innerHeight;
  }

  function draw(entry, time, nativeProof=false) {
    try {
      const image = entry.image;
      const sourceWidth=image.naturalWidth*entry.rect[2],sourceHeight=image.naturalHeight*entry.rect[3];
      const displayScale=entry.mode===1&&!nativeProof
        ? Math.min(1,(devicePixelRatio||1)*Math.min(entry.host.clientWidth/sourceWidth,entry.host.clientHeight/sourceHeight)) : 1;
      const width=Math.max(1,Math.ceil(sourceWidth*displayScale));
      const height=Math.max(1,Math.ceil(sourceHeight*displayScale));
      if(entry.canvas.width!==width||entry.canvas.height!==height){entry.canvas.width=width;entry.canvas.height=height;}
      if (surface.width !== width || surface.height !== height) {
        surface.width = width;
        surface.height = height;
      }
      if(entry.mode===1)advanceFlow(entry,time,nativeProof);
      gl.viewport(0, 0, surface.width, surface.height);
      bindQuad(program);
      gl.uniform4fv(locations.imageRect,entry.rect);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture(image));
      gl.uniform1f(locations.phase, ((time / period + entry.seed) % 1) * Math.PI * 2);
      gl.uniform1f(locations.flameClock,time/1000+entry.seed*13.7);
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
    if (now-lastPaint >= 1000/(root.dataset.backgroundCurrent==='lotus'?60:24)-.4) {
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

  function install(key,host,image,mode,variant=0,rect=[0,0,1,1]) {
    if (entries.get(key)?.image === image && entries.get(key)?.host === host&&entries.get(key)?.variant===variant) return;
    let entry = entries.get(key);
    if (entry) {
      releaseFlow(entry);
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
    entry.rect=rect;
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
    flame(host,image,rank) {
      const cell=(rank-1)%6,col=cell%3,row=Math.floor(cell/3);
      install(host,host,image,1,100+rank,[col/3,(1-row)/2,1/3,1/2]);
    },
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
      return {renderer:root.dataset.artRenderer||'not-needed',enabled:enabled(),periodMs:period,flameClock:'continuous',flameModel:'source flame layer replaced by transported burning material',fieldSize,fuelEnabled,flameFrameLimit:60,running:!!frame,ticks:stats.ticks,
              textureCount:textures.size,paints:stats.paints,meanTickMs:stats.ticks?stats.totalMs/stats.ticks:0,maxTickMs:stats.maxMs,
              entries:[...entries.values()].map(entry=>({type:entry.key.matches('[data-lotus-instance]')?'lotus':'imagery',subject:entry.key.closest('.imagery-object')?.dataset.imageryObject,
                stage:entry.variant,source:entry.image.currentSrc||entry.image.src,sourceWidth:entry.image.naturalWidth,sourceHeight:entry.image.naturalHeight,flowSteps:entry.flow?.steps||0,paints:entry.paints,visible:visible(entry),failed:!!entry.failed,width:entry.canvas.width,height:entry.canvas.height}))};
    },
    setFuel(value){fuelEnabled=!!value;},
    flowProbe(){
      if(!gl)return [];
      return [...entries.values()].filter(e=>e.flow).map(e=>{
        gl.bindFramebuffer(gl.FRAMEBUFFER,e.flow.pairs[e.flow.index].framebuffer);
        const width=e.flow.width,height=e.flow.height;
        const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let mass=0,weightedY=0,upper=0,lower=0;
        for(let i=3;i<pixels.length;i+=4){const y=Math.floor(i/4/width)/height,a=pixels[i];mass+=a;weightedY+=a*y;if(y>.68)upper+=a;if(y<.4)lower+=a;}
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);
        return {stage:e.variant,steps:e.flow.steps,mass,centerY:weightedY/Math.max(mass,1),upper,lower};
      });
    },
    renderAt(milliseconds) {
      cancelAnimationFrame(frame); frame=0; last=0;
      if (setup()) entries.forEach(entry=>{if(!entry.failed&&visible(entry))draw(entry,milliseconds,true);});
    }
  };
  new MutationObserver(wake).observe(root,{attributes:true,attributeFilter:['data-background-current','data-background-layout','data-art-motion']});
  document.addEventListener('visibilitychange',wake);
  window.addEventListener('scroll',wake,{passive:true});
  window.addEventListener('resize',wake,{passive:true});
  reduced.addEventListener('change',wake);
  wide.addEventListener('change',wake);
})();
