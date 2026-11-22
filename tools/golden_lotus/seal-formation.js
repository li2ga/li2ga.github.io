import * as T from 'three';

const TAU = Math.PI * 2;
const mix = T.MathUtils.lerp;
const at = (t, a, b) => T.MathUtils.smoothstep(t, a, b);

// A bounded, authored sequence: axial crystal bundle -> radial keyed arms ->
// nested pentagonal crowns. The arms and their end caps share one transform.
// Their apparent motion is real displacement through depth, not a flat spin.
export function addSealingFormation({root, mesh, material, geometries, time, noise}) {
  const gold = material(new T.MeshPhysicalMaterial({color: 0xe6bb67, metalness: .91,
    roughness: .23, clearcoat: 1, clearcoatRoughness: .16,
    emissive: 0xa76b24, emissiveIntensity: .16}));
  const glow = material(new T.MeshStandardMaterial({color: 0xffebba, metalness: .65,
    roughness: .21, emissive: 0xffcc79, emissiveIntensity: 1.3}));
  const crystal = material(new T.MeshPhysicalMaterial({color: 0x7574b9, metalness: .55,
    roughness: .16, clearcoat: 1, iridescence: .55,
    emissive: 0x514b9e, emissiveIntensity: .35}));
  crystal.onBeforeCompile = shader => {
    shader.uniforms.sealTime = time;
    shader.vertexShader = 'varying vec2 sealUV;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nsealUV=uv;');
    shader.fragmentShader = 'varying vec2 sealUV; uniform float sealTime;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      vec2 q=sealUV; float strand=pow(.5+.5*sin(q.x*59.+sin(q.y*33.-sealTime*.8)*3.),25.);
      float pulse=pow(.5+.5*sin(q.y*47.-sealTime*3.1+q.x*14.),7.);
      vec3 spectral=.55+.45*cos(6.28318*(q.y*.7+q.x*.3+vec3(.08,.36,.68)));
      totalEmissiveRadiance+=mix(vec3(.45,.7,1.9),spectral, .3)*(strand*.75+pulse*.08);
      diffuseColor.rgb*=.8+.2*sin(q.y*43.+q.x*18.);`);
  };
  function tube(points, radius = .012) {
    return new T.TubeGeometry(new T.CatmullRomCurve3(points), Math.max(16, points.length * 3), radius, 5, false);
  }
  function merge(parts) {
    const positions = [], normals = [], uvs = [], indices = []; let offset = 0;
    for (const g of parts) {
      positions.push(...g.attributes.position.array); normals.push(...g.attributes.normal.array);
      uvs.push(...(g.attributes.uv?.array || new Array(g.attributes.position.count * 2).fill(0)));
      if (g.index) for (const i of g.index.array) indices.push(i + offset);
      else for (let i = 0; i < g.attributes.position.count; i++) indices.push(i + offset);
      offset += g.attributes.position.count; g.dispose();
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); return g;
  }
  const polygon = (r, z = 0) => Array.from({length: 6}, (_, i) => {
    const a = i / 5 * TAU + Math.PI / 2; return new T.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);
  });
  const arms = [], satellites = [], petals = [];
  const face = material(new T.MeshPhysicalMaterial({color:0xa57a38,metalness:.87,roughness:.3,
    clearcoat:.8,emissive:0x573a16,emissiveIntensity:.28}));
  const group = new T.Group(); root.add(group);
  const capBody = new T.CylinderGeometry(.35, .35, .085, 5, 1); capBody.rotateX(Math.PI / 2);
  const capFrames = merge([.36, .31, .26].map(r => {
    const points=polygon(r,.063),path=new T.CurvePath();
    for(let i=0;i<5;i++)path.add(new T.LineCurve3(points[i],points[i+1]));
    return new T.TubeGeometry(path,60,.012,5,false);
  }));
  const ornaments = [];
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5 + Math.PI / 2;
    const points = [];
    for (let j = 0; j <= 15; j++) {
      const u = j / 15, r = .045 + .185 * Math.sin(u * Math.PI * .78);
      const theta = a + Math.sin(u * Math.PI) * .46;
      points.push(new T.Vector3(Math.cos(theta) * r, Math.sin(theta) * r, .075));
    }
    ornaments.push(tube(points, .009));
  }
  const capScroll = merge(ornaments);
  function cap(parent, size = 1) {
    const g = new T.Group(); g.scale.setScalar(size); parent.add(g);
    mesh(capBody, face, g); mesh(capFrames, glow, g); mesh(capScroll, glow, g); return g;
  }
  const shaft = new T.CylinderGeometry(.265, .22, 1, 5, 1); shaft.rotateX(Math.PI / 2);
  const rails = merge(Array.from({length: 5}, (_, i) => {
    const a = i / 5 * TAU + Math.PI / 2, x = Math.cos(a) * .27, y = Math.sin(a) * .27;
    return tube([new T.Vector3(x, y, -.5), new T.Vector3(x, y, .5)], .014);
  }));
  for (let i = 0; i < 12; i++) {
    const g = new T.Group(), a = i * TAU / 12 + Math.PI / 2; group.add(g);
    const body = mesh(shaft, crystal, g), ribs = mesh(rails, gold, g);
    const end = cap(g), back = cap(g, .8);
    arms.push({g, a, body, ribs, end, back, index: i});
    const radial = new T.Group(); radial.rotation.z = a; root.add(radial);
    const key = cap(radial, .72); key.rotation.z = -a;
    const link = mesh(new T.BoxGeometry(1, .065, .09), gold, radial);
    satellites.push({radial, key, link, index: i});
  }
  // The innermost twelve pointed shutters reveal the centre only after the
  // radial keys have seated. No opaque disc is composited over the bloom.
  const shape = new T.Shape();
  [[.08,0],[.4,-.18],[1.05,-.2],[1.36,0],[.92,.27],[.37,.18]].forEach(([x,y],i) => i ? shape.lineTo(x,y) : shape.moveTo(x,y));
  shape.closePath();
  const shutterGeo = new T.ExtrudeGeometry(shape, {depth: .055, bevelEnabled: true,
    bevelSegments: 2, bevelSize: .012, bevelThickness: .012});
  for (let i = 0; i < 12; i++) {
    const g = new T.Group(); g.rotation.z = i * TAU / 12; g.position.z = 1.42; root.add(g);
    mesh(shutterGeo, gold, g); petals.push(g);
  }

  const u = {time, gather: {value: 0}, unfold: {value: 0}, halo: {value: 0}, passage: {value: 0}};
  const ribbonGeo = new T.InstancedBufferGeometry().copy(new T.PlaneGeometry(1, 1, 1, 96));
  const count = innerWidth < 600 ? 42 : 70, seeds = [];
  ribbonGeo.instanceCount = count;
  for (let i = 0; i < count; i++) seeds.push(i * .618033989, (i % 11) / 11, (i % 17) / 17, (i % 7) / 7);
  ribbonGeo.setAttribute('seed', new T.InstancedBufferAttribute(new Float32Array(seeds), 4));
  const ribbonMat = material(new T.ShaderMaterial({transparent: true, depthWrite: false,
    blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: u,
    vertexShader: `attribute vec4 seed;varying vec2 st;varying vec4 fs;uniform float time,gather,unfold;${noise}
      void main(){st=uv;fs=seed;float v=uv.y,a=seed.x*6.28318;
      float radius=.16+pow(1.-v,1.45)*(8.+seed.y*6.);
      float theta=a+v*2.8+sin(v*6.-time*.7+seed.x)*.28;
      vec3 p=vec3(cos(theta)*radius,sin(theta)*radius,-3.+v*6.);
      p.xy+=normalize(p.xy+.01)*position.x*(.045+seed.z*.11);
      p.z+=sin(v*8.-time*.8+seed.x)*.32;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying vec2 st;varying vec4 fs;uniform float time,gather;${noise}
      void main(){float line=pow(max(0.,1.-abs(st.x-.5)*2.),1.8);
      float head=fract(time*(.24+fs.y*.1)+fs.x),d=fract(st.y-head+1.);
      float pulse=exp(-d*10.);float fade=smoothstep(0.,.1,st.y)*(1.-smoothstep(.88,1.,st.y));
      vec3 spectrum=.55+.45*cos(6.28318*(fs.z+st.y*.25+vec3(.02,.31,.63)));
      vec3 c=mix(vec3(3.8,2.,.55),spectrum*2.8,.48);
      gl_FragColor=vec4(c,line*(pulse*.85+.035)*fade*gather);}`
  }));
  const ribbons = mesh(ribbonGeo, ribbonMat); ribbons.frustumCulled = false;
  const haloMat = material(new T.ShaderMaterial({transparent: true, depthWrite: false,
    blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: u,
    vertexShader: 'varying vec2 st;void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 st;uniform float time,halo;${noise}
      void main(){vec2 q=(st-.5)*12.;float r=length(q),a=atan(q.y,q.x);
      float n=fbm(vec3(q*3.,time*.7));float curl=fbm(vec3(a*4.,r*8.-time*1.8,time*.2));
      float boundary=4.9+(n-.5)*.34+sin(a*12.)*.065;
      float rim=exp(-abs(r-boundary)*38.);float flare=exp(-abs(r-boundary-(curl-.25)*.78)*10.)*pow(curl,2.1);
      float ring=exp(-abs(r-4.5-(n-.5)*.05)*90.)*.2;
      vec3 spectral=.55+.45*cos(6.28318*(a*.28+n*.5+vec3(.0,.33,.66)));
      vec3 c=mix(vec3(3.4,1.6,.26),spectral*2.9,.24);
      gl_FragColor=vec4(c,(rim*.75+flare*.8+ring)*halo);}`
  }));
  const halo = mesh(new T.PlaneGeometry(12, 12), haloMat); halo.position.z = -1.7;
  return {
    pose(t) {
      const arrival = at(t, .25, 1.35), retract = at(t, 2.25, 4.1), unfold = at(t, 3.9, 6.25);
      const seat = at(t, 6.0, 7.9), portal = at(t, 12.4, 14.4);
      group.rotation.set((1 - retract) * .26, (1 - retract) * 1.02, (1 - retract) * -.25);
      group.position.z = mix(-1.1, .75, retract) + seat*1.9 - portal * 1.2;
      group.scale.setScalar(arrival || .0001);
      arms.forEach(({g,a,body,ribs,end,back,index}) => {
        const k = at(t, 3.9 + (index % 3) * .13, 6.25 + (index % 3) * .13);
        const radius = mix(1.1, 3.15, k) * (1 - seat) + seat * 1.15;
        const theta = a + (1 - k) * .12 + Math.sin(k * Math.PI) * .05;
        g.position.set(Math.cos(theta)*radius, Math.sin(theta)*radius, (index % 3)*.14*(1-seat));
        g.rotation.z = a - Math.PI / 2 + k * .15;
        const length = mix(4.8 + index%3*.45, .16, retract);
        body.scale.z = ribs.scale.z = length; body.position.z = ribs.position.z = -length / 2;
        end.position.z = .035; end.scale.setScalar(.75+k*.25); back.position.z = -length;
        g.scale.setScalar(1 - portal * .4);
      });
      satellites.forEach(({radial,key,link,index}) => {
        const k = at(t, 4.55 + index%3*.12, 6.7 + index%3*.12);
        radial.visible = k > 0 && t < 8.8; radial.position.z = -.8 + seat * .3;
        key.position.x = mix(.9, 4.4, k) + portal * 1.8;
        key.rotation.y = (1-k)*1.2;
        link.position.x = .9+(key.position.x-.9)/2; link.scale.x = Math.max(.001,key.position.x-.9);
        link.visible = t < 8.6;
        // Scale the cap, not the radial position, as it seats behind the petals.
        radial.scale.setScalar(1); key.scale.setScalar(mix(.72,.48,seat));
      });
      petals.forEach((g,i) => {
        const k = at(t, 10.9+i%3*.08, 12.8+i%3*.08);
        g.visible = t > 6.5; g.position.x = Math.cos(i*TAU/12)*(k*.84+portal*2.);
        g.position.y = Math.sin(i*TAU/12)*(k*.84+portal*2.);
        g.rotation.z = i*TAU/12 + k*.17; g.rotation.y = -.2-k*.72;
        g.scale.setScalar(at(t,6.5,7.9));
      });
      glow.emissiveIntensity = 1.1 + at(t,4,8)*.65;
      u.gather.value = at(t,0,.7)*(1-at(t,3.2,4.5))*1.45 + Math.sin(portal*Math.PI)*.3;
      u.halo.value = at(t,7.7,9.6)*(1-at(t,13.4,14.4));
      u.unfold.value = unfold; u.passage.value = portal;
      return {sealPrisms: arms.length, pentagonKeys: arms.length+satellites.length,
        irisBlades: petals.length, axialRetraction: retract, radialUnfold: unfold,
        keyedSeating: seat, streamRibbons: count, axialLength: arms[0].body.scale.z,
        capRadius: Math.hypot(arms[0].g.position.x,arms[0].g.position.y)};
    }
  };
}
