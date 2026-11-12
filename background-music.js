(() => {
  const panel=document.querySelector('[data-music-panel]');
  if(!panel)return;
  const toggle=document.querySelector('[data-music-toggle]'), audio=panel.querySelector('audio');
  const input=panel.querySelector('input[type=file]'), list=panel.querySelector('select');
  const localGroup=list.querySelector('[data-local-tracks]'), status=panel.querySelector('[role=status]');
  const files=new Map();
  let loaded='', objectUrl='', nextLocal=0;
  const zh=()=>document.documentElement.lang.startsWith('zh');
  const say=(en,cn)=>status.textContent=zh()?cn:en;
  function sync(){
    const pressed=String(!audio.paused);
    toggle.setAttribute('aria-pressed',pressed);
    panel.querySelector('[data-music-play]').setAttribute('aria-pressed',pressed);
  }
  function loadSelection(){
    const option=list.selectedOptions[0];
    if(!option || loaded===option.value)return;
    if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}
    if(files.has(option.value))objectUrl=URL.createObjectURL(files.get(option.value));
    audio.src=objectUrl||option.dataset.musicSrc;
    loaded=option.value;
  }
  async function play(){
    try{loadSelection();await audio.play();say('Playing.','正在播放。');}
    catch(e){if(e.name!=='AbortError')say('Could not play this track. Choose another and try again.','无法播放这首歌，请换一首重试。');}
  }
  function togglePlay(){if(audio.paused)void play();else{audio.pause();say('Paused.','已暂停。')}}
  function selectionChanged(){
    // Changing the selection while paused must not request any music bytes.
    if(!audio.paused)void play();else say('Ready to play.','已选曲，点击播放即可。');
  }
  toggle.addEventListener('click',togglePlay);
  panel.querySelector('[data-music-play]').addEventListener('click',togglePlay);
  document.querySelector('[data-music-settings]').addEventListener('click',()=>panel.showModal());
  input.addEventListener('change',()=>{
    if(!input.files.length)return;
    const first='local-'+nextLocal;
    for(const file of input.files){
      const key='local-'+nextLocal++;
      files.set(key,file);
      localGroup.append(new Option(file.name.replace(/\.[^.]+$/,''),key));
    }
    localGroup.hidden=false;
    list.value=first;
    selectionChanged();
    input.value='';
  });
  list.addEventListener('change',selectionChanged);
  audio.addEventListener('ended',()=>{
    const options=[...list.options],at=options.findIndex(option=>option.value===loaded);
    if(at>=0){list.value=options[(at+1)%options.length].value;void play();}
  });
  for(const event of ['play','pause','ended','emptied','error'])audio.addEventListener(event,sync);
  audio.volume=.32;
  panel.querySelector('input[type=range]').addEventListener('input',e=>audio.volume=Number(e.target.value));
  window.addEventListener('pagehide',()=>audio.pause());
  sync();
})();