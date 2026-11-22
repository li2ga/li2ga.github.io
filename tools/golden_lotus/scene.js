import * as T from 'three';
import {addMechanism} from './mechanism.js';

export const PRELUDE = 14.4;
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
    .36 * Math.sin(Math.PI * u) * Math.pow(1 - v * v, 2) + .62 * u * u
      + .14 * v * v * Math.sin(Math.PI * u) + .025 * Math.cos(v * 6 * Math.PI) * Math.sin(Math.PI * u)
  );
}

function petalGeometry(length, width) {
  const nu = 44, nv = 18, positions = [], uv = [], indices = [];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i <= nu; i++) {
      for (let j = 0; j <= nv; j++) {
        const u = i / nu, v = j / nv * 2 - 1;
        const p = surface(u, v, length, width);
        p.z -= side * (.035 + .075 * Math.sin(Math.PI * u) * (1 - .65 * v * v));
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
  g.addColorStop(0, '#fff1ce'); g.addColorStop(.35, '#9eaab4');
  g.addColorStop(.55, '#10131a'); g.addColorStop(1, '#bd8a46');
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
  const renderer = new T.WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 600 ? 1.25 : 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .86;
  const scene = new T.Scene(), env = environment(renderer);
  scene.environment = env.texture; scene.environmentIntensity = 1.08;
  const camera = new T.PerspectiveCamera(38, 1, .1, 80);
  camera.position.set(0, 0, 17); camera.lookAt(0, 0, 0);
  scene.add(new T.HemisphereLight(0xffedc2, 0x283245, .45));
  for (const [color, power, position] of [
    [0xfff6dc, .9, [-5, 7, 10]], [0xffd36f, .7, [6, -2, 6]], [0xb3e9ef, .55, [-3, -4, 5]]
  ]) { const light = new T.DirectionalLight(color, power); light.position.set(...position); scene.add(light); }
  const root = new T.Group(); scene.add(root);
  const geometries = new Set(), materials = new Set();
  const material = (m) => { materials.add(m); return m; };
  const gold = [0xc7a362, 0xe0bd7b, 0x62658d, 0xa6a5c6, 0xd8b873, 0xecd5a2].map((color, tier) => material(new T.MeshPhysicalMaterial({
    color, metalness: tier===2||tier===3?.68:.9, roughness: .31, clearcoat: .85, clearcoatRoughness: .23,
    iridescence: .26, iridescenceIOR: 1.38, iridescenceThicknessMinimum: 180, iridescenceThicknessMaximum: 480,
    emissive: tier===2||tier===3?0x342a79:0x8c5c1b, emissiveIntensity: .12, side: T.DoubleSide
  })));
  const vein = material(new T.MeshStandardMaterial({color: 0xffe1a0, metalness:.8, roughness:.2, emissive:0xffcd73, emissiveIntensity:.72}));
  const engraving = material(new T.MeshStandardMaterial({color: 0xa96d21, metalness: .8, roughness: .28}));
  const fireUniforms = {time: {value: 0}, intensity: {value: 0}};
  gold.forEach((mat, tier) => {
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
        vec3 jewel=mix(vec3(.94,.62,.18),spectrum,.35);
        ${tier===2||tier===3?'jewel=mix(vec3(.38,.31,.79),spectrum,.4);':''}
        float fold=.5+.5*sin(u*10.+v*4.+sin(v*5.)*.8);
        float sheen=(.08+.12*fold+.13*grazing)*smoothstep(.16,.72,u);
        diffuseColor.rgb=mix(diffuseColor.rgb,jewel,sheen);
        totalEmissiveRadiance+=mix(vec3(3.4,1.5,.28),spectrum*2.,.13)*heat*.95;
        diffuseColor.rgb*=.91+.09*sin(u*34.+v*11.);`);
    };
  });
  const mesh = (g, m, parent = root) => { geometries.add(g); const obj = new T.Mesh(g, m); parent.add(obj); return obj; };
  function tube(points, radius, mat, parent) {
    const curve = new T.CatmullRomCurve3(points);
    return mesh(new T.TubeGeometry(curve, 30, radius, 4, false), mat, parent);
  }
  const petals = [];
  const layers = [
    {count:12,length:4.52,width:.86,z:-1.12,start:5.25,end:7.65,closed:1.28,open:-.12},
    {count:12,length:3.93,width:.77,z:-.72,start:5.9,end:8.25,closed:1.30,open:.04},
    {count:24,length:3.12,width:.42,z:-.25,start:6.65,end:8.95,closed:1.35,open:.20},
    {count:24,length:2.48,width:.34,z:.2,start:7.2,end:9.35,closed:1.38,open:.32},
    {count:12,length:1.42,width:.27,z:.65,start:7.8,end:9.8,closed:1.41,open:.48},
    {count:12,length:.89,width:.2,z:1.06,start:8.4,end:10.3,closed:1.45,open:.61}
  ];
  layers.forEach((layer, tier) => {
    const geo = petalGeometry(layer.length, layer.width); geometries.add(geo);
    for (let i = 0; i < layer.count; i++) {
      const radial = new T.Group(); radial.rotation.z = i * TAU / layer.count + (tier % 2 ? .5 : 0) * TAU / layer.count + Math.PI / 2;
      radial.position.z = layer.z; root.add(radial);
      const hinge = new T.Group(); radial.add(hinge); hinge.position.x = .16 + tier * .035;
      mesh(geo, gold[tier], hinge);
      // Emission is shaded on the solid itself; a second coincident shell
      // would hide its surface detail once HDR bloom is enabled.
      for (const v of [-.96, 0, .96]) {
        const line = [];
        for (let k = 1; k < 34; k++) { const p = surface(k / 35, v, layer.length, layer.width); p.z += .012; line.push(p); }
        tube(line, v === 0 ? .014 : .009, v === 0 ? vein : engraving, hinge);
      }
      // Curled flame relief follows the actual curved surface on both sides.
      // The ribs join a common midrib rather than floating across the blossom.
      for (const side of [-1, 1]) for (const base of [.12,.28,.44,.60]) {
        const points=[];
        for(let k=0;k<=22;k++) {
          const t=k/22,u=base+t*.22-.064*Math.sin(t*Math.PI*1.8),v=side*(.09+.73*Math.sin(t*Math.PI*.83));
          const p=surface(u,v,layer.length,layer.width);p.z+=.022;points.push(p);
        }
        tube(points,.017,vein,hinge);
      }
      petals.push({radial, hinge, layer, tier, index: i, delay: (i % 4) * .13, angle: radial.rotation.z});
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
  const heartMaterial = material(new T.MeshStandardMaterial({color: 0xffd15f, emissive: 0xffb52e, emissiveIntensity: .4, metalness: .75, roughness: .16}));
  const heart = mesh(new T.OctahedronGeometry(.09, 1), heartMaterial, root); heart.position.z = 1;
  const heartLight = new T.PointLight(0xffd35a, 1.5, 6, 2); heartLight.position.z = 1.7; root.add(heartLight);
  const mechanism = addMechanism({renderer, scene, camera, root, mesh, material, geometries, petals, surface, fireUniforms});
  let latest = 0, disposed = false;
  function pose(t) {
    if (disposed) return;
    latest = t;
    const arrival = at(t, 0, 1.15), passage = at(t, 12.6, PRELUDE);
    root.visible = t < PRELUDE;
    root.scale.setScalar(mix(.79, 1, arrival) * (1 + at(t,5.5,9)*.1) * (1 + passage * 1.3));
    camera.position.z = (17.4 - passage * 8.8) / Math.min(1, camera.aspect);
    // The axis remains exactly frontal. Local hinges, not a camera orbit,
    // supply the depth and the staged transformations.
    petals.forEach(({radial, hinge, layer, tier, index, delay, angle}) => {
      const open = at(t, layer.start + delay, layer.end + delay);
      hinge.scale.setScalar(Math.max(.0001,at(t,layer.start-.55+delay,layer.start+.45+delay)));
      const unlock = at(t, layer.start - .32 + delay, layer.start + delay);
      hinge.rotation.y = -mix(layer.closed, layer.open, open);
      const indexStep = at(t, 5.05 + tier * .2, 6.8 + tier * .22);
      const weave = at(t, 7.25 + tier * .17, 9.05 + tier * .18);
      radial.rotation.z = angle + (tier % 2 ? -1 : 1) * (indexStep * .11 + weave * .16);
      const exchange = Math.sin(at(t, 6.95 + tier * .17, 9.25 + tier * .18) * Math.PI);
      hinge.rotation.x = exchange * (tier % 2 ? -.32 : .32);
      hinge.rotation.z = Math.sin(open * Math.PI) * (tier % 2 ? -.21 : .21) + exchange * (index % 2 ? -.08 : .08);
      hinge.position.x = .16 + tier * .035 + unlock * .09 + exchange * (.22 + tier * .06) + passage * (.7 + tier * .16);
      radial.position.z = layer.z + Math.sin(indexStep * Math.PI) * (tier % 2 ? -.12 : .12) + exchange * (tier % 2 ? -.34 : .34) - passage * .9;
    });
    fireUniforms.time.value = t;
    fireUniforms.intensity.value = arrival * (.38 + at(t, 3, 9.5) * .62) * (1 - at(t, 13.4, PRELUDE));
    heart.scale.setScalar((1 + .08 * Math.sin(t * 2)) * (1 - at(t, 10.8, 12.1)));
    heartMaterial.emissiveIntensity = .5 + at(t, 8, 11) * .7;
    heartLight.intensity = 1 + at(t, 3, 10) * 3 + passage * 15;
    root.updateMatrixWorld(true);
    const detail = mechanism.pose(t);
    canvas.style.opacity = String(arrival);
    mechanism.render();
    return {time: t, petals: petals.length, tiers: layers.length, camera: camera.position.toArray(),
      openings: layers.map((l, tier) => -petals.find(p => p.tier === tier).hinge.rotation.y),
      triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.calls, ...detail};
  }
  function resize() {
    if (disposed) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    // Keep the entire blossom inside the short side on both phones and desktops.
    camera.position.z = 16.8 / Math.min(1, camera.aspect);
    camera.updateProjectionMatrix(); mechanism.resize(w, h); pose(latest);
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  return {pose, dispose() {
    if (disposed) return; disposed = true; observer.disconnect();
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    mechanism.dispose(); env.dispose(); renderer.dispose(); renderer.forceContextLoss();
  }};
}
