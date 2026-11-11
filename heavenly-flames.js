"use strict";
(() => {
  const flames=[
    ['帝炎','多色归一，白金色焰心交织青、碧、紫与绯红。','#ddb974','特例榜首，以诸火汇聚作原创演绎。'],
    ['虚无吞炎','漆黑焰体向内吞卷，暗紫与赤红勾勒焰缘。','#a47ac8'],
    ['净莲妖火','乳白莲形，淡粉色焰脉流入层叠的火瓣。','#e5bfc7'],
    ['金帝焚天炎','纯金色长焰直上，白金焰心与金色外焰相叠。','#dab472'],
    ['生灵之焱','翠绿流焰舒展，像新生的嫩芽不断抽生。','#86c66d'],
    ['八荒破灭焱','淡黑色火势铺开，羽翼般的轮廓聚散生灭。','#ab8d91'],
    ['九幽金祖火','深金色火流低旋，厚重而幽深。','#c89e60'],
    ['红莲业火','深红焰瓣层层绽放，赤色火舌从莲心升起。','#cc6976'],
    ['三千焱炎火','紫黑星火蜿蜒成龙，游离的焰丝向星空散开。','#ad84d6'],
    ['九幽风炎','黑色风焰向上撕卷，细长焰缘随风改道。','#8eabc2'],
    ['骨灵冷火','骨白色焰心，冰青色焰缘，炽热与寒意同在。','#b2dce0'],
    ['九龙雷罡火','银白焰流交缠，细雷与龙形焰丝相伴。','#c6c8e8'],
    ['龟灵地火','棕褐色地火低伏，铜色焰流隐约构成龟甲形态。','#b3997b'],
    ['陨落心炎','近乎无色的火蟒，靠透明层次与微亮焰缘显形。','#dbd6b9'],
    ['海心焰','深蓝色焰体起伏，海流般的内焰向上舒卷。','#71a7d2'],
    ['火云水炎','水蓝与暗红火脉互相穿行，云般的焰团聚散。','#a696c2','外观设定推演：蓝红配色为本次创作选择，未当作原著定色。'],
    ['火山石焰','深红火势凝聚，细密赤色焰脉向上分枝。','#ce796b'],
    ['风怒龙炎','土黄色龙形风焰，细长焰尾被气流拉散。','#c7ae78'],
    ['青莲地心火','青碧莲形，层叠的焰瓣向上舒展。','#80cac1'],
    ['幽冥毒火','幽绿内焰，亮绿焰缘，细密毒焰不断抽生。','#9ac975'],
    ['阴阳双炎','黑白双焰同生，交缠上升，明暗各成一体。','#b7c7d0'],
    ['万兽灵火','赭红与琥珀色焰流中，兽形轮廓一闪而逝。','#c49377','外观设定推演：赤赭兽形为本次创作选择，不作为官方定稿。'],
    ['玄黄炎','深黄色火势内敛，温厚焰心分出细长火舌。','#c6af6d']
  ];
  const chinese=['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','二十一','二十二','二十三'];
  const list=document.getElementById('flame-list'),host=document.getElementById('flame-art'),root=document.querySelector('.page-atmosphere'),status=document.getElementById('status');
  const images=new Map();let rank=19,generation=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  flames.forEach((f,i)=>{const item=document.createElement('li'),button=document.createElement('button');button.type='button';button.dataset.rank=i+1;button.innerHTML='<span>'+String(i+1).padStart(2,'0')+'</span>'+f[0];button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>choose(i+1));item.append(button);list.append(item);});
  async function choose(next){
    rank=next;const request=++generation,f=flames[rank-1],plate=Math.ceil(rank/6),cell=(rank-1)%6;
    document.getElementById('flame-name').textContent=f[0];document.getElementById('rank').textContent=String(rank).padStart(2,'0');
    document.getElementById('rank-label').textContent='异火榜 · 第'+chinese[rank-1];document.getElementById('description').textContent=f[1];
    document.getElementById('basis').textContent=f[3]||'依据已知色彩与形态创作；不是动画官方原图。';
    document.documentElement.style.setProperty('--accent',f[2]);document.documentElement.style.setProperty('--glow',f[2]);
    list.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.rank===rank)));
    const url='assets/heavenly-flames/plate-'+String(plate).padStart(2,'0')+'-v1.png';document.getElementById('original').href=url;
    status.textContent='正在载入原图…';
    try{
      let pending=images.get(plate);
      if(!pending){pending=(async()=>{const image=new Image();image.src=url;await image.decode();return image;})();images.set(plate,pending);pending.catch(()=>images.delete(plate));}
      const image=await pending;if(request!==generation)return;
      host.style.backgroundImage='url("'+url+'")';host.style.backgroundPosition=(cell%3*50)+'% '+(Math.floor(cell/3)*100)+'%';
      window.JiaArtLoops.flame(host,image,rank);
      const target=new URL(location.href);target.searchParams.set('flame',String(rank));history.replaceState(null,'',target);
      updateStatus();
    }catch(_){if(request===generation)status.textContent='图版未能加载，请重新选择重试。';}
  }
  function updateStatus(){status.textContent=reduced.matches?'静态原图 · 系统已开启减少动态':root.dataset.artMotion==='still'?'静态原图':root.dataset.artRenderer==='still-fallback'?'静态原图 · 当前设备未启用 WebGL':'实时流焰 · 生成 / 上升 / 冷却';}
  document.getElementById('previous').addEventListener('click',()=>choose(rank===1?23:rank-1));document.getElementById('next').addEventListener('click',()=>choose(rank===23?1:rank+1));
  document.getElementById('motion').addEventListener('click',e=>{const on=root.dataset.artMotion==='still';root.dataset.artMotion=on?'loop':'still';e.currentTarget.setAttribute('aria-pressed',String(on));e.currentTarget.textContent=on?'动态':'静态';window.JiaArtLoops.wake();updateStatus();});
  document.getElementById('tone').addEventListener('click',e=>{const light=document.body.dataset.tone!=='light';document.body.dataset.tone=light?'light':'dark';e.currentTarget.setAttribute('aria-pressed',String(light));e.currentTarget.textContent=light?'深色':'浅色';});
  new MutationObserver(updateStatus).observe(root,{attributes:true,attributeFilter:['data-art-renderer']});reduced.addEventListener('change',updateStatus);
  const requested=Number(new URLSearchParams(location.search).get('flame'));choose(Number.isInteger(requested)&&requested>=1&&requested<=23?requested:19);
})();
