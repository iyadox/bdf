import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createStage, pointer, isMobileGpu } from './stage';
import { buildDoor } from './door-model';
import { beamTexture, glowTexture, gridTexture, lineGlowTexture } from './textures';

export interface HeroApi {
  setProgress: (p: number) => void; // 0 → 1 (défilement)
  intro: (onDone?: () => void) => void;
  anchors: () => { id: string; x: number; y: number; visible: boolean }[];
  dispose: () => void;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

export function createHero(canvas: HTMLCanvasElement): HeroApi {
  const mobile = isMobileGpu();
  const stage = createStage({ canvas, fov: 30, bloom: { strength: 0.55, radius: 0.55, threshold: 0.82 }, shadows: !mobile, exposure: 1.0 });
  const { scene, camera, renderer } = stage;
  renderer.localClippingEnabled = true;
  scene.fog = new THREE.FogExp2('#03070e', 0.055);

  // ---------------------------------------------------------------- porte
  const door = buildDoor({
    color: '#2a323b',
    colorInt: '#2a323b',
    frameColor: '#1b2129',
    finish: 'acier',
    molding: 'moderne',
    handle: 'bequille',
    lockPoints: 5,
    peephole: true,
  });
  const H = door.opts.height;
  const W = door.opts.width;
  scene.add(door.group);

  // plan de coupe pour l'apparition « scan »
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), -0.01);
  Object.values(door.materials).forEach((m) => {
    m.clippingPlanes = [clip];
  });

  // ---------------------------------------------------------------- mur + portail lumineux
  const wallMat = new THREE.MeshStandardMaterial({ color: '#0b121b', roughness: 0.82, metalness: 0.25 });
  const wallDepth = 0.3;
  const fw = 0.065;
  const holeW = W + fw * 2;
  const holeH = H + fw;
  const wallW = 9;
  const wallH = 5.5;
  const zWall = -0.01 - wallDepth / 2 + 0.055;
  const side = (wallW - holeW) / 2;
  const wl = new THREE.Mesh(new THREE.BoxGeometry(side, wallH, wallDepth), wallMat);
  wl.position.set(-holeW / 2 - side / 2, wallH / 2, zWall);
  const wr = wl.clone();
  wr.position.x = holeW / 2 + side / 2;
  const wt = new THREE.Mesh(new THREE.BoxGeometry(holeW, wallH - holeH, wallDepth), wallMat);
  wt.position.set(0, holeH + (wallH - holeH) / 2, zWall);
  [wl, wr, wt].forEach((m) => {
    m.receiveShadow = true;
    scene.add(m);
  });
  // panneaux muraux (rainures verticales discrètes)
  const seamMat = new THREE.MeshBasicMaterial({ color: '#16212e' });
  for (let i = -6; i <= 6; i++) {
    const x = i * 0.62;
    if (Math.abs(x) < holeW / 2 + 0.25) continue;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.004, wallH), seamMat);
    s.position.set(x, wallH / 2, zWall + wallDepth / 2 + 0.001);
    scene.add(s);
  }
  // liseré LED orange autour de l'ouverture
  const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6622').multiplyScalar(2.2), toneMapped: false });
  const ledOff = 0.16;
  const led = new THREE.Group();
  const lw = holeW + ledOff * 2;
  const lh = holeH + ledOff;
  const zl = zWall + wallDepth / 2 + 0.002;
  const mk = (w: number, h: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ledMat);
    m.position.set(x, y, zl);
    led.add(m);
  };
  const lt = 0.012;
  mk(lt, lh, -lw / 2, lh / 2);
  mk(lt, lh, lw / 2, lh / 2);
  mk(lw + lt, lt, 0, lh);
  scene.add(led);
  // halo du liseré sur le mur (bandes douces le long des LED, sans recouvrir la porte)
  const haloMat = new THREE.MeshBasicMaterial({ map: lineGlowTexture('255,110,50'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.22 });
  const halo = new THREE.Group();
  const hg = (w: number, h: number, x: number, y: number, rot = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), haloMat);
    m.position.set(x, y, zl + 0.001);
    m.rotation.z = rot;
    halo.add(m);
  };
  const gw = 0.34;
  hg(lh, gw, -lw / 2 - 0.02, lh / 2, Math.PI / 2);
  hg(lh, gw, lw / 2 + 0.02, lh / 2, Math.PI / 2);
  hg(lw + gw, gw, 0, lh + 0.02);
  scene.add(halo);

  // témoins de verrouillage (alignés sur les pênes, montant côté serrure)
  const indOn = new THREE.Color('#ff6622');
  const indOff = new THREE.Color('#3ecf8e');
  const indicators: THREE.Mesh[] = door.bolts.map((b) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.05), new THREE.MeshBasicMaterial({ color: indOn.clone().multiplyScalar(2.2), toneMapped: false }));
    const wp = b.getWorldPosition(new THREE.Vector3());
    m.position.set(W / 2 + fw / 2, wp.y, 0.047);
    scene.add(m);
    return m;
  });

  // ---------------------------------------------------------------- lumière derrière la porte
  const backMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd2b0'), toneMapped: false });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), backMat);
  back.position.set(0, 2.5, -2.4);
  scene.add(back);
  backMat.color.setScalar(0);
  const beamMat = new THREE.MeshBasicMaterial({ map: beamTexture('255,200,160'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, side: THREE.DoubleSide });
  const beams = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.55 + i * 0.1, 4.2), beamMat);
    b.position.set(-0.3 + i * 0.16, 0.9, 0.9);
    b.rotation.set(-1.25, (i - 2) * 0.12, 0);
    beams.add(b);
  }
  scene.add(beams);
  const doorLight = new THREE.PointLight('#ffb27a', 0, 6, 1.6);
  doorLight.position.set(0, 1.2, -0.6);
  scene.add(doorLight);

  // ---------------------------------------------------------------- sol
  let floor: THREE.Object3D;
  if (!mobile) {
    const refl = new Reflector(new THREE.PlaneGeometry(14, 10), {
      textureWidth: Math.round(stage.size.w * 0.5) || 512,
      textureHeight: Math.round(stage.size.h * 0.5) || 512,
      color: '#6b7a8c',
      clipBias: 0.003,
      multisample: 0,
    });
    refl.rotation.x = -Math.PI / 2;
    refl.position.y = -0.001;
    scene.add(refl);
    floor = refl;
  } else {
    floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshStandardMaterial({ color: '#070b12', roughness: 0.4, metalness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
  }
  // voile + grille au sol
  const grid = gridTexture(1024, 16, '#2e6894', '#ff6622');
  grid.repeat.set(7, 5);
  const overlay = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 10),
    new THREE.MeshBasicMaterial({ color: '#03070e', transparent: true, opacity: 0.78, depthWrite: false }),
  );
  overlay.rotation.x = -Math.PI / 2;
  overlay.position.y = 0.001;
  scene.add(overlay);
  const gridMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 10),
    new THREE.MeshBasicMaterial({ map: grid, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  gridMesh.rotation.x = -Math.PI / 2;
  gridMesh.position.set(0, 0.002, 1.5);
  scene.add(gridMesh);
  // ombre de contact
  const shadowMat = new THREE.MeshBasicMaterial({ map: glowTexture('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false });
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.9), shadowMat);
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, 0.003, 0.25);
  scene.add(contact);

  // ---------------------------------------------------------------- lumières
  scene.add(new THREE.HemisphereLight('#6d8fb3', '#05070a', 0.35));
  const key = new THREE.SpotLight('#dbe8ff', 46, 16, 0.36, 0.7, 1.5);
  key.position.set(-2.2, 4.6, 4.2);
  key.target.position.set(0, 1.0, 0);
  key.castShadow = !mobile;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  const rim = new THREE.SpotLight('#ff6a2a', 9, 10, 0.3, 0.9, 1.4);
  rim.position.set(2.2, 2.6, 0.9);
  rim.target.position.set(0.2, 1.1, 0);
  scene.add(rim, rim.target);
  const fill = new THREE.PointLight('#2e6894', 4, 8, 1.5);
  fill.position.set(-1.8, 0.6, 2.4);
  scene.add(fill);

  // ---------------------------------------------------------------- poussières
  const N = mobile ? 260 : 700;
  const pos = new Float32Array(N * 3);
  const spd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 7;
    pos[i * 3 + 1] = Math.random() * 3.6;
    pos[i * 3 + 2] = Math.random() * 3.6 - 0.6;
    spd[i] = 0.02 + Math.random() * 0.06;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({
    size: 0.018,
    map: glowTexture('rgba(255,200,160,1)', 'rgba(255,120,60,0)', 64),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.7,
    sizeAttenuation: true,
  });
  const dust = new THREE.Points(pg, pm);
  scene.add(dust);

  // ligne de scan (intro)
  const scanMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a4c').multiplyScalar(3), transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.5, 0.006), scanMat);
  scan.position.z = 0.1;
  scene.add(scan);
  const scanGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 1.2, 0.35),
    new THREE.MeshBasicMaterial({ map: beamTexture('255,140,80'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  scanGlow.position.z = 0.09;
  scene.add(scanGlow);

  // ---------------------------------------------------------------- caméra & cadrage
  const camA = { pos: new THREE.Vector3(2.5, 1.55, 6.9), look: new THREE.Vector3(0.05, 1.12, 0) };
  const camB = { pos: new THREE.Vector3(0.45, 1.25, 3.1), look: new THREE.Vector3(0.0, 1.1, -0.6) };
  const camC = { pos: new THREE.Vector3(0.1, 1.15, 1.25), look: new THREE.Vector3(0, 1.12, -2) };
  const layout = () => {
    const a = stage.size.w / stage.size.h;
    // décale la scène vers la droite sur grand écran (texte à gauche)
    camera.filmOffset = a > 1.25 ? -Math.min(8, (a - 1.05) * 11) : 0;
    camera.fov = a < 0.8 ? 42 : 30;
    camera.updateProjectionMatrix();
  };
  stage.onResize(layout);

  const ptr = pointer();
  const state = { progress: 0, intro: mobile ? 1 : 0 };
  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  const apply = () => {
    const p = state.progress;
    const unlock = ease(seg(p, 0.02, 0.22));
    const open = ease(seg(p, 0.2, 0.72));
    const push = ease(seg(p, 0.7, 1));
    door.setHandle(Math.sin(Math.min(1, unlock * 1.4) * Math.PI) * 1);
    door.setLock(1 - unlock);
    door.setOpen(open * 0.95);
    // lumière
    const li = Math.pow(open, 1.2);
    backMat.color.set('#ffc49a').multiplyScalar(li * 0.95);
    beamMat.opacity = li * 0.16;
    doorLight.intensity = li * 7;
    indicators.forEach((m, i) => {
      const k = THREE.MathUtils.clamp(unlock * 1.3 - i * 0.06, 0, 1);
      (m.material as THREE.MeshBasicMaterial).color.copy(indOn).lerp(indOff, k).multiplyScalar(2.2);
    });
    ledMat.color.set('#ff6622').multiplyScalar(2.2 + li * 1.5);
    // caméra
    if (open < 1 && push === 0) {
      tmpPos.lerpVectors(camA.pos, camB.pos, open);
      tmpLook.lerpVectors(camA.look, camB.look, open);
    } else {
      tmpPos.lerpVectors(camB.pos, camC.pos, push);
      tmpLook.lerpVectors(camB.look, camC.look, push);
    }
    return { tmpPos, tmpLook };
  };

  stage.onFrame((dt, t) => {
    const { tmpPos: cp, tmpLook: cl } = apply();
    const m = ptr.update(0.05);
    const k = 1 - state.progress; // parallaxe réduite pendant l'ouverture
    camera.position.set(cp.x + m.x * 0.35 * k, cp.y - m.y * 0.18 * k, cp.z);
    camera.lookAt(cl);
    // poussières
    const arr = pg.attributes.position.array as Float32Array;
    for (let i = 0; i < N; i++) {
      arr[i * 3 + 1] += spd[i] * dt;
      arr[i * 3] += Math.sin(t * 0.3 + i) * 0.0008;
      if (arr[i * 3 + 1] > 3.6) arr[i * 3 + 1] = 0;
    }
    pg.attributes.position.needsUpdate = true;
    // respiration du liseré
    haloMat.opacity = 0.22 + Math.sin(t * 1.4) * 0.05 + state.progress * 0.2;
    // intro « scan »
    const it = state.intro;
    const y = -0.2 + it * (H + 0.6);
    clip.constant = y;
    const sOp = it > 0 && it < 1 ? Math.sin(it * Math.PI) : 0;
    scan.position.y = y;
    scanGlow.position.y = y;
    scanMat.opacity = sOp;
    (scanGlow.material as THREE.MeshBasicMaterial).opacity = sOp * 0.6;
  });

  stage.start();

  // ---------------------------------------------------------------- ancres HUD
  const anchorDefs: { id: string; obj: () => THREE.Vector3 }[] = [
    { id: 'frame', obj: () => new THREE.Vector3(W / 2 + 0.035, 1.98, 0.05) },
    { id: 'lock', obj: () => door.bolts[1]?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3() },
    { id: 'cyl', obj: () => (door.handles[0] ? door.handles[0].localToWorld(new THREE.Vector3(0, -0.11, 0.02)) : new THREE.Vector3()) },
    { id: 'skin', obj: () => door.leaves[0].localToWorld(new THREE.Vector3(W * 0.62, 0.42, door.opts.thickness / 2)) },
  ];
  const v = new THREE.Vector3();

  return {
    setProgress(p) {
      state.progress = clamp01(p);
    },
    intro(onDone) {
      if (state.intro >= 1) {
        onDone?.();
        return;
      }
      const t0 = performance.now();
      const dur = 2200;
      const step = (now: number) => {
        const k = clamp01((now - t0) / dur);
        state.intro = 1 - Math.pow(1 - k, 3);
        if (k < 1) requestAnimationFrame(step);
        else {
          state.intro = 1;
          onDone?.();
        }
      };
      requestAnimationFrame(step);
    },
    anchors() {
      return anchorDefs.map((a) => {
        v.copy(a.obj()).project(camera);
        return { id: a.id, x: (v.x * 0.5 + 0.5) * stage.size.w, y: (-v.y * 0.5 + 0.5) * stage.size.h, visible: v.z < 1 };
      });
    },
    dispose() {
      door.dispose();
      stage.dispose();
    },
  };
}
