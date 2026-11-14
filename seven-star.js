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
  // Routes curve around the silhouette. Shoulder/forearm endpoints are local
  // anchors in the generated portrait, never rays through the eyes or face.
  const routes=[
    [[.48,.07],[.26,.15],[.15,.28],[.23,.42]],
    [[.56,.05],[.74,.12],[.85,.3],[.77,.43]],
    [[.14,.37],[.1,.49],[.19,.62],[.23,.81]],
    [[.85,.34],[.92,.51],[.81,.65],[.78,.87]],
    [[.29,.24],[.15,.19],[.09,.1]],
    [[.7,.22],[.85,.16],[.94,.06]],
    [[.3,.58],[.2,.7],[.3,.87],[.44,.96]],
    [[.71,.56],[.82,.73],[.72,.9],[.58,.97]]
  ];
  function pathPoints(route,seed){
    const points=[];
    for(let j=0;j<route.length-1;j++){
      const a=route[j],b=route[j+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
      const count=Math.max(7,Math.ceil(len*70));
      for(let k=0;k<count;k++){
        const q=k/count,offset=(random(seed+j*71+k*11)-.5)*.048*Math.sin(Math.PI*q);
        points.push([a[0]+dx*q-dy/len*offset,a[1]+dy*q+dx/len*offset]);
      }
    }
    points.push(route.at(-1));return points;
  }
  function stroke(ctx,points,alpha,width,reveal=1){
    if(alpha<=0)return;
    const count=Math.max(2,Math.ceil(points.length*reveal));
    ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<count;i++)ctx.lineTo(points[i][0],points[i][1]);
    ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.strokeStyle='#c98716';ctx.lineWidth=width*4;ctx.globalAlpha=alpha*.18;ctx.stroke();
    ctx.strokeStyle='#f7b528';ctx.lineWidth=width*7;ctx.globalAlpha=alpha*.13;ctx.stroke();
    ctx.strokeStyle='#ffcd4f';ctx.lineWidth=width*2.8;ctx.globalAlpha=alpha*.52;ctx.stroke();
    ctx.strokeStyle='#fff7c9';ctx.lineWidth=width;ctx.globalAlpha=alpha;ctx.stroke();
  }
  function bolt(ctx,route,index,t,foreground){
    const period=1.17+random(index+8)*1.15;
    const tick=t/period+random(index+19)*3,cycle=Math.floor(tick),age=tick-cycle;
    // A channel has a finite strike, a short return stroke, then extinguishes.
    const envelope=age<.1?smooth(age/.1):Math.exp(-(age-.1)*7.5)*(age<.72?1:0);
    const flicker=.7+.3*Math.sin(age*83+index);
    const seed=index*379+cycle*997;
    const points=pathPoints(route,seed),alpha=envelope*flicker*(foreground?.8:1);
    const reveal=Math.min(1,age/.12);
    stroke(ctx,points,alpha,.0019,reveal);
    for(let j=0;j<3;j++){
      const k=Math.floor(points.length*(.27+j*.2)),p=points[k],side=index%2?1:-1;
      const end=[p[0]+side*(.035+random(seed+j+4)*.07),p[1]-.035-random(seed+j+9)*.06];
      stroke(ctx,pathPoints([p,[(p[0]+end[0])*.5+.016*side,(p[1]+end[1])*.5],end],seed+j*113),alpha*.52,.0008,reveal);
    }
    if(age>.18&&age<.42)stroke(ctx,points,.32*Math.sin((age-.18)/.24*Math.PI),.00065,1);
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
        // A narrow warm rim stays outside the torso; no opaque yellow wash.
        const glow=ctx.createRadialGradient(.5,.47,.14,.5,.47,.48);
        glow.addColorStop(0,'#ffdf8a00');glow.addColorStop(.62,'#ffda7020');glow.addColorStop(1,'#f6b72700');
        ctx.fillStyle=glow;ctx.fillRect(0,0,1,1);
        routes.forEach((route,i)=>bolt(ctx,route,i,t,false));
      }else{
        // Short arcs follow the outside of the gauntlets and lower hem only.
        const cuffs=[[[.28,.41],[.22,.46],[.27,.54]],[[.73,.4],[.79,.46],[.74,.54]],[[.42,.83],[.35,.9],[.46,.94]]];
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
  function eligible(e){return selected()&&e.inside&&e.image.complete&&e.image.naturalWidth>0&&e.image.hasAttribute('data-art-ready');}
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
