import * as T from 'three';

export const PRELUDE = 9.2;
export const DURATION = 12.8;
export const STAGES = [
  {start:0,end:1.2,name:'枝脉苏醒',detail:'细枝生出，晶叶沿脉络靠近'},
  {start:1.2,end:2.5,name:'晶叶归位',detail:'散开的叶片转向，依次嵌入承座'},
  {start:2.5,end:4,name:'外框拼合',detail:'十二组支架分批收拢，接成外部骨架'},
  {start:4,end:5.3,name:'内层错位',detail:'中层翻面、前后换位，露出深处的机关'},
  {start:5.3,end:6.7,name:'逐级脱扣',detail:'光沿接缝传递，卡榫按次序退出'},
  {start:6.7,end:8.15,name:'中心开瓣',detail:'六瓣沿各自支点翻开，中心通道显露'},
  {start:8.15,end:9.2,name:'穿门入境',detail:'视点穿过多层构件，晶叶化为轨迹'},
  {start:9.2,end:12.8,name:'姓名显现',detail:'回到原来的轨迹汇聚、姓名显现与散落'}
];

const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => {x=clamp(x);return x*x*(3-2*x);};
const at = (t,a,b) => ease((t-a)/(b-a));
const mix = T.MathUtils.lerp;
const TAU = Math.PI*2;

function extrude(shape, depth=.07, bevel=.035) {
  const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:12});
  g.translate(0,0,-depth/2);
  const vertices=g.attributes.position;
  for(let i=0;i<vertices.count;i++)vertices.setZ(i,vertices.getZ(i)+.065*Math.sin(vertices.getX(i)*1.75)*(1-Math.min(.6,Math.abs(vertices.getY(i))*.4)));
  g.computeVertexNormals();
  return g;
}
function shape(points){const s=new T.Shape();points.forEach((p,i)=>i?s.lineTo(...p):s.moveTo(...p));s.closePath();return s;}
function leafShape(){
  const s=new T.Shape();s.moveTo(0,0);s.bezierCurveTo(.32,.19,.7,.16,1.02,0);s.bezierCurveTo(.66,-.15,.3,-.2,0,0);return s;
}
function irisShape(){
  const s=new T.Shape();s.moveTo(.12,-.04);s.bezierCurveTo(.54,.02,.88,.73,1.64,.87);s.bezierCurveTo(2.14,1,2.64,.82,2.63,.33);s.bezierCurveTo(2.2,.21,1.84,.36,1.43,.12);s.bezierCurveTo(.85,-.24,.54,-.26,.12,-.04);return s;
}
function leafWindow(){
  const s=new T.Shape();s.moveTo(1.75,-.1);s.bezierCurveTo(2.06,-.18,2.47,-.6,3.05,-.47);s.lineTo(3.6,0);s.lineTo(3.04,.47);s.bezierCurveTo(2.5,.6,2.04,.16,1.75,.1);s.closePath();
  const h=new T.Path();h.moveTo(2.19,0);h.bezierCurveTo(2.48,.14,2.75,.23,3.03,.24);h.lineTo(3.3,0);h.lineTo(3.03,-.24);h.bezierCurveTo(2.75,-.23,2.48,-.14,2.19,0);s.holes.push(h);return s;
}
function bladeRecess(){
  const s=new T.Shape();s.moveTo(.45,-.015);s.bezierCurveTo(.92,.12,1.25,.62,1.85,.73);s.bezierCurveTo(2.14,.77,2.37,.65,2.44,.42);s.bezierCurveTo(1.9,.51,1.39,.25,1.02,.05);s.bezierCurveTo(.78,-.07,.6,-.09,.45,-.015);return s;
}
function brushedSurface(){
  const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d');
  ctx.fillStyle='#808080';ctx.fillRect(0,0,256,128);
  for(let i=0;i<128;i++){const n=Math.sin(i*43.17)*.5+.5;ctx.fillStyle=`rgb(${115+n*26},${115+n*26},${115+n*26})`;ctx.fillRect(0,i,256,1);}
  const texture=new T.CanvasTexture(c);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(1,5);return texture;
}
function reflectionEnvironment(renderer){
  const c=document.createElement('canvas');c.width=1024;c.height=512;const x=c.getContext('2d');
  x.fillStyle='#dce5ee';x.fillRect(0,0,1024,512);
  const wash=x.createLinearGradient(0,0,0,512);wash.addColorStop(0,'#f7fbff');wash.addColorStop(.4,'#b4c5d5');wash.addColorStop(.6,'#435a70');wash.addColorStop(1,'#dfeaf4');x.fillStyle=wash;x.fillRect(0,0,1024,512);
  for(const [left,width] of [[75,90],[365,55],[690,145],[975,30]]){x.fillStyle='#fff';x.fillRect(left,28,width,340);}
  x.fillStyle='#263e54';x.fillRect(235,80,105,350);x.fillStyle='#e6d6ac';x.fillRect(550,30,75,240);
  const tex=new T.CanvasTexture(c);tex.mapping=T.EquirectangularReflectionMapping;tex.colorSpace=T.SRGBColorSpace;
  const pmrem=new T.PMREMGenerator(renderer);const env=pmrem.fromEquirectangular(tex).texture;tex.dispose();pmrem.dispose();return env;
}

export async function createVault(canvas){
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,innerWidth<600?1:1.25));
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();scene.environment=reflectionEnvironment(renderer);scene.environmentIntensity=1.05;
  const camera=new T.PerspectiveCamera(48,1,.05,65);
  const root=new T.Group();scene.add(root);
  const machining=brushedSurface();
  const materials={
    silver:new T.MeshPhysicalMaterial({color:0xc5d5e4,metalness:.97,roughness:.22,clearcoat:.7,clearcoatRoughness:.14,bumpMap:machining,bumpScale:.008}),
    edge:new T.MeshStandardMaterial({color:0xb9d1df,metalness:.82,roughness:.3}),
    dark:new T.MeshPhysicalMaterial({color:0x364f64,metalness:.96,roughness:.27,clearcoat:.5,bumpMap:machining,bumpScale:.006}),
    gold:new T.MeshPhysicalMaterial({color:0xd9b566,metalness:.96,roughness:.19,clearcoat:.8,bumpMap:machining,bumpScale:.005}),
    crystal:new T.MeshPhysicalMaterial({color:0xbce6f8,metalness:.4,roughness:.12,transmission:.22,thickness:.3,ior:1.35,clearcoat:1}),
    light:new T.MeshStandardMaterial({color:0xfff2ce,emissive:0xffdf9a,emissiveIntensity:.3,metalness:.35,roughness:.25})
  };
  scene.add(new T.HemisphereLight(0xf4faff,0xc6d6e5,.8));
  const key=new T.DirectionalLight(0xfffaf0,2.5);key.position.set(-4,7,9);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=7;key.shadow.camera.bottom=-7;key.shadow.camera.near=.2;key.shadow.camera.far=30;key.shadow.bias=-.0002;key.shadow.normalBias=.035;scene.add(key);
  const rim=new T.DirectionalLight(0xc5e9ff,1.5);rim.position.set(6,-3,6);scene.add(rim);
  const stage=new T.Mesh(new T.PlaneGeometry(60,60),new T.ShadowMaterial({color:0x66809a,opacity:.09}));stage.position.z=-3.6;stage.receiveShadow=true;scene.add(stage);
  const resources=new Set();
  function mesh(geometry,material,parent=root){resources.add(geometry);const m=new T.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function tube(points,radius,material,parent){
    const curve=new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v)));
    return mesh(new T.TubeGeometry(curve,Math.max(12,points.length*7),radius,5,false),material,parent);
  }
  // All fittings are seated on a shaft or a panel. No free-floating ornamental
  // bolts: the housing, bearing and retaining cap share a visible load path.
  const bearingGeo=new T.TorusGeometry(.118,.026,6,16);
  const spindleGeo=new T.CylinderGeometry(.077,.077,.23,12);
  const capGeo=new T.CylinderGeometry(.105,.105,.035,6);
  function bearing(parent,x,y,z){
    const g=new T.Group();g.position.set(x,y,z);parent.add(g);
    mesh(bearingGeo,materials.dark,g);
    const spindle=mesh(spindleGeo,materials.gold,g);spindle.rotation.x=Math.PI/2;
    const cap=mesh(capGeo,materials.silver,g);cap.rotation.x=Math.PI/2;cap.position.z=.135;
    return g;
  }
  const branchRoots=[];
  for(let i=0;i<6;i++){
    const g=new T.Group();g.rotation.z=i*TAU/6;g.position.z=-1.45;root.add(g);
    const paths=[[[.24,0,0],[1,.1,0],[2.2,.25,-.12],[3.55,.12,-.08],[4.85,.45,0]],[[1.8,.2,0],[2.4,.8,-.05],[3.1,1.2,-.1],[3.8,1.17,-.08]],[[2.9,.14,-.1],[3.5,-.5,.04],[4.3,-.67,.13]],[[.95,.12,0],[1.7,-.35,-.12],[2.3,-.38,-.1]]];
    const stems=paths.map((p,j)=>tube(p,j===0?.027:.013,materials.gold,g));
    branchRoots.push({g,stems});
  }
  const leaves=[];const leafGeo=extrude(leafShape(),.045,.022);
  for(let i=0;i<30;i++){
    const sector=i%6,level=Math.floor(i/6),angle=sector*TAU/6+(level%2?.2:-.16);
    const radius=2.1+level*.53;
    const pivot=new T.Group();root.add(pivot);const body=mesh(leafGeo,materials.crystal,pivot);
    body.rotation.z=angle+.35;body.scale.set(.9+level*.08,.85,1);
    const vein=tube([[.08,0,.065],[.48,.015,.075],[.9,0,.06]],.008,materials.gold,body);
    leaves.push({pivot,body,vein,angle,radius,delay:(i%6)*.075+level*.065});
  }
  const outer=new T.Group();outer.position.z=-.8;root.add(outer);
  const supports=[];
  const supportGeo=extrude(shape([[3.65,-.2],[3.98,-.35],[4.6,-.24],[4.95,0],[4.6,.24],[3.98,.35],[3.65,.2]]),.13,.045);
  const supportInset=extrude(shape([[3.78,-.07],[4.09,-.19],[4.57,-.13],[4.82,0],[4.57,.13],[4.09,.19],[3.78,.07]]),.04,.02);
  for(let i=0;i<12;i++){
    const radial=new T.Group();radial.rotation.z=i*TAU/12;outer.add(radial);
    const hinge=new T.Group();hinge.position.x=3.65;radial.add(hinge);
    const plate=mesh(supportGeo,materials.silver,hinge);plate.position.x=-3.65;
    const inset=mesh(supportInset,materials.gold,plate);inset.position.z=.095;
    const socket=mesh(supportInset,materials.dark,plate);socket.position.set(.64,0,.13);socket.scale.set(.85,.72,.8);socket.position.x=.64;
    const crown=mesh(supportInset,materials.silver,plate);crown.position.set(.9,0,.16);crown.scale.set(.79,.47,.65);
    bearing(plate,3.88,0,.15);
    const link=tube([[3.66,-.22,0],[3.6,-.52,0],[3.94,-.79,0],[4.3,-.87,0]],.028,materials.gold,plate);
    const link2=link.clone();link2.scale.y=-1;plate.add(link2);
    supports.push({hinge,radial,delay:(i%3)*.16+Math.floor(i/3)*.045});
  }
  const middle=new T.Group();middle.position.z=-.1;root.add(middle);
  const ribs=[];const ribGeo=extrude(leafWindow(),.11,.035);
  const crystalGeo=extrude(shape([[2.36,0],[2.97,-.18],[3.26,0],[2.97,.18]]),.09,.02);
  for(let i=0;i<12;i++){
    const radial=new T.Group();radial.rotation.z=i*TAU/12+TAU/24;middle.add(radial);
    const hinge=new T.Group();hinge.position.x=2.65;radial.add(hinge);
    const rib=mesh(ribGeo,materials.silver,hinge);rib.position.x=-2.65;
    const crystal=mesh(crystalGeo,materials.crystal,rib);crystal.position.z=.025;
    bearing(rib,2.1,0,.12);
    // A closed fork surrounds the crystal; the gold rail follows its edge.
    tube([[2.26,-.12,.13],[2.67,-.35,.13],[3.03,-.31,.13],[3.43,0,.13]],.012,materials.gold,rib);
    tube([[1.84,0,.115],[2.25,.19,.12],[2.72,.37,.115],[3.03,.34,.115],[3.46,0,.12]],.014,materials.gold,rib);
    const pin=mesh(new T.CylinderGeometry(.065,.065,.68,10),materials.gold,hinge);pin.position.set(0,0,.02);
    ribs.push({radial,hinge,crystal,delay:(i%4)*.1});
  }
  const iris=new T.Group();iris.position.z=.65;root.add(iris);
  const blades=[];const irisGeo=extrude(irisShape(),.16,.045);irisGeo.translate(-2.62,0,0);
  const recessGeo=extrude(bladeRecess(),.028,.012);recessGeo.translate(-2.62,0,0);
  for(let i=0;i<6;i++){
    const radial=new T.Group();radial.rotation.z=i*TAU/6;iris.add(radial);
    const hinge=new T.Group();hinge.position.set(2.62,0,i*.018);radial.add(hinge);
    mesh(irisGeo,materials.silver,hinge);
    const recess=mesh(recessGeo,materials.dark,hinge);recess.position.z=.15;
    const enamel=mesh(recessGeo,materials.crystal,hinge);enamel.scale.set(.87,.72,1);enamel.position.set(-.15,.08,.177);
    bearing(hinge,-.12,.31,.18);
    // Stepped ribs read as a machined spine, with the recess between them.
    for(let j=0;j<5;j++){
      const x=-1.63+j*.235,y=.38+j*.049;
      tube([[x-.055,y-.13,.183],[x,y,.195],[x+.065,y+.1,.183]],.011,materials.gold,hinge);
    }
    tube([[-2.34,-.015,.1],[-1.55,.34,.105],[-.9,.64,.12],[-.34,.64,.12],[-.08,.38,.11]],.018,materials.gold,hinge);
    tube([[-2.11,.005,.112],[-1.38,.24,.115],[-.75,.42,.115],[-.3,.41,.12]],.008,materials.edge,hinge);
    const axle=mesh(new T.CylinderGeometry(.078,.078,.48,12),materials.gold,hinge);axle.position.x=-.03;
    const latch=new T.Group();latch.position.set(2.7,-.38,.18);radial.add(latch);
    const latchMat=materials.gold.clone();
    mesh(extrude(shape([[-.24,-.085],[.15,-.085],[.26,0],[.15,.085],[-.24,.085]]),.14,.018),latchMat,latch);
    const gem=mesh(new T.OctahedronGeometry(.095),materials.crystal,latch);gem.position.z=.12;
    blades.push({radial,hinge,latch,latchMat,delay:i*.115});
  }
  const heart=new T.Group();heart.position.z=.95;root.add(heart);
  const heartGem=mesh(new T.OctahedronGeometry(.27,0),materials.crystal,heart);heartGem.scale.z=1.65;
  const heartMount=mesh(new T.CylinderGeometry(.37,.46,.17,12),materials.dark,heart);heartMount.rotation.x=Math.PI/2;heartMount.position.z=-.12;
  const bezel=mesh(new T.TorusGeometry(.32,.034,8,24),materials.gold,heart);bezel.position.z=.02;
  for(let i=0;i<6;i++){const a=i*TAU/6;tube([[Math.cos(a)*.46,Math.sin(a)*.46,-.12],[Math.cos(a)*.35,Math.sin(a)*.35,.05],[Math.cos(a)*.27,Math.sin(a)*.27,.16]],.021,materials.silver,heart);}
  const sparkGeometry=new T.BufferGeometry();const sparks=[];
  for(let i=0;i<48;i++){const a=i*2.3999632,r=1.5+(i%11)*.4;sparks.push(Math.cos(a)*r,Math.sin(a)*r,-2+(i%7)*.3);}
  sparkGeometry.setAttribute('position',new T.Float32BufferAttribute(sparks,3));resources.add(sparkGeometry);
  const sparkMat=new T.PointsMaterial({color:0xe9d2a3,size:.022,transparent:true,opacity:.65,sizeAttenuation:true,depthWrite:false});const dust=new T.Points(sparkGeometry,sparkMat);root.add(dust);
  const lightPulse=new T.PointLight(0xffeac3,0,7,2);lightPulse.position.z=1.1;root.add(lightPulse);
  let width=0,height=0,latestTime=0;
  function resize(){width=canvas.clientWidth;height=canvas.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();pose(latestTime);}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  function pose(t){
    latestTime=t;
    const alive=at(t,0,.4)*(1-at(t,8.85,9.2));root.visible=alive>0;stage.visible=alive>0;
    // Camera waypoints are indexed to stages, with a deliberate pause before
    // the central lock opens. Only the final move travels through the aperture.
    const keys=[[0,1.6,-3.6,12.8],[1.2,.9,-2.5,11.9],[2.5,-1.2,1.55,11],[4,1.5,.65,10.7],[5.3,.2,.12,10.5],[6.7,0,0,10.3],[8.15,0,0,8.7],[9.2,0,0,-1.4]];
    let a=keys[0],b=keys[1];for(let i=0;i<keys.length-1;i++){if(t>=keys[i][0]){a=keys[i];b=keys[i+1];}}
    const k=at(t,a[0],b[0]);camera.position.set(mix(a[1],b[1],k),mix(a[2],b[2],k),mix(a[3],b[3],k));
    camera.lookAt(0,0,Math.min(-1.8,camera.position.z-2));camera.rotation.z=mix(-.16,0,at(t,0,5.3));
    root.rotation.z=mix(-.12,0,at(t,0,2.5));
    branchRoots.forEach(({g,stems},i)=>{
      const grow=at(t,i*.065,1.1+i*.045);g.scale.setScalar(Math.max(.001,grow));
      g.rotation.y=.035*Math.sin(i+t)* (1-at(t,1.2,2.5));
      g.position.z=mix(-1.45,-2.15,at(t,6.8,8.8));
      stems.forEach((m,j)=>m.visible=grow>.06+j*.12);
    });
    leaves.forEach(({pivot,body,angle,radius,delay},i)=>{
      const q=at(t,.55+delay,2.05+delay),release=at(t,7.65+(i%6)*.065,8.85+(i%6)*.03);
      const r=mix(radius+2.8,radius,q)+release*1.8;
      pivot.position.set(Math.cos(angle)*r,Math.sin(angle)*r,mix(2.5+(i%4)*.35,-1.32,q)+release*5);
      pivot.rotation.set((1-q)*1.7+release*.6,(1-q)*Math.sin(i)*1.5,release*(i%2?.6:-.6));
      body.scale.z=mix(.4,1,q);pivot.visible=t>.35+delay&&t<9.15;
    });
    supports.forEach(({hinge,delay},i)=>{
      const q=at(t,2.15+delay,3.2+delay),lift=at(t,7.55+i*.045,8.9);
      hinge.position.x=3.65+(1-q)*1.9+lift*.6;
      hinge.rotation.y=mix(i%2?1.35:-1.35,0,q)+lift*(i%2?-.55:.55);
      hinge.rotation.z=mix(i%2?-.35:.35,0,q);hinge.visible=t>1.9+delay;
    });
    outer.rotation.z=mix(-TAU/24,0,at(t,2.6,3.95));outer.position.z=-.8-mix(0,.4,at(t,4,5.3));
    middle.rotation.z=mix(-TAU/24,TAU/24,at(t,4,5.1));middle.position.z=mix(-.55,.1,at(t,4,5.1));
    ribs.forEach(({hinge,delay},i)=>{
      const q=at(t,3.5+delay,4.6+delay),turn=at(t,4.15+delay,4.65+delay)-at(t,4.65+delay,5.1+delay),unlock=at(t,6.3+delay,7.8+delay);
      hinge.position.x=2.65+(1-q)*.9+unlock*.72;
      hinge.rotation.y=(1-q)*1.3+(i%2?1:-1)*turn*.8+unlock*(i%2?.42:-.42);
      hinge.visible=t>3.15+delay;
    });
    iris.rotation.z=mix(-.3,0,at(t,3.3,4.9));
    blades.forEach(({hinge,latch,latchMat,delay},i)=>{
      const arrive=at(t,3.3+delay*.5,4.5+delay*.4),unlock=at(t,5.3+delay,5.85+delay),open=at(t,6.65+delay*.65,7.65+delay*.65);
      hinge.position.x=2.62+(1-arrive)*.6+open*.42;hinge.rotation.y=(1-arrive)*.65-open*1.22;
      hinge.rotation.z=open*.24;hinge.visible=t>3.1+delay*.5;
      latch.position.x=2.7+unlock*.48;latch.position.z=.18+unlock*.15;latch.rotation.y=-unlock*.55;
      latch.visible=t>4.8;const flash=at(t,5.2+delay,5.42+delay)*(1-at(t,5.6+delay,6.08+delay));
      latchMat.emissive.setHex(0xffdb8a);latchMat.emissiveIntensity=flash*.75;
    });
    const heartOn=at(t,3.9,4.6),heartOff=at(t,6.6,7.3);
    heart.scale.setScalar(Math.max(.001,heartOn*(1-heartOff)));heart.rotation.z=mix(-.5,0,at(t,4,5.3));heartGem.rotation.y=t*.2;
    lightPulse.intensity=at(t,5.2,5.6)*(1-at(t,6.6,7.6))*2;
    dust.rotation.z=t*.012;sparkMat.opacity=.4*alive;
    canvas.style.opacity=String(alive);
    renderer.render(scene,camera);
    return {time:t,stage:STAGES.findIndex(s=>t<s.end),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,camera:camera.position.toArray(),hinge:blades[0].hinge.rotation.y,latch:blades[0].latch.position.x};
  }
  pose(4.6);
  await renderer.compileAsync(scene,camera);
  pose(0);
  return {pose,resize,dispose(){observer.disconnect();resources.forEach(g=>g.dispose());Object.values(materials).forEach(m=>m.dispose());machining.dispose();blades.forEach(b=>b.latchMat.dispose());sparkMat.dispose();scene.environment.dispose();stage.geometry.dispose();stage.material.dispose();renderer.dispose();}};
}
