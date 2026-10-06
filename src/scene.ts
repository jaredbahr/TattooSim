/**
 * 3D world: the parlor, the customer (bent over a bench, facing away), and the gun.
 *
 * Coordinate notes: the customer's rear faces +Z toward the camera. The canvas mesh is
 * a displaced plane whose UVs stay planar, so what the player draws from the front
 * camera maps 1:1 onto the scoring canvas.
 */
import * as THREE from 'three';

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
  return canvasTexture(1024, 256, (ctx) => {
    ctx.fillStyle = '#0b0b12';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.font = 'bold 150px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    for (const blur of [60, 30, 12]) {
      ctx.shadowBlur = blur;
      ctx.fillStyle = color;
      ctx.fillText(text, 512, 136);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff6fb';
    ctx.fillText(text, 512, 136);
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
  /** Moves as a unit when the customer squirms. */
  customer: THREE.Group;
  /** The paintable mesh (raycast target). */
  canvasMesh: THREE.Mesh;
  /** Mesh materials that should follow the customer's skin tone. */
  skinMaterials: THREE.MeshStandardMaterial[];
  shirtMaterial: THREE.MeshStandardMaterial;
  gun: THREE.Group;
  gunLight: THREE.PointLight;
  resize(): void;
}

export function buildWorld(container: HTMLElement, paintTexture: THREE.Texture): World {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#120d16');
  scene.fog = new THREE.Fog('#120d16', 12, 26);

  // Near head-on with a long lens: a steep camera angle would parallax-warp strokes drawn
  // across the crease, so what the player draws on screen wouldn't match what gets scored.
  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 60);
  camera.position.set(0, CAMERA_POS.y, CAMERA_POS.z);
  camera.lookAt(CAMERA_TARGET);

  // ---------- Lighting ----------
  scene.add(new THREE.HemisphereLight('#ffe9d6', '#2a1830', 0.9));
  const key = new THREE.SpotLight('#fff1e0', 60, 16, Math.PI / 6, 0.5, 1.4);
  key.position.set(2.2, 5, 4);
  key.target.position.set(0, -0.2, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  const rim = new THREE.PointLight('#ff3fa4', 14, 9);
  rim.position.set(-3, 2.5, -3);
  scene.add(rim);
  const fill = new THREE.PointLight('#6fc3ff', 5, 10);
  fill.position.set(3.5, 0.5, 2);
  scene.add(fill);

  // ---------- Room ----------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
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
    new THREE.PlaneGeometry(4.4, 1.1),
    new THREE.MeshBasicMaterial({ map: neonSign('CHEEK INK', '#ff3fa4'), toneMapped: false }),
  );
  sign.position.set(0, 2.6, -6.45);
  scene.add(sign);

  const posters: [string[], string, string, number, number, number][] = [
    [['TATTOOS', 'ARE', 'PERMANENT'], '#f4e04d', '#1b1b1b', -4.2, 0.9, -6.44],
    [['NO', 'REFUNDS', 'NO', 'REGRETS'], '#1b1b1b', '#f4e04d', 4.2, 0.9, -6.44],
    [['WE DO', 'NOT DO', 'FACES'], '#e94b3c', '#fff', -5.45, 0.6, -2.5],
    [['TIP', 'YOUR', 'ARTIST'], '#3cc3e9', '#fff', 5.45, 0.6, -2.5],
  ];
  for (const [lines, bg, fg, x, y, z] of posters) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.55), new THREE.MeshStandardMaterial({ map: poster(lines, bg, fg), roughness: 0.7 }));
    p.position.set(x, y, z);
    if (Math.abs(x) > 5) p.rotation.y = -Math.sign(x) * Math.PI / 2;
    scene.add(p);
  }

  // Bench the customer bends over.
  const leather = new THREE.MeshStandardMaterial({ color: '#1a1a1f', roughness: 0.35, metalness: 0.1 });
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.45, 2.8), leather);
  bench.position.set(0, -1.45, -2.3);
  bench.castShadow = bench.receiveShadow = true;
  scene.add(bench);
  const chrome = new THREE.MeshStandardMaterial({ color: '#c9c9d4', roughness: 0.25, metalness: 0.9 });
  for (const [x, z] of [[-0.8, -1.1], [0.8, -1.1], [-0.8, -3.5], [0.8, -3.5]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.75), chrome);
    leg.position.set(x, FLOOR_Y + 0.87, z);
    scene.add(leg);
  }

  // Ink caps tray, for set dressing.
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.5), chrome);
  tray.position.set(2.3, -0.9, 0.6);
  scene.add(tray);
  const capColors = ['#111', '#c0182c', '#1f6fd6', '#21a35a', '#f2c61f'];
  capColors.forEach((c, i) => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 16), new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 }));
    cap.position.set(2.0 + i * 0.15, -0.84, 0.6);
    scene.add(cap);
  });
  const trayStand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5), chrome);
  trayStand.position.set(2.3, FLOOR_Y + 1.25, 0.6);
  scene.add(trayStand);

  // ---------- Customer ----------
  const customer = new THREE.Group();
  scene.add(customer);

  const skin = new THREE.MeshStandardMaterial({ color: '#e0b090', roughness: 0.6 });
  // alphaTest cuts the plane down to the silhouette painted into the texture's alpha.
  const canvasMat = new THREE.MeshStandardMaterial({ map: paintTexture, roughness: 0.55, alphaTest: 0.5 });
  const geo = new THREE.PlaneGeometry(CANVAS_SIZE, CANVAS_SIZE, 220, 220);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, cheekHeight(pos.getX(i), pos.getY(i)));
  }
  geo.computeVertexNormals();
  const canvasMesh = new THREE.Mesh(geo, canvasMat);
  canvasMesh.castShadow = canvasMesh.receiveShadow = true;
  customer.add(canvasMesh);

  // Torso running away from the camera, hidden behind the skin except for a hiked-up shirt.
  const half = CANVAS_SIZE / 2;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.8, 2.6), skin);
  torso.position.set(0, 0.3, 0.15 - 1.3);
  torso.castShadow = true;
  customer.add(torso);
  const shirtMaterial = new THREE.MeshStandardMaterial({ color: '#3d6fb6', roughness: 0.9 });
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 2.4), shirtMaterial);
  shirt.position.set(0, half - 0.45, 0.12 - 1.2);
  shirt.castShadow = true;
  customer.add(shirt);
  // A roll of shirt fabric at the hem.
  const hem = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 1.85, 6, 12), shirtMaterial);
  hem.rotation.z = Math.PI / 2;
  hem.position.set(0, half - 0.02, 0.22);
  customer.add(hem);

  // Legs, with jeans bunched around the knees.
  const denim = new THREE.MeshStandardMaterial({ color: '#2f4a73', roughness: 0.95 });
  const sock = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 1 });
  const shoe = new THREE.MeshStandardMaterial({ color: '#202020', roughness: 0.6 });
  const legLen = 1.4;
  for (const side of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.42, legLen, 24), skin);
    thigh.position.set(side * 0.58, -0.7 - legLen / 2, -0.5);
    thigh.castShadow = true;
    customer.add(thigh);
    const jeans = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.17, 12, 24), denim);
    jeans.rotation.x = Math.PI / 2;
    jeans.position.set(side * 0.58, -2.15, -0.5);
    jeans.castShadow = true;
    customer.add(jeans);
    const jeansLower = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.42, 0.75, 20), denim);
    jeansLower.position.set(side * 0.58, -2.6, -0.5);
    customer.add(jeansLower);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.33, 0.35, 16), sock);
    s.position.set(side * 0.58, -3.08, -0.5);
    customer.add(s);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.95), shoe);
    foot.position.set(side * 0.58, FLOOR_Y + 0.11, -0.75);
    foot.castShadow = true;
    customer.add(foot);
  }
  // Belt buckle peeking out of the jeans bundle.
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.05), chrome);
  buckle.position.set(0, -2.15, 0.2);
  customer.add(buckle);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 0.06), new THREE.MeshStandardMaterial({ color: '#3b2414', roughness: 0.7 }));
  belt.position.set(0, -2.15, 0.15);
  customer.add(belt);

  // ---------- Tattoo gun ----------
  const gun = new THREE.Group();
  const gunMetal = new THREE.MeshStandardMaterial({ color: '#7a7f8c', roughness: 0.3, metalness: 0.85 });
  const gunGrip = new THREE.MeshStandardMaterial({ color: '#d1263b', roughness: 0.5 });
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.18), chrome);
  needle.position.y = 0.09;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.022, 0.35, 16), gunMetal);
  tube.position.y = 0.33;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.42, 20), gunGrip);
  grip.position.y = 0.68;
  const coil1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 16), gunMetal);
  coil1.position.set(0.09, 0.82, 0);
  coil1.rotation.z = Math.PI / 2;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.2), new THREE.MeshStandardMaterial({ color: '#111' }));
  cord.position.y = 1.48;
  gun.add(needle, tube, grip, coil1, cord);
  gun.traverse((o) => { o.castShadow = true; });
  scene.add(gun);
  const gunLight = new THREE.PointLight('#ffdcb0', 0, 1.2);
  gunLight.position.y = 0.05;
  gun.add(gunLight);

  function resize(): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // Keep the whole canvas in frame on narrow (portrait) screens.
    camera.fov = camera.aspect < 1 ? BASE_FOV / Math.max(0.55, camera.aspect) : BASE_FOV;
    camera.updateProjectionMatrix();
  }
  resize();

  return {
    renderer,
    scene,
    camera,
    customer,
    canvasMesh,
    skinMaterials: [skin],
    shirtMaterial,
    gun,
    gunLight,
    resize,
  };
}
