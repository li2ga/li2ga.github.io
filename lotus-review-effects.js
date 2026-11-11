(() => {
  const S=1280, tau=Math.PI*2, fract=x=>x-Math.floor(x);
  const rand=i=>fract(Math.sin(i*127.1+311.7)*43758.5453);
  const snow=Array.from({length:76},(_,i)=>({x:.04+.92*rand(i+12),phase:rand(i+120),speed:.028+.031*rand(i+220),size:4.1+8.6*rand(i+340)**1.8,spin:(rand(i+780)-.5)*.67,alpha:.36+.45*rand(i+460)}));
  function flakes(c,t,dark) {
    c.save();c.strokeStyle=dark?'#a5e5ff':'#65a6c3';c.lineCap='round';
    for(const [i,p] of snow.entries()){
      const u=fract(p.phase+t*p.speed),x=(p.x+.036*Math.sin(t*.78+i)+.013*Math.sin(t*1.81+i*2))*S,y=(1.16*u-.08)*S;
      c.save();c.translate(x,y);c.rotate(t*p.spin+i);c.globalAlpha=p.alpha*Math.min(1,u*12,(1-u)*12);c.lineWidth=.9+p.size*.11;c.beginPath();
      for(let j=0;j<6;j++){const a=j*tau/6,dx=Math.cos(a),dy=Math.sin(a),r=p.size;c.moveTo(0,0);c.lineTo(dx*r,dy*r);
        if(r>5)for(const side of[-1,1]){c.moveTo(dx*r*.64,dy*r*.64);c.lineTo(dx*r*.44-dy*r*.25*side,dy*r*.44+dx*r*.25*side)}
      }
      c.stroke();c.restore();
    }
    c.restore();
  }
  // The cold vapor spreads below the lower petals. Feathered moving density
  // pockets give the air depth without painting across the crystal surface.
  const vapor=document.createElement('canvas');vapor.width=vapor.height=128;
  const v=vapor.getContext('2d'),g=v.createRadialGradient(64,64,0,64,64,64);
  for(const [x,a] of [[0,.84],[.24,.64],[.53,.3],[.82,.072],[1,0]])g.addColorStop(x,`rgba(102,179,210,${a})`);
  v.fillStyle=g;v.fillRect(0,0,128,128);
  const wisps=Array.from({length:24},(_,i)=>({p:rand(i+917),speed:.10+.07*rand(i+771),side:i%2?1:-1,spread:230+180*rand(i+451),size:89+81*rand(i+501),drift:rand(i+399),angle:(rand(i+878)-.5)*.32}));
  function coldAir(c,t,dark){
    c.save();
    for(const [i,p] of wisps.entries()){
      const u=fract(p.p+t*p.speed),q=Math.sin(u*Math.PI)**1.9;
      const x=640+p.side*(50+u*p.spread)+23*Math.sin(u*5+t*.46+i),y=932+u*(90+p.drift*68)+17*Math.sin(t*.7+u*5+i);
      c.save();c.translate(x,y);c.rotate(p.angle+.08*Math.sin(t*.7+i));
      c.globalAlpha=(dark?.27:.23)*q;c.drawImage(vapor,-p.size*(.85+u*.44),-22-p.drift*12,p.size*(1.7+u*.88),44+p.drift*24);c.restore();
    }
    c.restore();
  }
  window.LotusReviewEffects={flakes,coldAir,snowCount:snow.length};
})();