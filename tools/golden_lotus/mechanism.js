import * as T from 'three';

export const STAGES = [[0,1.7,'金脉唤醒'],[1.7,3.4,'榫锁退让'],[3.4,5.7,'外瓣翻展'],[5.7,8.3,'层间换位'],[8.3,10.6,'内莲绽放'],[10.6,12.6,'莲心开门'],[12.6,14.4,'穿入莲境']];
const TAU=Math.PI*2, mix=T.MathUtils.lerp;
const at=(t,a,b)=>{const x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x);};
const NOISE=`
float hash3(vec3 p){p=fract(p*.3183099+vec3(.13,.37,.73));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.54;for(int i=0;i<4;i++){v+=a*noise3(p);p=p*2.03+vec3(3.1,1.7,2.9);a*=.49;}return v;}`;

function bevel(points,depth=.11){
  const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
  return new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:3,steps:1});
}
function tube(points,radius=.012,segments=28){return new T.TubeGeometry(new T.CatmullRomCurve3(points),segments,radius,5,false);}
function arc(radius,a,b,z=0,thickness=.025){
  return tube(Array.from({length:25},(_,i)=>new T.Vector3(Math.cos(mix(a,b,i/24))*radius,Math.sin(mix(a,b,i/24))*radius,z)),thickness,40);
}
function merge(parts){
  const p=[],n=[],uv=[],ix=[];let offset=0;
  for(const g of parts){
    p.push(...g.attributes.position.array);n.push(...g.attributes.normal.array);
    uv.push(...(g.attributes.uv?.array||new Array(g.attributes.position.count*2).fill(0)));
    if(g.index)for(const i of g.index.array)ix.push(i+offset);else for(let i=0;i<g.attributes.position.count;i++)ix.push(i+offset);
    offset+=g.attributes.position.count;g.dispose();
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);return g;
}

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
  const metal=material(new T.MeshPhysicalMaterial({color:0xb78a35,metalness:.93,roughness:.27,clearcoat:.8,clearcoatRoughness:.19}));
  const inset=material(new T.MeshStandardMaterial({color:0x2c2116,metalness:.9,roughness:.3}));
  const edge=material(new T.MeshStandardMaterial({color:0xeacb83,metalness:.88,roughness:.21}));
  const light=material(new T.MeshStandardMaterial({color:0xffedbc,emissive:0xffc66a,emissiveIntensity:1.7,metalness:.35,roughness:.2}));
  const jewel=material(new T.MeshPhysicalMaterial({color:0xceded0,metalness:.55,roughness:.17,clearcoat:1,iridescence:.65,iridescenceIOR:1.4,iridescenceThicknessMinimum:180,iridescenceThicknessMaximum:480}));
  const u={time:fireUniforms.time,heat:fireUniforms.intensity,portal:{value:0},burst:{value:0}};
  const post=compositor(renderer,u);
  const sectors=[],latches=[],rods=[],blades=[];
  const a=new T.TorusGeometry(.098,.023,6,14);a.rotateY(Math.PI/2);a.translate(0,-.13,-.08);
  const b=a.clone();b.translate(0,.26,0);
  const axle=new T.CylinderGeometry(.049,.049,.38,10);axle.rotateZ(Math.PI/2);axle.translate(0,0,-.08);
  const joint=merge([a,b,axle]);
  petals.forEach(({hinge})=>mesh(joint,metal,hinge));
  for(let tier=0;tier<3;tier++){
    const crown=new T.Group();crown.position.z=-1.1-tier*.48;root.add(crown);
    const radius=1.48+tier*.91,parts=[arc(radius,-.23,.23,0,.067),arc(radius+.19,-.23,.23,-.06,.032)];
    for(let j=-2;j<=2;j++){
      const q=bevel([[radius-.04,-.018],[radius+.08,-.04],[radius+.17,0],[radius+.08,.04],[radius-.04,.018]],.07);q.rotateZ(j*.089);parts.push(q);
    }
    const geo=merge(parts);
    for(let i=0;i<12;i++){
      const g=new T.Group();g.rotation.z=i*TAU/12;crown.add(g);mesh(geo,metal,g);
      const marking=mesh(arc(radius+.11,-.17,.17,.075,.008),light,g);
      sectors.push({crown,g,marking,index:i,tier,angle:i*TAU/12});
    }
  }
  const latchGeo=bevel([[-.24,-.075],[.13,-.075],[.28,0],[.13,.075],[-.24,.075]],.12);
  const socketGeo=bevel([[-.34,-.14],[.18,-.14],[.36,0],[.18,.14],[-.34,.14]],.16);
  const rodGeo=new T.CylinderGeometry(.026,.026,1,8),sleeveGeo=new T.CylinderGeometry(.048,.048,.52,10);
  const outerPetals=petals.filter(p=>p.tier===0);
  outerPetals.forEach((petal,i)=>{
    const angle=i*TAU/outerPetals.length+Math.PI/2,g=new T.Group();g.rotation.z=angle;g.position.z=-1.05;root.add(g);
    const socket=mesh(socketGeo,inset,g);socket.position.x=1.38;
    const latch=mesh(latchGeo,metal,g);latch.position.set(1.38,0,.13);
    const dot=mesh(new T.OctahedronGeometry(.053,0),jewel,latch);dot.position.set(.15,0,.13);
    latches.push({g,latch,index:i});rods.push({rod:mesh(rodGeo,edge),sleeve:mesh(sleeveGeo,inset),petal,angle});
  });
  const iris=new T.Group();iris.position.z=1.46;root.add(iris);
  const bladeGeo=bevel([[.04,-.04],[.34,-.12],[.83,.02],[1.18,.37],[1.1,.58],[.82,.62],[.42,.25]],.09);bladeGeo.translate(-1.08,0,0);
  const rail=tube([new T.Vector3(-1,0,.14),new T.Vector3(-.6,.12,.14),new T.Vector3(-.19,.44,.14),new T.Vector3(0,.4,.14)],.012,16);
  for(let i=0;i<8;i++){
    const g=new T.Group();g.rotation.z=i*TAU/8;iris.add(g);
    const hinge=new T.Group();hinge.position.set(1.08,0,i*.012);g.add(hinge);
    const blade=mesh(bladeGeo,metal,hinge);blade.castShadow=true;blade.receiveShadow=true;mesh(rail,light,hinge);
    blades.push({hinge,index:i});
  }

  // A small advected volume is emitted from each actual petal surface. Birth,
  // transport, cooling and death happen together; no tongue grows forever.
  const emitters=petals.filter(p=>p.tier<5&&p.index%2===0);
  const flameGeo=new T.InstancedBufferGeometry().copy(new T.PlaneGeometry(1,1,8,18));flameGeo.instanceCount=emitters.length;
  const anchors=new Float32Array(emitters.length*3),seeds=new Float32Array(emitters.length*4),activation=new Float32Array(emitters.length);
  emitters.forEach((_,i)=>seeds.set([i*1.738,.38+(i%7)*.027,.38+(i%5)*.11,i%8],i*4));
  flameGeo.setAttribute('activation',new T.InstancedBufferAttribute(activation,1));
  flameGeo.setAttribute('anchor',new T.InstancedBufferAttribute(anchors,3));flameGeo.setAttribute('seed',new T.InstancedBufferAttribute(seeds,4));
  const flameMat=material(new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
    uniforms:{time:u.time,heat:u.heat},
    vertexShader:`attribute vec3 anchor;attribute vec4 seed;attribute float activation;varying vec2 st;varying vec4 fs;varying float vEmission;uniform float time;${NOISE}
    void main(){st=uv;fs=seed;vEmission=activation;float age=fract(time*seed.y+seed.x),height=1.45*seed.z*(.6+sin(age*3.14159)*.7);vec3 p=position;p.x*=.68*seed.z;p.y=(uv.y+age*.48-.12)*height;
    p.x+=(noise3(vec3(seed.x,uv.y*2.8-time*1.1,time*.37))-.5)*.65*uv.y;p.z+=sin(uv.y*5.+seed.x+time)*.1;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p+anchor,1.);}`,
    fragmentShader:`varying vec2 st;varying vec4 fs;varying float vEmission;uniform float time,heat;${NOISE}
    void main(){float age=fract(time*fs.y+fs.x),y=st.y,x=(st.x-.5)*2.;vec3 adv=vec3(x*2.8,y*4.2-time*(1.7+fs.y),fs.x+time*.13);
    float turbulence=fbm(adv+vec3(2.3,0,4.1));float curl=(fbm(adv*.7)-.5)*1.2*y;float width=pow(max(0.,1.-y),.85)*(.2+turbulence*.92);
    float body=1.-abs(x-curl)/max(.025,width);float density=body+turbulence*.8-.52-y*.18;
    float fire=smoothstep(.02,.62,density)*smoothstep(0.,.13,y)*(1.-smoothstep(.68,1.,y));
    fire*=smoothstep(0.,.16,age)*(1.-smoothstep(.64,1.,age))*heat*vEmission;
    float core=pow(max(0.,1.-abs(x-curl)*2.5),5.)*(1.-y);vec3 color=mix(vec3(3.3,.65,.09),vec3(5.5,3.5,1.15),core);
    if(fs.w<.5)color=mix(color,vec3(1.,2.8,3.5),.16);gl_FragColor=vec4(color,fire*.66);}`
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
  const yAxis=new T.Vector3(0,1,0);let frame=0;
  return {
    pose(t){
      const retreat=at(t,11.9,13.6),passage=at(t,12.6,14.4);
      u.burst.value=at(t,8.3,11.5)*(1-at(t,13.7,14.4));u.portal.value=at(t,12.75,14.4)*(Math.max(1,camera.aspect)*.7+.2);
      latches.forEach(({g,latch,index})=>{const k=at(t,1.65+index%4*.14,2.6+index%4*.14);latch.position.x=1.38+k*.51;latch.rotation.z=-k*.16;g.position.z=-1.05-retreat*1.8;});
      sectors.forEach(({crown,g,marking,index,tier,angle})=>{
        const k=at(t,1.65+tier*.32,3+tier*.32),clear=at(t,4.2+tier*.4,6.7+tier*.4);crown.rotation.z=(tier%2?-1:1)*k*.26;
        const slide=clear*(.3+tier*.12)+passage*2.2;g.position.set(Math.cos(angle)*slide,Math.sin(angle)*slide,Math.sin(k*Math.PI)*.15-retreat*.9);marking.visible=t>index*.06;
      });
      blades.forEach(({hinge,index})=>{const k=at(t,10.7+index*.06,12.45+index*.025);hinge.rotation.z=-k*1.12;hinge.rotation.y=k*.74;hinge.position.x=1.08+k*.32+passage*2.3;});
      iris.rotation.z=at(t,10.2,11.4)*.23;iris.position.z=1.46-passage*1.8;
      root.updateMatrixWorld(true);
      rods.forEach(({rod,sleeve,petal,angle})=>{
        const start=new T.Vector3(Math.cos(angle)*1.32,Math.sin(angle)*1.32,-1.1-retreat*1.5);
        const end=petal.hinge.localToWorld(new T.Vector3(.7,0,-.14));root.worldToLocal(end);
        const delta=end.sub(start),length=delta.length();rod.position.copy(start).addScaledVector(delta,.5);rod.scale.y=length;rod.quaternion.setFromUnitVectors(yAxis,delta.normalize());
        sleeve.position.copy(start).addScaledVector(delta,Math.min(.25,length/2));sleeve.quaternion.copy(rod.quaternion);
      });
      emitters.forEach((p,i)=>{const q=surface(.86,Math.sin(i*7.1)*.36,p.layer.length,p.layer.width);q.z+=.16;p.hinge.localToWorld(q);root.worldToLocal(q);anchors.set(q.toArray(),i*3);activation[i]=at(t,p.layer.start+.3+p.delay,p.layer.end+p.delay);});flameGeo.attributes.anchor.needsUpdate=true;flameGeo.attributes.activation.needsUpdate=true;
      renderer.shadowMap.autoUpdate=frame++%2===0;
      return {stage:STAGES.find(s=>t>=s[0]&&t<s[1])?.[2],latches:latches.length,bearingSectors:sectors.length,irisBlades:blades.length,flames:emitters.length};
    },
    resize(w,h){post.resize(w,h);},render(){post.render(scene,camera);},
    dispose(){key.shadow.dispose();post.dispose();}
  };
}
