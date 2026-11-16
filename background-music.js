(() => {
  const panel=document.querySelector('[data-music-panel]');
  if(!panel)return;
  const toggle=document.querySelector('[data-music-toggle]'), audio=panel.querySelector('audio');
  const input=panel.querySelector('[data-music-upload]'), list=panel.querySelector('select');
  const localGroup=list.querySelector('[data-local-tracks]'), status=panel.querySelector('[data-music-status]');
  const lyricsToggle=panel.querySelector('[data-lyrics-toggle]');
  const lyricsInput=panel.querySelector('[data-lyrics-upload]');
  const lyricsDelay=panel.querySelector('[data-lyrics-delay]');
  const lyricsStatus=panel.querySelector('[data-lyrics-status]');
  const captions=document.querySelector('[data-music-captions]');
  const captionLine=captions.querySelector('[data-caption-line]');
  const files=new Map();
  const lyricsCache=new Map(), delays=new Map();
  let loaded='', objectUrl='', nextLocal=0;
  let cues=[], cueTrack='', lyricsRequest=0, animationFrame=0;
  let musicMessage=['',''], lyricsMessage=['',''];
  const zh=()=>document.documentElement.lang.startsWith('zh');
  const say=(en,cn)=>{musicMessage=[en,cn];status.textContent=zh()?cn:en;};
  const sayLyrics=(en,cn)=>{lyricsMessage=[en,cn];lyricsStatus.textContent=zh()?cn:en;};

  function parseLyrics(text, format){
    const rows=[];
    text=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
    const seconds=value=>value.replace(',','.').split(':').reduce((total,part)=>total*60+Number(part),0);
    if(format==='lrc'){
      const offset=Number(text.match(/^\[offset:\s*([+-]?\d+)\s*\]/mi)?.[1]||0)/1000;
      for(const line of text.split('\n')){
        const stamps=[...line.matchAll(/\[(\d{1,3}:\d{2}(?:\.\d{1,3})?)\]/g)];
        const content=line.replace(/\[[^\]]*\]/g,'').trim();
        for(const stamp of stamps)rows.push({start:Math.max(0,seconds(stamp[1])-offset),text:content});
      }
    }else{
      for(const block of text.split(/\n\s*\n/)){
        const lines=block.split('\n');
        const at=lines.findIndex(line=>line.includes('-->'));
        if(at<0)continue;
        const times=lines[at].match(/((?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)/);
        if(times)rows.push({start:seconds(times[1]),end:seconds(times[2]),text:lines.slice(at+1).join('\n').trim()});
      }
    }
    rows.sort((a,b)=>a.start-b.start);
    const merged=[];
    for(const row of rows){
      if(!Number.isFinite(row.start)||row.start<0)continue;
      // Subtitles are plain text, including imported files; never render markup.
      row.text=row.text.replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[entity]).slice(0,500);
      const previous=merged[merged.length-1];
      if(previous?.start===row.start){
        if(row.text&&!previous.text.split('\n').includes(row.text))previous.text=[previous.text,row.text].filter(Boolean).join('\n');
        if(row.end)previous.end=Math.max(previous.end||0,row.end);
      }else merged.push(row);
    }
    for(let i=0;i<merged.length;i++){
      // LRC has no end times. Clear long instrumental gaps instead of leaving a stale line.
      merged[i].end??=Math.min(merged[i+1]?.start??Infinity,merged[i].start+12);
    }
    return merged.filter(row=>row.end>row.start).slice(0,20000);
  }

  function renderCaptions(){
    let text='';
    if(lyricsToggle.checked&&cueTrack===loaded&&loaded===list.value&&!audio.ended&&!audio.error){
      const time=audio.currentTime-(delays.get(list.value)||0);
      let low=0,high=cues.length;
      while(low<high){const mid=(low+high)>>1;if(cues[mid].start<=time)low=mid+1;else high=mid;}
      const cue=cues[low-1];
      if(cue&&time<cue.end)text=cue.text;
    }
    if(captionLine.textContent!==text)captionLine.textContent=text;
    captions.hidden=!text;
  }

  function updateClock(){
    renderCaptions();
    const running=lyricsToggle.checked&&cues.length&&!audio.paused&&!audio.ended&&!document.hidden;
    if(running&&!animationFrame)animationFrame=requestAnimationFrame(()=>{animationFrame=0;updateClock();});
    if(!running&&animationFrame){cancelAnimationFrame(animationFrame);animationFrame=0;}
  }

  async function refreshLyrics(){
    const request=++lyricsRequest, key=list.value, option=list.selectedOptions[0];
    cues=[];cueTrack='';updateClock();
    if(!lyricsToggle.checked){sayLyrics('Subtitles are off.','字幕已关闭。');return;}
    if(!lyricsCache.has(key)){
      if(!option?.dataset.lyricsSrc){
        sayLyrics('No timed lyrics for this track yet. Import an LRC, SRT or VTT file.','这首歌暂未配字幕，可导入 LRC、SRT 或 VTT 文件。');return;
      }
      const pending=fetch(option.dataset.lyricsSrc).then(response=>{
        if(!response.ok)throw new Error('Lyrics request failed');
        return response.text();
      }).then(text=>parseLyrics(text,'lrc'));
      lyricsCache.set(key,pending);
      pending.catch(()=>{if(lyricsCache.get(key)===pending)lyricsCache.delete(key);});
    }
    sayLyrics('Loading subtitles…','正在载入字幕…');
    try{
      const result=await lyricsCache.get(key);
      if(request!==lyricsRequest)return;
      if(!result.some(cue=>cue.text))throw new Error('No timed lyrics');
      cues=result;cueTrack=key;
      sayLyrics('Subtitles ready. They follow playback.','字幕已就绪，会跟随播放进度。');
      updateClock();
    }catch{
      if(request===lyricsRequest)sayLyrics('Could not load subtitles. Try switching them off and on, or import a file.','字幕载入失败，可关闭后重开，或导入文件。');
    }
  }

  function sync(){
    const pressed=String(!audio.paused);
    toggle.setAttribute('aria-pressed',pressed);
    panel.querySelector('[data-music-play]').setAttribute('aria-pressed',pressed);
    updateClock();
  }
  function loadSelection(){
    const option=list.selectedOptions[0];
    if(!option || loaded===option.value)return;
    if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}
    if(files.has(option.value))objectUrl=URL.createObjectURL(files.get(option.value));
    audio.src=objectUrl||option.dataset.musicSrc;
    loaded=option.value;
    updateClock();
  }
  async function play(){
    try{loadSelection();await audio.play();say('Playing.','正在播放。');}
    catch(e){if(e.name!=='AbortError')say('Could not play this track. Choose another and try again.','无法播放这首歌，请换一首重试。');}
  }
  function togglePlay(){if(audio.paused)void play();else{audio.pause();say('Paused.','已暂停。')}}
  function selectionChanged(){
    // Changing the selection while paused must not request any music bytes.
    lyricsDelay.value=String(delays.get(list.value)||0);
    void refreshLyrics();
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
  lyricsToggle.addEventListener('change',()=>void refreshLyrics());
  document.querySelector('[data-lyrics-close]').addEventListener('click',()=>{
    lyricsToggle.checked=false;void refreshLyrics();
  });
  lyricsInput.addEventListener('change',async()=>{
    const file=lyricsInput.files[0],key=list.value;
    lyricsInput.value='';
    if(!file)return;
    const format=file.name.split('.').pop().toLowerCase();
    if(!['lrc','srt','vtt'].includes(format)||file.size>2*1024*1024){
      sayLyrics('Choose an LRC, SRT or VTT file under 2 MB.','请选择 2 MB 以内的 LRC、SRT 或 VTT 文件。');return;
    }
    try{
      const bytes=await file.arrayBuffer();
      let text;
      try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
      catch{text=new TextDecoder('gb18030').decode(bytes);}
      const parsed=parseLyrics(text,format);
      if(!parsed.some(cue=>cue.text))throw new Error('No timed lines');
      lyricsCache.set(key,Promise.resolve(parsed));
      if(key!==list.value)return;
      if(lyricsToggle.checked)void refreshLyrics();
      else sayLyrics('Subtitles imported. Turn on “Show lyrics” to display them.','字幕已导入，勾选“显示歌词字幕”即可显示。');
    }catch{if(key===list.value)sayLyrics('No valid timed lines found. Check the subtitle file.','未找到有效的时间轴，请检查字幕文件。');}
  });
  lyricsDelay.addEventListener('input',()=>{
    const delay=Math.max(-30,Math.min(30,Number(lyricsDelay.value)||0));
    delays.set(list.value,delay);updateClock();
  });
  audio.addEventListener('ended',()=>{
    const options=[...list.options],at=options.findIndex(option=>option.value===loaded);
    if(at>=0){
      list.value=options[(at+1)%options.length].value;
      lyricsDelay.value=String(delays.get(list.value)||0);
      void refreshLyrics();void play();
    }
  });
  for(const event of ['play','pause','ended','emptied','error'])audio.addEventListener(event,sync);
  for(const event of ['timeupdate','seeking','seeked','loadedmetadata'])audio.addEventListener(event,updateClock);
  document.addEventListener('visibilitychange',updateClock);
  new MutationObserver(()=>{
    status.textContent=musicMessage[zh()?1:0];
    lyricsStatus.textContent=lyricsMessage[zh()?1:0];
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  audio.volume=.32;
  panel.querySelector('input[type=range]').addEventListener('input',e=>audio.volume=Number(e.target.value));
  window.addEventListener('pagehide',()=>audio.pause());
  // Keep music and captions off on every page load, even if a browser restores form state.
  lyricsToggle.checked=false;
  void refreshLyrics();sync();
})();
