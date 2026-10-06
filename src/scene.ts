/**
 * 3D world: the parlor, the customer (bent over a bench, facing away), and the gun.
 *
 * Coordinate notes: the customer's rear faces +Z toward the camera. The canvas mesh is
 * a displaced plane whose UVs stay planar, so what the player draws from the front
 * camera maps 1:1 onto the scoring canvas.
 */
import * as THREE from 'three';
import { silhouettePath } from './painter';

export const CANVAS_SIZE = 2.4; // world units spanned by the paintable plane (UV 0..1)
const FLOOR_Y = -3.4;
const BASE_FOV = 30;
export const CAMERA_POS = new THREE.Vector3(0, 0.45, 7.2);
export const CAMERA_TARGET = new THREE.Vector3(0, -0.3, 0);

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Polynomial smooth max: like Math.max but blends within `k` so seams stay soft. */
function smax(a: number, b: number, k: number): number {
  const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (a - b)) / k));
  return b + (a - b) * h + k * h * (1 - h);
}

/**
 * Height of the rear surface at plane coords (x, y). Two elliptical domes (one per cheek)
 * smooth-maxed together form the crease; a gentle ramp above them is the lower back.
 * Dome footprints are a bit larger than the painted silhouette (see painter.ts) so the
 * cut-out edge lands on a rounded slope rather than a cliff.
 */
export function cheekHeight(x: number, y: number): number {
  const dome = (cx: number, cy: number) => {
    const q = ((x - cx) / 0.68) ** 2 + ((y - cy) / 0.86) ** 2;
    return q >= 1 ? 0 : 0.62 * Math.pow(1 - q, 0.6);
  };
  let z = smax(dome(-0.52, -0.21), dome(0.52, -0.21), 0.06);
  z = smax(z, 0.3 * smoothstep(0.1, 0.75, y), 0.1);
  z -= 0.04 * Math.exp(-(x * x + y * y) / 0.003);
  return z;
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function woodFloor(): THREE.CanvasTexture {
  const t = canvasTexture(512, 512, (ctx) => {
    for (let i = 0; i < 8; i++) {
      const l = 30 + Math.random() * 8;
      ctx.fillStyle = `hsl(25, 35%, ${l}%)`;
      ctx.fillRect(0, i * 64, 512, 64);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, i * 64, 512, 64);
      const seam = Math.random() * 512;
      ctx.beginPath();
      ctx.moveTo(seam, i * 64);
      ctx.lineTo(seam, i * 64 + 64);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      for (let k = 0; k < 6; k++) {
        const y = i * 64 + 8 + k * 9 + Math.random() * 4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(170, y + 4, 340, y - 4, 512, y);
        ctx.stroke();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}

function neonSign(text: string, color: string): THREE.CanvasTexture {
  return canvasTexture(2048, 256, (ctx) => {
    ctx.fillStyle = '#0b0b12';
    ctx.fillRect(0, 0, 2048, 256);
    ctx.font = 'bold 150px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    for (const blur of [60, 30, 12]) {
      ctx.shadowBlur = blur;
      ctx.fillStyle = color;
      ctx.fillText(text, 1024, 136);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff6fb';
    ctx.fillText(text, 1024, 136);
  });
}

function poster(lines: string[], bg: string, fg: string): THREE.CanvasTexture {
  return canvasTexture(256, 360, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 360);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, 228, 332);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px Impact, "Arial Black", sans-serif';
    lines.forEach((l, i) => ctx.fillText(l, 128, 90 + i * 52));
  });
}

export interface World {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Moves as a unit when the customer squirms or walks. */
  customer: THREE.Group;
  /** Hip pivots; rotate on X to swing the legs while waddling. */
  legs: THREE.Group[];
  /** The paintable mesh (raycast target). Lives on HI_RES_LAYER. */
  canvasMesh: THREE.Mesh;
  /** Mesh materials that should follow the customer's skin tone. */
  skinMaterials: THREE.MeshStandardMaterial[];
  shirtMaterial: THREE.MeshStandardMaterial;
  hairMaterial: THREE.MeshStandardMaterial;
  gun: THREE.Group;
  gunLight: THREE.PointLight;
  /** PS1 vertex-snap grid (half the low-res render size), shared by all world materials. */
  snapRes: { value: THREE.Vector2 };
  /** 0 = relaxed, 1 = fully puckered. Physically pulls the skin (and the ink) toward the hole. */
  setPucker(amount: number): void;
  /**
   * Body pose. `upright` 1 = standing, 0 = bent over the bench (pivots at the waist).
   * `pantsUp` 1 = jeans on, 0 = bunched at the knees.
   */
  setPose(upright: number, pantsUp: number): void;
  /** Hair meshes, shoulder width and rear proportions for this client. */
  setLooks(looks: { sex: 'f' | 'm'; hair: string; hairColor: string }, body: { width: number; depth: number }): void;
  /** Recompute the camera's projection after the zoom or the window changes. `fov` is the landscape FOV. */
  setFov(fov: number): void;
  resize(): void;
}

/** Objects on this layer skip the low-res PS1 pass and render crisp (the skin and the gun). */
export const HI_RES_LAYER = 1;

export const ZOOM = {
  wide: { fov: BASE_FOV, target: new THREE.Vector3(0, -0.3, 0) },
  close: { fov: 9, target: new THREE.Vector3(0, 0, 0) },
  /** Pulled back far enough to see a standing client, head to toe. */
  entrance: { fov: 58, target: new THREE.Vector3(0, 0.6, 0) },
} as const;

/** Patch a material so its vertices snap to the low-res pixel grid: the PS1 wobble. */
function ps1Snap(mat: THREE.Material, snapRes: { value: THREE.Vector2 }): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = snapRes;
    shader.vertexShader = 'uniform vec2 uSnap;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnap + 0.5) / uSnap * gl_Position.w;`,
    );
  };
}

export function buildWorld(container: HTMLElement, paintTexture: THREE.Texture): World {
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#120d16');
  scene.fog = new THREE.Fog('#120d16', 12, 26);

  // Fixed position, near head-on, long lens. Zoom changes only the FOV: moving the camera
  // or steepening its angle would parallax-warp strokes drawn across the crease, so what
  // the player draws on screen wouldn't match what gets scored.
  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 60);
  camera.position.copy(CAMERA_POS);
  camera.lookAt(CAMERA_TARGET);

  // ---------- Lighting ----------
  // Lights must see both layers or the crisp pass would render unlit.
  const hemi = new THREE.HemisphereLight('#ffe9d6', '#2a1830', 0.9);
  const key = new THREE.SpotLight('#fff1e0', 60, 16, Math.PI / 6, 0.5, 1.4);
  key.position.set(2.2, 5, 4);
  key.target.position.set(0, -0.2, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.camera.layers.enableAll();
  const rim = new THREE.PointLight('#ff3fa4', 14, 9);
  rim.position.set(-3, 2.5, -3);
  const fill = new THREE.PointLight('#6fc3ff', 5, 10);
  fill.position.set(3.5, 0.5, 2);
  for (const l of [hemi, key, rim, fill]) l.layers.enableAll();
  scene.add(hemi, key, key.target, rim, fill);

  // ---------- Room ----------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30, 30, 30),
    new THREE.MeshStandardMaterial({ map: woodFloor(), roughness: 0.8 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: '#2c2236', roughness: 0.95 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), wallMat);
  back.position.set(0, FLOOR_Y + 4.5, -6.5);
  back.receiveShadow = true;
  scene.add(back);
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), wallMat);
    w.position.set(side * 5.5, FLOOR_Y + 4.5, 0);
    w.rotation.y = -side * Math.PI / 2;
    scene.add(w);
  }

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 0.8),
    new THREE.MeshBasicMaterial({ map: neonSign('CHEEKY BUSINESS', '#ff3fa4'), toneMapped: false }),
  );
  sign.position.set(0, 2.6, -6.45);
  scene.add(sign);

  const posters: [string[], string, string, number, number, number][] = [
    [['TATTOOS', 'ARE', 'PERMANENT'], '#f4e04d', '#1b1b1b', -4.2, 0.9, -6.44],
    [['NO', 'REFUNDS', 'NO', 'REGRETS'], '#1b1b1b', '#f4e04d', 4.2, 0.9, -6.44],
    [['WE DO', 'NOT DO', 'FACES'], '#e94b3c', '#fff', -5.45, 0.6, -2.5],
    [['TIP', 'YOUR', 'ARTIST'], '#3cc3e9', '#fff', 5.45, 0.6, -2.5],
    [['NO', 'SITTING', 'ON THE', 'ART'], '#f2f2f2', '#1b1b1b', -2.75, -0.35, -6.44],
    [['PLEASE', 'DO NOT', 'FART ON', 'ARTIST'], '#ff8a3c', '#1b1b1b', 2.95, -0.35, -6.44],
    [['CRACK', 'OF DAWN', 'SPECIAL'], '#2fd58a', '#1b1b1b', -5.45, 0.4, 2.2],
  ];
  for (const [lines, bg, fg, x, y, z] of posters) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.55), new THREE.MeshStandardMaterial({ map: poster(lines, bg, fg), roughness: 0.7 }));
    p.position.set(x, y, z);
    if (Math.abs(x) > 5) p.rotation.y = -Math.sign(x) * Math.PI / 2;
    scene.add(p);
  }

  // Bench the customer bends over.
  const leather = new THREE.MeshStandardMaterial({ color: '#6a1f2e', roughness: 0.4, metalness: 0.05 });
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.45, 2.8), leather);
  bench.position.set(0, -1.45, -2.3);
  bench.castShadow = bench.receiveShadow = true;
  scene.add(bench);
  const chrome = new THREE.MeshStandardMaterial({ color: '#c9c9d4', roughness: 0.25, metalness: 0.9 });
  for (const [x, z] of [[-0.8, -1.1], [0.8, -1.1], [-0.8, -3.5], [0.8, -3.5]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.75, 6), chrome);
    leg.position.set(x, FLOOR_Y + 0.87, z);
    scene.add(leg);
  }

  // Ink caps tray, for set dressing. Kept behind the customer's plane (z < 0) because the
  // crisp pass draws the skin over everything in the low-res pass.
  const trayZ = -0.9;
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.5), chrome);
  tray.position.set(2.6, -0.9, trayZ);
  scene.add(tray);
  const capColors = ['#111', '#c0182c', '#1f6fd6', '#21a35a', '#f2c61f'];
  capColors.forEach((c, i) => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 8), new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 }));
    cap.position.set(2.3 + i * 0.15, -0.84, trayZ);
    scene.add(cap);
  });
  const trayStand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6), chrome);
  trayStand.position.set(2.6, FLOOR_Y + 1.25, trayZ);
  scene.add(trayStand);

  // ---------- Customer ----------
  const customer = new THREE.Group();
  scene.add(customer);

  const skin = new THREE.MeshStandardMaterial({ color: '#e0b090', roughness: 0.6, flatShading: true });
  // alphaTest cuts the plane down to the silhouette painted into the texture's alpha.
  const canvasMat = new THREE.MeshStandardMaterial({ map: paintTexture, roughness: 0.55, alphaTest: 0.5 });
  const SEG = 220;
  const geo = new THREE.PlaneGeometry(CANVAS_SIZE, CANVAS_SIZE, SEG, SEG);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, cheekHeight(pos.getX(i), pos.getY(i)));
  }
  geo.computeVertexNormals();
  const canvasMesh = new THREE.Mesh(geo, canvasMat);
  canvasMesh.castShadow = canvasMesh.receiveShadow = true;
  canvasMesh.layers.set(HI_RES_LAYER);
  // Body shape scales the rear as a unit (skin + jeans seat). Ink and scoring live in UV
  // space, so a wider or rounder client changes how the design sits, not how it's judged.
  const rear = new THREE.Group();
  customer.add(rear);
  rear.add(canvasMesh);

  // Pucker: remember the rest pose of the vertices near the hole.
  const rest = Float32Array.from(pos.array as Float32Array);
  const near: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = rest[i * 3];
    const y = rest[i * 3 + 1];
    if (x * x + y * y < 0.35 * 0.35) near.push(i);
  }
  let lastPucker = 0;
  function setPucker(amount: number): void {
    if (Math.abs(amount - lastPucker) < 0.01) return;
    lastPucker = amount;
    const arr = pos.array as Float32Array;
    for (const i of near) {
      const x = rest[i * 3];
      const y = rest[i * 3 + 1];
      const r2 = x * x + y * y;
      const f = amount * 0.45 * Math.exp(-r2 / 0.012);
      arr[i * 3] = x * (1 - f);
      arr[i * 3 + 1] = y * (1 - f);
      arr[i * 3 + 2] = rest[i * 3 + 2] - amount * 0.05 * Math.exp(-r2 / 0.004);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  // Upper body on a waist pivot at the top of the rear. Bent (rotation 0): the torso runs
  // away from the camera over the bench. Upright (rotation π/2): it stands straight up.
  const half = CANVAS_SIZE / 2;
  const upper = new THREE.Group();
  upper.position.set(0, 1.0, -0.4);
  customer.add(upper);
  const local = <T extends THREE.Object3D>(m: T, x: number, y: number, z: number): T => {
    m.position.set(x, y - upper.position.y, z - upper.position.z);
    upper.add(m);
    return m;
  };
  const torso = local(new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.8, 2.6), skin), 0, 0.3, 0.15 - 1.3);
  torso.castShadow = true;
  const shirtMaterial = new THREE.MeshStandardMaterial({ color: '#3d6fb6', roughness: 0.9, flatShading: true });
  const shirt = local(new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 2.4), shirtMaterial), 0, half - 0.45, 0.12 - 1.2);
  shirt.castShadow = true;
  // A roll of shirt fabric at the hem.
  const hem = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 1.85, 3, 6), shirtMaterial);
  hem.rotation.z = Math.PI / 2;
  local(hem, 0, half - 0.02, 0.22);
  // Shoulders, head and hair at the far end of the torso.
  const shoulders = local(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 0.7), shirtMaterial), 0, 0.55, -2.55);
  shoulders.castShadow = true;
  const head = local(new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), skin), 0, 0.55, -3.3);
  head.castShadow = true;
  const hairMaterial = new THREE.MeshStandardMaterial({ color: '#2b1d14', roughness: 1, flatShading: true });
  // Hair caps the back/top of the head: rel +y faces the camera when standing, rel -z is "up".
  // Hair pieces, shown per style. Positions are in the bent pose: +y is the back of the
  // head, -z is the crown, +z runs down the client's back.
  const hairCap = local(new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), hairMaterial), 0, 0.68, -3.4);
  hairCap.scale.set(1, 0.85, 1);
  const ponytail = local(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.1, 1.7, 6), hairMaterial), 0, 1.2, -2.6);
  ponytail.rotation.x = Math.PI / 2 - 0.15;
  // Long hair and pigtails sit proud of the torso's back face so they show when standing.
  const longHair = local(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.22, 1.5), hairMaterial), 0, 1.38, -2.75);
  const bun = local(new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), hairMaterial), 0, 0.6, -3.95);
  const pigtails = [-1, 1].map((side) => {
    // Cylinder +y maps to "down" when standing, so the thin end is the tip.
    const p = local(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, 1.0, 6), hairMaterial), side * 0.62, 1.35, -2.65);
    p.rotation.x = Math.PI / 2 - 0.3;
    p.rotation.z = -side * 0.35;
    return p;
  });
  const afro = local(new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), hairMaterial), 0, 0.62, -3.45);
  for (const m of [hairCap, ponytail, longHair, bun, ...pigtails, afro]) m.castShadow = true;
  // Arms hang from the shoulders; their pivots counter-rotate so they always dangle downward.
  const armPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    local(pivot, side * 1.25, 0.55, -2.55);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.6, 8), shirtMaterial);
    sleeve.position.y = -0.25;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 1.3, 8), skin);
    arm.position.y = -0.9;
    const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), skin);
    hand.position.y = -1.6;
    for (const m of [sleeve, arm, hand]) {
      m.castShadow = true;
      pivot.add(m);
    }
    armPivots.push(pivot);
  }

  // Jeans seat: a denim copy of the rear surface that slides down when the pants drop.
  // Lives on HI_RES_LAYER because it has to draw over the (crisp) skin.
  const seatTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.scale(0.5, 0.5);
    ctx.clip(silhouettePath());
    ctx.fillStyle = '#2f4a73';
    ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#3a5884' : '#263d60';
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 6, 2);
    }
    ctx.strokeStyle = '#d99a3a';
    ctx.lineWidth = 6;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(512, 150);
    ctx.lineTo(512, 760);
    for (const x of [300, 724]) {
      ctx.moveTo(x - 120, 420);
      ctx.lineTo(x + 120, 420);
      ctx.lineTo(x + 105, 600);
      ctx.lineTo(x, 650);
      ctx.lineTo(x - 105, 600);
      ctx.closePath();
    }
    ctx.stroke();
    ctx.fillStyle = '#3b2414';
    ctx.fillRect(0, 30, 1024, 70);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const seat = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: seatTex, roughness: 0.95, alphaTest: 0.5 }));
  seat.scale.set(1.02, 1.02, 1.06);
  seat.position.z = 0.02;
  seat.layers.set(HI_RES_LAYER);
  rear.add(seat);

  // Legs on hip pivots (so they can swing), jeans bunched at the knees.
  const denim = new THREE.MeshStandardMaterial({ color: '#2f4a73', roughness: 0.95, flatShading: true });
  const sock = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 1 });
  const shoe = new THREE.MeshStandardMaterial({ color: '#202020', roughness: 0.6 });
  const legLen = 1.4;
  const hipY = -0.7;
  const legs: THREE.Group[] = [];
  // Thighs switch between skin and denim depending on whether the pants are up.
  const thighMat = skin.clone();
  const jeansBundles: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.58, hipY, -0.5);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.42, legLen, 10), thighMat);
    thigh.position.y = -legLen / 2;
    const jeans = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.17, 6, 10), denim);
    jeans.rotation.x = Math.PI / 2;
    jeans.position.y = -2.15 - hipY;
    const jeansLower = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.42, 0.75, 10), denim);
    jeansLower.position.y = -2.6 - hipY;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.33, 0.35, 8), sock);
    s.position.y = -3.08 - hipY;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.95), shoe);
    foot.position.set(0, FLOOR_Y + 0.11 - hipY, -0.25);
    for (const m of [thigh, jeans, jeansLower, s, foot]) {
      m.castShadow = true;
      pivot.add(m);
    }
    customer.add(pivot);
    legs.push(pivot);
    jeansBundles.push(jeans);
  }
  // Belt buckle peeking out of the jeans bundle.
  const beltGroup = new THREE.Group();
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.05), chrome);
  buckle.position.z = 0.05;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 0.06), new THREE.MeshStandardMaterial({ color: '#3b2414', roughness: 0.7 }));
  beltGroup.add(buckle, belt);
  beltGroup.position.set(0, -2.15, 0.15);
  customer.add(beltGroup);

  const denimColor = new THREE.Color('#2f4a73');
  const skinColor = new THREE.Color();
  function setLooks(looks: { sex: 'f' | 'm'; hair: string; hairColor: string }, body: { width: number; depth: number }): void {
    hairMaterial.color.set(looks.hairColor);
    const h = looks.hair;
    hairCap.visible = h !== 'bald' && h !== 'afro';
    afro.visible = h === 'afro';
    ponytail.visible = h === 'ponytail';
    longHair.visible = h === 'long' || h === 'bob' || h === 'mullet';
    longHair.scale.z = h === 'bob' ? 0.45 : 1;
    longHair.position.z = (h === 'bob' ? -3.05 : -2.75) - upper.position.z;
    bun.visible = h === 'bun';
    for (const p of pigtails) p.visible = h === 'pigtails';
    shoulders.scale.x = looks.sex === 'f' ? 0.86 : 1;
    rear.scale.set(body.width, 1, body.depth);
  }

  function setPose(upright: number, pantsUp: number): void {
    upper.rotation.x = upright * (Math.PI / 2);
    for (const a of armPivots) a.rotation.x = -upper.rotation.x;
    // Pants: the seat slides down and squashes into the bundle at the knees.
    seat.visible = pantsUp > 0.02;
    seat.position.y = -(1 - pantsUp) * 2.3;
    seat.scale.y = 1.02 * (0.25 + 0.75 * pantsUp);
    beltGroup.position.y = THREE.MathUtils.lerp(-2.15, half + 0.02, pantsUp);
    beltGroup.position.z = THREE.MathUtils.lerp(0.15, 0.45, pantsUp);
    for (const j of jeansBundles) j.scale.setScalar(pantsUp > 0.5 ? 0.85 : 1);
    skinColor.copy(skin.color);
    thighMat.color.copy(pantsUp > 0.5 ? denimColor : skinColor);
  }

  // ---------- Tattoo gun ----------
  const gun = new THREE.Group();
  const gunMetal = new THREE.MeshStandardMaterial({ color: '#7a7f8c', roughness: 0.3, metalness: 0.85 });
  const gunGrip = new THREE.MeshStandardMaterial({ color: '#d1263b', roughness: 0.5 });
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.18), chrome);
  needle.position.y = 0.09;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.022, 0.35, 8), gunMetal);
  tube.position.y = 0.33;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.42, 8), gunGrip);
  grip.position.y = 0.68;
  const coil1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), gunMetal);
  coil1.position.set(0.09, 0.82, 0);
  coil1.rotation.z = Math.PI / 2;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.2), new THREE.MeshStandardMaterial({ color: '#111' }));
  cord.position.y = 1.48;
  gun.add(needle, tube, grip, coil1, cord);
  gun.traverse((o) => {
    o.castShadow = true;
    o.layers.set(HI_RES_LAYER);
  });
  scene.add(gun);
  const gunLight = new THREE.PointLight('#ffdcb0', 0, 1.2);
  gunLight.position.y = 0.05;
  gunLight.layers.enableAll();
  gun.add(gunLight);

  // PS1 vertex wobble on everything in the low-res pass.
  const snapRes = { value: new THREE.Vector2(160, 120) };
  const patched = new WeakSet<THREE.Material>();
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.layers.isEnabled(HI_RES_LAYER)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (patched.has(m)) continue;
      patched.add(m);
      ps1Snap(m, snapRes);
    }
  });

  let landscapeFov = BASE_FOV;
  function setFov(fov: number): void {
    landscapeFov = fov;
    // Keep the frame's width on narrow (portrait) screens.
    camera.fov = camera.aspect < 1 ? fov / Math.max(0.55, camera.aspect) : fov;
    camera.updateProjectionMatrix();
  }
  function resize(): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    setFov(landscapeFov);
  }
  resize();

  return {
    renderer, scene, camera, customer, legs, canvasMesh,
    skinMaterials: [skin, thighMat], shirtMaterial, hairMaterial, gun, gunLight, snapRes,
    setPucker, setPose, setLooks, setFov, resize,
  };
}
