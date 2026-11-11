(() => {
  const panel=document.querySelector('[data-music-panel]');
  if(!panel)return;
  const toggle=document.querySelector('[data-music-toggle]'), audio=panel.querySelector('audio');
  const input=panel.querySelector('input[type=file]'), list=panel.querySelector('select');
  const status=panel.querySelector('[role=status]');
  let tracks=[], current=-1, objectUrl='';
  const zh=()=>document.documentElement.lang.startsWith('zh');
  const say=(en,cn)=>status.textContent=zh()?cn:en;
  function sync(){
    toggle.setAttribute('aria-pressed',String(!audio.paused));
    panel.querySelector('[data-music-play]').setAttribute('aria-pressed',String(!audio.paused));
  }
  async function play(){
    if(!tracks.length){panel.showModal();return}
    try{await audio.play();say('Playing on this device.','正在本机播放。');}
    catch(_){say('This file could not play. Choose another audio file.','无法播放此文件，请换一首。');}
  }
  function select(index, autoplay){
    audio.pause();
    if(objectUrl)URL.revokeObjectURL(objectUrl);
    current=index;list.value=String(index);objectUrl=URL.createObjectURL(tracks[index]);
    audio.src=objectUrl;
    if(autoplay)void play();
  }
  function togglePlay(){if(audio.paused)void play();else{audio.pause();say('Paused.','已暂停。')}}
  toggle.addEventListener('click',togglePlay);
  panel.querySelector('[data-music-play]').addEventListener('click',togglePlay);
  document.querySelector('[data-music-settings]').addEventListener('click',()=>panel.showModal());
  input.addEventListener('change',()=>{
    if(!input.files.length)return;
    tracks=Array.from(input.files);
    list.replaceChildren(...tracks.map((file,i)=>new Option(file.name.replace(/\.[^.]+$/,''),i)));
    list.disabled=false;
    select(0,true);
    input.value='';
  });
  list.addEventListener('change',()=>select(Number(list.value),!audio.paused));
  audio.addEventListener('ended',()=>{if(current>=0)select((current+1)%tracks.length,true)});
  for(const event of ['play','pause','ended'])audio.addEventListener(event,sync);
  audio.volume=.32;
  panel.querySelector('input[type=range]').addEventListener('input',e=>audio.volume=Number(e.target.value));
  window.addEventListener('pagehide',()=>audio.pause());
  sync();
})();