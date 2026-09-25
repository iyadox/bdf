import * as THREE from 'three';
import { createStage, pointer } from './stage';
import { buildDoor } from './door-model';
import { glowTexture, gridTexture } from './textures';

/*
 * Vue éclatée d'une porte blindée : chaque couche se sépare au défilement
 * et la couche décrite à l'écran est mise en valeur.
 */
export type LayerId = 'front' | 'omegas' | 'wool' | 'lock' | 'hinges' | 'frame' | 'seals';

export function createAnatomy(canvas: HTMLCanvasElement) {
  const stage = createStage({ canvas, fov: 28, bloom: { strength: 0.3, radius: 0.4, threshold: 1.0 }, exposure: 0.95 });
  const { scene, camera } = stage;

  const door = buildDoor({
    color: '#33404d',
    colorInt: '#33404d',
    frameColor: '#222a33',
    finish: 'lisse',
    molding: 'aucune',
    internals: true,
    lockPoints: 5,
    peephole: true,
    handle: 'bequille',
  });
  const root = new THREE.Group();
  root.add(door.group);
  root.position.set(0, -1.04, 0);
  scene.add(root);

  const L = door.layers;
  const base = new Map<THREE.Object3D, THREE.Vector3>();
  Object.values(L).forEach((o) => base.set(o, o.position.clone()));
  // positions éclatées (décalages locaux)
  const off: Record<string, THREE.Vector3> = {
    front: new THREE.Vector3(0, 0, 0.66),
    decor: new THREE.Vector3(0, 0, 0.66),
    omegas: new THREE.Vector3(0, 0, 0.34),
    wool: new THREE.Vector3(0, 0, 0.02),
    back: new THREE.Vector3(0, 0, -0.5),
    lock: new THREE.Vector3(0.42, 0, 0.12),
    faceplate: new THREE.Vector3(0.42, 0, 0.12),
    hinges: new THREE.Vector3(-0.3, 0, -0.15),
    seals: new THREE.Vector3(0, 0.16, 0.5),
    frame: new THREE.Vector3(0, 0, -1.05),
  };
  // les poignées suivent la face avant
  const handles = door.handles;
  const handleBase = handles.map((h) => h.position.clone());

  // lumières
  scene.add(new THREE.HemisphereLight('#4a7396', '#070a0f', 0.35));
  const key = new THREE.DirectionalLight('#ffffff', 1.5);
  key.position.set(-2, 3, 4);
  scene.add(key);
  const rim = new THREE.PointLight('#4a7396', 8, 8, 1.6);
  rim.position.set(1.8, 0.8, -1);
  scene.add(rim);
  const blue = new THREE.PointLight('#2e6894', 6, 8, 1.4);
  blue.position.set(-1.6, -0.6, 1.6);
  scene.add(blue);

  // socle holographique
  const grid = gridTexture(1024, 16, '#2e6894', '#4a7396');
  grid.repeat.set(2, 2);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 64),
    new THREE.MeshBasicMaterial({ map: grid, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -1.05;
  scene.add(disc);
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#4a7396').multiplyScalar(1.8), toneMapped: false, transparent: true, opacity: 0.8 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.212, 96), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -1.04;
  scene.add(ring);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 3.6),
    new THREE.MeshBasicMaterial({ map: glowTexture('rgba(46,104,148,0.8)', 'rgba(46,104,148,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -1.049;
  scene.add(glow);

  // surbrillance : on atténue les couches non sélectionnées
  const layerMeshes: Record<string, THREE.Mesh[]> = {};
  Object.entries(L).forEach(([k, o]) => {
    layerMeshes[k] = [];
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.material = (m.material as THREE.Material).clone();
        (m.material as THREE.Material).transparent = true;
        layerMeshes[k].push(m);
      }
    });
  });

  const state = { explode: 0, targetExplode: 0, focus: '' as string, rot: 0 };
  const ptr = pointer();
  const look = new THREE.Vector3(0.08, 0, 0);
  const camDir = new THREE.Vector3(2.2, 0.8, 3.4).normalize();
  const camDirPortrait = new THREE.Vector3(2.2, 0.8, 3.4).normalize();
  let camDist = 6;
  let spread = 1; // amplitude de l'éclatement
  let portrait = false;
  stage.onResize((w, h) => {
    const a = w / h;
    // écran vertical ou petite zone d'affichage (téléphone) : cadrage dédié
    portrait = a < 0.95 || h < 560;
    // écran vertical (téléphone) : éclatement resserré et porte cadrée sur toute la hauteur
    spread = portrait ? 0.6 : 1;
    const fit = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camDist = portrait ? Math.max(3.1, 2.45 / a) / fit : Math.max(5.6, 4.9 / a);
    // sur téléphone, l'en-tête peut recouvrir le haut : la porte est légèrement abaissée
    look.y = portrait ? 0.2 : 0;
  });

  const focusGroups: Record<string, string[]> = {
    front: ['front', 'back', 'decor'],
    omegas: ['omegas'],
    wool: ['wool'],
    lock: ['lock', 'faceplate'],
    hinges: ['hinges'],
    frame: ['frame'],
    seals: ['seals'],
  };

  stage.onFrame((dt, t) => {
    state.explode += (state.targetExplode - state.explode) * Math.min(1, dt * 4);
    const e = state.explode;
    for (const [k, o] of Object.entries(L)) {
      const b = base.get(o)!;
      const d = off[k];
      const amp = e * spread;
      if (d) o.position.set(b.x + d.x * amp, b.y + d.y * amp, b.z + d.z * amp);
    }
    handles.forEach((h, i) => {
      const side = i === 0 ? 1 : -1;
      const d = side > 0 ? off.front.z : off.back.z;
      h.position.set(handleBase[i].x, handleBase[i].y, handleBase[i].z + d * e * spread);
    });
    // mise en valeur
    const active = focusGroups[state.focus] || [];
    for (const [k, meshes] of Object.entries(layerMeshes)) {
      const on = !state.focus || active.includes(k);
      for (const m of meshes) {
        const mat = m.material as THREE.MeshStandardMaterial;
        const target = on ? 1 : 0.12;
        mat.opacity += (target - mat.opacity) * Math.min(1, dt * 6);
        mat.depthWrite = mat.opacity > 0.6;
        if ('emissive' in mat && mat.emissive) {
          const glowK = on && state.focus ? 0.26 + Math.sin(t * 3) * 0.1 : 0;
          // lueur bleue (#4a7396) sur la couche décrite
          mat.emissive.setRGB(glowK * 0.22, glowK * 0.56, glowK);
        }
      }
    }
    // rotation lente + souris
    const m = ptr.update(0.05);
    state.rot += dt * 0.12;
    root.rotation.y = -0.78 + Math.sin(state.rot) * 0.16 + m.x * 0.25;
    camera.position.copy(portrait ? camDirPortrait : camDir).multiplyScalar(camDist);
    camera.position.x += m.x * 0.25;
    camera.position.y -= m.y * 0.2;
    camera.lookAt(look);
    ring.rotation.z = t * 0.2;
  });
  stage.start();

  return {
    setExplode(v: number) {
      state.targetExplode = v;
    },
    setFocus(id: string) {
      state.focus = id;
    },
    dispose() {
      door.dispose();
      stage.dispose();
    },
  };
}
