import * as THREE from 'three';
import { createStage, pointer } from './stage';
import { glowTexture } from './textures';
import outline from '@/data/france-outline.json';

/* Carte 3D de France : chaque installateur est une colonne lumineuse. */

const LAT0 = 46.6;
const LNG0 = 2.45;
const K = 0.36;
const COS = Math.cos((LAT0 * Math.PI) / 180);
export const project = (lat: number, lng: number) => new THREE.Vector2((lng - LNG0) * COS * K, -(lat - LAT0) * K);

export function createNetwork(canvas: HTMLCanvasElement, pts: [number, number][], hq: [number, number]) {
  const stage = createStage({ canvas, fov: 32, bloom: { strength: 0.75, radius: 0.5, threshold: 0.55 }, exposure: 1.0 });
  const { scene, camera } = stage;
  const world = new THREE.Group();
  scene.add(world);

  // ---------------------------------------------------------------- territoire
  const shapes: THREE.Shape[] = [];
  const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#4a7396').multiplyScalar(1.6), transparent: true, opacity: 0.9, toneMapped: false });
  for (const ring of outline.rings as number[][][]) {
    const v = ring.map(([lng, lat]) => project(lat, lng));
    shapes.push(new THREE.Shape(v));
    const g = new THREE.BufferGeometry().setFromPoints(v.map((p) => new THREE.Vector3(p.x, 0.061, p.y)));
    world.add(new THREE.LineLoop(g, lineMat));
  }
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.06, 0);
  const topMat = new THREE.MeshPhysicalMaterial({ color: '#001c3c', metalness: 0.3, roughness: 0.45, clearcoat: 0.6, transparent: true, opacity: 0.94 });
  const sideMat = new THREE.MeshStandardMaterial({ color: '#043d6c', emissive: '#043d6c', emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.5 });
  const land = new THREE.Mesh(geo, [topMat, sideMat]);
  world.add(land);
  // mailles hexagonales sur le territoire (texture de points)
  const dotsGeo = new THREE.BufferGeometry();
  const dotPos: number[] = [];
  const main = shapes[0];
  const mainPts = main.getPoints();
  const inside = (x: number, y: number) => {
    let c = false;
    for (let i = 0, j = mainPts.length - 1; i < mainPts.length; j = i++) {
      const a = mainPts[i],
        b = mainPts[j];
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  for (let x = -2.2; x <= 2.2; x += 0.07)
    for (let y = -2.2; y <= 2.2; y += 0.0606) {
      const xx = x + (Math.round(y / 0.0606) % 2 ? 0.035 : 0);
      if (inside(xx, y)) dotPos.push(xx, 0.075, y);
    }
  dotsGeo.setAttribute('position', new THREE.Float32BufferAttribute(dotPos, 3));
  world.add(new THREE.Points(dotsGeo, new THREE.PointsMaterial({ color: '#2e6894', size: 0.012, transparent: true, opacity: 0.7 })));

  // ---------------------------------------------------------------- colonnes installateurs
  const P = pts.map(([lat, lng]) => project(lat, lng));
  const dens = P.map((p) => P.reduce((n, q) => n + (p.distanceTo(q) < 0.12 ? 1 : 0), 0));
  const colGeo = new THREE.BoxGeometry(0.014, 1, 0.014);
  colGeo.translate(0, 0.5, 0);
  const colMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, opacity: 0.85 });
  const cols = new THREE.InstancedMesh(colGeo, colMat, P.length);
  const heights = dens.map((d) => 0.06 + Math.min(1, Math.log(1 + d) / Math.log(120)) * 0.9);
  const dummy = new THREE.Object3D();
  const cA = new THREE.Color('#4a7396').multiplyScalar(1.3);
  const cB = new THREE.Color('#e8eef4').multiplyScalar(1.1);
  P.forEach((_p, i) => {
    const t = Math.min(1, dens[i] / 80);
    cols.setColorAt(i, cA.clone().lerp(cB, t));
  });
  world.add(cols);
  const tipGeo = new THREE.BufferGeometry();
  const tipPos = new Float32Array(P.length * 3);
  tipGeo.setAttribute('position', new THREE.BufferAttribute(tipPos, 3));
  const tips = new THREE.Points(
    tipGeo,
    new THREE.PointsMaterial({ map: glowTexture('rgba(232,238,244,1)', 'rgba(74, 115, 150, 0)', 64), size: 0.06, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  world.add(tips);

  // ---------------------------------------------------------------- siège (Aulnay-sous-Bois)
  const H = project(hq[0], hq[1]);
  const beacon = new THREE.Group();
  beacon.position.set(H.x, 0.075, H.y);
  const hexGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 6);
  const hex = new THREE.Mesh(hexGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#4a7396').multiplyScalar(1.1), toneMapped: false }));
  beacon.add(hex);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.02, 1.6, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#4a7396').multiplyScalar(1.1), transparent: true, opacity: 0.4, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  beam.position.y = 0.8;
  beacon.add(beam);
  const pulses: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.058, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#4a7396').multiplyScalar(2), transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }),
    );
    r.rotation.x = -Math.PI / 2;
    r.userData.off = i / 3;
    beacon.add(r);
    pulses.push(r);
  }
  world.add(beacon);

  // ---------------------------------------------------------------- arcs de livraison
  const far = P.map((p, i) => ({ p, i, d: p.distanceTo(H) })).filter((x) => x.d > 0.45);
  const chosen: THREE.Vector2[] = [];
  far.sort((a, b) => b.d - a.d);
  for (const f of far) {
    if (chosen.every((c) => c.distanceTo(f.p) > 0.55)) chosen.push(f.p);
    if (chosen.length >= 14) break;
  }
  const arcs: { line: THREE.Line; mat: THREE.LineDashedMaterial; off: number; curve: THREE.QuadraticBezierCurve3; comet: THREE.Sprite }[] = [];
  const cometMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(232,238,244,1)', 'rgba(74, 115, 150, 0)', 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const c of chosen) {
    const a = new THREE.Vector3(H.x, 0.08, H.y);
    const b = new THREE.Vector3(c.x, 0.08, c.y);
    const mid = a.clone().lerp(b, 0.5);
    mid.y += 0.25 + a.distanceTo(b) * 0.35;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const g = new THREE.BufferGeometry().setFromPoints(curve.getPoints(60));
    const mat = new THREE.LineDashedMaterial({ color: new THREE.Color('#4a7396').multiplyScalar(1.6), dashSize: 0.05, gapSize: 0.04, transparent: true, opacity: 0.8, toneMapped: false });
    const line = new THREE.Line(g, mat);
    line.computeLineDistances();
    world.add(line);
    const comet = new THREE.Sprite(cometMat);
    comet.scale.setScalar(0.09);
    world.add(comet);
    arcs.push({ line, mat, off: Math.random(), curve, comet });
  }

  // ---------------------------------------------------------------- lumières / sol
  scene.add(new THREE.HemisphereLight('#4a7396', '#05070a', 1.1));
  const dl = new THREE.DirectionalLight('#ffffff', 1.4);
  dl.position.set(-2, 4, 3);
  scene.add(dl);
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.MeshBasicMaterial({ map: glowTexture('rgba(46,104,148,0.55)', 'rgba(46,104,148,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -0.02;
  world.add(halo);

  camera.position.set(0, 3.9, 4.3);
  const look = new THREE.Vector3(0, 0, 0.1);
  const ptr = pointer();
  let grow = 0;
  let camZ = 4.3;
  let growTarget = 0;

  stage.onFrame((dt, t) => {
    grow += (growTarget - grow) * Math.min(1, dt * 1.6);
    P.forEach((p, i) => {
      const delay = Math.min(0.6, p.distanceTo(H) * 0.25);
      const g = Math.min(1, Math.max(0, (grow - delay) / (1 - delay + 1e-6)));
      const h = heights[i] * (0.02 + g * 0.98);
      dummy.position.set(p.x, 0.07, p.y);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      cols.setMatrixAt(i, dummy.matrix);
      tipPos[i * 3] = p.x;
      tipPos[i * 3 + 1] = 0.07 + h;
      tipPos[i * 3 + 2] = p.y;
    });
    cols.instanceMatrix.needsUpdate = true;
    tipGeo.attributes.position.needsUpdate = true;
    for (const a of arcs) {
      const k = (t * 0.22 + a.off) % 1;
      a.curve.getPoint(k, a.comet.position);
      a.comet.visible = grow > 0.5;
      a.mat.opacity = 0.55 * grow;
    }
    pulses.forEach((r) => {
      const k = (t * 0.6 + r.userData.off) % 1;
      r.scale.setScalar(1 + k * 5);
      (r.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.8;
    });
    const m = ptr.update(0.04);
    world.rotation.y = Math.sin(t * 0.15) * 0.2 + m.x * 0.25;
    camera.position.set(m.x * 0.3, 3.9 - m.y * 0.3, camZ);
    camera.lookAt(look);
  });
  stage.onResize((w, h) => {
    const a = w / h;
    camZ = a < 1 ? 6 : 4.3;
  });
  stage.start();

  return {
    grow() {
      growTarget = 1;
    },
    dispose() {
      stage.dispose();
    },
  };
}
