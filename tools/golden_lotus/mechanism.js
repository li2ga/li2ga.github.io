import * as T from 'three';
import {addSealingFormation} from './seal-formation.js';

export const STAGES = [[0,1.7,'万火汇流'],[1.7,3.9,'晶柱凝形'],[3.9,6.25,'棱端抽展'],[6.25,7.9,'五边构件归位'],[7.9,10.6,'晶瓣成莲'],[10.6,12.6,'金焰莲阵'],[12.6,14.4,'穿入莲境']];
const at=(t,a,b)=>T.MathUtils.smoothstep(t,a,b);
const NOISE=`
float hash3(vec3 p){p=fract(p*.3183099+vec3(.13,.37,.73));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.54;for(int i=0;i<4;i++){v+=a*noise3(p);p=p*2.03+vec3(3.1,1.7,2.9);a*=.49;}return v;}`;

// Separate HDR emission from the sharp physical surface. Only highlights above
// the threshold bloom; the lotus body is never blurred or downsampled.
function compositor(renderer,u){
  const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType});
  const blurTargets=Array.from({length:4},()=>new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false}));
  const world=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1),geo=new T.PlaneGeometry(2,2),quad=new T.Mesh(geo);world.add(quad);
  const vertex='varying vec2 st;void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const blur=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{image:{value:null},direction:{value:new T.Vector2()},extract:{value:0}},vertexShader:vertex,
    fragmentShader:`varying vec2 st;uniform sampler2D image;uniform vec2 direction;uniform float extract;
    vec3 sampleAt(vec2 p){vec3 c=texture2D(image,p).rgb;float l=max(c.r,max(c.g,c.b));return c*mix(1.,smoothstep(1.1,2.8,l),extract);}
    void main(){vec3 c=sampleAt(st)*.227027;c+=(sampleAt(st+direction*1.384615)+sampleAt(st-direction*1.384615))*.316216;
    c+=(sampleAt(st+direction*3.230769)+sampleAt(st-direction*3.230769))*.070270;gl_FragColor=vec4(c,1.);}`});
  const final=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{image:{value:target.texture},bloom:{value:blurTargets[1].texture},wide:{value:blurTargets[3].texture},portal:u.portal,aspect:{value:1}},vertexShader:vertex,
    fragmentShader:`varying vec2 st;uniform sampler2D image,bloom,wide;uniform float portal,aspect;
    void main(){vec3 c=texture2D(image,st).rgb+texture2D(bloom,st).rgb*.28+texture2D(wide,st).rgb*.22;
    float d=length((st-.5)*vec2(aspect,1.));float edge=1.-smoothstep(portal-.09,portal+.09,d);
    c=mix(c,vec3(5.),edge*step(.001,portal));gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  function pass(from,to,x,y,extract){blur.uniforms.image.value=from.texture;blur.uniforms.direction.value.set(x,y);blur.uniforms.extract.value=extract;quad.material=blur;renderer.setRenderTarget(to);renderer.render(world,camera);}
  return {
    resize(w,h){const size=renderer.getDrawingBufferSize(new T.Vector2());target.setSize(size.x,size.y);blurTargets.forEach((r,i)=>r.setSize(Math.max(1,Math.floor(size.x/(i<2?2:4))),Math.max(1,Math.floor(size.y/(i<2?2:4)))));final.uniforms.aspect.value=w/h;},
    render(scene,view){renderer.setRenderTarget(target);renderer.render(scene,view);pass(target,blurTargets[0],2/target.width,0,1);pass(blurTargets[0],blurTargets[1],0,2/blurTargets[0].height,0);pass(blurTargets[1],blurTargets[2],3/blurTargets[1].width,0,0);pass(blurTargets[2],blurTargets[3],0,3/blurTargets[2].height,0);quad.material=final;renderer.setRenderTarget(null);renderer.render(world,camera);},
    dispose(){target.dispose();blurTargets.forEach(r=>r.dispose());geo.dispose();blur.dispose();final.dispose();}
  };
}

export function addMechanism({renderer,scene,camera,root,mesh,material,geometries,petals,surface,fireUniforms}){
  const mobile=innerWidth<600;
  scene.background=new T.Color(0x050910);scene.environmentIntensity=.75;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const key=new T.DirectionalLight(0xffe8b7,1.65);key.position.set(-4,5,9);key.castShadow=true;
  key.shadow.mapSize.set(mobile?512:1024,mobile?512:1024);Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:1,far:25});
  key.shadow.bias=-.00018;key.shadow.normalBias=.025;scene.add(key);
  root.traverse(obj=>{if(obj.isMesh&&!obj.material.transparent){obj.castShadow=true;obj.receiveShadow=true;}});
  const u={time:fireUniforms.time,heat:fireUniforms.intensity,portal:{value:0},burst:{value:0}};
  const post=compositor(renderer,u);
  const formation=addSealingFormation({root,mesh,material,geometries,time:u.time,noise:NOISE});

  // A small advected volume is emitted from each actual petal surface. Birth,
  // transport, cooling and death happen together; no tongue grows forever.
  const emitters=petals.filter(p=>p.tier<5&&p.index%2===0);
  const flameGeo=new T.InstancedBufferGeometry().copy(new T.PlaneGeometry(1,1,8,18));flameGeo.instanceCount=emitters.length;
  const anchors=new Float32Array(emitters.length*3),seeds=new Float32Array(emitters.length*4),activation=new Float32Array(emitters.length);
  emitters.forEach((_,i)=>seeds.set([i*1.738,.38+(i%7)*.027,.38+(i%5)*.11,emitters[i].tier===2||emitters[i].tier===3?0:2],i*4));
  flameGeo.setAttribute('activation',new T.InstancedBufferAttribute(activation,1));
  flameGeo.setAttribute('anchor',new T.InstancedBufferAttribute(anchors,3));flameGeo.setAttribute('seed',new T.InstancedBufferAttribute(seeds,4));
  const flameMat=material(new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
    uniforms:{time:u.time,heat:u.heat},
    vertexShader:`attribute vec3 anchor;attribute vec4 seed;attribute float activation;varying vec2 st;varying vec4 fs;varying float vEmission;uniform float time;${NOISE}
    void main(){st=uv;fs=seed;vEmission=activation;float age=fract(time*seed.y+seed.x),height=2.25*seed.z*(.6+sin(age*3.14159)*.7);vec3 p=position;p.x*=.95*seed.z;p.y=(uv.y+age*.48-.12)*height;
    p.x+=(noise3(vec3(seed.x,uv.y*2.8-time*1.1,time*.37))-.5)*.65*uv.y;p.z+=sin(uv.y*5.+seed.x+time)*.1;vec2 radial=normalize(anchor.xy+vec2(.01));p.xy=radial*p.y+vec2(-radial.y,radial.x)*p.x;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p+anchor,1.);}`,
    fragmentShader:`varying vec2 st;varying vec4 fs;varying float vEmission;uniform float time,heat;${NOISE}
    void main(){float age=fract(time*fs.y+fs.x),y=st.y,x=(st.x-.5)*2.;vec3 adv=vec3(x*2.8,y*4.2-time*(1.7+fs.y),fs.x+time*.13);
    float turbulence=fbm(adv+vec3(2.3,0,4.1));float curl=(fbm(adv*.7)-.5)*1.2*y;float width=pow(max(0.,1.-y),.85)*(.2+turbulence*.92);
    float body=1.-abs(x-curl)/max(.025,width);float density=body+turbulence*.8-.52-y*.18;
    float fire=smoothstep(.02,.62,density)*smoothstep(0.,.13,y)*(1.-smoothstep(.68,1.,y));
    fire*=smoothstep(0.,.16,age)*(1.-smoothstep(.64,1.,age))*heat*vEmission;
    float core=pow(max(0.,1.-abs(x-curl)*2.5),5.)*(1.-y);vec3 color=mix(vec3(3.3,.65,.09),vec3(5.5,3.5,1.15),core);
    if(fs.w<.5)color=mix(color,vec3(1.6,1.9,4.2),.7);gl_FragColor=vec4(color,fire*.53);}`
  }));
  const flames=mesh(flameGeo,flameMat);flames.frustumCulled=false;
  const sparkGeo=new T.BufferGeometry(),sparkSeeds=[];
  const sparkCount=mobile?600:1300;
  for(let i=0;i<sparkCount;i++)sparkSeeds.push(i*.6180339,(i%37)/37,(i%71)/71,(i%17)/17);
  sparkGeo.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(sparkCount*3),3));sparkGeo.setAttribute('seed',new T.Float32BufferAttribute(sparkSeeds,4));
  const sparkMat=material(new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{time:u.time,heat:u.heat,burst:u.burst},
    vertexShader:`attribute vec4 seed;uniform float time,heat,burst;varying float opacity;void main(){
    float age=fract(time*(.12+seed.w*.12)+seed.x),a=seed.x*6.28318,r=1.+seed.y*4.8;vec3 p=vec3(cos(a)*r,sin(a)*r,-1.+seed.z*2.8);
    p.y+=age*(1.8+seed.y*1.8);p.x+=sin(age*5.+seed.x*23.)*.22;p.xy+=normalize(p.xy+.01)*burst*age*3.;
    vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((12.+seed.z*14.)/(-mv.z),.8,3.1);
    opacity=sin(age*3.14159)*heat*(.3+seed.w*.7);}`,
    fragmentShader:`varying float opacity;void main(){float a=(1.-smoothstep(.05,.5,length(gl_PointCoord-.5)))*opacity;gl_FragColor=vec4(4.,2.5,1.1,a);}`
  }));
  // Register the points geometry for the same resource ownership as meshes.
  geometries.add(sparkGeo);
  const sparks=new T.Points(sparkGeo,sparkMat);sparks.frustumCulled=false;root.add(sparks);
  const raysMat=material(new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:{time:u.time,heat:u.heat,burst:u.burst},vertexShader:'varying vec2 st;void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 st;uniform float time,heat,burst;${NOISE}
    void main(){vec2 p=(st-.5)*2.;float r=length(p),a=atan(p.y,p.x),curl=fbm(vec3(p*3.,time*.18));
    float ray=pow(.5+.5*sin(a*41.+curl*4.-r*8.+time*.4),28.);float fine=pow(.5+.5*sin(a*137.+curl*8.+r*7.-time*.3),70.);
    float alpha=(ray*.05+fine*.025)*(1.-smoothstep(.15,1.,r))*smoothstep(.12,.3,r)*heat*(.25+burst*.8);
    gl_FragColor=vec4(2.,.98,.28,alpha);}`
  }));
  const rays=mesh(new T.PlaneGeometry(22,22),raysMat);rays.position.z=-3.8;
  let frame=0;
  return {
    pose(t){
      u.burst.value=at(t,7.9,10.5)*(1-at(t,13.7,14.4));u.portal.value=at(t,12.75,14.4)*(Math.max(1,camera.aspect)*.7+.2);
      const detail=formation.pose(t);
      root.updateMatrixWorld(true);
      emitters.forEach((p,i)=>{const q=surface(.86,Math.sin(i*7.1)*.36,p.layer.length,p.layer.width);q.z+=.16;p.hinge.localToWorld(q);root.worldToLocal(q);anchors.set(q.toArray(),i*3);activation[i]=at(t,p.layer.start+.3+p.delay,p.layer.end+p.delay);});flameGeo.attributes.anchor.needsUpdate=true;flameGeo.attributes.activation.needsUpdate=true;
      renderer.shadowMap.autoUpdate=frame++%2===0;
      return {stage:STAGES.find(s=>t>=s[0]&&t<s[1])?.[2],flames:emitters.length,...detail};
    },
    resize(w,h){post.resize(w,h);},render(){post.render(scene,camera);},
    dispose(){key.shadow.dispose();post.dispose();}
  };
}
