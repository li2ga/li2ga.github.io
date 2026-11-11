// Small luminous streaks follow the swirl around the crystal and rise out of it.
// Coordinates are normalized to the square composition; paths never move the lotus.
(() => {
  const tau = Math.PI * 2;
  const fract = x => x - Math.floor(x);
  const hash = x => fract(Math.sin(x * 127.1 + 311.7) * 43758.5453);
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = (a, b, x) => { const t = Math.max(0, Math.min(1, (x-a)/(b-a))); return t*t*(3-2*t); };
  const orbit = Array.from({length:65}, (_,i) => {
    const k = i + 1;
    return {phase:hash(k*3),angle:tau*hash(k*7),rate:.46+.36*hash(k*9),
      radius:.26+.13*hash(k*11),height:.056+.063*hash(k*13), drift:.024+.062*hash(k*17),
      light:hash(k*23),size:.72+hash(k*27)*1.8,spin:k%5===0?-1:1};
  });
  const rise = Array.from({length:46}, (_,i) => {
    const k = i + 101;
    return {phase:hash(k*3),angle:tau*hash(k*7),rate:.27+.39*hash(k*9),
      root:hash(k*13),height:.12+.20*hash(k*17),curl:.013+.035*hash(k*19),
      light:hash(k*23),size:.68+hash(k*27)*1.7,drift:(hash(k*31)-.5)*.16};
  });
  function rgb(p, lilac, dark) {
    if (lilac) return dark ? [207,165,255] : [133,76,212];
    return dark ? (p.light>.62?[198,251,255]:[62,226,255]) : (p.light>.62?[67,164,223]:[20,146,191]);
  }
  function trail(c, point, u, p, t, a, w, dark, lilac) {
    const [r,g,b]=rgb(p,lilac,dark),head=point(u,p,t),tail=point(Math.max(0,u-w),p,t),
      mid=point(Math.max(0,u-w*.46),p,t),dx=head[0]-tail[0],dy=head[1]-tail[1];
    if(dx*dx+dy*dy<1e-9)return;
    const grad=c.createLinearGradient(tail[0],tail[1],head[0],head[1]);
    grad.addColorStop(0,`rgba(${r},${g},${b},0)`);
    grad.addColorStop(.55,`rgba(${r},${g},${b},${a*.34})`);
    grad.addColorStop(1,`rgba(${r},${g},${b},${a})`);
    c.beginPath();c.moveTo(...tail);c.quadraticCurveTo(...mid,...head);
    c.lineWidth=(p.size*(dark?1.25:1.03))/1280;c.strokeStyle=grad;c.stroke();
    if(p.light>.61){
      c.beginPath();c.ellipse(head[0],head[1],p.size*.76/1280,p.size*.47/1280,Math.atan2(dy,dx),0,tau);
      c.fillStyle=dark?`rgba(235,255,255,${a*.92})`:`rgba(${r},${g},${b},${a*.8})`;c.fill();
    }
  }
  function orbitPoint(u,p,t) {
    const angle=p.angle+p.spin*(u*4.1+t*.54), rr=p.radius+u*p.drift;
    return [.5+rr*Math.cos(angle),.545+p.height*Math.sin(angle)-u*.065+.012*Math.sin(angle*2.3+t*.9)];
  }
  const edgeCurves = [
    [[.09,.45],[.22,.47],[.22,.58],[.45,.635]],
    [[.91,.45],[.79,.46],[.75,.57],[.55,.635]],
    [[.18,.568],[.24,.57],[.36,.616],[.45,.649]],
    [[.82,.568],[.77,.57],[.64,.617],[.55,.649]],
    [[.26,.364],[.286,.43],[.329,.502],[.432,.55]],
    [[.742,.365],[.708,.43],[.68,.50],[.565,.55]],
  ];
  const edge=Array.from({length:18},(_,i)=>({
    curve:edgeCurves[i%edgeCurves.length],phase:hash(i+191),rate:.28+.31*hash(i+139),
    light:.7+.27*hash(i+301),size:1.08+1.1*hash(i+211),
  }));
  function edgePoint(u,p) {
    const a=p.curve,v=1-u;const w=[v*v*v,3*v*v*u,3*v*u*u,u*u*u];
    return [a.reduce((sum,x,i)=>sum+x[0]*w[i],0),a.reduce((sum,x,i)=>sum+x[1]*w[i],0)];
  }
  function risePoint(u,p,t) {
    const s=Math.sin(p.angle), side=p.root<.5?-1:1, rootX=.5+side*.24*Math.pow(Math.abs(p.root-.5)*2,1.48);
    return [rootX+u*p.drift+p.curl*u*Math.sin(u*9.8+p.angle-t*1.28)+.013*u*Math.sin(t*2.3+s),
      .438-.098*Math.abs(p.root-.5)*2-u*p.height+.017*u*Math.sin(u*6+p.angle+t*.95)];
  }
  window.drawLotusLight = (c, ms, front, dark) => {
    const t=ms/1000;
    c.save();c.scale(1280,1280);c.lineCap='round';
    for(const p of orbit){
      const u=fract(p.phase+t*p.rate),pos=orbitPoint(u,p,t),x=Math.abs(pos[0]-.5);
      if(front ? (pos[1]<.55 || x<.285 || p.light<.52) : false)continue;
      const a=ease(0,.14,u)*(1-ease(.53,1,u))*(.36+.48*p.light)*(front?.49:1);
      trail(c,orbitPoint,u,p,t,a,.035+.075*p.light,dark,p.light>.92);
    }
    if(front)for(const p of edge){
      const u=fract(p.phase+t*p.rate),a=ease(.02,.18,u)*(1-ease(.53,.93,u))*(dark?.83:.73);
      trail(c,edgePoint,u,p,t,a,.10+.055*p.light,dark,false);
    }
    if(!front)for(const p of rise){
      const u=fract(p.phase+t*p.rate);
      const a=ease(0,.15,u)*(1-ease(.54,1,u))*(.24+.66*p.light);
      trail(c,risePoint,u,p,t,a,.023+.045*p.light,dark,p.light>.74&&u>.38);
    }
    c.restore();
  };
})();