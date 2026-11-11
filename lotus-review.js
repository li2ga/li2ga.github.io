(() => {
  const $=s=>document.querySelector(s), S=1280, fps=24;
  const data=JSON.parse($('#lotus-review-data').textContent);
  const canvas=$('#view'), c=canvas.getContext('2d'), stage=$('[data-lotus-instance]'), host=$('.lotus-frame');
  const picker=$('#variant'), seek=$('#seek'), reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const media='assets/previews/cold-volumetric-fire-v3.webp';
  const cache=new Map();
  let selection='cold', art=null, painted=null, frame=null, decoder=null, opening=null, serial=0;
  let moving=!reduced.matches, showFire=true, snow=true, mist=true, ready=false, decoding=false;
  let currentFrame=0, frameCount=64, t=0, prev=0, elapsed=0;
  const img=src=>{
    if(!cache.has(src)){const image=new Image();image.src=src;cache.set(src,image.decode().then(()=>image).catch(e=>{cache.delete(src);throw e}));}
    return cache.get(src);
  };
  function drawImage(i){const q=Math.min(S/i.naturalWidth,S/i.naturalHeight),w=i.naturalWidth*q,h=i.naturalHeight*q;c.drawImage(i,(S-w)/2,(S-h)/2,w,h);}
  function displayFires(d){
    if(!frame)return;
    // A common 3D simulation is re-positioned and colored for each artwork.
    // None of the original silhouettes or metalwork is warped or cut out.
    c.save();
    for(const [i,[x,y,w,h,hue,alpha]] of d.jets.entries()){
      c.globalAlpha=alpha;
      c.filter=`hue-rotate(${hue}deg) saturate(1.23)`;
      const sway=Math.sin(t*.83+i*1.9)*.004;
      c.drawImage(frame,452,36,378,583,(x-w/2+sway)*S,(y-h)*S,w*S,h*S);
    }
    c.restore();
  }
  function lightMotes(d,dark){
    const base=d.jets[0],rgb=dark?d.bright:d.ink;
    for(let i=0;i<27;i++){
      const u=((i*.61803398875+t*(.39+(i%7)*.045))%1+1)%1;
      const x=S*(base[0]+(u*.055+.017)*Math.sin(i*2.399+t*.8+u*4.1)),y=S*(base[1]-.03-u*(base[3]*.83));
      c.globalAlpha=Math.sin(u*Math.PI)**1.8*(.30+(i%5)*.14);
      c.fillStyle=rgb;c.beginPath();c.ellipse(x,y,1.0+i%4*.32,2.0+i%3*.78,Math.sin(i+t)*.45,0,Math.PI*2);c.fill();
    }
    c.globalAlpha=1;
  }
  function draw(){
    if(!art)return;
    const dark=document.body.classList.contains('dark'),d=data[selection],cold=selection==='cold';
    c.clearRect(0,0,S,S);
    if(cold&&mist)LotusReviewEffects.coldAir(c,t,dark);
    if(showFire){if(cold){ColdLotusCore.draw(c,frame,false);drawLotusLight(c,t*1000,false,dark,true)}else displayFires(d);}
    drawImage(art);
    if(showFire){
      if(cold){ColdLotusCore.draw(c,frame,true);drawLotusLight(c,t*1000,true,dark,true)}
      else lightMotes(d,dark);
    }
    if(cold&&snow)LotusReviewEffects.flakes(c,t,dark);
    seek.value=currentFrame;$('#time').value=`${(currentFrame/fps).toFixed(2)} s · ${currentFrame+1} / ${frameCount}`;
  }
  function sync(){
    $('#play').textContent=moving?'暂停动效':'播放动效';$('#play').setAttribute('aria-pressed',String(moving));
    $('.page-atmosphere').dataset.artMotion=moving?'loop':'still';JiaArtLoops.wake();
    for(const [id,on] of [['#fire',showFire],['#snow',snow],['#mist',mist]])$(id).setAttribute('aria-pressed',String(on));
    $('#cold-controls').hidden=selection!=='cold';
    $('#variant-note').textContent=data[selection].note;
  }
  async function choose(key){
    if(!data[key])return;
    const request=++serial,d=data[key];$('#status').textContent='正在载入火莲…';
    try{
      const [base,body]=await Promise.all([img(d.src),key==='cold'?img('assets/backgrounds/fire-lotus-cold-body-v1.png'):img(d.src)]);
      if(request!==serial)return;
      selection=key;painted=base;art=body;picker.value=key;
      stage.dataset.lotusStage=d.stage;host.dataset.lotusFrame=d.stage;host.style.backgroundImage=`url("${d.src}")`;
      JiaArtLoops.lotus(stage,d.stage,painted);JiaArtLoops.setColdSnow(true);
      sync();draw();$('#status').textContent=ready?'选择任意一款，左右同步切换。':'正在准备光焰动效…';
    }catch(_){if(request===serial)$('#status').textContent='图像暂未载入，换一款后可重试。'}
  }
  async function paintFrame(index){
    if(!decoder||decoding)return;
    decoding=true;
    try{const r=await decoder.decode({frameIndex:index});if(frame instanceof VideoFrame)frame.close();frame=r.image;currentFrame=index;draw();}
    catch(_){$('#status').textContent='光焰暂不可播放，仍可查看静态对比。';moving=false;sync();}
    finally{decoding=false;}
  }
  function open(){
    if(opening)return opening;
    opening=(async()=>{
      if(!window.ImageDecoder){seek.disabled=true;return;}
      const r=await fetch(media);if(!r.ok)throw Error(r.status);
      decoder=new ImageDecoder({data:await r.arrayBuffer(),type:'image/webp',preferAnimation:true});await decoder.tracks.ready;
      frameCount=decoder.tracks.selectedTrack.frameCount;seek.max=frameCount-1;ready=true;
      await paintFrame(0);$('#status').textContent='选择任意一款，左右同步切换。';
    })().catch(()=>{$('#status').textContent='动态文件未载入，仍可查看静态对比。';});
    return opening;
  }
  function tick(now){
    if(moving&&!document.hidden){
      if(!prev)prev=now;
      const dt=Math.min(.15,(now-prev)/1000);prev=now;t+=dt;elapsed+=dt;
      if(elapsed>=1/fps){
        if(ready&&!decoding){const advance=Math.min(3,Math.floor(elapsed*fps));elapsed-=advance/fps;void paintFrame((currentFrame+advance)%frameCount);}
        else if(!ready){elapsed%=1/fps;draw();}
      }
    }else prev=0;
    requestAnimationFrame(tick);
  }
  for(const [key,d] of Object.entries(data))picker.append(new Option(d.name,key));
  picker.addEventListener('change',()=>void choose(picker.value));
  $('#prev').addEventListener('click',()=>{const keys=Object.keys(data),i=keys.indexOf(selection);void choose(keys[(i+keys.length-1)%keys.length]);});
  $('#next').addEventListener('click',()=>{const keys=Object.keys(data),i=keys.indexOf(selection);void choose(keys[(i+1)%keys.length]);});
  $('#play').addEventListener('click',()=>{moving=!moving;if(moving)void open();sync();});
  $('#fire').addEventListener('click',()=>{showFire=!showFire;sync();draw()});
  $('#snow').addEventListener('click',()=>{snow=!snow;sync();draw()});
  $('#mist').addEventListener('click',()=>{mist=!mist;sync();draw()});
  $('#tone').addEventListener('click',e=>{const dark=document.body.classList.toggle('dark');e.target.textContent=dark?'浅色背景':'深色背景';draw()});
  seek.addEventListener('input',()=>{moving=false;t=Number(seek.value)/fps;sync();void paintFrame(Number(seek.value))});
  reduced.addEventListener('change',()=>{if(reduced.matches){moving=false;sync();}});
  window.LotusReview={inspect:()=>({selection,ready,moving,frame:currentFrame,snow:selection==='cold'&&snow?LotusReviewEffects.snowCount:0,mist:selection==='cold'&&mist,available:Object.keys(data).length}),choose,drawAt:async i=>{moving=false;t=i/fps;sync();await paintFrame(i)}};
  void (async()=>{
    frame=await img('assets/previews/cold-volumetric-fire-still-v3.png');
    const requested=new URLSearchParams(location.search).get('lotus');await choose(data[requested]?requested:'cold');
    sync();if(moving)void open();else $('#status').textContent='当前为静态预览，可手动开启动效。';requestAnimationFrame(tick);
  })();
})();