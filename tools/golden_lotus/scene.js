import * as T from 'three';

export const PRELUDE = 8.4;
const TAU = Math.PI * 2;
const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const at = (t, a, b) => ease((t - a) / (b - a));
const mix = (a, b, t) => a + (b - a) * t;

// A petal is a curved, closed solid, with a central ridge and rolled edges.
// Its root stays at the hinge while the tip unfolds outwards.
function surface(u, v, length, width) {
  const span = Math.pow(Math.sin(Math.PI * u), .82) * width * (.75 + .25 * u);
  return new T.Vector3(
    u * length,
    v * span,
    .24 * Math.sin(Math.PI * u) * (1 - v * v) + .32 * u * u
      + .13 * v * v * Math.sin(Math.PI * u) + .022 * Math.cos(v * 6 * Math.PI) * Math.sin(Math.PI * u)
  );
}

function petalGeometry(length, width) {
  const nu = 36, nv = 14, positions = [], uv = [], indices = [];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i <= nu; i++) {
      for (let j = 0; j <= nv; j++) {
        const u = i / nu, v = j / nv * 2 - 1;
        const p = surface(u, v, length, width);
        p.z -= side * .055;
        positions.push(p.x, p.y, p.z); uv.push(u, v);
      }
    }
  }
  const stride = nv + 1, count = (nu + 1) * stride;
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = side * count + i * stride + j, b = a + stride;
      if (!side) indices.push(a, b, a + 1, b, b + 1, a + 1);
      else indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  for (let i = 0; i < nu; i++) for (const j of [0, nv]) {
    const a = i * stride + j, b = a + stride;
    indices.push(a, a + count, b, b, a + count, b + count);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

function mergeRails(meshes) {
  const positions = [], normals = [], indices = [];
  let offset = 0;
  for (const mesh of meshes) {
    const g = mesh.geometry;
    positions.push(...g.attributes.position.array);
    normals.push(...g.attributes.normal.array);
    for (const i of g.index.array) indices.push(i + offset);
    offset += g.attributes.position.count;
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  g.setIndex(indices); return g;
}

function environment(renderer) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#fff9ed'); g.addColorStop(.35, '#c2ced9');
  g.addColorStop(.55, '#45485e'); g.addColorStop(1, '#fff1d2');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256);
  for (const [x, w] of [[24, 55], [161, 23], [302, 77], [461, 25]]) {
    ctx.fillStyle = '#fffef8'; ctx.fillRect(x, 6, w, 210);
  }
  ctx.fillStyle = '#423b30'; ctx.fillRect(225, 25, 28, 150);
  ctx.fillStyle = '#a4edee'; ctx.fillRect(88, 45, 36, 150);
  ctx.fillStyle = '#c0a0e9'; ctx.fillRect(390, 50, 35, 145);
  const texture = new T.CanvasTexture(c); texture.colorSpace = T.SRGBColorSpace;
  texture.mapping = T.EquirectangularReflectionMapping;
  const pmrem = new T.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(texture);
  texture.dispose(); pmrem.dispose();
  return target;
}

export function createLotus(canvas) {
  const renderer = new T.WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 600 ? 1.25 : 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .94;
  const scene = new T.Scene(), env = environment(renderer);
  scene.environment = env.texture; scene.environmentIntensity = .86;
  const camera = new T.PerspectiveCamera(38, 1, .1, 80);
  camera.position.set(0, 0, 17); camera.lookAt(0, 0, 0);
  scene.add(new T.HemisphereLight(0xfff4d1, 0xa78b55, .95));
  for (const [color, power, position] of [
    [0xfff6dc, 2.1, [-5, 7, 10]], [0xffd36f, 1.15, [6, -2, 6]], [0xffffff, .8, [-3, -4, 5]]
  ]) { const light = new T.DirectionalLight(color, power); light.position.set(...position); scene.add(light); }
  const root = new T.Group(); scene.add(root);
  const geometries = new Set(), materials = new Set();
  const material = (m) => { materials.add(m); return m; };
  const gold = [0xe9b94f, 0xf4d078, 0xf5d691, 0xf5dda1].map(color => material(new T.MeshPhysicalMaterial({
    color, metalness: .8, roughness: .21, clearcoat: 1, clearcoatRoughness: .13,
    iridescence: .58, iridescenceIOR: 1.31, iridescenceThicknessMinimum: 180, iridescenceThicknessMaximum: 560,
    emissive: 0xf9ac1c, emissiveIntensity: .045, side: T.DoubleSide
  })));
  const vein = material(new T.MeshBasicMaterial({color: 0xfff0ac}));
  const engraving = material(new T.MeshStandardMaterial({color: 0xa96d21, metalness: .8, roughness: .28}));
  const fireUniforms = {time: {value: 0}, intensity: {value: 0}};
  gold.forEach(mat => {
    mat.onBeforeCompile = shader => {
      shader.uniforms.lotusTime = fireUniforms.time;
      shader.uniforms.lotusHeat = fireUniforms.intensity;
      shader.vertexShader = 'varying vec2 lotusUV; varying vec2 lotusWorld;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nlotusUV=uv;lotusWorld=(modelMatrix*vec4(position,1.)).xy;');
      shader.fragmentShader = 'varying vec2 lotusUV; varying vec2 lotusWorld; uniform float lotusTime; uniform float lotusHeat;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float u=lotusUV.x,v=lotusUV.y;
        float vein=pow(.5+.5*sin(v*44.+sin(u*17.)*1.6+sin(v*12.+u*8.)*.8),22.);
        float fleck=pow(.5+.5*sin(u*193.+v*73.)*sin(v*219.-u*61.),16.);
        float flow=pow(.5+.5*sin(u*19.-lotusTime*4.+v*7.),6.);
        float heat=(vein*.27+fleck*.9)*(flow*.7+.3)*lotusHeat*sin(u*3.14159);
        float grazing=1.-abs(dot(normal,normalize(vViewPosition)));
        float phase=u*1.38+v*.36+grazing*.5+sin(u*5.+v*3.)*.1+lotusTime*.006;
        phase+=sin(atan(lotusWorld.y,lotusWorld.x)*3.+u*4.)*.16;
        vec3 spectrum=.54+.46*cos(6.28318*(phase+vec3(.0,.34,.67)));
        // Gold remains the base; the curved facets carry cyan, violet and red
        // interference highlights instead of a uniform yellow coating.
        vec3 jewel=mix(vec3(.94,.62,.18),spectrum,.82);
        float fold=.5+.5*sin(u*10.+v*4.+sin(v*5.)*.8);
        float sheen=(.22+.46*fold+.2*grazing)*smoothstep(.16,.72,u);
        diffuseColor.rgb=mix(diffuseColor.rgb,jewel,sheen);
        totalEmissiveRadiance+=mix(vec3(1.,.43,.045),spectrum,.25)*heat*1.4;
        diffuseColor.rgb*=.91+.09*sin(u*34.+v*11.);`);
    };
  });
  const glow = material(new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: fireUniforms,
    vertexShader: `varying vec2 st; void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 st;uniform float time;uniform float intensity;
      void main(){float u=st.x,v=st.y;
      float ridge=pow(max(0.,1.-abs(v)),14.);
      float edge=pow(abs(v),19.);
      float stream=.45+.55*pow(.5+.5*sin(u*34.-time*7.+v*11.),5.);
      float a=(ridge*.38+edge*.25)*sin(3.14159*u)*stream*intensity;
      gl_FragColor=vec4(1.,.65+.3*stream,.16+.5*stream,a);}`
  }));
  const mesh = (g, m, parent) => { geometries.add(g); const obj = new T.Mesh(g, m); parent.add(obj); return obj; };
  function tube(points, radius, mat, parent) {
    const curve = new T.CatmullRomCurve3(points);
    return mesh(new T.TubeGeometry(curve, 30, radius, 4, false), mat, parent);
  }
  const petals = [];
  const layers = [
    {count: 12, length: 4.3, width: 1.04, z: -.37, start: 1.3, end: 3.5, closed: 1.12, open: -.08},
    {count: 12, length: 3.45, width: .91, z: -.08, start: 2.8, end: 4.8, closed: 1.26, open: .15},
    {count: 8, length: 2.48, width: .74, z: .18, start: 4.1, end: 6.1, closed: 1.38, open: .39},
    {count: 6, length: 1.5, width: .47, z: .35, start: 5.15, end: 6.6, closed: 1.44, open: .48}
  ];
  layers.forEach((layer, tier) => {
    const geo = petalGeometry(layer.length, layer.width); geometries.add(geo);
    for (let i = 0; i < layer.count; i++) {
      const radial = new T.Group(); radial.rotation.z = i * TAU / layer.count + tier * .25 + Math.PI / 2;
      radial.position.z = layer.z; root.add(radial);
      const hinge = new T.Group(); radial.add(hinge); hinge.position.x = .16 + tier * .035;
      mesh(geo, gold[tier], hinge);
      const luminous = mesh(geo, glow, hinge); luminous.position.z = .006;
      for (const v of [-.96, 0, .96]) {
        const line = [];
        for (let k = 1; k < 34; k++) { const p = surface(k / 35, v, layer.length, layer.width); p.z += .012; line.push(p); }
        tube(line, v === 0 ? .014 : .009, v === 0 ? vein : engraving, hinge);
      }
      for (const side of [-1, 1]) for (const base of [.2, .39, .57]) {
        const points = [];
        for (let k = 0; k <= 8; k++) {
          const p = surface(base + k / 8 * .22, side * k / 8 * .9, layer.length, layer.width);
          p.z += .014; points.push(p);
        }
        tube(points, .007, vein, hinge);
      }
      petals.push({radial, hinge, layer, tier, index: i, delay: (i % 3) * .14});
    }
  });
  // Consolidate each petal's engraving and ribs into two draw calls. Their
  // hinge remains independent; this only avoids dozens of tiny rail meshes.
  petals.forEach(({hinge}) => {
    for (const mat of [vein, engraving]) {
      const rails = hinge.children.filter(child => child.material === mat);
      const combined = mergeRails(rails);
      rails.forEach(rail => { hinge.remove(rail); geometries.delete(rail.geometry); rail.geometry.dispose(); });
      mesh(combined, mat, hinge);
    }
  });
  // Thin luminous tongues are attached to actual petal tips. Their whole
  // lifetime is transported, so no static spike keeps growing indefinitely.
  const flameGeo = new T.PlaneGeometry(.38, 1.7, 8, 24);
  const flameMaterial = material(new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: fireUniforms,
    vertexShader: `varying vec2 st;uniform float time;void main(){st=uv;vec3 p=position;
      p.x+=sin(uv.y*7.-time*3.1+position.x*8.)*.11*uv.y;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying vec2 st;uniform float time;uniform float intensity;
      void main(){float life=fract(time*.57+st.x*.21);float y=(st.y-life*.78+.18)/.64;
      float width=.3*pow(max(0.,1.-y),.8);float bend=sin(y*7.-time*3.)*.13*y;
      float d=abs(st.x-.5-bend);float a=(1.-smoothstep(width*.3,width,d));
      a*=smoothstep(0.,.13,y)*(1.-smoothstep(.65,1.,y));
      a*=sin(life*3.14159)*intensity*.52;
      gl_FragColor=vec4(1.,.64+.31*(1.-d*3.),.16+.5*(1.-d*3.),max(0.,a));}`
  }));
  const flames = [];
  petals.filter(p => p.tier < 3 && p.index % 2 === 0).forEach(p => {
    const group = new T.Group(); root.add(group);
    const flame = mesh(flameGeo, flameMaterial, group);
    flames.push({group, flame, petal: p});
  });
  const heartMaterial = material(new T.MeshStandardMaterial({color: 0xffd15f, emissive: 0xffb52e, emissiveIntensity: .4, metalness: .75, roughness: .16}));
  const heart = mesh(new T.OctahedronGeometry(.18, 1), heartMaterial, root); heart.position.z = 1;
  const heartLight = new T.PointLight(0xffd35a, 1.5, 6, 2); heartLight.position.z = 1.7; root.add(heartLight);
  let latest = 0, disposed = false;
  function pose(t) {
    if (disposed) return;
    latest = t;
    const arrival = at(t, 0, 1), passage = at(t, 7.2, PRELUDE);
    root.visible = t < PRELUDE;
    root.scale.setScalar(mix(.8, 1, arrival) * (1 + passage * 2.8));
    // The axis remains exactly frontal. Local hinges, not a camera orbit,
    // supply the depth and the staged transformations.
    petals.forEach(({radial, hinge, layer, tier, index, delay}) => {
      const open = at(t, layer.start + delay, layer.end + delay);
      const unlock = at(t, layer.start - .32 + delay, layer.start + delay);
      hinge.rotation.y = -mix(layer.closed, layer.open, open);
      hinge.rotation.z = Math.sin(open * Math.PI) * (tier % 2 ? -.1 : .1);
      hinge.position.x = .16 + tier * .035 + unlock * .09 + passage * (.7 + tier * .16);
      radial.position.z = layer.z - passage * .9;
    });
    fireUniforms.time.value = t;
    fireUniforms.intensity.value = at(t, .5, 1.6) * (1 - at(t, 7.15, 8.25));
    heart.scale.setScalar(1 + .12 * Math.sin(t * 2) + at(t, 5.6, 7) * .4);
    heartMaterial.emissiveIntensity = .35 + at(t, 5.6, 7) * .55;
    heartLight.intensity = 1.5 + at(t, 5.5, 6.7) * 2;
    root.updateMatrixWorld(true);
    flames.forEach(({group, flame, petal}, i) => {
      const point = surface(.94, 0, petal.layer.length, petal.layer.width);
      petal.hinge.localToWorld(point); root.worldToLocal(point);
      group.position.copy(point); group.position.y += .28;
      group.rotation.z = Math.sin(i * 5.1) * .2;
      flame.scale.setScalar(.65 + (i % 4) * .13);
      flame.position.y = .38;
    });
    canvas.style.opacity = String(arrival * (1 - at(t, 7.45, PRELUDE)));
    renderer.render(scene, camera);
    return {time: t, petals: petals.length, tiers: layers.length, camera: camera.position.toArray(),
      openings: layers.map((l, tier) => -petals.find(p => p.tier === tier).hinge.rotation.y),
      triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.calls};
  }
  function resize() {
    if (disposed) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    // Keep the entire blossom inside the short side on both phones and desktops.
    camera.position.z = 16.8 / Math.min(1, camera.aspect);
    camera.updateProjectionMatrix(); pose(latest);
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  return {pose, dispose() {
    if (disposed) return; disposed = true; observer.disconnect();
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    env.dispose(); renderer.dispose(); renderer.forceContextLoss();
  }};
}
