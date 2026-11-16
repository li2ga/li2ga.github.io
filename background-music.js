(() => {
  const panel=document.querySelector('[data-music-panel]');
  if(!panel)return;
  const toggle=document.querySelector('[data-music-toggle]'), audio=panel.querySelector('audio');
  const input=panel.querySelector('[data-music-upload]'), list=panel.querySelector('[data-music-tracks]');
  const mode=panel.querySelector('[data-music-mode]');
  const previousButton=panel.querySelector('[data-music-previous]');
  const nextButton=panel.querySelector('[data-music-next]');
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
  let captionKey='', history=[list.value], historyIndex=0, shuffleQueue=[];
  let audioContext=null, analyser=null, spectrum=null, waveform=null, analysisPending=null;
  let energy=0, beat=0, bassAverage=0, lastBeat=0, lastAnalysis=0;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const modeDescriptions={
    'list-loop':['Play in order, then start the playlist again.','按歌单顺序播放，播完后从头循环。'],
    'sequence':['Play in order and stop after the last track.','按歌单顺序播放，最后一首结束后停止。'],
    'shuffle':['Shuffle without repeats; Previous retraces your listening history.','随机不重复播放；上一首可回到刚刚听过的歌。'],
    'repeat-one':['Repeat this track. Previous and Next still switch tracks.','当前歌曲循环播放，仍可手动切换上下首。']
  };
  let musicMessage=['',''], lyricsMessage=['',''];
  const zh=()=>document.documentElement.lang.startsWith('zh');
  const say=(en,cn)=>{musicMessage=[en,cn];status.textContent=zh()?cn:en;};
  const sayLyrics=(en,cn)=>{lyricsMessage=[en,cn];lyricsStatus.textContent=zh()?cn:en;};

  function updateModeLabels(){
    for(const option of mode.options)option.textContent=zh()?option.dataset.modeZh:option.dataset.modeEn;
    panel.querySelector('[data-music-mode-description]').textContent=modeDescriptions[mode.value][zh()?1:0];
    previousButton.disabled=mode.value==='shuffle'&&historyIndex===0;
  }

  function rememberTrack(key){
    if(history[historyIndex]!==key){
      history=history.slice(0,historyIndex+1);history.push(key);historyIndex=history.length-1;
    }
    shuffleQueue=shuffleQueue.filter(value=>value!==key);
    updateModeLabels();
  }

  function randomNext(){
    if(!shuffleQueue.length){
      shuffleQueue=[...list.options].map(option=>option.value).filter(key=>key!==list.value);
      for(let i=shuffleQueue.length-1;i>0;i--){
        const at=Math.floor(Math.random()*(i+1));
        [shuffleQueue[i],shuffleQueue[at]]=[shuffleQueue[at],shuffleQueue[i]];
      }
    }
    return shuffleQueue.shift()||list.value;
  }

  function navigate(direction,automatic=false){
    const options=[...list.options],at=options.findIndex(option=>option.value===list.value);
    const autoplay=automatic||!audio.paused;
    let key,remember=true;
    if(automatic&&mode.value==='repeat-one')key=list.value;
    else if(automatic&&mode.value==='sequence'&&at===options.length-1){
      audio.pause();say('Playlist finished.','歌单已播放完毕。');updateClock();return;
    }else if(mode.value==='shuffle'){
      if(direction<0){
        if(historyIndex===0)return;
        key=history[--historyIndex];remember=false;
      }else if(historyIndex<history.length-1){key=history[++historyIndex];remember=false;}
      else key=randomNext();
    }else key=options[(at+direction+options.length)%options.length].value;
    list.value=key;
    if(key===loaded&&autoplay)audio.currentTime=0;
    selectionChanged({autoplay,remember});
  }

  async function enableAudioAnalysis(){
    if(analysisPending)return analysisPending;
    try{
      // A running graph must stay connected even when captions are switched off.
      if(audioContext?.state==='suspended')await audioContext.resume();
      if(!lyricsToggle.checked||reducedMotion.matches||analyser)return;
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context)return;
      analysisPending=(async()=>{
        audioContext??=new Context();
        if(audioContext.state!=='running')await audioContext.resume();
        if(audioContext.state!=='running')return;
        const node=audioContext.createAnalyser();node.fftSize=512;node.smoothingTimeConstant=.55;
        const source=audioContext.createMediaElementSource(audio);
        source.connect(node);node.connect(audioContext.destination);
        analyser=node;spectrum=new Uint8Array(node.frequencyBinCount);waveform=new Float32Array(node.fftSize);
        captions.dataset.musicReactive='active';
      })();
      await analysisPending;
    }catch{/* Captions and native playback remain usable without audio analysis. */}
    finally{analysisPending=null;}
  }

  function animateLyrics(){
    if(!analyser||reducedMotion.matches||captions.hidden)return;
    const now=performance.now();
    if(now-lastAnalysis<30)return;
    lastAnalysis=now;
    analyser.getByteFrequencyData(spectrum);
    analyser.getFloatTimeDomainData(waveform);
    const bins=Math.max(2,Math.ceil(220*analyser.fftSize/audioContext.sampleRate));
    let bass=0,level=0;
    for(let i=1;i<=bins;i++)bass+=spectrum[i];
    for(const sample of waveform)level+=sample*sample;
    bass/=255*bins;level=Math.sqrt(level/waveform.length);
    bassAverage=bassAverage*.93+bass*.07;
    if(bass>.12&&bass>bassAverage*1.14&&now-lastBeat>210){beat=Math.min(1,.3+(bass-bassAverage)*3);lastBeat=now;}
    beat*=.88;energy=energy*.78+Math.min(1,level*5)*.22;
    captions.style.setProperty('--lyric-energy',energy.toFixed(3));
    captions.style.setProperty('--lyric-beat',beat.toFixed(3));
  }

  function drawLyricPhrase(text,key){
    captionKey=key;
    captionLine.replaceChildren();
    let seed=0;
    for(const character of key)seed=(Math.imul(seed,31)+character.codePointAt(0))>>>0;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const phraseSize=random();
    captionLine.style.setProperty('--phrase-scale',(0.96+phraseSize*.15).toFixed(3));
    captionLine.style.setProperty('--phrase-scale-mobile',(0.92+phraseSize*.16).toFixed(3));
    const characters=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(item=>item.segment):Array.from(text);
    const eligible=characters.map((character,index)=>/[\p{L}\p{N}]/u.test(character)?index:-1).filter(index=>index>=0);
    const featured=eligible.length>1&&eligible.length<=32&&!/(?:作词|作曲|编曲|制作|录音|监制|发行|母带|OP|SP)\s*[:：]/i.test(text);
    captionLine.dataset.lyricAccent=featured&&random()<.42?'strong':'normal';
    const spotlight=featured?eligible[Math.floor(random()*eligible.length)]:-1;
    // Only compact Chinese phrases use the side composition. Imported long/Latin lines stay horizontal.
    // Zhu Guang's official MV keeps lyrics horizontal below the action.
    const vertical=loaded!=='zhu-guang'&&featured&&eligible.length<=18&&/^[\p{Script=Han}\p{P}\s]+$/u.test(text);
    captions.dataset.lyricLayout=vertical?'vertical':'horizontal';
    captionLine.dataset.lyricLength=eligible.length<=5?'short':'long';
    let split=characters.length;
    if(vertical&&eligible.length>5){
      const middle=characters.length/2;
      const balanced=index=>{
        const left=eligible.filter(at=>at<index).length,right=eligible.length-left;
        return Math.min(left,right)>=2&&Math.max(left,right)<=Math.min(left,right)*2.5;
      };
      const pauses=characters.map((character,index)=>/[，、；。！？\s]/u.test(character)?index+1:-1)
        .filter(index=>index>=2&&index<=characters.length-2&&balanced(index));
      // Prefer actual punctuation, then the nearest word boundary; no fabricated lyric timing.
      const words=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('zh',{granularity:'word'}).segment(text)]
        .map(item=>Array.from(text.slice(0,item.index)).length).filter(index=>index>=2&&index<=characters.length-2&&balanced(index)):[];
      split=(pauses.length?pauses:words.length?words:[Math.ceil(middle)])
        .reduce((best,index)=>Math.abs(index-middle)<Math.abs(best-middle)?index:best);
    }
    const fragment=document.createDocumentFragment();
    let run=document.createElement('span');run.className='music-lyric-run';fragment.append(run);
    characters.forEach((character,index)=>{
      if(index===split){run=document.createElement('span');run.className='music-lyric-run';fragment.append(run);}
      if(/\s/.test(character)){run.append(document.createTextNode(character));return;}
      const glyph=document.createElement('span');glyph.className='music-lyric-glyph';glyph.textContent=character;
      if(/^\p{P}+$/u.test(character))glyph.dataset.lyricPunctuation='';
      if(index===spotlight)glyph.dataset.lyricEmphasis='';
      glyph.style.setProperty('--glyph-delay',Math.min(.36,index*.018).toFixed(3)+'s');
      glyph.style.setProperty('--glyph-size',(0.92+random()*.18).toFixed(3));
      glyph.style.setProperty('--glyph-rise',(1+random()*4).toFixed(2));
      glyph.style.setProperty('--glyph-tilt',((random()-.5)*3).toFixed(2)+'deg');
      run.append(glyph);
    });
    captionLine.append(fragment);
  }

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
    let text='',key='',opacity=1;
    if(lyricsToggle.checked&&cueTrack===loaded&&loaded===list.value&&!audio.ended&&!audio.error){
      const time=audio.currentTime-(delays.get(list.value)||0);
      let low=0,high=cues.length;
      while(low<high){const mid=(low+high)>>1;if(cues[mid].start<=time)low=mid+1;else high=mid;}
      const cue=cues[low-1];
      if(cue&&time<cue.end){
        text=cue.text;key=loaded+':'+cue.start;
        const fade=Math.min(.38,(cue.end-cue.start)*.15);
        opacity=Math.min(1,Math.max(0,(cue.end-time)/fade));
      }
    }
    if(captionKey!==key||captionLine.textContent!==text)drawLyricPhrase(text,key);
    captions.style.setProperty('--cue-opacity',opacity.toFixed(3));
    captions.hidden=!text;
  }

  function updateClock(){
    renderCaptions();
    const running=lyricsToggle.checked&&cues.length&&!audio.paused&&!audio.ended&&!document.hidden;
    if(running)animateLyrics();
    else{
      energy=0;beat=0;bassAverage=0;
      captions.style.setProperty('--lyric-energy','0');captions.style.setProperty('--lyric-beat','0');
    }
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
    try{void enableAudioAnalysis();loadSelection();await audio.play();say('Playing.','正在播放。');}
    catch(e){if(e.name!=='AbortError')say('Could not play this track. Choose another and try again.','无法播放这首歌，请换一首重试。');}
  }
  function togglePlay(){if(audio.paused)void play();else{audio.pause();say('Paused.','已暂停。')}}
  function selectionChanged({autoplay=!audio.paused,remember=true}={}){
    // Changing the selection while paused must not request any music bytes.
    if(remember)rememberTrack(list.value);else updateModeLabels();
    lyricsDelay.value=String(delays.get(list.value)||0);
    void refreshLyrics();
    if(autoplay)void play();else say('Ready to play.','已选曲，点击播放即可。');
  }
  toggle.addEventListener('click',togglePlay);
  panel.querySelector('[data-music-play]').addEventListener('click',togglePlay);
  previousButton.addEventListener('click',()=>navigate(-1));
  nextButton.addEventListener('click',()=>navigate(1));
  mode.addEventListener('change',()=>{
    shuffleQueue=[];history=[list.value];historyIndex=0;updateModeLabels();
    try{localStorage.setItem('jia-li-music-playback-mode',mode.value);}catch{}
  });
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
    shuffleQueue=[];
    list.value=first;
    selectionChanged();
    input.value='';
  });
  list.addEventListener('change',()=>selectionChanged());
  lyricsToggle.addEventListener('change',()=>{if(!audio.paused)void enableAudioAnalysis();void refreshLyrics();});
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
  audio.addEventListener('ended',()=>navigate(1,true));
  for(const event of ['play','pause','ended','emptied','error'])audio.addEventListener(event,sync);
  for(const event of ['timeupdate','seeking','seeked','loadedmetadata'])audio.addEventListener(event,updateClock);
  document.addEventListener('visibilitychange',updateClock);
  reducedMotion.addEventListener('change',()=>{if(!audio.paused)void enableAudioAnalysis();updateClock();});
  new MutationObserver(()=>{
    status.textContent=musicMessage[zh()?1:0];
    lyricsStatus.textContent=lyricsMessage[zh()?1:0];
    updateModeLabels();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  audio.volume=.32;
  panel.querySelector('input[type=range]').addEventListener('input',e=>audio.volume=Number(e.target.value));
  window.addEventListener('pagehide',()=>audio.pause());
  // Keep music and captions off on every page load, even if a browser restores form state.
  lyricsToggle.checked=false;
  try{const saved=localStorage.getItem('jia-li-music-playback-mode');if(Object.hasOwn(modeDescriptions,saved))mode.value=saved;}catch{}
  updateModeLabels();void refreshLyrics();sync();
})();
