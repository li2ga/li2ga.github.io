"use strict";
// Independent character paintings with local light transport, never video footage.
(() => {
  const root=document.querySelector('.page-atmosphere');
  if(!root)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),wide=matchMedia('(min-width:1041px)');
  const groups=[...root.querySelectorAll('[data-character-cycle]')].map((host,i)=>({host,forms:[...host.children],index:0,age:0,period:26+i*5}));
  const entries=[...root.querySelectorAll('[data-character-energy]')].map(host=>({host,image:host.querySelector('img'),canvas:host.querySelector('canvas'),paints:0,inside:false}));
  const selected=()=>root.dataset.backgroundCurrent==='lotus'&&(wide.matches||root.dataset.artScope==='gallery');
  const moving=()=>selected()&&!document.hidden&&!reduced.matches&&root.dataset.artMotion!=='still';
  const visible=e=>e.inside&&!e.host.closest('[hidden]')&&e.image.complete&&e.image.naturalWidth>0&&e.image.hasAttribute('data-art-ready');
  let frame=0,last=0,clock=0,painted=0;
  const vertex='attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}';
  const fragment=`precision highp float;
    varying vec2 uv;uniform sampler2D picture;uniform sampler2D protection;uniform float time;uniform float kind;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
    vec4 art(vec2 p){if(min(p.x,p.y)<0.||max(p.x,p.y)>1.)return vec4(0.);return texture2D(picture,p);}
    float energy(vec4 c){
      if(kind<.5)return smoothstep(.07,.23,c.r-c.b)*smoothstep(.32,.7,c.g);
      return smoothstep(.10,.32,max(c.g,c.b)-c.r)*smoothstep(.38,.7,max(c.g,c.b));
    }
    void main(){
      vec4 base=art(uv);float keep=texture2D(protection,uv).r;
      float field=noise(vec2(uv.x*11.+time*.31,uv.y*9.-time*1.5));
      float fine=noise(vec2(uv.x*27.-time*.83,uv.y*21.-time*2.7));
      vec2 bend=vec2((field-.5)*.020+(fine-.5)*.006,(fine-.5)*.010);
      vec4 bent=art(uv+bend*(1.-keep));
      float painted=energy(base)*(1.-keep);
      // Only the painted energy distorts. Face, cloth, metal and hands use exact source pixels.
      vec4 color=mix(base,bent,painted*.88);
      float light=painted*(.10+.18*pow(field,3.));
      color.rgb+=color.rgb*light;
      for(int i=0;i<2;i++){
        float phase=fract(time*.72+float(i)*.5);
        vec2 source=uv-vec2((field-.5)*.028,phase*.075);
        vec4 trail=art(source);
        float sourceKeep=texture2D(protection,clamp(source,0.,1.)).r;
        float life=pow(sin(phase*3.14159265),1.6);
        float a=energy(trail)*trail.a*(1.-sourceKeep)*(1.-keep)*life*.34;
        a*=smoothstep(.30,.67,field+.24*fine);
        // A short-lived rising continuation uses the original flame's colors and texture.
        vec3 premul=color.rgb*color.a+trail.rgb*a*(1.-color.a*.65);
        float alpha=color.a+a*(1.-color.a);
        color=vec4(premul/max(alpha,.001),alpha);
      }
      gl_FragColor=color;
    }`;
  const masks={
    'young-emperor':{polygon:[[.28,0],[.75,0],[.66,.17],[.60,.28],[.75,.33],[.79,.43],[.88,.47],[.81,.60],[.62,.62],[.72,1],[.17,1],[.23,.70],[.08,.94],[.04,.91],[.10,.70],[.22,.52],[.23,.32],[.27,.24]],face:[.39,.23,.17,.18]},
    'lindong-six':{polygon:[[.35,.23],[.68,.22],[.78,.40],[.75,.64],[.92,.79],[.92,.85],[.80,.83],[.93,1],[.11,1],[.31,.66],[.28,.44]],face:[.52,.15,.14,.15]},
    'lindong-seven':{polygon:[[.30,0],[.68,0],[.79,.18],[.82,.27],[.72,.34],[.88,.50],[.83,.69],[.90,.79],[.75,.86],[.57,.75],[.62,1],[.04,1],[.20,.74],[.03,.90],[.01,.84],[.12,.66],[.20,.44],[.27,.26]],face:[.39,.18,.17,.16]}
  };
  function prepare(e){
    if(e.gl||e.failed)return !!e.gl;
    try{
      const gl=e.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,preserveDrawingBuffer:true});
      if(!gl)throw Error('WebGL unavailable');
      const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
      const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const a=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
      const mask=document.createElement('canvas');mask.width=512;mask.height=512;const ctx=mask.getContext('2d'),shape=masks[e.host.dataset.characterEnergy];
      ctx.fillStyle='black';ctx.fillRect(0,0,512,512);ctx.fillStyle='white';ctx.shadowColor='white';ctx.shadowBlur=9;
      ctx.beginPath();shape.polygon.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](x*512,y*512));ctx.closePath();ctx.fill();
      const [x,y,rx,ry]=shape.face;ctx.beginPath();ctx.ellipse(x*512,y*512,rx*512,ry*512,0,0,Math.PI*2);ctx.fill();
      [e.image,mask].forEach((image,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);});
      gl.uniform1i(gl.getUniformLocation(program,'picture'),0);gl.uniform1i(gl.getUniformLocation(program,'protection'),1);
      gl.uniform1f(gl.getUniformLocation(program,'kind'),e.host.dataset.characterEnergy==='young-emperor'?0:1);
      e.gl=gl;e.program=program;e.time=gl.getUniformLocation(program,'time');e.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();e.failed=true;e.host.removeAttribute('data-flow-active');});
      return true;
    }catch(error){e.failed=String(error);e.host.removeAttribute('data-flow-active');return false;}
  }
  function paint(e,t){
    if(!prepare(e))return;
    const displayHeight=Math.min(e.host.clientHeight,e.host.clientWidth*e.image.naturalHeight/e.image.naturalWidth);
    const bottom=(e.host.clientHeight+displayHeight)/2;
    const fade=`linear-gradient(#000 ${bottom-displayHeight*.13}px,transparent ${bottom}px)`;
    e.canvas.style.maskImage=fade;e.image.style.maskImage=fade;
    const w=Math.max(1,Math.min(e.image.naturalWidth,Math.ceil(e.host.clientWidth*Math.min(devicePixelRatio||1,2))));
    const h=Math.ceil(w*e.image.naturalHeight/e.image.naturalWidth);
    if(e.canvas.width!==w||e.canvas.height!==h){e.canvas.width=w;e.canvas.height=h;}
    e.gl.viewport(0,0,w,h);e.gl.useProgram(e.program);e.gl.uniform1f(e.time,t);e.gl.drawArrays(e.gl.TRIANGLES,0,6);e.host.setAttribute('data-flow-active','');e.paints++;
  }
  function choose(group,index){
    group.index=(index+group.forms.length)%group.forms.length;group.age=0;
    group.forms.forEach((form,i)=>{form.hidden=i!==group.index;});
    document.dispatchEvent(new Event('jia-character-change'));window.JiaSevenStar?.wake();wake();
  }
  function tick(now){
    frame=0;if(!moving()){last=0;return;}
    const dt=last?Math.min(now-last,100)/1000:0;clock+=dt;last=now;
    groups.forEach(g=>{g.age+=dt;if(g.age>=g.period)choose(g,g.index+1);});
    if(now-painted>1000/30){entries.filter(visible).forEach(e=>paint(e,clock));painted=now;}
    if(!frame)frame=requestAnimationFrame(tick);
  }
  function wake(){
    cancelAnimationFrame(frame);frame=0;last=0;
    if(moving()&&(groups.length||entries.some(visible)))frame=requestAnimationFrame(tick);
    else entries.forEach(e=>e.host.removeAttribute('data-flow-active'));
  }
  const io=new IntersectionObserver(changes=>{changes.forEach(c=>{const e=entries.find(e=>e.host===c.target);if(e)e.inside=c.isIntersecting;});wake();});
  entries.forEach(e=>{io.observe(e.host);e.image.addEventListener('load',wake);new MutationObserver(wake).observe(e.image,{attributes:true,attributeFilter:['data-art-ready']});});
  new MutationObserver(wake).observe(root,{attributes:true,subtree:true,attributeFilter:['data-background-current','data-art-motion','hidden']});
  document.addEventListener('visibilitychange',wake);reduced.addEventListener('change',wake);wide.addEventListener('change',wake);window.addEventListener('resize',wake);
  window.JiaCharacterArt={select:(side,name)=>{const g=groups.find(g=>g.host.dataset.characterCycle===side);if(g){const i=g.forms.findIndex(f=>f.dataset.characterForm===name);if(i>=0)choose(g,i);}},inspect:()=>({moving:moving(),running:!!frame,clock,source:'independent generated transparent art; no footage',groups:groups.map(g=>({side:g.host.dataset.characterCycle,form:g.forms[g.index].dataset.characterForm,age:g.age})),entries:entries.map(e=>({name:e.host.dataset.characterEnergy,visible:visible(e),paints:e.paints,failed:e.failed||false,width:e.canvas.width,height:e.canvas.height}))}),renderAt:t=>{cancelAnimationFrame(frame);frame=0;entries.filter(visible).forEach(e=>paint(e,t));},wake};
  wake();
})();
