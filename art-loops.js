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
  const fieldSize = 192;
  let frame = 0, elapsed = 0, last = 0, lastPaint = 0, serial = 0;
  const stats = { paints: 0, ticks: 0, totalMs: 0, maxMs: 0 };
  const crossings = 'IntersectionObserver' in window
    ? new IntersectionObserver(changes => { if (changes.some(change => change.isIntersecting)) wake(); }) : null;
  let visibilityWake = 0;

  const vertex = `attribute vec2 position; varying vec2 uv;
    void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
  const fragment = `precision highp float;
    uniform sampler2D picture, noiseField, heatField;
    uniform vec4 imageRect;
    uniform float phase, mode, variant, flameClock;
    varying vec2 uv;
    float fireNoise(vec3 p){
      vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      vec2 q=i.xy+f.xy+.5+i.z*vec2(37.,17.);
      return mix(texture2D(noiseField,q/128.).r,texture2D(noiseField,(q+vec2(37.,17.))/128.).r,f.z);
    }
    float fireFbm(vec3 p){return fireNoise(p)*.57+fireNoise(p*2.03+7.1)*.29+fireNoise(p*4.17-3.8)*.14;}
    vec4 artwork(vec2 p){
      if(p.x<0.||p.x>1.||p.y<0.||p.y>1.)return vec4(0.);
      return texture2D(picture,imageRect.xy+clamp(p,.001,.999)*imageRect.zw);
    }
    bool hasFramework(){return (variant>4.5&&variant<5.5)||(variant>8.5&&variant<13.);}
    float goldMaterial(vec4 color){
      return smoothstep(.04,.17,color.r-color.b)*smoothstep(.01,.1,color.g-color.b);
    }
    float fuel(vec2 at,vec4 color){
      // Warm fire is still fuel. Only artworks with a metal framework need
      // a material exclusion; applying it to gold/green flames freezes them.
      float height=smoothstep(.17,.60,at.y);
      float hot=smoothstep(.36,.82,max(max(color.r,color.g),color.b));
      float metal=hasFramework()?goldMaterial(color):0.;
      if(variant>4.5&&variant<5.5){
        float pale=1.-smoothstep(.03,.14,max(max(color.r,color.g),color.b)-min(min(color.r,color.g),color.b));
        metal=max(metal,pale*.72);
      }
      return height*hot*(1.-metal)*color.a;
    }
    vec4 livingFlame(vec2 at){
      vec4 original=artwork(at);
      bool fineBranches=variant>11.5&&variant<12.5;
      float rigidGold=0.;
      if(hasFramework()){
        // Classify the unshifted scaffold before a neighboring flame can move
        // into it. This protection never applies to the golden-fire artwork.
        rigidGold=goldMaterial(original)*smoothstep(.35,.7,original.a);
        if(rigidGold>.7)return vec4(original.rgb*original.a,original.a);
      }
      float t=flameClock;
      if(fineBranches)t*=.72;
      float h=smoothstep(.17,.90,at.y);
      // Upward advection and curling eddies move fire material, not the metal body.
      vec3 domain=vec3(at.x*23.,at.y*19.-t*1.22,t*.19+variant*3.1);
      float n=fireFbm(domain),n2=fireFbm(domain+vec3(11.1,3.7,5.2));
      vec2 curl=vec2(n2-.5,n-.5);
      float strength=1.;
      if(variant>1.5&&variant<3.5)strength=1.55;
      if(variant>5.5&&variant<6.5)strength=1.9;
      vec2 shift=vec2(curl.x*.040*h,curl.y*.025*h)*strength;
      // A slower coherent bend carries a whole tongue, while smaller eddies
      // travel inside it. Low and lateral tongues also receive some motion.
      shift.x+=sin(at.y*11.-t*1.4+variant)*.008*h*strength;
      if(fineBranches)shift*=.58;
      vec4 moving=artwork(at-shift);
      float mask=max(fuel(at,original),fuel(at-shift,moving));
      mask*=1.-rigidGold;
      vec4 body=mix(original,moving,clamp(mask*1.25,0.,1.));
      // Short, colored wisps detach from actual hot pixels and rise through
      // the transparent margin. Sampling the source retains each phase's palette.
      vec3 emission=vec3(0.);float opacity=0.;
      float strand=fireFbm(vec3(at.x*81.+n2*2.,at.y*38.-t*3.4,variant*4.2));
      for(int i=1;i<=6;i++){
        float age=float(i)/6.;
        vec2 source=at-vec2((curl.x*.055+sin(at.y*31.-t*1.8)*.006)*age,.065*age);
        vec4 sampleColor=artwork(source);
        float f=fuel(source,sampleColor);
        float d=f*smoothstep(.48+age*.08,.76,strand+.06*sin(age*19.-t))*(.18*(1.-age*.8));
        // Existing opaque material occludes trails; no halo over polished metal.
        d*=1.-original.a*.86;
        d*=1.-rigidGold;
        emission+=sampleColor.rgb*d;opacity+=d;
      }
      float stream=pow(max(0.,1.-abs(n-.53)*6.),8.);
      vec3 light=mix(body.rgb,vec3(1.),.22);
      body.rgb=clamp(body.rgb+light*(stream*.22-.032)*mask,0.,1.);
      // Transported fuel is persistent across frames. Old tips extinguish;
      // fresh, source-colored flame rises beyond the original silhouette.
      vec4 heat=texture2D(heatField,at);
      float crest=smoothstep(.38,.82,at.y)*mask;
      float alive=smoothstep(.025,.35,heat.a);
      body.a*=mix(1.,.24+.76*alive,crest*.88);
      vec3 rgb=body.rgb*body.a+emission*(1.-body.a*.5);
      float alpha=clamp(body.a+opacity*(1.-body.a),0.,1.);
      float plume=smoothstep(.028,.29,heat.a)*.62*(1.-rigidGold);
      plume*=smoothstep(0.,.04,at.x)*(1.-smoothstep(.96,1.,at.x))*(1.-smoothstep(.92,1.,at.y));
      plume*=mix(.26,1.,1.-body.a);
      vec3 fireColor=heat.rgb/max(heat.a,.004);
      rgb=rgb*(1.-plume)+fireColor*plume;
      alpha=alpha+plume*(1.-alpha);
      return vec4(min(rgb,vec3(alpha)),alpha);
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

  // Semi-Lagrangian transport of emitted RGB density, with buoyant upward
  // velocity, time-varying curl and cooling. This is a 2D approximation, not
  // a pressure-projected 3D combustion simulation. Neither image UVs nor a
  // looping sine are the lifetime state: that state lives in ping-pong FBOs.
  const transport = `precision highp float;
    uniform sampler2D previous, picture, noiseField;
    uniform vec4 imageRect;
    uniform float dt, clock, variant, inject;
    varying vec2 uv;
    float n(vec2 p){return texture2D(noiseField,p/128.).r;}
    float psi(vec2 p){return n(p*13.+vec2(clock*2.9,clock*1.7)+variant*9.7)*.7+n(p*31.-vec2(clock*3.1,clock*.8))*.3;}
    vec2 velocity(vec2 p){
      float e=.015;
      vec2 curl=vec2(psi(p+vec2(0.,e))-psi(p-vec2(0.,e)),psi(p-vec2(e,0.))-psi(p+vec2(e,0.)))/(2.*e);
      float buoyancy=texture2D(previous,clamp(p,0.,1.)).a;
      return vec2(0.,.13+buoyancy*.075)+curl*.035;
    }
    void main(){
      vec2 v=velocity(uv);
      vec2 source=uv-dt*velocity(uv-v*dt*.5);
      vec4 old=texture2D(previous,clamp(source,0.,1.));
      if(source.y<0.||source.y>1.||source.x<0.||source.x>1.)old=vec4(0.);
      // Temporal dithering prevents low-density 8-bit texels becoming immortal.
      float cooled=max(0.,old.a*exp(-dt*.75)-dt*.05);
      float density=floor(cooled*255.+n(uv*127.+vec2(clock*19.,-clock*23.)))/255.;
      vec3 carried=old.rgb*(density/max(old.a,.004));
      vec4 art=texture2D(picture,imageRect.xy+uv*imageRect.zw);
      float peak=max(max(art.r,art.g),art.b);
      float metal=0.;
      if((variant>4.5&&variant<5.5)||(variant>8.5&&variant<13.)){
        metal=smoothstep(.04,.17,art.r-art.b)*smoothstep(.01,.1,art.g-art.b);
        if(variant<5.5){float pale=1.-smoothstep(.03,.14,peak-min(min(art.r,art.g),art.b));metal=max(metal,pale*.72);}
      }
      float lower=smoothstep(.06,.19,uv.y)*(1.-smoothstep(.48,.66,uv.y));
      float gust=smoothstep(.16,.74,n(uv*59.+vec2(clock*8.3,-clock*5.4)+variant*3.));
      float amount=inject*dt*3.7*lower*art.a*smoothstep(.22,.78,peak)*(1.-metal)*(.28+gust*.72);
      float a=clamp(amount,0.,1.);
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
      transportLocations=Object.fromEntries(['previous','picture','noiseField','imageRect','dt','clock','variant','inject'].map(name=>[name,gl.getUniformLocation(transportProgram,name)]));
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
      const pairs=Array.from({length:2},()=>{
        const t=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,t);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,fieldSize,fieldSize,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Flame field unavailable');
        gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
        return {texture:t,framebuffer:f};
      });
      entry.flow={pairs,index:0,time:time-800,steps:0};
    }
    const f=entry.flow;
    if(time<f.time){releaseFlow(entry);return advanceFlow(entry,time,nativeProof);}
    const span=Math.min(nativeProof?10000:140,time-f.time);
    const count=Math.max(0,Math.ceil(span/(1000/30)));
    const dt=count?span/count/1000:0;
    bindQuad(transportProgram);
    gl.viewport(0,0,fieldSize,fieldSize);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture(entry.image));
    gl.uniform4fv(transportLocations.imageRect,entry.rect);
    gl.uniform1f(transportLocations.variant,entry.variant);
    gl.uniform1f(transportLocations.inject,fuelEnabled?1:0);
    for(let i=0;i<count;i++){
      const next=1-f.index;
      gl.bindFramebuffer(gl.FRAMEBUFFER,f.pairs[next].framebuffer);
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,f.pairs[f.index].texture);
      gl.uniform1f(transportLocations.dt,dt);
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
      return {renderer:root.dataset.artRenderer||'not-needed',enabled:enabled(),periodMs:period,flameClock:'continuous',flameModel:'2D transported fuel with cooling',fieldSize,fuelEnabled,flameFrameLimit:60,running:!!frame,ticks:stats.ticks,
              textureCount:textures.size,paints:stats.paints,meanTickMs:stats.ticks?stats.totalMs/stats.ticks:0,maxTickMs:stats.maxMs,
              entries:[...entries.values()].map(entry=>({type:entry.key.matches('[data-lotus-instance]')?'lotus':'imagery',subject:entry.key.closest('.imagery-object')?.dataset.imageryObject,
                stage:entry.variant,source:entry.image.currentSrc||entry.image.src,sourceWidth:entry.image.naturalWidth,sourceHeight:entry.image.naturalHeight,flowSteps:entry.flow?.steps||0,paints:entry.paints,visible:visible(entry),failed:!!entry.failed,width:entry.canvas.width,height:entry.canvas.height}))};
    },
    setFuel(value){fuelEnabled=!!value;},
    flowProbe(){
      if(!gl)return [];
      return [...entries.values()].filter(e=>e.flow).map(e=>{
        gl.bindFramebuffer(gl.FRAMEBUFFER,e.flow.pairs[e.flow.index].framebuffer);
        const pixels=new Uint8Array(fieldSize*fieldSize*4);gl.readPixels(0,0,fieldSize,fieldSize,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let mass=0,weightedY=0,upper=0,lower=0;
        for(let i=3;i<pixels.length;i+=4){const y=Math.floor(i/4/fieldSize)/fieldSize,a=pixels[i];mass+=a;weightedY+=a*y;if(y>.68)upper+=a;if(y<.4)lower+=a;}
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
