/* art-loops.js */
"use strict";

// Internal image motion. Originals remain the still/reduced-motion fallback.
(() => {
  const root = document.querySelector('.page-atmosphere');
  if (!root) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const wide = matchMedia('(min-width: 1041px)');
  const entries = new Map();
  const textures = new Map();
  const surface = document.createElement('canvas');
  const period = 8000;
  let gl, program, locations, transportProgram, transportLocations, quad, attempted = false;
  let fuelEnabled = true;
  let coldSnowEnabled = true;
  const fieldSize = 768;
  let frame = 0, elapsed = 0, last = 0, lastPaint = 0, serial = 0;
  const stats = { paints: 0, ticks: 0, totalMs: 0, maxMs: 0 };
  // These profiles describe the existing painted shapes, not new replacement art.
  // family: plume, vortex, lotus, dragon, fan, mineral, dual current.
  const emperorProfiles = [
    {family:0,speed:1.12,bend:1.00,trail:.70,anchor:[.50,.35],head:[.50,.70],motion:'万色流焰'},
    {family:1,speed:.82,bend:1.18,trail:.35,anchor:[.50,.48],head:[.50,.48],motion:'向心吞卷'},
    {family:2,speed:.88,bend:.86,trail:.72,anchor:[.50,.37],head:[.50,.69],motion:'净莲瓣缘起焰'},
    {family:0,speed:1.78,bend:.82,trail:1.05,anchor:[.50,.18],head:[.50,.79],motion:'金丝急焰'},
    {family:0,speed:.91,bend:1.35,trail:.82,anchor:[.50,.22],head:[.50,.76],motion:'分枝生长'},
    {family:4,speed:1.23,bend:1.04,trail:.60,anchor:[.50,.36],head:[.50,.61],motion:'翼缘破焰'},
    {family:1,speed:.61,bend:.90,trail:.58,anchor:[.50,.34],head:[.50,.40],motion:'低回金涡'},
    {family:2,speed:1.04,bend:1.12,trail:.95,anchor:[.50,.34],head:[.50,.65],motion:'红莲逐瓣燃烧'},
    {family:3,speed:1.13,bend:1.35,trail:.65,anchor:[.43,.44],head:[.76,.76],motion:'紫龙脊焰游走'},
    {family:0,speed:1.93,bend:1.26,trail:1.02,anchor:[.43,.20],head:[.67,.72],motion:'斜掠风焰'},
    {family:0,speed:.97,bend:.88,trail:.78,anchor:[.48,.22],head:[.52,.80],motion:'冷白细焰'},
    {family:4,speed:1.55,bend:.76,trail:.65,anchor:[.50,.37],head:[.50,.65],motion:'龙首雷脉'},
    {family:5,speed:.67,bend:.56,trail:.54,anchor:[.50,.34],head:[.82,.35],motion:'龟甲地火流隙'},
    {family:3,speed:.81,bend:1.17,trail:.36,anchor:[.45,.39],head:[.72,.76],motion:'无形心焰游走'},
    {family:0,speed:1.09,bend:1.40,trail:.86,anchor:[.48,.21],head:[.53,.78],motion:'海潮上涌'},
    {family:6,speed:1.10,bend:1.06,trail:.74,anchor:[.50,.28],head:[.50,.69],motion:'水火错流'},
    {family:5,speed:.86,bend:.69,trail:.84,anchor:[.50,.30],head:[.50,.49],motion:'熔隙喷焰'},
    {family:3,speed:1.47,bend:1.36,trail:.84,anchor:[.51,.40],head:[.27,.72],motion:'风龙鬃焰'},
    {family:2,speed:.96,bend:1.08,trail:.94,anchor:[.50,.34],head:[.50,.67],motion:'青莲心焰上生'},
    {family:0,speed:.78,bend:1.45,trail:.86,anchor:[.50,.22],head:[.50,.75],motion:'毒焰卷枝'},
    {family:6,speed:.83,bend:1.15,trail:.40,anchor:[.50,.31],head:[.50,.73],motion:'阴阳两仪错流'},
    {family:4,speed:1.17,bend:1.15,trail:.75,anchor:[.51,.35],head:[.28,.69],motion:'兽首鬃翼流焰'},
    {family:0,speed:.74,bend:1.03,trail:.79,anchor:[.50,.19],head:[.50,.77],motion:'玄黄厚焰'}
  ];
  const classicEmperor = new URLSearchParams(location.search).get('flames') === 'classic';
  const crossings = 'IntersectionObserver' in window
    ? new IntersectionObserver(changes => { if (changes.some(change => change.isIntersecting)) wake(); }) : null;
  let visibilityWake = 0;

  const vertex = `attribute vec2 position; varying vec2 uv;
    void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
  const flameLayers = `
    bool hasFramework(){return (variant>4.5&&variant<5.5)||(variant>8.5&&variant<13.);}
    float goldMaterial(vec4 c){return smoothstep(.04,.17,c.r-c.b)*smoothstep(.01,.1,c.g-c.b);}
    vec4 artwork(vec2 p){
      if(p.x<0.||p.x>1.||p.y<0.||p.y>1.)return vec4(0.);
      return texture2D(picture,imageRect.xy+clamp(p,.0005,.9995)*imageRect.zw);
    }
    float burnerRoot(float x){
      if(variant>100.){
        // Lotus forms retain their lower petals. Other flames are gas all the
        // way down and have no persistent upper silhouette.
        if(abs(variant-103.)<.1||abs(variant-108.)<.1||abs(variant-119.)<.1)return .40;
        return .12;
      }
      if(variant>11.5&&variant<12.5)return .29+.24*pow(max(0.,1.-abs(x-.5)*2.),1.15);
      if(hasFramework())return .36+.15*exp(-pow((x-.5)*2.8,2.));
      if(variant<.5)return .70;
      if(variant>5.5&&variant<6.5)return .73-.11*exp(-pow((x-.5)*6.,2.));
      return .46+.08*exp(-pow((x-.5)*2.8,2.));
    }
    float flameRegion(vec2 p){
      float root=burnerRoot(p.x);
      float region=smoothstep(root-.025,root+.045,p.y);
      if(variant<.5){
        // This blue artwork has glass-like petals around a central flame.
        float width=.055+max(0.,p.y-.70)*.32;
        float central=1.-smoothstep(width,width+.025,abs(p.x-.515));
        region*=mix(central,1.,smoothstep(.78,.86,p.y));
      }
      return region;
    }
    float rigidMaterial(vec4 c){
      if(!hasFramework())return 0.;
      return goldMaterial(c)*smoothstep(.35,.7,c.a);
    }
    float movingMaterial(vec2 p,vec4 c){
      return flameRegion(p)*(1.-rigidMaterial(c));
    }
  `;
  // Lotus appearance restored from published revision fe08ca2. The separate
  // gallery transport and imagery/lamp motion retain their current behavior.
  const fragment = `precision highp float;
    uniform sampler2D picture, noiseField, heatField;
    uniform vec4 imageRect, motionProfile, motionShape;
    uniform float phase, mode, variant, flameClock;
    varying vec2 uv;
    ${flameLayers}
    float fireNoise(vec3 p){
      vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      vec2 q=i.xy+f.xy+.5+i.z*vec2(37.,17.);
      return mix(texture2D(noiseField,q/128.).r,texture2D(noiseField,(q+vec2(37.,17.))/128.).r,f.z);
    }
    float fireFbm(vec3 p){return fireNoise(p)*.57+fireNoise(p*2.03+7.1)*.29+fireNoise(p*4.17-3.8)*.14;}
    float detailFuel(vec2 at,vec4 color){
      // Warm fire is still fuel. Only artworks with a metal framework need
      // a material exclusion; applying it to gold/green flames freezes them.
      float height=smoothstep(.17,.60,at.y);
      float hot=smoothstep(.36,.82,max(max(color.r,color.g),color.b));
      float metal=hasFramework()?goldMaterial(color):0.;
      if(variant>4.5&&variant<5.5){
        float pale=1.-smoothstep(.03,.14,max(max(color.r,color.g),color.b)-min(min(color.r,color.g),color.b));
        metal=max(metal,pale*.72);
      }
      return height*hot*(1.-metal)*color.a;
    }
    vec4 detailSample(vec2 p){
      if(variant>30.&&variant<60.)return artwork(p);
      return texture2D(picture,p);
    }
    vec4 detailFlame(vec2 at){
      if(variant>30.&&variant<60.)at=(at-.5)/.86+.5;
      vec4 original=detailSample(at);
      bool fineBranches=variant>11.5&&variant<12.5;
      float rigidGold=0.;
      if(hasFramework()){
        // Classify the unshifted scaffold before a neighboring flame can move
        // into it. This protection never applies to the golden-fire artwork.
        rigidGold=goldMaterial(original)*smoothstep(.35,.7,original.a);
        if(rigidGold>.7)return vec4(original.rgb*original.a,original.a);
      }
      float t=flameClock;
      if(fineBranches)t*=.72;
      float h=smoothstep(.17,.90,at.y);
      // Upward advection and curling eddies move fire material, not the metal body.
      vec3 domain=vec3(at.x*23.,at.y*19.-t*1.22,t*.19+variant*3.1);
      float n=fireFbm(domain),n2=fireFbm(domain+vec3(11.1,3.7,5.2));
      vec2 curl=vec2(n2-.5,n-.5);
      float strength=1.;
      if(variant>1.5&&variant<3.5)strength=1.55;
      if(variant>5.5&&variant<6.5)strength=1.9;
      vec2 shift=vec2(curl.x*.040*h,curl.y*.025*h)*strength;
      // A slower coherent bend carries a whole tongue, while smaller eddies
      // travel inside it. Low and lateral tongues also receive some motion.
      shift.x+=sin(at.y*11.-t*1.4+variant)*.008*h*strength;
      if(fineBranches)shift*=.58;
      vec4 moving=detailSample(clamp(at-shift,0.,1.));
      float mask=max(detailFuel(at,original),detailFuel(at-shift,moving));
      mask*=1.-rigidGold;
      vec4 body=mix(original,moving,clamp(mask*1.25,0.,1.));
      // Short, colored wisps detach from actual hot pixels and rise through
      // the transparent margin. Sampling the source retains each phase's palette.
      vec3 emission=vec3(0.);float opacity=0.;
      float strand=fireFbm(vec3(at.x*81.+n2*2.,at.y*38.-t*3.4,variant*4.2));
      for(int i=1;i<=6;i++){
        float age=float(i)/6.;
        vec2 source=at-vec2((curl.x*.055+sin(at.y*31.-t*1.8)*.006)*age,.065*age);
        vec4 sampleColor=detailSample(clamp(source,0.,1.));
        float f=detailFuel(source,sampleColor);
        float d=f*smoothstep(.48+age*.08,.76,strand+.06*sin(age*19.-t))*(.18*(1.-age*.8));
        // Existing opaque material occludes trails; no halo over polished metal.
        d*=1.-original.a*.86;
        d*=1.-rigidGold;
        emission+=sampleColor.rgb*d;opacity+=d;
      }
      float stream=pow(max(0.,1.-abs(n-.53)*6.),8.);
      vec3 light=mix(body.rgb,vec3(1.),.22);
      body.rgb=clamp(body.rgb+light*(stream*.22-.032)*mask,0.,1.);
      vec3 rgb=body.rgb*body.a+emission*(1.-body.a*.5);
      float alpha=clamp(body.a+opacity*(1.-body.a),0.,1.);
      return vec4(min(rgb,vec3(alpha)),alpha);
    }
    vec4 emperorSample(vec2 p){
      vec4 color=artwork(p);
      // Generated atlas cells contain a few neighboring-tip specks at their
      // extreme borders. A transparent gutter isolates each complete sprite.
      float border=min(min(p.x,p.y),min(1.-p.x,1.-p.y));
      color.a*=smoothstep(.015,.055,border);
      return color;
    }
    vec4 emperorFlameDetail(vec2 point){
      vec2 at=(point-.5)/.86+.5;
      vec4 original=emperorSample(at);
      float rank=variant-30.,family=motionProfile.x;
      float t=flameClock*motionProfile.y;
      vec2 center=motionShape.xy,delta=at-center;
      float radius=length(delta),angle=atan(delta.y,delta.x);
      float height=smoothstep(center.y-.09,.90,at.y);
      float edge=smoothstep(.045,.38,radius);
      vec3 domain=vec3(at.x*17.,at.y*15.-t*1.5,rank*5.3+t*.17);
      float n=fireFbm(domain),m=fireNoise(domain+vec3(7.2,3.1,5.7));
      vec2 shift=vec2(0.);
      float flowing=1.,stream=at.y*27.-t*5.;
      float bright=max(max(original.r,original.g),original.b);
      if(family<.5){
        // Coherent tongues bend from their roots; fine eddies travel upward.
        float branches=abs(rank-5.)<.1||abs(rank-20.)<.1?1.:0.;
        float wave=sin(at.y*12.-t*2.3+sin(at.x*11.+t*.7));
        shift=vec2((wave*.019+(m-.5)*.044)*height,(n-.5)*.030*height);
        shift.x+=branches*.012*sin(at.x*24.+at.y*15.-t*1.7)*height;
        if(abs(rank-10.)<.1){shift.x+=.021*height*sin(at.y*18.-t*2.8);stream+=at.x*18.;}
        if(abs(rank-15.)<.1){shift.x+=.012*sin(at.y*24.-t*2.1)*height;}
      }else if(family<1.5){
        // Differential curl and inward-running ridges; the card never rotates.
        float twist=(.12*sin(radius*25.+t*2.)+.05*(m-.5))*edge;
        vec2 tangent=vec2(-delta.y,delta.x);
        shift=tangent*twist+normalize(delta+vec2(.0001))*.012*sin(radius*32.+t*3.1)*edge;
        flowing=edge;stream=radius*47.+t*5.2+angle*2.;
      }else if(family<2.5){
        // The calyx stays planted. Separate petal sectors flex out of phase.
        float petal=sin(angle*7.+radius*9.-t*1.45);
        float fixedBase=1.-smoothstep(center.y-.08,center.y+.06,at.y);
        shift=normalize(delta+vec2(.0001))*(.012*petal+.013*(m-.5))*edge;
        shift+=vec2(.016*sin(at.y*16.-t*2.2)+(m-.5)*.025,(n-.5)*.025)*height;
        shift*=1.-fixedBase*.72;stream=radius*39.-t*4.8+sin(angle*6.);
      }else if(family<3.5){
        // Protect the painted head; a traveling spinal wave reaches the tail.
        float head=exp(-dot(at-motionShape.zw,at-motionShape.zw)*105.);
        float side=motionShape.z<.5?-1.:1.;
        float spine=at.x*11.*side+at.y*5.-t*2.05;
        shift=vec2(.016*sin(spine*.79)+(m-.5)*.014,.023*sin(spine)+(n-.5)*.014);
        shift*=1.-head*.90;stream=at.x*24.*side+at.y*12.-t*5.1;
        flowing=.22+.78*(1.-head);
      }else if(family<4.5){
        // Rigid head/core, independently rippling fan, wing and mane edges.
        float head=exp(-dot(at-motionShape.zw,at-motionShape.zw)*105.);
        vec2 tangent=vec2(-delta.y,delta.x);
        shift=tangent*.07*sin(radius*18.-t*2.5+angle*3.)*edge;
        shift+=vec2((m-.5)*.030,(n-.5)*.026)*edge;
        shift*=1.-head*.87;stream=radius*42.-t*6.1+angle*3.;
        flowing=.20+.80*edge*(1.-head*.8);
      }else if(family<5.5){
        // Dark shell and volcanic rock are solid. Only their hot seams flow.
        flowing=smoothstep(.40,.88,bright)*smoothstep(.035,.22,original.r-original.b);
        shift=vec2((m-.5)*.023,(n-.5)*.024)*flowing;
        stream=at.y*36.+at.x*19.-t*4.7;
      }else{
        // Red/blue and black/white remain distinct material streams.
        float side=abs(rank-21.)<.1?mix(-1.,1.,smoothstep(.30,.66,bright))
          :mix(-1.,1.,smoothstep(-.08,.08,original.r-original.b));
        shift=vec2(.023*sin(at.y*17.-t*2.2*side)+(m-.5)*.014,
                   .014*cos(at.x*16.+at.y*7.-t*1.8*side));
        shift*=.30+.70*height;stream=at.y*29.-t*5.*side+at.x*13.;
      }
      shift*=motionProfile.z;
      // Resample the complete native artwork; no fuel mask cuts into its body.
      vec4 body=emperorSample(at-shift);
      float ridge=pow(max(0.,sin(stream+(n-.5)*4.)),13.);
      float glint=(ridge*.15-.018)*flowing;
      if(abs(rank-12.)<.1){
        float flash=pow(max(0.,sin(t*6.1+floor(angle*4.))),24.);
        glint+=flash*pow(max(0.,sin(radius*63.-angle*5.+t*14.)),20.)*.32;
      }
      // Multiplication preserves black-white separation and the source palette.
      body.rgb=clamp(body.rgb*(1.+glint),0.,1.);
      vec3 emitted=vec3(0.);float opacity=0.;
      for(int i=1;i<=3;i++){
        float lane=float(i),age=fract(t*(.39+lane*.09)+rank*.173+lane*.317+at.x*.75);
        float life=smoothstep(0.,.18,age)*(1.-smoothstep(.65,1.,age));
        vec2 travel=vec2((m-.5)*.065+sin(t*1.7+at.y*18.+lane)*.014,.10);
        if(family> .5&&family<1.5)travel=-normalize(delta+vec2(.0001))*.085+vec2(-delta.y,delta.x)*.11;
        if(abs(rank-10.)<.1)travel.x+=.055;
        vec2 source=at-shift-travel*age;
        vec4 fuel=emperorSample(source);
        float hot=smoothstep(.43,.86,max(max(fuel.r,fuel.g),fuel.b));
        float shred=smoothstep(.48,.78,fireNoise(vec3(at.x*69.+lane*13.,at.y*45.-t*3.5,rank*7.+lane)));
        float amount=fuel.a*hot*life*shred*.24*motionProfile.w;
        amount*=1.-body.a*.94;
        emitted+=fuel.rgb*amount;opacity+=amount;
      }
      float alpha=clamp(body.a+opacity*(1.-body.a),0.,1.);
      vec3 rgb=body.rgb*body.a+emitted*(1.-body.a*.7);
      return vec4(min(rgb,vec3(alpha)),alpha);
    }
    vec4 livingFlame(vec2 at){
      vec4 original=artwork(at);
      float rigid=rigidMaterial(original);
      if(rigid>.7)return vec4(original.rgb*original.a,original.a);
      // Remove the original flame pixels from the fixed image. This is a
      // replacement layer, not an extra plume over permanently visible tips.
      float burning=movingMaterial(at,original);
      vec4 stable=vec4(original.rgb*original.a,original.a)*(1.-burning);
      vec4 fire=texture2D(heatField,at);
      float density=fire.a;
      float alpha=smoothstep(.045,.63,density);
      alpha*=smoothstep(0.,.025,at.x)*(1.-smoothstep(.975,1.,at.x))*(1.-smoothstep(.87,.995,at.y));
      vec3 color=fire.rgb/max(density,.003);
      color*=mix(.94,1.1,smoothstep(.05,.65,density));
      fire=vec4(clamp(color,0.,1.)*alpha,alpha);
      vec4 result=stable+fire*(1.-stable.a);
      return vec4(min(result.rgb,vec3(result.a)),result.a);
    }
    void main(){
      if(mode>.5&&mode<1.5){
        if(variant>30.&&variant<60.&&motionProfile.y>0.)gl_FragColor=emperorFlameDetail(uv);
        else gl_FragColor=variant<100.?detailFlame(uv):livingFlame(uv);
        return;
      }
      vec2 p=uv;
      float t=phase;
      float light=0.;
      vec3 fringeLight=vec3(0.);
      if(mode>6.5){
        // Keep the emperor's face and central armor rigid. Only long hair and
        // the loose lateral robes flex; a fine glint crosses silver engraving.
        float edge=smoothstep(.12,.40,abs(uv.x-.50));
        float hair=smoothstep(.73,.90,uv.y)*smoothstep(.10,.30,abs(uv.x-.46));
        float cloth=max(edge*(1.-smoothstep(.63,.77,uv.y)),hair);
        p.x+=cloth*(.004*sin(uv.y*24.-flameClock*1.7)+.002*sin(uv.y*43.+flameClock*.91));
        p.y+=cloth*.0028*sin(uv.x*29.-flameClock*1.23);
        light=.065*pow(max(0.,sin(uv.x*7.+uv.y*11.-flameClock*.54)),26.);
        // The dialogue PV shows cyan/violet light traveling through long hair
        // and cool silver reflections, with the face kept clear and solid.
        float face=1.-smoothstep(.07,.14,length((uv-vec2(.47,.76))*vec2(1.,.8)));
        float shoulder=edge*smoothstep(.58,.70,uv.y)*(1.-smoothstep(.81,.87,uv.y));
        float sheen=.5+.5*sin(uv.y*19.+uv.x*9.-flameClock*.87);
        fringeLight=mix(vec3(.29,.65,1.),vec3(.80,.35,1.),sheen)
          *(.032*hair+.020*shoulder)*(1.-face);
      }else if(mode>5.5&&mode<6.5){
        // The lamp has its own wick: keep its metal body fixed, move only fire.
        float flame=smoothstep(.515,.555,uv.y)*smoothstep(.63,.74,uv.x);
        p.x+=flame*(.008*sin(uv.y*29.-flameClock*3.1)+.003*sin(uv.y*57.+flameClock*2.3));
        p.y+=flame*.004*sin(uv.x*31.-flameClock*2.7);
        light=flame*.045*sin(uv.y*35.-flameClock*4.1);
      }else if(mode<.5){
        // Branches and feathers flex locally, rather than moving a rigid card.
        float edge=smoothstep(.1,.9,uv.y);
        p.x+=.006*edge*sin(uv.y*19.+t)*sin(uv.x*8.-t);
        p.y+=.0025*sin(uv.x*21.+t*2.)*edge;
        light=.025*sin(uv.y*28.-t*2.);
      }else if(mode<2.5){
        // Water/mist ripples travel through the dragon and river details.
        p.x+=.009*sin(uv.y*40.-t*3.)+.003*sin(uv.y*77.+t*2.);
        p.y+=.004*sin(uv.x*27.-t*2.);
        light=.055*sin(uv.y*42.+uv.x*18.-t*3.);
      }else if(mode<3.5){
        // A narrow glint crosses rigid architecture and metal without bending it.
        float line=sin(uv.x*5.+uv.y*8.-t);
        light=.16*pow(max(0.,line),20.);
      }else if(mode<4.5){
        // The moon remains solid; its luminous detail shimmers gently.
        float radius=length(uv-vec2(.5));
        light=.035*sin(t)+.07*pow(max(0.,sin(radius*37.-t*2.)),12.);
      }else{
        // Soft paper, cloud and petals retain their center with a living edge.
        float edge=smoothstep(.08,.42,abs(uv.x-.5));
        p.y+=.008*edge*sin(uv.x*18.+t);
        p.x+=.0025*sin(uv.y*24.-t*2.);
        light=.035*sin(uv.x*17.+uv.y*8.-t);
      }
      vec4 c=texture2D(picture,clamp(p,0.,1.));
      float brightness=dot(c.rgb,vec3(.2126,.7152,.0722));
      vec3 tint=mix(c.rgb,vec3(1.),.35);
      c.rgb=clamp(c.rgb+tint*light*(.25+.75*brightness),0.,1.);
      c.rgb=clamp(c.rgb+fringeLight*smoothstep(.28,.74,brightness),0.,1.);
      gl_FragColor=vec4(c.rgb*c.a,c.a);
    }`;

  // The state is the actual source-colored flame layer. The original upper
  // flame is excised from the stable layer before this material is composited.
  const transport = `precision highp float;
    uniform sampler2D previous, picture, noiseField;
    uniform vec4 imageRect;
    uniform vec2 texel;
    uniform float dt, clock, variant, inject, initialize;
    varying vec2 uv;
    ${flameLayers}
    float n(vec2 p){return texture2D(noiseField,p/128.).r;}
    float psi(vec2 p){
      return n(p*19.+vec2(clock*3.7,clock*2.1)+variant*9.7)*.65
        +n(p*47.-vec2(clock*4.1,clock*1.3))*.25
        +n(p*93.+vec2(clock*5.,-clock*2.))*.1;
    }
    vec2 velocity(vec2 p){
      float e=.009;
      vec2 curl=vec2(psi(p+vec2(0.,e))-psi(p-vec2(0.,e)),psi(p-vec2(e,0.))-psi(p+vec2(e,0.)))/(2.*e);
      float heat=texture2D(previous,clamp(p,0.,1.)).a;
      return vec2(-.06*(p.x-.5),.20+heat*.11)+curl*.025;
    }
    void main(){
      vec4 art=artwork(uv);
      float material=movingMaterial(uv,art);
      if(initialize>.5){gl_FragColor=vec4(art.rgb*art.a,art.a)*material;return;}
      vec2 v=velocity(uv);
      vec2 source=uv-dt*velocity(uv-v*dt*.5);
      vec4 old=texture2D(previous,clamp(source,0.,1.));
      // A bounded edge-restoration term keeps native painted flame filaments
      // from dissolving into a low-resolution, single-color smoke overlay.
      vec4 local=(texture2D(previous,clamp(source+vec2(texel.x,0.),0.,1.))
                 +texture2D(previous,clamp(source-vec2(texel.x,0.),0.,1.))
                 +texture2D(previous,clamp(source+vec2(0.,texel.y),0.,1.))
                 +texture2D(previous,clamp(source-vec2(0.,texel.y),0.,1.)))*.25;
      old=clamp(old+(old-local)*.12,0.,1.);
      old.rgb=min(old.rgb,vec3(old.a));
      if(source.y<0.||source.y>1.||source.x<0.||source.x>1.)old=vec4(0.);
      float loss=variant>100.?.85:1.75;
      float consumption=variant>100.?.08:.16;
      float cooled=max(0.,old.a*exp(-dt*loss)-dt*consumption);
      float density=floor(cooled*255.+n(uv*127.+vec2(clock*19.,-clock*23.)))/255.;
      vec3 carried=old.rgb*(density/max(old.a,.003));
      float root=burnerRoot(uv.x);
      float zone=material*(1.-smoothstep(root+.035,root+.105,uv.y));
      float fine=n(uv*91.+vec2(clock*8.3,-clock*14.4)+variant*3.);
      float pulse=.16+.84*pow(smoothstep(.24,.77,fine),2.5);
      float a=clamp(inject*dt*30.*zone*art.a*pulse,0.,1.);
      gl_FragColor=vec4(carried*(1.-a)+art.rgb*a,density*(1.-a)+a);
    }`;

  function setup() {
    if (attempted) return !!gl;
    attempted = true;
    try {
      gl = surface.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      if (!gl) { root.dataset.artRenderer='still-fallback'; return false; }
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Image motion shader unavailable');
        return shader;
      };
      program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Image motion program unavailable');
      gl.useProgram(program);
      quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      locations = Object.fromEntries(['picture','phase','mode','variant','flameClock','noiseField','heatField','imageRect','motionProfile','motionShape'].map(name => [name, gl.getUniformLocation(program,name)]));
      gl.uniform1i(locations.picture, 0);
      gl.uniform1i(locations.heatField, 2);
      transportProgram=gl.createProgram();
      gl.attachShader(transportProgram,compile(gl.VERTEX_SHADER,vertex));
      gl.attachShader(transportProgram,compile(gl.FRAGMENT_SHADER,transport));
      gl.linkProgram(transportProgram);
      if(!gl.getProgramParameter(transportProgram,gl.LINK_STATUS))throw new Error('Flame transport unavailable');
      transportLocations=Object.fromEntries(['previous','picture','noiseField','imageRect','dt','clock','variant','inject','initialize','texel'].map(name=>[name,gl.getUniformLocation(transportProgram,name)]));
      gl.useProgram(transportProgram);
      gl.uniform1i(transportLocations.picture,0);gl.uniform1i(transportLocations.noiseField,1);gl.uniform1i(transportLocations.previous,2);
      gl.useProgram(program);
      const emptyField=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,emptyField);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
      // A shared deterministic scalar field replaces hundreds of hash operations
      // per native-resolution pixel; original art textures are never resized.
      const noisePixels=new Uint8Array(128*128*4);
      let noiseSeed=0x5a17c9;
      for(let i=0;i<noisePixels.length;i+=4){noiseSeed^=noiseSeed<<13;noiseSeed^=noiseSeed>>>17;noiseSeed^=noiseSeed<<5;noisePixels[i]=noisePixels[i+1]=noisePixels[i+2]=noiseSeed&255;noisePixels[i+3]=255;}
      const noiseTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,noiseTexture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,128,128,0,gl.RGBA,gl.UNSIGNED_BYTE,noisePixels);gl.uniform1i(locations.noiseField,1);gl.activeTexture(gl.TEXTURE0);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      surface.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        gl = null;
        textures.clear();
        root.dataset.artRenderer='still-fallback';
        entries.forEach(entry => show(entry, false));
      });
      root.dataset.artRenderer = 'webgl';
      return true;
    } catch (_) {
      gl = null;
      root.dataset.artRenderer = 'still-fallback';
      return false;
    }
  }

  function texture(image) {
    if (textures.has(image)) return textures.get(image);
    const next = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, next);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    textures.set(image, next);
    return next;
  }

  function show(entry, ready) {
    entry.host.classList.toggle('has-art-loop', ready);
    entry.canvas.hidden = !ready;
  }

  function enabled() {
    return root.dataset.artMotion !== 'still' && !document.hidden && !reduced.matches && (wide.matches||root.dataset.artScope==='gallery');
  }

  function bindQuad(next) {
    gl.useProgram(next);gl.bindBuffer(gl.ARRAY_BUFFER,quad);
    const p=gl.getAttribLocation(next,'position');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
  }

  function releaseFlow(entry) {
    if(entry.flow&&gl)entry.flow.pairs.forEach(p=>{gl.deleteFramebuffer(p.framebuffer);gl.deleteTexture(p.texture);});
    entry.flow=null;
  }

  function advanceFlow(entry,time,nativeProof) {
    if(!entry.flow){
      const minimum=entry.key.closest('[data-background-scene="emperor"]')?96:192;
      const width=Math.min(fieldSize,Math.max(minimum,entry.canvas.width));
      const height=Math.min(fieldSize,Math.max(minimum,entry.canvas.height));
      const pairs=Array.from({length:2},()=>{
        const t=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,t);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Flame field unavailable');
        gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
        return {texture:t,framebuffer:f};
      });
      entry.flow={pairs,index:0,time,steps:0,width,height};
    }
    const f=entry.flow;
    if(time<f.time){releaseFlow(entry);return advanceFlow(entry,time,nativeProof);}
    const span=Math.min(nativeProof?10000:140,time-f.time);
    const count=Math.max(f.steps===0?1:0,Math.ceil(span/(1000/30)));
    const dt=count?span/count/1000:0;
    bindQuad(transportProgram);
    gl.viewport(0,0,f.width,f.height);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture(entry.image));
    gl.uniform4fv(transportLocations.imageRect,entry.rect);
    gl.uniform1f(transportLocations.variant,entry.variant);
    gl.uniform1f(transportLocations.inject,fuelEnabled?1:0);
    gl.uniform2f(transportLocations.texel,1/f.width,1/f.height);
    for(let i=0;i<count;i++){
      const next=1-f.index;
      gl.bindFramebuffer(gl.FRAMEBUFFER,f.pairs[next].framebuffer);
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,f.pairs[f.index].texture);
      gl.uniform1f(transportLocations.dt,dt);
      gl.uniform1f(transportLocations.initialize,f.steps===0?1:0);
      gl.uniform1f(transportLocations.clock,(f.time+(i+1)*dt*1000)/1000+entry.seed*13.7);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);f.index=next;f.steps++;
    }
    f.time=time;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,f.pairs[f.index].texture);
  }

  function visible(entry) {
    if (!entry.key.isConnected || !entry.key.closest('[data-background-scene][data-active]')) return false;
    const box = entry.host.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.right > 0 && box.left < innerWidth && box.bottom > 0 && box.top < innerHeight;
  }

  function draw(entry, time, nativeProof=false) {
    try {
      const image = entry.image;
      const sourceWidth=image.naturalWidth*entry.rect[2],sourceHeight=image.naturalHeight*entry.rect[3];
      const displayScale=(entry.mode===1||entry.mode===7)&&!nativeProof
        ? Math.min(1,(devicePixelRatio||1)*Math.min(entry.host.clientWidth/sourceWidth,entry.host.clientHeight/sourceHeight)) : 1;
      const width=Math.max(1,Math.ceil(sourceWidth*displayScale));
      const height=Math.max(1,Math.ceil(sourceHeight*displayScale));
      if(entry.canvas.width!==width||entry.canvas.height!==height){entry.canvas.width=width;entry.canvas.height=height;}
      if (surface.width !== width || surface.height !== height) {
        surface.width = width;
        surface.height = height;
      }
      if(entry.mode===1&&entry.variant>=100)advanceFlow(entry,time,nativeProof);
      gl.viewport(0, 0, surface.width, surface.height);
      bindQuad(program);
      gl.uniform4fv(locations.imageRect,entry.rect);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture(image));
      gl.uniform1f(locations.phase, ((time / period + entry.seed) % 1) * Math.PI * 2);
      gl.uniform1f(locations.flameClock,time/1000+entry.seed*13.7);
      gl.uniform1f(locations.mode, entry.mode);
      gl.uniform1f(locations.variant, entry.variant);
      const personality=entry.variant>30&&entry.variant<60?emperorProfiles[entry.variant-31]:null;
      gl.uniform4fv(locations.motionProfile,personality&&!classicEmperor
        ?[personality.family,personality.speed,personality.bend,personality.trail]:[0,0,0,0]);
      gl.uniform4fv(locations.motionShape,personality?[...personality.anchor,...personality.head]:[.5,.3,.5,.7]);
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      // Checking after each orbiting sprite forces 24 GPU synchronizations.
      // This scene checks once after the complete frame instead.
      if (root.dataset.backgroundCurrent!=='emperor' && gl.getError() !== gl.NO_ERROR) throw new Error('Image motion rendering failed');
      entry.context.clearRect(0,0,entry.canvas.width,entry.canvas.height);
      entry.context.drawImage(surface,0,0);
      if(coldSnowEnabled&&entry.mode===1&&entry.variant===1)drawColdSnow(entry,time);
      if (entry.key.matches('img') && !entry.fullyRevealed) {
        const opacity=getComputedStyle(entry.image).opacity;
        entry.canvas.style.opacity=opacity;
        entry.fullyRevealed=Number(opacity)>=.999;
      }
      show(entry,true);
      entry.paints++;
      stats.paints++;
    } catch (_) {
      entry.failed = true;
      show(entry,false);
    }
  }

  // Restore the cold-lotus snowfall independently of the archived video player.
  // Snow has its own downward travel; it never rotates or resamples the artwork.
  function coldSnowParticle(index,milliseconds) {
    const t=milliseconds/1000,seed=index*.61803398875;
    const phase=(t*(.026+(index%5)*.004)+seed)%1;
    const x=.07+((index*.754877666)%1)*.86
      +.035*Math.sin(t*.53+index*2.1)+.018*Math.sin(t*1.17+index);
    return {x,y:phase*1.12-.06,size:.004+(index%4)*.0018,
            opacity:Math.sin(phase*Math.PI)*(.53+(index%3)*.11),angle:t*.23+index};
  }
  function drawColdSnow(entry,milliseconds) {
    const c=entry.context,w=entry.canvas.width,h=entry.canvas.height;
    c.save();c.strokeStyle='rgb(87,177,213)';c.lineWidth=Math.max(.7,w/600);
    for(let i=0;i<40;i++){
      const p=coldSnowParticle(i,milliseconds),size=w*p.size;
      c.save();c.translate(p.x*w,p.y*h);c.rotate(p.angle);c.globalAlpha=p.opacity;c.beginPath();
      for(let arm=0;arm<6;arm++){
        const a=arm*Math.PI/3,dx=Math.cos(a),dy=Math.sin(a);
        c.moveTo(0,0);c.lineTo(dx*size,dy*size);
        for(const side of [-1,1]){
          c.moveTo(dx*size*.62,dy*size*.62);
          c.lineTo(dx*size*.43+Math.cos(a+side*Math.PI/2)*size*.23,
                   dy*size*.43+Math.sin(a+side*Math.PI/2)*size*.23);
        }
      }
      c.stroke();c.restore();
    }
    c.restore();
  }

  function tick(now) {
    frame = 0;
    if (!enabled()) {
      entries.forEach(entry => show(entry,false));
      last = 0;
      return;
    }
    if (last) elapsed += Math.min(120, now-last);
    last = now;
    if (now-lastPaint >= 1000/(root.dataset.backgroundCurrent==='lotus'?60:24)-.4) {
      const start = performance.now();
      let uploads=0;
      for (const entry of entries.values()) {
        if (entry.failed || !visible(entry)) continue;
        if (!textures.has(entry.image)) {
          if (uploads>=1) continue;
          uploads++;
        }
        if (setup()) draw(entry,elapsed);
      }
      if(root.dataset.backgroundCurrent==='emperor'&&gl&&gl.getError()!==gl.NO_ERROR){
        entries.forEach(entry=>{if(visible(entry)){entry.failed=true;show(entry,false);}});
      }
      const duration = performance.now()-start;
      stats.ticks++;
      stats.totalMs += duration;
      stats.maxMs = Math.max(stats.maxMs,duration);
      lastPaint = now;
    }
    if (attempted && !gl) { last=0; return; }
    if ([...entries.values()].some(entry => !entry.failed && visible(entry))) frame = requestAnimationFrame(tick);
    else {
      last = 0;
      if (!crossings && [...entries.values()].some(entry=>entry.key.closest('[data-background-scene][data-active]'))) {
        visibilityWake=setTimeout(wake,500);
      }
    }
  }

  function wake() {
    window.JiaLotusVideos?.wake();
    clearTimeout(visibilityWake);
    if (!enabled()) {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      entries.forEach(entry => show(entry,false));
    } else if (!frame && entries.size) frame = requestAnimationFrame(tick);
  }

  function install(key,host,image,mode,variant=0,rect=[0,0,1,1]) {
    if (entries.get(key)?.image === image && entries.get(key)?.host === host&&entries.get(key)?.variant===variant) return;
    let entry = entries.get(key);
    if (entry) {
      releaseFlow(entry);
      crossings?.unobserve(entry.host);
      show(entry,false);
      entry.canvas.remove();
    } else {
      const canvas=document.createElement('canvas');
      canvas.className='art-loop-canvas';
      canvas.setAttribute('aria-hidden','true');
      canvas.hidden=true;
      const context=canvas.getContext('2d',{alpha:true});
      if (!context) return;
      entry={key,canvas,context,seed:(serial++*.173)%1,paints:0};
      entries.set(key,entry);
    }
    entry.host=host;
    entry.image=image;
    entry.mode=mode;
    entry.variant=variant;
    entry.rect=rect;
    entry.failed=false;
    entry.fullyRevealed=false;
    entry.canvas.width=image.naturalWidth;
    entry.canvas.height=image.naturalHeight;
    host.classList.add('art-loop-host');
    host.appendChild(entry.canvas);
    crossings?.observe(host);
    wake();
  }

  const subjects = { moon:4, sun:0, palace:3, scroll:5, 'star-sword':3, crane:0,
                     pine:0, blade:3, 'water-dragon':2, lamp:6, vine:5, mountain:2 };
  window.JiaArtLoops = {
    emperorFlame(host,image,rank) {
      const cell=(rank-1)%6,col=cell%3,row=Math.floor(cell/3);
      // Each form keeps its native artwork and receives its own local flow.
      host.dataset.flameMotion=emperorProfiles[rank-1].motion;
      install(host,host,image,1,30+rank,[col/3,(1-row)/2,1/3,1/2]);
    },
    emperor(host,image) {
      install(host,host,image,7);
    },
    flame(host,image,rank) {
      const cell=(rank-1)%6,col=cell%3,row=Math.floor(cell/3);
      install(host,host,image,1,100+rank,[col/3,(1-row)/2,1/3,1/2]);
    },
    lotus(element,stage,image) {
      if (window.JiaLotusVideos) { window.JiaLotusVideos.lotus(element,stage,image); return; }
      const host=element.querySelector(`[data-lotus-frame="${stage}"]`);
      if (host && image) install(element,host,image,1,stage);
    },
    imagery(image) {
      const object=image.closest('.imagery-object');
      if (object) install(image,image.parentElement,image,subjects[object.dataset.imageryObject]??0);
    },
    wake,
    emperorProfiles:()=>emperorProfiles.map((profile,i)=>({rank:i+1,...profile})),
    inspect() {
      return {lotusVideo:window.JiaLotusVideos?.inspect(),renderer:root.dataset.artRenderer||'not-needed',enabled:enabled(),periodMs:period,flameClock:'continuous',lotusRendererRevision:'fe08ca2',lotusUsesFuelField:false,coldSnow:{enabled:coldSnowEnabled,count:40,direction:'downward'},emperorMotion:{revision:'shape-directed-v2',classic:classicEmperor,profiles:emperorProfiles.length},flameModel:'original artwork with short source-colored tongues; gallery: source flame transport',fieldSize,fuelEnabled,flameFrameLimit:60,running:!!frame,ticks:stats.ticks,
              textureCount:textures.size,paints:stats.paints,meanTickMs:stats.ticks?stats.totalMs/stats.ticks:0,maxTickMs:stats.maxMs,
              entries:[...entries.values()].map(entry=>({type:entry.key.matches('[data-lotus-instance]')?'lotus':'imagery',subject:entry.key.closest('.imagery-object')?.dataset.imageryObject,
                stage:entry.variant,motion:entry.host.dataset.flameMotion,source:entry.image.currentSrc||entry.image.src,sourceWidth:entry.image.naturalWidth,sourceHeight:entry.image.naturalHeight,flowSteps:entry.flow?.steps||0,paints:entry.paints,visible:visible(entry),failed:!!entry.failed,width:entry.canvas.width,height:entry.canvas.height}))};
    },
    setFuel(value){fuelEnabled=!!value;},
    setColdSnow(value){coldSnowEnabled=!!value;},
    snowProbe(milliseconds){return Array.from({length:40},(_,i)=>coldSnowParticle(i,milliseconds));},
    flowProbe(){
      if(!gl)return [];
      return [...entries.values()].filter(e=>e.flow).map(e=>{
        gl.bindFramebuffer(gl.FRAMEBUFFER,e.flow.pairs[e.flow.index].framebuffer);
        const width=e.flow.width,height=e.flow.height;
        const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let mass=0,weightedY=0,upper=0,lower=0;
        for(let i=3;i<pixels.length;i+=4){const y=Math.floor(i/4/width)/height,a=pixels[i];mass+=a;weightedY+=a*y;if(y>.68)upper+=a;if(y<.4)lower+=a;}
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);
        return {stage:e.variant,steps:e.flow.steps,mass,centerY:weightedY/Math.max(mass,1),upper,lower};
      });
    },
    renderAt(milliseconds) {
      cancelAnimationFrame(frame); frame=0; last=0;
      if (setup()) entries.forEach(entry=>{if(!entry.failed&&visible(entry))draw(entry,milliseconds,true);});
    }
  };
  new MutationObserver(wake).observe(root,{attributes:true,attributeFilter:['data-background-current','data-background-layout','data-art-motion']});
  document.addEventListener('visibilitychange',wake);
  window.addEventListener('scroll',wake,{passive:true});
  window.addEventListener('resize',wake,{passive:true});
  reduced.addEventListener('change',wake);
  wide.addEventListener('change',wake);
})();

;
/* lotus-duel-light.js */
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
  const coreSparks=Array.from({length:25},(_,i)=>{
    const k=i+521;
    return {phase:hash(k*7),rate:.50+.62*hash(k*13),seed:tau*hash(k*23),
      root:(hash(k*9)-.5)*.081,spread:(hash(k*15)-.5)*.24,
      lift:.11+.23*hash(k*21),light:.64+.35*hash(k*17),size:1+1.45*hash(k*5)};
  });
  function corePoint(u,p,t){
    return [.5+p.root+p.spread*u*u+.024*Math.sin(u*7.3+p.seed-t*1.7)*u,
      .456-p.lift*(.72*u+.28*u*u)+.012*Math.sin(u*5+p.seed)*u];
  }
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
  window.drawLotusLight = (c, ms, front, dark, cold=false) => {
    const t=ms/1000;
    c.save();c.scale(1280,1280);c.lineCap='round';
    for(const p of orbit){
      const u=fract(p.phase+t*p.rate),pos=orbitPoint(u,p,t),x=Math.abs(pos[0]-.5);
      if(front ? (pos[1]<.55 || x<.285 || p.light<.52) : false)continue;
      const a=ease(0,.14,u)*(1-ease(.53,1,u))*(.36+.48*p.light)*(front?.49:1);
      trail(c,orbitPoint,u,p,t,a,.035+.075*p.light,dark,!cold&&p.light>.92);
    }
    if(front)for(const p of edge){
      const u=fract(p.phase+t*p.rate),a=ease(.02,.18,u)*(1-ease(.53,.93,u))*(dark?.83:.73);
      trail(c,edgePoint,u,p,t,a,.10+.055*p.light,dark,false);
    }
    if(!front)for(const p of rise){
      const u=fract(p.phase+t*p.rate);
      const a=ease(0,.15,u)*(1-ease(.54,1,u))*(.24+.66*p.light);
      trail(c,risePoint,u,p,t,a,.023+.045*p.light,dark,!cold&&p.light>.74&&u>.38);
    }
    if(cold&&!front)for(const p of coreSparks){
      const u=fract(p.phase+t*p.rate),a=ease(.05,.19,u)*(1-ease(.56,1,u))*(dark?.94:.77);
      trail(c,corePoint,u,p,t,a,.046+.037*p.light,dark,false);
    }
    c.restore();
  };
})();
;
/* lotus-cold-core.js */
// Register the projected volume to the crystalline cup, then let the front petals
// occlude it. A soft window admits the near half of the central plume into the cup.
(() => {
  const size = 1280;
  const near = document.createElement('canvas');
  near.width = near.height = size;
  const cup = near.getContext('2d');
  const mask = document.createElement('canvas');
  mask.width = mask.height = size;
  const matte = mask.getContext('2d');
  matte.save();matte.translate(640,502);matte.scale(120,172);
  const fade=matte.createRadialGradient(0,0,.27,0,0,1);
  for(const [at,alpha] of [[0,.83],[.53,.77],[.72,.55],[.88,.20],[1,0]])fade.addColorStop(at,`rgba(255,255,255,${alpha})`);
  matte.fillStyle=fade;matte.fillRect(-1,-1,2,2);matte.restore();
  // Below the inner-cup lip, the foreground crystal must stay unlit by the plume.
  matte.globalCompositeOperation='destination-in';
  const lip=matte.createLinearGradient(0,588,0,657);
  lip.addColorStop(0,'#fff');lip.addColorStop(.42,'rgba(255,255,255,.74)');lip.addColorStop(1,'rgba(255,255,255,0)');
  matte.fillStyle=lip;matte.fillRect(0,0,size,size);
  let rendered;
  function update(image){
    if(rendered===image)return;
    rendered=image;
    cup.clearRect(0,0,size,size);
    cup.drawImage(image,0,0,size,size);
    cup.globalCompositeOperation='destination-in';cup.drawImage(mask,0,0);
    cup.globalCompositeOperation='source-over';
  }
  function draw(c, image, front){
    if(!image)return;
    if(front)update(image);
    c.drawImage(front?near:image,0,0,size,size);
  }
  window.ColdLotusCore = {draw};
})();
;
/* lotus-review-effects.js */
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

  const sparks=Array.from({length:43},(_,i)=>({
    seed:rand(i+821),root:rand(i+862),phase:rand(i+901),speed:.44+.47*rand(i+963),
    h:.044+.17*rand(i+1078),sway:(rand(i+1200)-.5)*.112,point:rand(i+1351)
  }));
  function embers(c,t,profile,dark,front){
    const roots=profile.roots, branch=roots.length>6;
    c.save();c.scale(S,S);c.lineCap='round';
    for(const [i,p] of sparks.entries()){
      if(front && (p.point<.66 || i%3!==0))continue;
      const [x,y]=roots[Math.min(roots.length-1,Math.floor(p.root*roots.length))];
      const u=fract(p.phase+t*p.speed),h=p.h*(branch?.82:1);
      const opacity=Math.min(1,u*5)*Math.max(0,1-u)**1.5*(front?.30:.65);
      const curve=q=>[x+p.sway*q*q+.019*q*Math.sin(q*8.4+p.seed*6.28-t*1.9),y-h*q];
      const [px,py]=curve(u),[qx,qy]=curve(Math.max(0,u-(.045+p.point*.065)));
      const palette=profile.alt && x<.35?profile.alt:profile.alt2 && x>.56?profile.alt2:profile.colors;
      const color='#'+palette[dark?3:2];
      if(u<.006)continue;
      const g=c.createLinearGradient(qx,qy,px,py);
      g.addColorStop(0,color+'00');g.addColorStop(1,color);
      c.globalAlpha=opacity;c.strokeStyle=g;c.lineWidth=(1+p.point*1.6)/S;
      c.beginPath();c.moveTo(qx,qy);c.lineTo(px,py);c.stroke();
    }
    c.restore();
  }

  window.LotusReviewEffects={flakes,coldAir,embers,snowCount:snow.length};
})();
;
/* lotus-review-composite.js */
(() => {
  const size = 1280;

  function buffer() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    return canvas.getContext('2d');
  }

  function contained(ctx, image) {
    const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  }

  // The mask shapes only the light in front of the original illustration.
  function cupMask([x, y, rx, ry, bottom]) {
    const ctx = buffer();
    ctx.save();
    ctx.translate(size*x, size*y);
    ctx.scale(size*rx, size*ry);
    const fade = ctx.createRadialGradient(0, 0, .21, 0, 0, 1);
    for (const [at, a] of [[0,.71],[.46,.65],[.69,.39],[.9,.12],[1,0]]) {
      fade.addColorStop(at, 'rgba(255,255,255,'+a+')');
    }
    ctx.fillStyle = fade;
    ctx.fillRect(-1,-1,2,2);
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-in';
    const cutoff = ctx.createLinearGradient(0,(bottom-.052)*size,0,bottom*size);
    cutoff.addColorStop(0, '#fff');
    cutoff.addColorStop(1, 'transparent');
    ctx.fillStyle = cutoff;
    ctx.fillRect(0,0,size,size);
    return ctx.canvas;
  }

  const far = buffer();
  const near = buffer();
  const sky = far.createLinearGradient(0, 0, 0, .105*size);
  sky.addColorStop(0, 'transparent');
  sky.addColorStop(.16, 'transparent');
  sky.addColorStop(.54, 'rgba(255,255,255,.48)');
  sky.addColorStop(1, '#fff');
  let projectedFrame = null;

  function project(image) {
    if (image === projectedFrame) return far.canvas;
    far.clearRect(0,0,size,size);
    far.drawImage(image,0,0,size,size);
    far.globalCompositeOperation = 'destination-in';
    far.fillStyle = sky;
    far.fillRect(0,0,size,size);
    far.globalCompositeOperation = 'source-over';
    projectedFrame = image;
    return far.canvas;
  }

  function flames(ctx, image, mask, front, strength) {
    if (!image) return;
    const projection = project(image);
    ctx.save();
    ctx.globalAlpha = strength;
    if (front) {
      near.clearRect(0,0,size,size);
      near.drawImage(projection,0,0);
      near.globalCompositeOperation = 'destination-in';
      near.drawImage(mask,0,0);
      near.globalCompositeOperation = 'source-over';
      ctx.drawImage(near.canvas,0,0);
    } else {
      ctx.drawImage(projection,0,0);
    }
    ctx.restore();
  }

  function paint(ctx, {body, profile, mask, fire, cold, t, dark = false, showFire = true, snow = true, mist = true}) {
    ctx.clearRect(0, 0, size, size);
    if (cold && mist) LotusReviewEffects.coldAir(ctx, t, dark);
    if (showFire && cold) {
      ColdLotusCore.draw(ctx, fire, false);
      drawLotusLight(ctx, t * 1000, false, dark, true);
    } else if (showFire) {
      flames(ctx, fire, mask, false, 1);
      LotusReviewEffects.embers(ctx, t, profile, dark, false);
    }
    contained(ctx, body);
    if (showFire && cold) {
      ColdLotusCore.draw(ctx, fire, true);
      drawLotusLight(ctx, t * 1000, true, dark, true);
    } else if (showFire) {
      flames(ctx, fire, mask, true, .70);
      LotusReviewEffects.embers(ctx, t, profile, dark, true);
    }
    if (cold && snow) LotusReviewEffects.flakes(ctx, t, dark);
  }

  window.LotusReviewComposite = {cupMask, paint};
})();

;
/* lotus-atmosphere.js */
(() => {
  const root = document.querySelector('.page-atmosphere');
  const config = document.querySelector('#lotus-atmosphere-data');
  if (!root || !config || !window.ImageDecoder) return;

  const sources = JSON.parse(config.textContent);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const wide = matchMedia('(min-width: 1041px)');
  const entries = new Map();
  const fps = 24;
  const observer = new IntersectionObserver(wake);
  let animation = 0;
  let loading = null;

  function enabled() {
    return wide.matches && !reduced.matches && !document.hidden
      && root.dataset.backgroundCurrent === 'lotus' && root.dataset.artMotion !== 'still';
  }

  function visible({host}) {
    const box = host.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.right > 0 && box.left < innerWidth
      && box.bottom > 0 && box.top < innerHeight;
  }

  function show(entry, active) {
    entry.host.classList.toggle('has-art-loop', active);
    entry.canvas.hidden = !active;
  }

  function announce(entry, state) {
    if (entry.element.dataset.lotusParticleState === state) return;
    entry.element.dataset.lotusParticleState = state;
    root.dispatchEvent(new CustomEvent('lotusparticlesstate'));
  }

  async function load(entry) {
    const controller = new AbortController();
    loading = {entry, controller};
    const timeout = setTimeout(() => controller.abort('timeout'), 90000);
    let decoder;
    try {
      const response = await fetch(entry.source.media, {
        signal: controller.signal,
        priority: 'low'
      });
      if (!response.ok) throw new Error('Lotus effect unavailable');
      const bytes = await response.arrayBuffer();
      if (controller.signal.aborted) return;
      decoder = new ImageDecoder({data: bytes, type: 'image/webp', preferAnimation: true});
      await decoder.tracks.ready;
      if (controller.signal.aborted || entries.get(entry.element) !== entry) {
        decoder.close();
        return;
      }
      entry.count = decoder.tracks.selectedTrack.frameCount;
      entry.decoder = decoder;
    } catch (_) {
      decoder?.close();
      if (!controller.signal.aborted || controller.signal.reason === 'timeout') entry.failed = true;
      if (entry.failed) announce(entry, 'fallback');
    } finally {
      clearTimeout(timeout);
      loading = null;
      wake();
    }
  }

  function render(entry, now) {
    if (entry.decoding || now < entry.nextPaint) return;
    const {decoder, context, canvas, host, source} = entry;
    const next = entry.index < 0 ? 0 : (entry.index + 1) % entry.count;
    entry.nextPaint = Math.max(now - 1000 / fps, entry.nextPaint) + 1000 / fps;
    entry.decoding = true;
    decoder.decode({frameIndex: next}).then(({image}) => {
      try {
        if (entries.get(entry.element) !== entry || !enabled() || !visible(entry)) return;
        const pixels = Math.max(1, Math.min(1280, Math.ceil(Math.min(host.clientWidth, host.clientHeight) * devicePixelRatio)));
        if (canvas.width !== pixels || canvas.height !== pixels) canvas.width = canvas.height = pixels;
        const scale = pixels / 1280;
        context.setTransform(scale, 0, 0, scale, 0, 0);
        LotusReviewComposite.paint(context, {
          body: entry.image, profile: source.profile, mask: entry.mask,
          fire: image, cold: source.cold, t: entry.paints / fps + entry.phase
        });
        entry.index = next;
        entry.paints++;
        show(entry, true);
        announce(entry, 'ready');
      } finally {
        image.close();
      }
    }).catch(() => {
      if (entries.get(entry.element) !== entry) return;
      entry.failed = true;
      decoder.close();
      entry.decoder = null;
      show(entry, false);
      announce(entry, 'fallback');
    }).finally(() => { entry.decoding = false; });
  }

  function wake() {
    if (!enabled()) {
      cancelAnimationFrame(animation);
      animation = 0;
      entries.forEach(entry => show(entry, false));
      return;
    }
    if (!animation && entries.size) animation = requestAnimationFrame(tick);
  }

  function tick(now) {
    animation = 0;
    if (!enabled()) return;
    const active = [...entries.values()].filter(entry => !entry.failed && visible(entry));
    if (!loading) {
      const next = active.find(entry => !entry.decoder);
      if (next) void load(next);
    }
    for (const entry of active) if (entry.decoder) render(entry, now);
    if (active.some(entry => entry.decoder)) animation = requestAnimationFrame(tick);
  }

  function lotus(element, stage, image) {
    if (!element.matches('.motif-top-right, .motif-lower-right')) return false;
    const source = sources[stage];
    const host = element.querySelector('[data-lotus-frame="' + stage + '"]');
    if (!host || !source) return false;
    const old = entries.get(element);
    if (old) {
      if (old.stage === stage && old.image === image && !old.failed) return true;
      if (loading?.entry === old) loading.controller.abort();
      observer.unobserve(old.host);
      old.decoder?.close();
      show(old, false);
      old.canvas.remove();
      entries.delete(element);
    }
    const canvas = document.createElement('canvas');
    canvas.className = 'art-loop-canvas lotus-particle-canvas';
    canvas.hidden = true;
    canvas.setAttribute('aria-hidden', 'true');
    const context = canvas.getContext('2d');
    if (!context) return false;
    const entry = {
      element, stage, host, image, source, canvas, context,
      mask: source.cold ? null : LotusReviewComposite.cupMask(source.profile.cup),
      phase: Number(element.dataset.lotusInstance) * .31,
      index: -1, paints: 0, nextPaint: 0
    };
    entries.set(element, entry);
    host.appendChild(canvas);
    observer.observe(host);
    announce(entry, 'loading');
    wake();
    return true;
  }

  window.JiaLotusAtmosphere = {
    lotus,
    inspect: () => [...entries.values()].map(entry => ({
      instance: Number(entry.element.dataset.lotusInstance),
      stage: entry.stage, ready: !!entry.decoder, visible: visible(entry),
      paints: entry.paints, frame: entry.index, fallback: !!entry.failed
    }))
  };
  new MutationObserver(wake).observe(root, {
    attributes: true, attributeFilter: ['data-art-motion', 'data-background-current', 'data-background-layout']
  });
  document.addEventListener('visibilitychange', wake);
  reduced.addEventListener('change', wake);
  wide.addEventListener('change', wake);
})();
