import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStage } from './stage';
import { buildDoor, type DoorOptions, type DoorRig } from './door-model';
import { glowTexture, gridTexture, grainNormal } from './textures';

/*
 * Configurateur 3D : porte posée dans un mur, vue extérieure / intérieure,
 * ouverture animée, cotes en temps réel, vue « rayons X » de la structure.
 */
export type View = 'ext' | 'int';
export type Ambiance = 'studio' | 'jour';

const FW = 0.065; // largeur du dormant (voir door-model)
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createConfigurator(canvas: HTMLCanvasElement, labels: { w: HTMLElement; h: HTMLElement }) {
  const stage = createStage({ canvas, fov: 32, bloom: { strength: 0.32, radius: 0.5, threshold: 0.92 }, shadows: true, exposure: 1.0, alpha: false, envIntensity: 0.75 });
  const { scene, camera, renderer } = stage;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const bg = new THREE.Color('#05080d');
  scene.background = bg;
  scene.fog = new THREE.Fog(bg, 9, 24);

  // ---------------------------------------------------------------- lumières
  const hemi = new THREE.HemisphereLight('#9dbbe0', '#0a0d12', 0.45);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#fff4ea', 1.6);
  key.position.set(-2.2, 4.2, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3.5;
  key.shadow.camera.bottom = -0.5;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const back = new THREE.DirectionalLight('#dfe8f5', 1.1);
  back.position.set(2.4, 3.6, -4.5);
  scene.add(back);
  const rimO = new THREE.PointLight('#ff6a2a', 5, 6, 1.6);
  rimO.position.set(1.6, 2.4, 1.1);
  scene.add(rimO);
  const rimB = new THREE.PointLight('#3f87c9', 4, 6, 1.6);
  rimB.position.set(-1.6, 0.6, 1.4);
  scene.add(rimB);

  // ---------------------------------------------------------------- sol
  const grid = gridTexture(1024, 16, '#2e6894', '#ff6622').clone();
  grid.wrapS = grid.wrapT = THREE.RepeatWrapping;
  grid.repeat.set(10, 10);
  grid.needsUpdate = true;
  const floorMat = new THREE.MeshStandardMaterial({ color: '#0a121c', roughness: 0.5, metalness: 0.1, envMapIntensity: 0.35 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const floorGrid = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshBasicMaterial({ map: grid, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  floorGrid.rotation.x = -Math.PI / 2;
  floorGrid.position.y = 0.002;
  scene.add(floorGrid);

  // ---------------------------------------------------------------- mur (reconstruit selon la taille)
  const wallMat = new THREE.MeshStandardMaterial({ color: '#0f1926', roughness: 0.88, metalness: 0.05, normalMap: grainNormal(), normalScale: new THREE.Vector2(0.25, 0.25) });
  const LED = () => new THREE.Color('#ff6622').multiplyScalar(1.5);
  const ledMat = new THREE.MeshBasicMaterial({ color: LED(), toneMapped: false });
  const wallGroup = new THREE.Group();
  scene.add(wallGroup);
  const WALL_D = 0.2;
  const buildWall = (W: number, H: number) => {
    wallGroup.children.forEach((c) => (c as THREE.Mesh).geometry?.dispose());
    wallGroup.clear();
    const a = W / 2 + FW;
    const h = H + FW;
    const s = new THREE.Shape();
    s.moveTo(-6, 0);
    s.lineTo(-a, 0);
    s.lineTo(-a, h);
    s.lineTo(a, h);
    s.lineTo(a, 0);
    s.lineTo(6, 0);
    s.lineTo(6, 3.4);
    s.lineTo(-6, 3.4);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: WALL_D, bevelEnabled: false });
    g.translate(0, 0, -WALL_D / 2 - 0.01);
    const wall = new THREE.Mesh(g, wallMat);
    wall.receiveShadow = true;
    wall.castShadow = true;
    wallGroup.add(wall);
    // bandeaux lumineux verticaux de part et d'autre de la porte (deux faces)
    for (const side of [-1, 1])
      for (const face of [1, -1]) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.008, h * 0.8, 0.006), ledMat);
        led.position.set(side * (a + 0.55), h * 0.4 + 0.25, face * (WALL_D / 2 + 0.001) - 0.01);
        wallGroup.add(led);
      }
    // plinthe lumineuse
    for (const face of [1, -1]) {
      const sk = new THREE.Mesh(new THREE.BoxGeometry(12, 0.004, 0.006), ledMat);
      sk.position.set(0, 0.02, face * (WALL_D / 2 + 0.004) - 0.01);
      wallGroup.add(sk);
    }
  };

  // lumière derrière la porte (visible à l'ouverture)
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,214,180,1)', 'rgba(255,102,34,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const glowBack = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), glowMat);
  glowBack.position.set(0, 1.1, -1.4);
  scene.add(glowBack);
  const glowFront = glowBack.clone();
  glowFront.material = glowMat.clone();
  glowFront.position.z = 1.4;
  glowFront.rotation.y = Math.PI;
  scene.add(glowFront);

  // ---------------------------------------------------------------- cotes
  const dimMat = new THREE.LineBasicMaterial({ color: '#ff8a4c', transparent: true, opacity: 0.9, toneMapped: false });
  const dims = new THREE.Group();
  scene.add(dims);
  const anchors = { w: new THREE.Vector3(), h: new THREE.Vector3() };
  let showDims = true;
  const buildDims = (W: number, H: number, z: number) => {
    dims.children.forEach((c) => (c as THREE.Line).geometry.dispose());
    dims.clear();
    const y = H + FW + 0.14;
    const x = -(W / 2 + FW + 0.16);
    const seg = (pts: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      dims.add(new THREE.LineSegments(g, dimMat));
    };
    const t = 0.05;
    seg([-W / 2, y, z, W / 2, y, z, -W / 2, y - t, z, -W / 2, y + t, z, W / 2, y - t, z, W / 2, y + t, z]);
    seg([x, 0, z, x, H, z, x - t, 0, z, x + t, 0, z, x - t, H, z, x + t, H, z]);
    anchors.w.set(0, y, z);
    anchors.h.set(x, H / 2, z);
  };
  const v = new THREE.Vector3();
  const placeLabel = (el: HTMLElement, p: THREE.Vector3) => {
    v.copy(p).project(camera);
    const vis = showDims && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    el.style.opacity = vis ? '1' : '0';
    el.style.transform = `translate(-50%,-50%) translate(${((v.x + 1) / 2) * stage.size.w}px, ${((1 - v.y) / 2) * stage.size.h}px)`;
  };

  // ---------------------------------------------------------------- contrôles
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 2.2;
  controls.maxDistance = 7.5;
  controls.minPolarAngle = 0.95;
  controls.maxPolarAngle = 1.58;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.7;
  const AZ = 1.25;
  const setAzLimits = (view: View) => {
    if (view === 'ext') {
      controls.minAzimuthAngle = -AZ;
      controls.maxAzimuthAngle = AZ;
    } else {
      controls.minAzimuthAngle = Math.PI - AZ;
      controls.maxAzimuthAngle = Math.PI + AZ;
    }
  };

  let door: DoorRig | null = null;
  let opts: DoorOptions | null = null;
  let view: View = 'ext';
  let xray = false;
  let openTarget = 0;
  let openP = 0; // 0 fermé → 1 ouvert (séquence complète)
  let idle = 0;
  let autoSpin = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const frameCam = (instant = false) => {
    const H = opts?.height ?? 2.1;
    const W = opts?.width ?? 0.93;
    const target = new THREE.Vector3(0, H * 0.5, 0);
    const aspect = stage.size.w / stage.size.h;
    const need = Math.max(H + 1.25, (W + 1.8) / Math.max(aspect, 0.5));
    const dist = THREE.MathUtils.clamp(need / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))), 3, 7.4);
    const side = view === 'ext' ? 1 : -1;
    const pos = new THREE.Vector3(0.36 * dist * side, H * 0.62, dist * 0.93 * side);
    if (instant) {
      camera.position.copy(pos);
      controls.target.copy(target);
      controls.update();
    } else tweenTo(pos, target);
  };

  // transition caméra en arc (autour du mur)
  let tween: { from: THREE.Spherical; to: THREE.Spherical; tf: THREE.Vector3; tt: THREE.Vector3; t: number } | null = null;
  const tweenTo = (pos: THREE.Vector3, target: THREE.Vector3) => {
    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const to = new THREE.Spherical().setFromVector3(pos.clone().sub(target));
    // plus court chemin en azimut
    let d = to.theta - from.theta;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    to.theta = from.theta + d;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    tween = { from, to, tf: controls.target.clone(), tt: target, t: 0 };
  };

  const applyXray = () => {
    if (!door) return;
    const m = door.materials.matExt as THREE.MeshStandardMaterial;
    const mi = door.materials.matInt as THREE.MeshStandardMaterial;
    const target = view === 'ext' ? m : mi;
    for (const mm of [m, mi]) {
      const on = xray && mm === target;
      mm.transparent = on;
      mm.opacity = on ? 0.12 : 1;
      mm.depthWrite = !on;
      mm.needsUpdate = true;
    }
    const edge = door.materials.matEdge as THREE.MeshStandardMaterial;
    edge.transparent = xray;
    edge.opacity = xray ? 0.35 : 1;
    edge.needsUpdate = true;
  };

  const setDoor = (o: DoorOptions) => {
    const sizeChanged = !opts || opts.width !== o.width || opts.height !== o.height;
    if (door) {
      scene.remove(door.group);
      door.dispose();
    }
    door = buildDoor({ ...o, internals: xray });
    opts = o;
    door.group.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    scene.add(door.group);
    if (sizeChanged) {
      buildWall(o.width, o.height);
      buildDims(o.width, o.height, view === 'ext' ? WALL_D / 2 + 0.03 : -WALL_D / 2 - 0.05);
    }
    applyXray();
    applyPose();
  };

  const seq = (p: number) => {
    // 0–0.18 : pênes rentrent · 0.18–0.3 : béquille · 0.3–1 : ouverture
    const lock = 1 - THREE.MathUtils.clamp(p / 0.18, 0, 1);
    const handle = p < 0.3 ? THREE.MathUtils.clamp((p - 0.16) / 0.1, 0, 1) : 1 - THREE.MathUtils.clamp((p - 0.3) / 0.12, 0, 1);
    const open = ease(THREE.MathUtils.clamp((p - 0.3) / 0.7, 0, 1));
    return { lock, handle, open };
  };
  const applyPose = () => {
    if (!door) return;
    const s = seq(openP);
    door.setLock(s.lock);
    door.setHandle(s.handle);
    door.setOpen(s.open);
    const gO = s.open * (ambiance === 'studio' ? 0.55 : 0.3);
    glowMat.opacity = view === 'ext' ? gO : 0;
    (glowFront.material as THREE.MeshBasicMaterial).opacity = view === 'int' ? gO : 0;
  };

  // ---------------------------------------------------------------- ambiances
  let ambiance: Ambiance = 'studio';
  const setAmbiance = (a: Ambiance) => {
    ambiance = a;
    const day = a === 'jour';
    bg.set(day ? '#c9d0d6' : '#05080d');
    (scene.fog as THREE.Fog).color.copy(bg);
    wallMat.color.set(day ? '#e4dfd6' : '#0f1926');
    floorMat.color.set(day ? '#8d8479' : '#0a121c');
    floorMat.roughness = day ? 0.6 : 0.5;
    floorGrid.visible = !day;
    ledMat.color.copy(day ? new THREE.Color('#f3efe8') : LED());
    hemi.intensity = day ? 1.3 : 0.45;
    key.intensity = day ? 2.2 : 1.6;
    back.intensity = day ? 1.6 : 1.1;
    rimO.intensity = day ? 0 : 5;
    rimB.intensity = day ? 0 : 4;
    (scene as any).environmentIntensity = day ? 1 : 0.75;
    if (stage.bloom) stage.bloom.strength = day ? 0.12 : 0.32;
    dimMat.color.set(day ? '#d9480f' : '#ff8a4c');
    applyPose();
  };

  // ---------------------------------------------------------------- boucle
  const onUser = () => {
    idle = 0;
  };
  controls.addEventListener('start', () => {
    onUser();
    autoSpin = false;
  });

  stage.onResize(() => frameCam(true));
  stage.onFrame((dt, t) => {
    idle += dt;
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / 1.2);
      const k = ease(tween.t);
      const s = new THREE.Spherical(
        THREE.MathUtils.lerp(tween.from.radius, tween.to.radius, k),
        THREE.MathUtils.lerp(tween.from.phi, tween.to.phi, k),
        THREE.MathUtils.lerp(tween.from.theta, tween.to.theta, k),
      );
      // écarte la caméra du mur pendant le passage latéral
      s.radius *= 1 + Math.sin(k * Math.PI) * (Math.abs(tween.to.theta - tween.from.theta) > 1.5 ? 0.35 : 0);
      controls.target.lerpVectors(tween.tf, tween.tt, k);
      camera.position.setFromSpherical(s).add(controls.target);
      camera.lookAt(controls.target);
      if (tween.t >= 1) {
        tween = null;
        setAzLimits(view);
        controls.update();
      }
    } else {
      // balancement léger au repos
      if (autoSpin && idle > 2.5) {
        const base = view === 'ext' ? 0 : Math.PI;
        const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
        const goal = base + Math.sin(t * 0.25) * 0.45;
        sph.theta += (goal - sph.theta) * 0.01;
        camera.position.setFromSpherical(sph).add(controls.target);
      }
      controls.update();
    }
    // ouverture / fermeture
    if (openP !== openTarget) {
      const dir = Math.sign(openTarget - openP);
      openP = THREE.MathUtils.clamp(openP + dir * dt * 0.55, 0, 1);
      if ((dir > 0 && openP >= openTarget) || (dir < 0 && openP <= openTarget)) openP = openTarget;
      applyPose();
    }
    placeLabel(labels.w, anchors.w);
    placeLabel(labels.h, anchors.h);
  });

  setAmbiance('studio');
  setAzLimits('ext');

  return {
    stage,
    setDoor,
    get options() {
      return opts;
    },
    setView(v2: View) {
      if (v2 === view) return;
      view = v2;
      if (opts) buildDims(opts.width, opts.height, view === 'ext' ? WALL_D / 2 + 0.03 : -WALL_D / 2 - 0.05);
      applyXray();
      applyPose();
      frameCam();
    },
    get view() {
      return view;
    },
    toggleOpen() {
      openTarget = openTarget > 0.5 ? 0 : 1;
      return openTarget === 1;
    },
    setXray(on: boolean) {
      xray = on;
      if (opts) setDoor(opts);
    },
    setDims(on: boolean) {
      showDims = on;
      dims.visible = on;
    },
    setAmbiance,
    reset() {
      autoSpin = false;
      frameCam();
    },
    /** Capture PNG de la vue courante. */
    snapshot() {
      stage.renderOnce();
      return canvas.toDataURL('image/png');
    },
    dispose() {
      controls.dispose();
      door?.dispose();
      stage.dispose();
    },
  };
}
