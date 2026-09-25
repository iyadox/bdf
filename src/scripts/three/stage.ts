import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export interface StageOptions {
  canvas: HTMLCanvasElement;
  fov?: number;
  bloom?: { strength: number; radius: number; threshold: number } | false;
  maxDpr?: number;
  alpha?: boolean;
  shadows?: boolean;
  exposure?: number;
  envIntensity?: number;
}

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer?: EffectComposer;
  bloom?: UnrealBloomPass;
  size: { w: number; h: number };
  onFrame: (fn: (dt: number, t: number) => void) => void;
  onResize: (fn: (w: number, h: number) => void) => void;
  start: () => void;
  stop: () => void;
  renderOnce: () => void;
  dispose: () => void;
  visible: boolean;
}

export const isMobileGpu = () => window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;

export function createStage(o: StageOptions): Stage {
  const canvas = o.canvas;
  const mobile = isMobileGpu();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !o.bloom || mobile,
    alpha: o.alpha ?? true,
    powerPreference: 'high-performance',
  });
  const dpr = Math.min(window.devicePixelRatio || 1, o.maxDpr ?? (mobile ? 1.5 : 1.8));
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposure ?? 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (o.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  (scene as any).environmentIntensity = o.envIntensity ?? 0.9;

  const camera = new THREE.PerspectiveCamera(o.fov ?? 35, 1, 0.05, 200);

  let composer: EffectComposer | undefined;
  let bloom: UnrealBloomPass | undefined;
  if (o.bloom && !mobile) {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), o.bloom.strength, o.bloom.radius, o.bloom.threshold);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  const size = { w: 1, h: 1 };
  const frameFns: ((dt: number, t: number) => void)[] = [];
  const resizeFns: ((w: number, h: number) => void)[] = [];

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (w === size.w && h === size.h) return;
    size.w = w;
    size.h = h;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resizeFns.forEach((f) => f(w, h));
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const timer = new THREE.Timer();
  let running = false;
  let raf = 0;
  const render = () => (composer ? composer.render() : renderer.render(scene, camera));
  const loop = () => {
    raf = requestAnimationFrame(loop);
    timer.update();
    const dt = Math.min(Math.max(timer.getDelta(), 0), 0.05);
    const t = timer.getElapsed();
    frameFns.forEach((f) => f(dt, t));
    render();
  };

  const stage: Stage = {
    renderer,
    scene,
    camera,
    composer,
    bloom,
    size,
    visible: true,
    onFrame: (fn) => frameFns.push(fn),
    onResize: (fn) => {
      resizeFns.push(fn);
      fn(size.w, size.h);
    },
    start() {
      if (running) return;
      running = true;
      timer.update();
      loop();
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    renderOnce: render,
    dispose() {
      stage.stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      env.dispose();
      pmrem.dispose();
      composer?.dispose();
      renderer.dispose();
    },
  };

  // pause hors écran / onglet caché
  const io = new IntersectionObserver(
    ([e]) => {
      stage.visible = e.isIntersecting;
      if (e.isIntersecting && !document.hidden) stage.start();
      else stage.stop();
    },
    { rootMargin: '100px' },
  );
  io.observe(canvas);
  const onVis = () => {
    if (document.hidden) stage.stop();
    else if (stage.visible) stage.start();
  };
  document.addEventListener('visibilitychange', onVis);

  return stage;
}

/** Pointeur normalisé (-1..1) lissé, relatif à la fenêtre. */
export function pointer() {
  const p = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener(
    'pointermove',
    (e) => {
      p.tx = (e.clientX / window.innerWidth) * 2 - 1;
      p.ty = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true },
  );
  const update = (k = 0.06) => {
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
    return p;
  };
  return { p, update };
}
