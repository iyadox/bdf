import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { brushedNormal, grainNormal, woodTexture, woolTexture } from './textures';

/*
 * Porte blindée procédurale (unités : mètres).
 * Repère : porte centrée en x=0, sol en y=0, face extérieure vers +z.
 */

export type Finish = 'lisse' | 'texture' | 'bois' | 'acier';
export type Molding = 'aucune' | 'classique' | 'moderne' | 'rainures' | 'cadre';
export type HandleType = 'bequille' | 'tirage' | 'barre';

export interface DoorOptions {
  leaves: 1 | 2;
  width: number; // largeur de passage totale
  height: number;
  thickness: number;
  color: string; // face extérieure
  colorInt: string; // face intérieure
  frameColor: string;
  finish: Finish;
  wood: [string, string];
  molding: Molding;
  handle: HandleType;
  hardware: 'inox' | 'laiton' | 'noir';
  peephole: boolean;
  oculus: boolean;
  closer: boolean;
  grille: boolean;
  lockPoints: number;
  withFrame: boolean;
  internals: boolean; // omégas, isolant, crémone (vue éclatée)
}

export const DEFAULT_DOOR: DoorOptions = {
  leaves: 1,
  width: 0.93,
  height: 2.08,
  thickness: 0.068,
  color: '#2f3740',
  colorInt: '#e8e6e1',
  frameColor: '#262d35',
  finish: 'lisse',
  wood: ['#9a6a3c', '#5b3a1d'],
  molding: 'aucune',
  handle: 'bequille',
  hardware: 'inox',
  peephole: true,
  oculus: false,
  closer: false,
  grille: false,
  lockPoints: 5,
  withFrame: true,
  internals: false,
};

export interface DoorRig {
  group: THREE.Group;
  leaves: THREE.Group[]; // pivots (rotation.y pour ouvrir)
  bolts: THREE.Object3D[]; // translation x pour verrouiller
  handles: THREE.Group[];
  frame?: THREE.Group;
  layers: Record<string, THREE.Object3D>; // pièces de la vue éclatée
  materials: Record<string, THREE.Material>;
  opts: DoorOptions;
  setOpen: (t: number) => void; // 0 fermé → 1 ouvert
  setLock: (t: number) => void; // 1 verrouillé → 0 déverrouillé
  setHandle: (t: number) => void; // 0 repos → 1 abaissée
  dispose: () => void;
}

const HW = {
  inox: { color: '#d7dde3', rough: 0.22 },
  laiton: { color: '#c9a45c', rough: 0.25 },
  noir: { color: '#1b1d20', rough: 0.45 },
};

function skinMaterial(o: DoorOptions, color: string) {
  const m = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.35,
    roughness: 0.38,
    clearcoat: 0.8,
    clearcoatRoughness: 0.25,
  });
  if (o.finish === 'texture') {
    m.normalMap = grainNormal();
    m.normalScale = new THREE.Vector2(0.55, 0.55);
    m.normalMap.repeat.set(3, 6);
    m.roughness = 0.72;
    m.clearcoat = 0.15;
    m.metalness = 0.25;
  } else if (o.finish === 'bois') {
    const t = woodTexture(o.wood[0], o.wood[1]).clone();
    t.needsUpdate = true;
    t.repeat.set(1, 1);
    m.map = t;
    m.color.set('#ffffff');
    m.metalness = 0;
    m.roughness = 0.55;
    m.clearcoat = 0.45;
  } else if (o.finish === 'acier') {
    m.normalMap = brushedNormal();
    m.normalMap.repeat.set(2, 5);
    m.normalScale = new THREE.Vector2(0.35, 0.35);
    m.metalness = 0.85;
    m.roughness = 0.32;
    m.clearcoat = 0.35;
  }
  return m;
}

function box(w: number, h: number, d: number, mat: THREE.Material, r = 0.003) {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(r: number, h: number, mat: THREE.Material, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.castShadow = true;
  return m;
}

export function buildDoor(partial: Partial<DoorOptions> = {}): DoorRig {
  const o: DoorOptions = { ...DEFAULT_DOOR, ...partial };
  const group = new THREE.Group();
  group.name = 'porte';

  const matExt = skinMaterial(o, o.color);
  const matInt = skinMaterial({ ...o, finish: o.finish === 'bois' ? 'lisse' : o.finish }, o.colorInt);
  const matEdge = new THREE.MeshStandardMaterial({ color: new THREE.Color(o.color).multiplyScalar(0.7), metalness: 0.6, roughness: 0.4 });
  const matFrame = new THREE.MeshPhysicalMaterial({ color: o.frameColor, metalness: 0.5, roughness: 0.42, clearcoat: 0.4 });
  const hw = HW[o.hardware];
  const matMetal = new THREE.MeshStandardMaterial({ color: hw.color, metalness: 1, roughness: hw.rough });
  const matChrome = new THREE.MeshStandardMaterial({ color: '#e9eef2', metalness: 1, roughness: 0.12 });
  const matSteel = new THREE.MeshStandardMaterial({ color: '#9aa4ad', metalness: 0.9, roughness: 0.35, normalMap: brushedNormal() });
  const matDark = new THREE.MeshStandardMaterial({ color: '#0b0e12', metalness: 0.4, roughness: 0.6 });
  const matGroove = new THREE.MeshStandardMaterial({ color: new THREE.Color(o.color).multiplyScalar(0.45), metalness: 0.4, roughness: 0.6 });
  const matGlass = new THREE.MeshPhysicalMaterial({
    color: '#9fc4e6',
    metalness: 0.1,
    roughness: 0.04,
    transparent: true,
    opacity: 0.42,
    clearcoat: 1,
  });
  const matOrange = new THREE.MeshStandardMaterial({ color: '#ff6622', emissive: '#ff4a0a', emissiveIntensity: 1.4, metalness: 0.2, roughness: 0.4 });
  const matWool = new THREE.MeshStandardMaterial({ map: woolTexture(), roughness: 1, metalness: 0 });

  const materials: Record<string, THREE.Material> = { matExt, matInt, matEdge, matFrame, matMetal, matChrome, matSteel, matDark, matGroove, matGlass, matOrange, matWool };
  const layers: Record<string, THREE.Object3D> = {};

  const W = o.width;
  const H = o.height;
  const T = o.thickness;
  const gap = 0.004;
  const leafH = H - 0.012;

  // ---------------------------------------------------------------- huisserie
  let frame: THREE.Group | undefined;
  const fw = 0.065; // largeur visible du dormant
  const fd = 0.11; // profondeur
  if (o.withFrame) {
    frame = new THREE.Group();
    frame.name = 'huisserie';
    const jambL = box(fw, H + fw, fd, matFrame, 0.004);
    jambL.position.set(-W / 2 - fw / 2, (H + fw) / 2, -0.01);
    const jambR = jambL.clone();
    jambR.position.x = W / 2 + fw / 2;
    const head = box(W + fw * 2, fw, fd, matFrame, 0.004);
    head.position.set(0, H + fw / 2, -0.01);
    // feuillure (butée intérieure)
    const stopMat = matFrame;
    const stopL = box(0.014, H, 0.026, stopMat, 0.002);
    stopL.position.set(-W / 2 + 0.004, H / 2, T / 2 + 0.013);
    const stopR = stopL.clone();
    stopR.position.x = W / 2 - 0.004;
    const stopT = box(W, 0.014, 0.026, stopMat, 0.002);
    stopT.position.set(0, H - 0.004, T / 2 + 0.013);
    // barre de seuil
    const sill = box(W + fw * 2, 0.012, fd + 0.02, matSteel, 0.002);
    sill.position.set(0, 0.006, -0.01);
    // gâches (réception des pênes) sur le montant côté serrure
    frame.add(jambL, jambR, head, stopL, stopR, stopT, sill);
    // joint périphérique
    const seal = new THREE.MeshStandardMaterial({ color: '#15181c', roughness: 0.9 });
    const sealL = box(0.006, H - 0.01, 0.012, seal, 0);
    sealL.position.set(-W / 2 + 0.002, H / 2, T / 2 + 0.002);
    const sealR = sealL.clone();
    sealR.position.x = W / 2 - 0.002;
    frame.add(sealL, sealR);
    group.add(frame);
    layers.frame = frame;
  }

  // ---------------------------------------------------------------- vantaux
  const leafWidths = o.leaves === 2 ? [W * 0.4 - gap, W * 0.6 - gap] : [W - gap * 2];
  const leaves: THREE.Group[] = [];
  const bolts: THREE.Object3D[] = [];
  const handles: THREE.Group[] = [];

  leafWidths.forEach((lw, li) => {
    const isMain = o.leaves === 1 || li === 1;
    // pivot : 1 vantail → charnières à gauche ; 2 vantaux → semi-fixe à gauche, principal à droite
    const hingeLeft = o.leaves === 1 || li === 0;
    const pivot = new THREE.Group();
    pivot.name = isMain ? 'vantail-principal' : 'vantail-semi-fixe';
    const px = hingeLeft ? -W / 2 + gap : W / 2 - gap;
    pivot.position.set(px, 0, 0);
    group.add(pivot);
    leaves.push(pivot);

    const leaf = new THREE.Group();
    const dir = hingeLeft ? 1 : -1; // direction vers l'intérieur du vantail
    leaf.position.set((dir * lw) / 2, 0.006 + leafH / 2, 0);
    pivot.add(leaf);

    // coque : faces extérieure / intérieure + chants
    const skinT = 0.0015;
    const core = box(lw, leafH, T - skinT * 2, matEdge, 0.004);
    leaf.add(core);
    const front = box(lw - 0.002, leafH - 0.002, skinT, matExt, 0);
    front.position.z = T / 2 - skinT / 2;
    const back = box(lw - 0.002, leafH - 0.002, skinT, matInt, 0);
    back.position.z = -T / 2 + skinT / 2;
    leaf.add(front, back);
    if (isMain) {
      layers.front = front;
      layers.back = back;
      layers.core = core;
    }
    if (o.finish === 'bois') {
      const tex = (matExt.map as THREE.Texture) || null;
      if (tex) tex.repeat.set(lw / 0.9, 1);
    }

    // ------------------------------------------ décors (moulures / rainures)
    const decor = new THREE.Group();
    const zf = T / 2 + 0.001;
    const strip = (w: number, h: number, x: number, y: number, mat: THREE.Material = matExt, d = 0.008, r = 0.002) => {
      const s = box(w, h, d, mat, r);
      s.position.set(x, y, zf + d / 2 - 0.002);
      decor.add(s);
    };
    const pw = lw - 0.2;
    if (o.molding === 'classique') {
      // deux panneaux moulurés (haut / bas)
      const panels = [
        { y: leafH * 0.16, h: leafH * 0.52 },
        { y: -leafH * 0.3, h: leafH * 0.3 },
      ];
      for (const p of panels) {
        const t = 0.028;
        strip(pw, t, 0, p.y + p.h / 2);
        strip(pw, t, 0, p.y - p.h / 2);
        strip(t, p.h, -pw / 2 + t / 2, p.y);
        strip(t, p.h, pw / 2 - t / 2, p.y);
        // panneau central légèrement bombé
        const c = box(pw - 0.1, p.h - 0.1, 0.006, matExt, 0.01);
        c.position.set(0, p.y, zf + 0.001);
        decor.add(c);
      }
    } else if (o.molding === 'cadre') {
      const t = 0.022;
      const h = leafH - 0.24;
      strip(pw, t, 0, h / 2);
      strip(pw, t, 0, -h / 2);
      strip(t, h, -pw / 2, 0);
      strip(t, h, pw / 2, 0);
    } else if (o.molding === 'moderne') {
      for (const k of [-0.28, -0.14, 0, 0.14, 0.28]) strip(lw - 0.12, 0.006, 0, k * leafH, matGroove, 0.003, 0);
    } else if (o.molding === 'rainures') {
      const n = Math.max(3, Math.round(lw / 0.14));
      for (let i = 1; i < n; i++) strip(0.006, leafH - 0.24, -lw / 2 + (i * lw) / n, 0, matGroove, 0.003, 0);
    }
    if (o.grille) {
      // grille de ventilation (portes de cave)
      const gw = lw - 0.3,
        gh = 0.34;
      const gy = leafH / 2 - 0.36;
      const back = box(gw, gh, 0.004, matDark, 0.002);
      back.position.set(0, gy, zf + 0.002);
      decor.add(back);
      for (let i = 0; i < 9; i++) {
        const l = box(gw - 0.02, 0.012, 0.01, matExt, 0.002);
        l.position.set(0, gy - gh / 2 + 0.03 + i * 0.036, zf + 0.006);
        l.rotation.x = -0.5;
        decor.add(l);
      }
    }
    if (o.oculus && isMain) {
      const ow = Math.min(0.28, lw - 0.3),
        oh = 0.62;
      const oy = leafH * 0.2;
      const glass = box(ow, oh, 0.012, matGlass, 0.004);
      glass.position.set(0, oy, zf + 0.004);
      decor.add(glass);
      const t = 0.022;
      for (const [w, h, x, y] of [
        [ow + t * 2, t, 0, oy + oh / 2 + t / 2],
        [ow + t * 2, t, 0, oy - oh / 2 - t / 2],
        [t, oh, -ow / 2 - t / 2, oy],
        [t, oh, ow / 2 + t / 2, oy],
      ] as const)
        strip(w, h, x, y, matSteel, 0.014, 0.003);
    }
    leaf.add(decor);
    if (isMain) layers.decor = decor;

    // ------------------------------------------ paumelles (charnières)
    const hingeX = -dir * (lw / 2) - dir * 0.004;
    const nH = leafH > 2.2 ? 4 : 3;
    const hinges = new THREE.Group();
    hinges.name = 'paumelles';
    for (let i = 0; i < nH; i++) {
      const y = -leafH / 2 + 0.22 + (i * (leafH - 0.44)) / (nH - 1);
      const k = cyl(0.011, 0.14, matChrome);
      k.position.set(hingeX, y, -T / 2 + 0.006);
      hinges.add(k);
      const cap = cyl(0.0115, 0.006, matMetal);
      cap.position.set(hingeX, y + 0.073, -T / 2 + 0.006);
      hinges.add(cap);
      if (o.internals) {
        const rf = box(0.05, 0.2, 0.004, matSteel, 0.001);
        rf.position.set(hingeX + dir * 0.03, y, -T / 2 + 0.012);
        hinges.add(rf);
      }
    }
    leaf.add(hinges);
    if (isMain) layers.hinges = hinges;
    if (o.internals && isMain) {
      const sealMat = new THREE.MeshStandardMaterial({ color: '#c0392b', emissive: '#7a1208', emissiveIntensity: 0.6, roughness: 0.7 });
      materials.matSeal = sealMat;
      const seals = new THREE.Group();
      seals.name = 'joints';
      const st = 0.004;
      for (const sx of [-1, 1]) {
        const e = box(st, leafH - 0.02, 0.012, sealMat, 0);
        e.position.set(sx * (lw / 2 + st / 2), 0, 0);
        seals.add(e);
      }
      const top = box(lw, st, 0.012, sealMat, 0);
      top.position.set(0, leafH / 2 + st / 2, 0);
      seals.add(top);
      leaf.add(seals);
      layers.seals = seals;
    }

    // ------------------------------------------ serrure & pênes (vantail principal)
    if (isMain) {
      const edgeX = dir * (lw / 2);
      // têtière (plaque d'acier sur le chant)
      const face = box(0.004, leafH * 0.86, 0.024, matSteel, 0.001);
      face.position.set(edgeX + dir * 0.002, 0, 0);
      leaf.add(face);
      layers.faceplate = face;
      const lockGroup = new THREE.Group();
      lockGroup.name = 'serrure';
      const n = Math.max(1, o.lockPoints);
      const ys: number[] = [];
      if (n === 1) ys.push(0);
      else {
        const top = leafH * 0.4,
          bot = -leafH * 0.4;
        for (let i = 0; i < n; i++) ys.push(top - (i * (top - bot)) / (n - 1));
      }
      ys.forEach((y) => {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.05, 20), matChrome);
        b.rotation.z = Math.PI / 2;
        b.position.set(edgeX + dir * 0.0, y, 0);
        b.userData.base = b.position.x;
        b.userData.dir = dir;
        b.castShadow = true;
        lockGroup.add(b);
        bolts.push(b);
      });
      // boîtier de serrure (visible en vue éclatée)
      const caseBox = box(0.12, 0.26, 0.018, matDark, 0.003);
      caseBox.position.set(edgeX - dir * 0.07, 0, 0);
      lockGroup.add(caseBox);
      // tringles haute / basse
      const rodT = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, leafH * 0.38, 10), matSteel);
      rodT.position.set(edgeX - dir * 0.03, leafH * 0.21, 0);
      const rodB = rodT.clone();
      rodB.position.y = -leafH * 0.21;
      lockGroup.add(rodT, rodB);
      leaf.add(lockGroup);
      layers.lock = lockGroup;

      // --------------------------------------- poignées (deux faces)
      const hy = 1.02 - (0.006 + leafH / 2); // hauteur 1,02 m
      const hx = edgeX - dir * 0.075;
      for (const side of [1, -1]) {
        const hg = new THREE.Group();
        hg.name = side > 0 ? 'poignee-ext' : 'poignee-int';
        hg.position.set(hx, hy, side * (T / 2));
        const type = side > 0 ? o.handle : o.handle === 'barre' ? 'bequille' : 'bequille';
        if (type === 'tirage' && side > 0) {
          const bar = cyl(0.014, 0.62, matMetal);
          bar.position.set(-dir * 0.0, 0.1, 0.07);
          hg.add(bar);
          for (const yy of [-0.17, 0.37]) {
            const st = cyl(0.009, 0.07, matMetal);
            st.rotation.x = Math.PI / 2;
            st.position.set(0, yy, 0.035);
            hg.add(st);
          }
        } else {
          // rosace + béquille
          const rose = cyl(0.028, 0.012, matMetal, 32);
          rose.rotation.x = Math.PI / 2;
          rose.position.z = side * 0.006;
          const lever = new THREE.Group();
          lever.name = 'bequille';
          const neck = cyl(0.009, 0.05, matMetal);
          neck.rotation.x = Math.PI / 2;
          neck.position.z = side * 0.03;
          const arm = box(0.14, 0.018, 0.02, matMetal, 0.008);
          arm.position.set(-dir * 0.065, 0, side * 0.055);
          lever.add(neck, arm);
          hg.add(rose, lever);
          hg.userData.lever = lever;
        }
        // cylindre de sécurité (A2P) sous la poignée
        const cylRose = cyl(0.024, 0.012, matMetal, 32);
        cylRose.rotation.x = Math.PI / 2;
        cylRose.position.set(0, -0.11, side * 0.006);
        const keyway = box(0.004, 0.018, 0.004, matDark, 0);
        keyway.position.set(0, -0.11, side * 0.013);
        const plug = cyl(0.012, 0.01, matChrome, 24);
        plug.rotation.x = Math.PI / 2;
        plug.position.set(0, -0.11, side * 0.011);
        hg.add(cylRose, plug, keyway);
        leaf.add(hg);
        handles.push(hg);
      }
      if (o.handle === 'barre') {
        // barre anti-panique face intérieure
        const bar = box(lw - 0.22, 0.05, 0.05, matSteel, 0.012);
        bar.position.set(-dir * 0.02, hy, -T / 2 - 0.045);
        const bar2 = box(lw - 0.34, 0.03, 0.03, matOrange, 0.01);
        bar2.position.set(-dir * 0.02, hy, -T / 2 - 0.074);
        leaf.add(bar, bar2);
      }
      if (o.peephole) {
        const ph = cyl(0.011, 0.014, matChrome, 24);
        ph.rotation.x = Math.PI / 2;
        ph.position.set(0, 1.52 - (0.006 + leafH / 2), T / 2 + 0.005);
        const lens = cyl(0.006, 0.003, matGlass, 20);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0, 1.52 - (0.006 + leafH / 2), T / 2 + 0.012);
        leaf.add(ph, lens);
      }
      if (o.closer) {
        const body = box(0.26, 0.055, 0.05, matSteel, 0.01);
        body.position.set(hingeX + dir * 0.2, leafH / 2 - 0.07, -T / 2 - 0.03);
        const arm = box(0.3, 0.018, 0.012, matSteel, 0.004);
        arm.position.set(hingeX + dir * 0.32, leafH / 2 - 0.02, -T / 2 - 0.05);
        arm.rotation.y = 0.2;
        leaf.add(body, arm);
      }
    } else {
      // vantail semi-fixe : verrous haut/bas
      const edgeX = dir * (lw / 2);
      for (const yy of [leafH * 0.45, -leafH * 0.45]) {
        const v = box(0.02, 0.12, 0.016, matSteel, 0.003);
        v.position.set(edgeX - dir * 0.03, yy, -T / 2 - 0.009);
        leaf.add(v);
      }
    }

    // ------------------------------------------ structure interne (vue éclatée)
    if (o.internals && isMain) {
      const inner = new THREE.Group();
      inner.name = 'structure';
      const omegas = new THREE.Group();
      const nO = 5;
      for (let i = 0; i < nO; i++) {
        const x = -lw / 2 + 0.1 + (i * (lw - 0.2)) / (nO - 1);
        const om = new THREE.Group();
        const web = box(0.04, leafH - 0.08, 0.002, matSteel, 0);
        const f1 = box(0.002, leafH - 0.08, 0.035, matSteel, 0);
        f1.position.set(-0.02, 0, -0.017);
        const f2 = f1.clone();
        f2.position.x = 0.02;
        om.add(web, f1, f2);
        om.position.set(x, 0, 0.01);
        omegas.add(om);
      }
      const wool = box(lw - 0.03, leafH - 0.03, 0.04, matWool, 0.004);
      wool.position.z = -0.004;
      inner.add(wool, omegas);
      leaf.add(inner);
      layers.omegas = omegas;
      layers.wool = wool;
      core.visible = false;
    }
  });

  // ---------------------------------------------------------------- contrôles
  const setOpen = (t: number) => {
    const a = THREE.MathUtils.clamp(t, 0, 1) * THREE.MathUtils.degToRad(102);
    leaves.forEach((p, i) => {
      const main = o.leaves === 1 || i === 1;
      const hingeLeft = o.leaves === 1 || i === 0;
      const k = main ? 1 : Math.max(0, t - 0.35) / 0.65;
      p.rotation.y = (hingeLeft ? 1 : -1) * a * k;
      // ouverture vers l'intérieur (-z)
    });
  };
  const setLock = (t: number) => {
    const k = THREE.MathUtils.clamp(t, 0, 1);
    for (const b of bolts) b.position.x = b.userData.base + b.userData.dir * 0.022 * k;
  };
  const setHandle = (t: number) => {
    for (const h of handles) {
      const lever = h.userData.lever as THREE.Group | undefined;
      if (lever) lever.rotation.z = -0.5 * THREE.MathUtils.clamp(t, 0, 1) * (o.leaves === 1 ? 1 : -1);
    }
  };
  setLock(1);

  const dispose = () => {
    group.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    Object.values(materials).forEach((m) => m.dispose());
  };

  return { group, leaves, bolts, handles, frame, layers, materials, opts: o, setOpen, setLock, setHandle, dispose };
}

export { RAL, WOODS } from './palette';
