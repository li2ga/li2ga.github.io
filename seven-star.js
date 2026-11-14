"use strict";
(() => {
  const root=document.querySelector('.page-atmosphere');
  const hosts=[...document.querySelectorAll('[data-seven-star]')];
  if(!root||!hosts.length)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),wide=matchMedia('(min-width:1041px)');
  const entries=hosts.map(host=>({host,image:host.querySelector('img'),back:host.querySelector('[data-thunder-back]'),front:host.querySelector('[data-thunder-front]'),inside:false,paints:0}));
  const clamp=x=>Math.max(0,Math.min(1,x));
  const random=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  let frame=0,last=0,clock=0,lastPaint=0;
  // Physical contact points on the armor. Each discharge rebuilds its channel;
  // face and eyes stay outside the front-layer routes.
  const routes=[
    [[.25,.33],[.13,.39],[.20,.54]],
    [[.76,.29],[.94,.36],[.87,.52]],
    [[.15,.49],[.07,.64],[.16,.81]],
    [[.83,.48],[.95,.67],[.85,.86]],
    [[.22,.39],[.10,.29],[.13,.19]],
    [[.79,.34],[.94,.23],[.91,.13]],
    [[.30,.67],[.22,.80],[.38,.94]],
    [[.72,.67],[.84,.80],[.70,.96]]
  ];
  function pathPoints(route,seed){
    const points=[];
    for(let j=0;j<route.length-1;j++){
      const a=route[j],b=route[j+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
      function split(p,q,depth,s){
        if(!depth){points.push(p);return;}
        const jitter=(random(s)-.5)*len*.36*Math.pow(.53,5-depth),mx=(p[0]+q[0])*.5-dy/len*jitter,my=(p[1]+q[1])*.5+dx/len*jitter;
        split(p,[mx,my],depth-1,s*1.73+19);split([mx,my],q,depth-1,s*2.13+41);
      }
      split(a,b,5,seed+j*71);
    }
    points.push(route.at(-1));return points;
  }
  function stroke(ctx,points,alpha,width,reveal=1){
    if(alpha<=0)return;
    const count=Math.max(2,Math.ceil(points.length*reveal));
    ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<count;i++)ctx.lineTo(points[i][0],points[i][1]);
    ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.strokeStyle='#e99409';ctx.lineWidth=width*13;ctx.globalAlpha=alpha*.055;ctx.stroke();
    ctx.strokeStyle='#ffb619';ctx.lineWidth=width*6;ctx.globalAlpha=alpha*.18;ctx.stroke();
    ctx.strokeStyle='#ffdc66';ctx.lineWidth=width*2.9;ctx.globalAlpha=alpha*.66;ctx.stroke();
    ctx.strokeStyle='#fffbe6';ctx.lineWidth=width;ctx.globalAlpha=alpha;ctx.stroke();
  }
  function bolt(ctx,route,index,t,foreground){
    const period=.72+random(index+8)*1.32;
    const tick=t/period+random(index+19)*3,cycle=Math.floor(tick),age=tick-cycle;
    // A channel has a finite strike, a short return stroke, then extinguishes.
    const seconds=age*period;
    const envelope=seconds<.022?smooth(seconds/.022):
      Math.exp(-(seconds-.022)*14)+.76*Math.exp(-Math.pow((seconds-.12)/.023,2))+.42*Math.exp(-Math.pow((seconds-.23)/.018,2));
    const flicker=.84+.16*Math.sin(age*211+index);
    const seed=index*379+cycle*997;
    const points=pathPoints(route,seed),alpha=clamp(envelope*flicker)*(foreground?1:.88);
    const reveal=Math.min(1,seconds/.026);
    stroke(ctx,points,alpha,foreground?.0033:.0028,reveal);
    for(let j=0;j<4;j++){
      const k=Math.floor(points.length*(.27+j*.2)),p=points[k],side=index%2?1:-1;
      const end=[p[0]+side*(.035+random(seed+j+4)*.07),p[1]-.035-random(seed+j+9)*.06];
      stroke(ctx,pathPoints([p,[(p[0]+end[0])*.5+.016*side,(p[1]+end[1])*.5],end],seed+j*113),alpha*.75,.00125,reveal);
    }
    if(seconds>.06&&seconds<.32)stroke(ctx,points,.18*(1-(seconds-.06)/.26),.0008,1);
  }
  function resize(entry){
    const box=entry.host.getBoundingClientRect();
    const ratio=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.ceil(box.width*ratio)),h=Math.max(1,Math.ceil(box.height*ratio));
    for(const canvas of [entry.back,entry.front])if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  }
  function paint(entry,t,staticPose=false){
    resize(entry);
    for(const [layer,canvas] of [entry.back,entry.front].entries()){
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
      if(staticPose)continue;
      ctx.save();ctx.scale(canvas.width,canvas.height);
      if(layer===0){
        routes.forEach((route,i)=>bolt(ctx,route,i,t,false));
      }else{
        const cuffs=[
          [[.26,.39],[.37,.45],[.46,.52]],[[.74,.37],[.65,.45],[.58,.52]],
          [[.44,.51],[.52,.59],[.43,.67]],[[.67,.48],[.72,.59],[.62,.67]],
          [[.19,.60],[.23,.72],[.17,.84]],[[.83,.60],[.77,.72],[.83,.83]],
          [[.34,.66],[.49,.70],[.62,.67]],[[.37,.75],[.47,.84],[.43,.91]]
        ];
        cuffs.forEach((r,i)=>bolt(ctx,r,12+i,t,true));
        for(let i=0;i<22;i++){
          const a=(t*(.18+random(i)*.12)+random(i+40))%1;
          const x=.5+(i%2?1:-1)*(.21+.13*random(i+6))+.012*Math.sin(t*2+i);
          const y=.91-a*.8;ctx.globalAlpha=Math.sin(a*Math.PI)*.65;
          ctx.fillStyle=i%3?'#eab54a':'#fff1b5';ctx.fillRect(x,y,.0017,.0025+random(i+9)*.002);
        }
      }
      ctx.restore();
    }
    entry.paints++;
  }
  function selected(){return root.dataset.backgroundCurrent==='lotus'&&(wide.matches||root.dataset.artScope==='gallery');}
  function eligible(e){return selected()&&e.inside&&!e.host.closest('[hidden]')&&e.image.complete&&e.image.naturalWidth>0&&e.image.hasAttribute('data-art-ready');}
  function moving(){return !document.hidden&&!reduced.matches&&root.dataset.artMotion!=='still';}
  function tick(now){
    frame=0;if(!moving()||!entries.some(eligible)){last=0;return;}
    clock+=last?Math.min(now-last,80)/1000:0;last=now;
    if(now-lastPaint>=1000/30){entries.filter(eligible).forEach(e=>paint(e,clock));lastPaint=now;}
    frame=requestAnimationFrame(tick);
  }
  function wake(){
    cancelAnimationFrame(frame);frame=0;last=0;
    if(!moving()||!selected()){entries.forEach(e=>paint(e,clock,true));return;}
    if(entries.some(eligible))frame=requestAnimationFrame(tick);
  }
  const crossings=new IntersectionObserver(changes=>{changes.forEach(change=>{const e=entries.find(e=>e.host===change.target);if(e)e.inside=change.isIntersecting;});wake();});
  entries.forEach(e=>{crossings.observe(e.host);new MutationObserver(wake).observe(e.image,{attributes:true,attributeFilter:['data-art-ready']});e.image.addEventListener('load',wake);});
  new MutationObserver(wake).observe(root,{attributes:true,attributeFilter:['data-background-current','data-art-motion','data-background-layout']});
  new ResizeObserver(wake).observe(hosts[0]);
  document.addEventListener('visibilitychange',wake);wide.addEventListener('change',wake);reduced.addEventListener('change',wake);
  window.JiaSevenStar={inspect:()=>({running:!!frame,clock,selected:selected(),entries:entries.map(e=>({paints:e.paints,visible:e.inside,ready:e.image.complete&&e.image.naturalWidth>0,width:e.back.width,height:e.back.height}))}),renderAt:t=>{cancelAnimationFrame(frame);frame=0;entries.forEach(e=>paint(e,t));},wake};
  wake();
})();
