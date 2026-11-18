"use strict";
// Source-colored advection for three independently rendered effects, without characters.
(() => {
  const root=document.querySelector('.page-atmosphere');
  const config=document.querySelector('#trailer-art-sources');
  if(!root||!config)return;
  const sources=JSON.parse(config.textContent),gallery=root.dataset.artScope==='gallery';
  const reduce=matchMedia('(prefers-reduced-motion:reduce)'),wide=matchMedia('(min-width:1041px)');
  const cache=new Map(),cycle=['vortex','suns','filaments'];
  const entries=[...root.querySelectorAll('[data-trailer-art]')].map(host=>({host,img:host.querySelector('img'),canvas:host.querySelector('canvas'),key:host.dataset.trailerArt,inside:false,paints:0,token:0}));
  const selected=()=>root.dataset.backgroundCurrent==='trailer'&&(gallery||wide.matches);
  const moving=()=>selected()&&!document.hidden&&!reduce.matches&&root.dataset.artMotion!=='still';
  let raf=0,clock=0,last=0,painted=0,age=0,cycleIndex=0;
  const vertex='attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}';
  const fragment=`precision highp float;
  varying vec2 uv;uniform sampler2D picture;uniform sampler2D protection;uniform float time;uniform float kind;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
  vec4 art(vec2 p){if(min(p.x,p.y)<0.||max(p.x,p.y)>1.)return vec4(0.);return texture2D(picture,p);}
  vec4 advect(vec2 p,vec2 flow,float phase){
    float f=noise(p*19.-vec2(phase*2.4,time*.65));
    vec2 curl=vec2(f-.5,noise(p*26.+time*.41)-.5);
    return art(p-flow*phase-curl*.009*sin(phase*3.14159265));
  }
  void main(){
    vec4 base=art(uv);float keep=texture2D(protection,uv).r;
    vec2 d=uv-vec2(.5);float radius=length(d);vec2 tangent=vec2(-d.y,d.x);
    float n=noise(uv*14.-vec2(time*.29,time*1.3));
    vec2 flow;
    if(kind<.5){flow=tangent*.21-d*.035;}
    else if(kind<1.5){flow=-tangent*.17-d*.04;}
    else{flow=vec2(sign(d.x)*(.026+abs(d.x)*.06),.015+abs(d.x)*.02)+vec2(n-.5,0.)*.014;}
    float phase=fract(time*(kind>1.5?.67:.52));
    float other=fract(phase+.5);float blend=abs(phase-.5)*2.;
    vec4 a=advect(uv,flow,phase),b=advect(uv,flow,other);
    // Crossfade two finite flow lifetimes: no permanently stretching flame tip.
    vec4 fire=mix(a,b,blend);
    float energy=1.;
    float influence=(1.-keep)*energy;
    vec4 result=mix(base,fire,influence*.86);
    result.rgb*=1.+influence*.16*noise(vec2(uv.x*30.+time*.8,uv.y*21.-time*2.));
    result.a=max(result.a,base.a*mix(.65,1.,keep));
    // Painted solid regions, including sun discs, use byte-stable original RGBA.
    result=mix(result,base,keep);
    gl_FragColor=result;
  }`;
  const masks={
    vortex:{polygon:[],ellipses:[]},
    filaments:{polygon:[],ellipses:[[.5,.685,.025,.032]]},
    suns:{polygon:[],ellipses:[[.148,.335,.063,.055],[.377,.316,.035,.035],[.534,.351,.029,.028],[.837,.312,.061,.063],[.303,.479,.034,.038],[.678,.511,.035,.033],[.363,.661,.036,.032],[.533,.683,.034,.032],[.171,.754,.056,.05],[.791,.805,.052,.052]]}
  };
  function protection(e){
    const m=document.createElement('canvas');m.width=m.height=512;
    const c=m.getContext('2d'),shape=masks[e.key];c.fillStyle='#000';c.fillRect(0,0,512,512);c.fillStyle='#fff';
    if(shape.polygon.length){c.beginPath();shape.polygon.forEach(([x,y],i)=>c[i?'lineTo':'moveTo'](x*512,y*512));c.closePath();c.fill();}
    shape.ellipses.forEach(([x,y,rx,ry])=>{c.beginPath();c.ellipse(x*512,y*512,rx*512,ry*512,0,0,Math.PI*2);c.fill();});
    return m;
  }
  function upload(e){
    const gl=e.gl;gl.useProgram(e.program);
    [e.img,protection(e)].forEach((im,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,e.textures[i]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);});
    gl.uniform1f(gl.getUniformLocation(e.program,'kind'),['vortex','suns','filaments'].indexOf(e.key));
  }
  function prepare(e){
    if(e.failed)return false;
    if(e.gl)return true;
    try{
      const gl=e.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,preserveDrawingBuffer:true});
      if(!gl)throw Error('WebGL unavailable');
      const compile=(kind,src)=>{const s=gl.createShader(kind);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
      const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      const textures=[0,1].map(i=>{const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return tex;});
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.uniform1i(gl.getUniformLocation(program,'picture'),0);gl.uniform1i(gl.getUniformLocation(program,'protection'),1);
      Object.assign(e,{gl,program,textures,time:gl.getUniformLocation(program,'time')});upload(e);return true;
    }catch(err){e.failed=String(err);return false;}
  }
  function paint(e,t){
    if(!prepare(e))return;
    const box=e.host.getBoundingClientRect(),ratio=e.img.naturalWidth/e.img.naturalHeight;
    const width=Math.min(box.width,box.height*ratio);
    const w=Math.max(1,Math.min(e.img.naturalWidth,Math.ceil(width*Math.min(devicePixelRatio||1,2))));
    const h=Math.ceil(w/ratio);
    if(e.canvas.width!==w||e.canvas.height!==h){e.canvas.width=w;e.canvas.height=h;}
    e.gl.viewport(0,0,w,h);e.gl.useProgram(e.program);e.gl.uniform1f(e.time,t);e.gl.drawArrays(e.gl.TRIANGLES,0,6);e.host.setAttribute('data-flow-active','');e.paints++;
  }
  function image(key){
    if(!cache.has(key)){
      const im=new Image();im.decoding='async';im.fetchPriority='low';im.src=sources[key];
      const promise=im.decode().then(()=>im).catch(err=>{cache.delete(key);throw err;});cache.set(key,promise);
    }
    return cache.get(key);
  }
  async function choose(e,key){
    if(!sources[key])return;
    const token=++e.token;e.loading=true;e.host.removeAttribute('data-error');
    try{
      const im=await image(key);if(token!==e.token)return;
      e.img.src=im.src;await e.img.decode();if(token!==e.token)return;
      e.key=key;e.host.dataset.trailerArt=key;e.host.removeAttribute('data-flow-active');e.host.setAttribute('data-ready','');
      if(e.gl)upload(e);
      const note=document.querySelector('#load-note');if(note)note.textContent=reduce.matches?'系统减少动态已开启 · 显示清晰原画':'原画纹理已加载 · 实时光焰';
      if(gallery||e.host.closest('[data-trailer-side=right]'))document.querySelectorAll('[data-trailer-select]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.trailerSelect===key)));
    }catch(err){if(token===e.token){e.host.setAttribute('data-error','');const note=document.querySelector('#load-note');if(note)note.textContent='图片加载失败，可点击重试';document.querySelectorAll('[data-trailer-retry]').forEach(b=>b.hidden=false);}}
    finally{if(token===e.token){e.loading=false;wake();}}
  }
  const visible=e=>e.inside&&e.host.hasAttribute('data-ready')&&!e.loading;
  function tick(now){
    raf=0;if(!moving()){last=0;return;}
    const dt=last?Math.min(now-last,100)/1000:0;last=now;clock+=dt;age+=dt;
    if(!gallery&&age>25){age=0;cycleIndex=(cycleIndex+1)%cycle.length;entries.forEach((e,i)=>choose(e,cycle[(cycleIndex+i)%cycle.length]));}
    if(now-painted>1000/30){entries.filter(visible).forEach(e=>paint(e,clock));painted=now;}
    raf=requestAnimationFrame(tick);
  }
  function wake(){
    cancelAnimationFrame(raf);raf=0;last=0;
    if(selected())entries.forEach(e=>{if(e.inside&&!e.host.hasAttribute('data-ready')&&!e.loading&&!e.host.hasAttribute('data-error'))choose(e,e.key);});
    if(moving()&&entries.some(visible))raf=requestAnimationFrame(tick);
    else entries.forEach(e=>e.host.removeAttribute('data-flow-active'));
  }
  const io=new IntersectionObserver(changes=>{changes.forEach(c=>{const e=entries.find(e=>e.host===c.target);if(e)e.inside=c.isIntersecting;});wake();});
  entries.forEach(e=>{io.observe(e.host);e.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();e.failed='context lost';e.host.removeAttribute('data-flow-active');});e.canvas.addEventListener('webglcontextrestored',()=>{e.gl=null;e.failed=false;wake();});});
  document.querySelectorAll('[data-trailer-select]').forEach(b=>b.addEventListener('click',()=>{const e=gallery?entries[0]:entries.find(e=>e.host.closest('[data-trailer-side=right]'));if(e){age=0;choose(e,b.dataset.trailerSelect);}}));
  document.querySelectorAll('[data-trailer-retry]').forEach(b=>b.addEventListener('click',()=>{entries.filter(e=>e.host.hasAttribute('data-error')).forEach(e=>{e.host.removeAttribute('data-error');choose(e,e.key);});b.hidden=true;}));
  new MutationObserver(wake).observe(root,{attributes:true,attributeFilter:['data-background-current','data-art-motion']});
  document.addEventListener('visibilitychange',wake);window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);raf=0;});window.addEventListener('pageshow',wake);reduce.addEventListener('change',wake);wide.addEventListener('change',wake);window.addEventListener('resize',wake);
  window.JiaTrailerArt={wake,inspect:()=>({selected:selected(),moving:moving(),running:!!raf,clock,loaded:[...cache.keys()],entries:entries.map(e=>({key:e.key,ready:e.host.hasAttribute('data-ready'),inside:e.inside,paints:e.paints,failed:e.failed||false,width:e.canvas.width,height:e.canvas.height}))}),renderAt:t=>{cancelAnimationFrame(raf);raf=0;entries.filter(visible).forEach(e=>paint(e,t));}};
  wake();
})();
