/**
 * Cheek Ink: game loop and state machine.
 *
 *   title -> intro -> inking -> result -> (intro ... ) -> dayEnd -> intro (next day)
 */
import * as THREE from 'three';
import { buildWorld, CAMERA_POS, CAMERA_TARGET } from './scene';
import { BRUSHES, SkinPainter, drawReferenceCard, targetMask, GRID } from './painter';
import { makeCustomer, reactionFor, reviewFor, type Customer } from './customers';
import { scoreMasks, type ScoreBreakdown } from './scoring';
import { GunAudio } from './audio';

const CLIENTS_PER_DAY = 5;
const BEST_KEY = 'cheek-ink:best-day';

type Phase = 'title' | 'intro' | 'inking' | 'result' | 'dayEnd';

interface JobResult {
  customer: Customer;
  score: ScoreBreakdown;
  pay: number;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- Setup ----------
const stage = $('stage');
const painter = new SkinPainter();
const world = buildWorld(stage, painter.texture);
const audio = new GunAudio();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
let pointerInside = false;
let pointerDown = false;

const state = {
  phase: 'title' as Phase,
  day: 1,
  clientIndex: 0,
  cash: 0,
  dayCash: 0,
  customer: null as Customer | null,
  results: [] as JobResult[],
  usedDesigns: [] as string[],
  brush: 1,
  timeLimit: 45,
  timeLeft: 45,
  pain: 0,
  flinchCooldown: 0,
  clench: 0,
  quipTimer: 0,
};

// Squirm physics: a damped spring that flinches get added to.
const flinch = { pos: new THREE.Vector2(), vel: new THREE.Vector2() };
let elapsed = 0;

// ---------- HUD wiring ----------
const brushBox = $('brushes');
BRUSHES.forEach((b, i) => {
  const btn = document.createElement('button');
  const dot = Math.round(b.radius * 0.9 + 3);
  btn.innerHTML = `<span class="dot" style="width:${dot}px;height:${dot}px"></span>${b.label}<kbd>${i + 1}</kbd>`;
  btn.addEventListener('click', () => setBrush(i));
  brushBox.appendChild(btn);
});
function setBrush(i: number): void {
  state.brush = i;
  [...brushBox.children].forEach((c, j) => c.classList.toggle('active', i === j));
}
setBrush(1);

$('finish-btn').addEventListener('click', () => finishJob());
$('mute-btn').addEventListener('click', (e) => {
  (e.currentTarget as HTMLElement).textContent = audio.toggleMute() ? '🔇' : '🔊';
});

function updateTopHud(): void {
  $('hud-day').textContent = `Day ${state.day}`;
  $('hud-client').textContent = `Client ${Math.min(state.clientIndex + 1, CLIENTS_PER_DAY)}/${CLIENTS_PER_DAY}`;
  $('hud-cash').textContent = `$${state.cash.toLocaleString()}`;
}

let bubbleTimeout = 0;
function say(text: string, ms = 1800): void {
  const b = $('bubble');
  b.textContent = text;
  b.classList.remove('hidden');
  // Restart the pop animation.
  b.style.animation = 'none';
  void b.offsetWidth;
  b.style.animation = '';
  window.clearTimeout(bubbleTimeout);
  bubbleTimeout = window.setTimeout(() => b.classList.add('hidden'), ms);
}

// ---------- Modal screens ----------
function showModal(html: string, actions: { label: string; primary?: boolean; onClick: () => void }[]): HTMLElement {
  const card = $('modal-card');
  card.innerHTML = html;
  const row = document.createElement('div');
  row.className = 'actions';
  for (const a of actions) {
    const btn = document.createElement('button');
    btn.textContent = a.label;
    if (a.primary) btn.className = 'primary';
    btn.addEventListener('click', () => {
      audio.unlock();
      a.onClick();
    });
    row.appendChild(btn);
  }
  card.appendChild(row);
  $('modal').classList.remove('hidden');
  // Re-trigger the entrance animation.
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = '';
  return card;
}
function hideModal(): void {
  $('modal').classList.add('hidden');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}
function writeBest(v: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(v));
  } catch {
    /* storage unavailable (private mode); best score just isn't remembered */
  }
}

function showTitle(): void {
  state.phase = 'title';
  $('hud').classList.add('hidden');
  const best = readBest();
  showModal(
    `<h1>CHEEK INK</h1>
     <p style="margin-top:8px">A tattoo parlor simulator for one very specific clientele.</p>
     <ul>
       <li>Clients walk in, bend over, and request a design. Ink it <strong>exactly</strong> as shown.</li>
       <li>Hold the mouse (or your finger) to ink. <strong>1 / 2 / 3</strong> switch needles.</li>
       <li>They squirm. Pain makes them flinch. Hold still while they don't.</li>
       <li>You're scored on accuracy (no stray ink) and coverage (finish the whole design).</li>
       <li>There is no undo. Tattoos are permanent.</li>
     </ul>
     ${best ? `<p>Best single-day earnings: <strong style="color:var(--green)">$${best}</strong></p>` : ''}`,
    [{ label: 'Open the shop', primary: true, onClick: () => startDay(1) }],
  );
}

function startDay(day: number): void {
  state.day = day;
  state.clientIndex = 0;
  state.dayCash = 0;
  state.results = [];
  state.usedDesigns = [];
  state.timeLimit = Math.max(25, 48 - (day - 1) * 5);
  nextClient();
}

function nextClient(): void {
  const c = makeCustomer(state.day, Math.random, state.usedDesigns);
  state.customer = c;
  state.usedDesigns.push(c.design.id);
  painter.prepare(c);
  for (const m of world.skinMaterials) m.color.set(c.skin);
  world.shirtMaterial.color.setHSL(Math.random(), 0.45, 0.4);
  updateTopHud();

  state.phase = 'intro';
  $('hud').classList.add('hidden');
  const card = showModal(
    `<div class="client" style="gap:14px">
       <span class="avatar" style="font-size:56px">${c.avatar}</span>
       <div><h2>${escapeHtml(c.name)}</h2><div class="trait">${escapeHtml(c.trait)}</div></div>
     </div>
     <div class="quote">"${escapeHtml(c.request)}"</div>
     <div style="display:flex;gap:14px;align-items:center">
       <canvas id="intro-ref" width="160" height="160" style="width:140px;border-radius:10px;border:3px solid #fff"></canvas>
       <p style="margin:0">${escapeHtml(c.design.tip)}<br/><br/>You have <strong>${state.timeLimit}s</strong>.</p>
     </div>`,
    [{ label: "Let's ink 🖊️", primary: true, onClick: startInking }],
  );
  drawReferenceCard(card.querySelector<HTMLCanvasElement>('#intro-ref')!, c.design);
}

function startInking(): void {
  const c = state.customer!;
  hideModal();
  $('hud').classList.remove('hidden');
  stage.classList.add('inking');
  $('client-avatar').textContent = c.avatar;
  $('client-name').textContent = c.name;
  $('client-trait').textContent = c.trait;
  $('ref-name').textContent = c.design.name;
  $('ref-tip').textContent = c.design.tip;
  drawReferenceCard($<HTMLCanvasElement>('ref-card'), c.design);

  state.timeLeft = state.timeLimit;
  state.pain = 0;
  state.flinchCooldown = 0;
  state.quipTimer = 4;
  flinch.pos.set(0, 0);
  flinch.vel.set(0, 0);
  state.phase = 'inking';
  say(`${c.name}: "Be gentle."`);
}

function payFor(score: number, c: Customer): number {
  if (score < 30) return 0;
  return Math.round((40 + score * 1.6) * c.generosity);
}

function finishJob(): void {
  if (state.phase !== 'inking') return;
  const c = state.customer!;
  state.phase = 'result';
  pointerDown = false;
  painter.lift();
  audio.setBuzzing(false);
  stage.classList.remove('inking');
  $('bubble').classList.add('hidden');

  const score = scoreMasks(painter.inkMask(), targetMask(c.design), GRID, 2);
  const pay = payFor(score.score, c);
  state.cash += pay;
  state.dayCash += pay;
  state.results.push({ customer: c, score, pay });
  updateTopHud();

  const card = showModal(
    `<h2>${escapeHtml(c.name)} checks the mirror…</h2>
     <div class="quote">"${escapeHtml(reactionFor(score.score, c))}"</div>
     <div class="compare">
       <figure><canvas id="res-ink" width="260" height="260"></canvas>Your work</figure>
       <figure><canvas id="res-overlay" width="260" height="260"></canvas>vs. the request</figure>
     </div>
     <div class="score-row">
       <div class="grade ${score.grade}">${score.grade}</div>
       <dl class="stats">
         <dt>Likeness</dt><dd>${score.score}%</dd>
         <dt>Accuracy</dt><dd>${Math.round(score.precision * 100)}% <span style="color:var(--muted);font-weight:normal">of your ink was on-design</span></dd>
         <dt>Coverage</dt><dd>${Math.round(score.recall * 100)}% <span style="color:var(--muted);font-weight:normal">of the design got inked</span></dd>
         <dt>Paid</dt><dd style="color:${pay ? 'var(--green)' : 'var(--red)'}">${pay ? `$${pay}` : 'Refused to pay'}</dd>
       </dl>
     </div>`,
    [{
      label: state.clientIndex + 1 >= CLIENTS_PER_DAY ? 'Close up shop' : 'Next client',
      primary: true,
      onClick: () => {
        state.clientIndex++;
        if (state.clientIndex >= CLIENTS_PER_DAY) endDay();
        else nextClient();
      },
    }],
  );
  const snap = painter.snapshot(260);
  card.querySelector<HTMLCanvasElement>('#res-ink')!.getContext('2d')!.drawImage(snap, 0, 0);
  drawReferenceCard(card.querySelector<HTMLCanvasElement>('#res-overlay')!, c.design, snap);
}

function endDay(): void {
  state.phase = 'dayEnd';
  $('hud').classList.add('hidden');
  const avg = Math.round(state.results.reduce((s, r) => s + r.score.score, 0) / state.results.length);
  const best = readBest();
  const record = state.dayCash > best;
  if (record) writeBest(state.dayCash);
  const reviews = state.results.map((r) => `<li>${escapeHtml(reviewFor(r.score.score, r.customer))}</li>`).join('');
  showModal(
    `<h2>Day ${state.day} complete</h2>
     <p>Earned <strong style="color:var(--green)">$${state.dayCash}</strong> today · average likeness <strong>${avg}%</strong>
     ${record ? ' · <strong style="color:var(--yellow)">New record!</strong>' : ''}</p>
     <p style="margin-bottom:0">Your online reviews:</p>
     <ul class="reviews">${reviews}</ul>
     <p style="font-size:13px">Tomorrow's clients are more caffeinated and you get less time.</p>`,
    [
      { label: 'Quit to title', onClick: showTitle },
      { label: `Open Day ${state.day + 1}`, primary: true, onClick: () => startDay(state.day + 1) },
    ],
  );
}

// ---------- Input ----------
function updatePointer(e: PointerEvent): void {
  const r = world.renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  pointerInside = true;
}
const canvasEl = world.renderer.domElement;
canvasEl.addEventListener('pointermove', updatePointer);
canvasEl.addEventListener('pointerdown', (e) => {
  audio.unlock();
  updatePointer(e);
  canvasEl.setPointerCapture(e.pointerId);
  pointerDown = true;
  painter.lift();
});
const release = () => {
  pointerDown = false;
  painter.lift();
};
canvasEl.addEventListener('pointerup', release);
canvasEl.addEventListener('pointercancel', release);
canvasEl.addEventListener('pointerleave', () => {
  pointerInside = false;
});
window.addEventListener('blur', release);

window.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') $('mute-btn').click();
  if (state.phase !== 'inking') return;
  if (e.key === '1' || e.key === '2' || e.key === '3') setBrush(Number(e.key) - 1);
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    finishJob();
  }
});

window.addEventListener('resize', () => world.resize());

// ---------- Per-frame simulation ----------
const PAIN_QUIPS = [
  ['Tickles a bit.', 'Is that it?', "This isn't so bad.", '*hums nervously*'],
  ['Hnnngh.', 'Okay, okay, OKAY.', 'Are you using a fork?', 'Talk to me about anything else.'],
  ['MOMMY.', 'WHY IS IT VIBRATING', 'I can see colors that don\'t exist', 'I regret EVERYTHING'],
];
const FLINCH_LINES = ['OW!', 'YEOWCH!', 'SWEET MOTHER OF—', '*involuntary clench*', 'NOT THE HOLE!'];

const tmpNormal = new THREE.Vector3();
const toCam = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tilt = new THREE.Vector3(0.35, 0.45, 0);

function frame(dt: number): void {
  elapsed += dt;
  const c = state.customer;
  const inking = state.phase === 'inking';

  // Customer squirm: idle sway + pain-driven jitter + flinch spring.
  const squirm = c ? c.squirm : 0.2;
  const amp = (inking ? 0.01 + squirm * 0.045 + state.pain * 0.05 : 0.008);
  const t = elapsed;
  const k = 90;
  const damping = 9;
  flinch.vel.x += (-k * flinch.pos.x - damping * flinch.vel.x) * dt;
  flinch.vel.y += (-k * flinch.pos.y - damping * flinch.vel.y) * dt;
  flinch.pos.addScaledVector(flinch.vel, dt);
  world.customer.position.set(
    amp * (Math.sin(t * 1.7) + 0.6 * Math.sin(t * 3.3 + 1.2) + 0.3 * Math.sin(t * 7.1)) + flinch.pos.x,
    amp * 0.7 * (Math.sin(t * 1.3 + 0.4) + 0.5 * Math.sin(t * 4.1)) + flinch.pos.y,
    0,
  );
  world.customer.rotation.z = amp * 0.6 * Math.sin(t * 1.1 + 2) + flinch.pos.x * 0.3;

  // Random clench: cheeks squeeze inward briefly.
  if (inking && Math.random() < dt * squirm * 0.25) state.clench = 1;
  state.clench = Math.max(0, state.clench - dt * 2.5);
  world.canvasMesh.scale.x = 1 - 0.05 * Math.sin(state.clench * Math.PI);

  // Raycast the gun onto the skin.
  let hit: THREE.Intersection | undefined;
  if (pointerInside) {
    raycaster.setFromCamera(pointer, world.camera);
    hit = raycaster.intersectObject(world.canvasMesh, false)[0];
  }

  // The plane is alpha-cut to a silhouette; hits on the invisible part don't count.
  if (hit && !(hit.uv && painter.isOnSkin(hit.uv))) hit = undefined;
  const buzzing = inking && pointerDown && !!hit;
  audio.setBuzzing(buzzing);
  world.gun.visible = inking && pointerInside;

  if (hit && hit.face) {
    tmpNormal.copy(hit.face.normal).transformDirection(world.canvasMesh.matrixWorld);
    toCam.copy(world.camera.position).sub(hit.point).normalize();
    const dir = tmpNormal.multiplyScalar(0.5).addScaledVector(toCam, 0.5).add(tilt).normalize();
    world.gun.quaternion.setFromUnitVectors(UP, dir);
    const lift = buzzing ? 0 : 0.06;
    world.gun.position.copy(hit.point).addScaledVector(dir, lift);
    if (buzzing) {
      world.gun.position.x += (Math.random() - 0.5) * 0.006;
      world.gun.position.y += (Math.random() - 0.5) * 0.006;
      painter.paintAt(hit.uv!, BRUSHES[state.brush].radius);
    }
  } else if (pointerInside) {
    // Off the skin: float the gun on a plane in front of the customer.
    raycaster.setFromCamera(pointer, world.camera);
    const p = new THREE.Vector3();
    raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.8), p);
    world.gun.position.copy(p);
    world.gun.quaternion.setFromUnitVectors(UP, tilt.clone().add(new THREE.Vector3(0, 0, 0.6)).normalize());
    painter.lift();
  }
  world.gunLight.intensity = buzzing ? 1.4 : 0;

  if (inking && c) {
    // Pain: builds while inking (worse near the center), fades while resting.
    if (buzzing) {
      const centerDist = hit && hit.uv ? Math.hypot(hit.uv.x - 0.5, hit.uv.y - 0.5) : 1;
      const nearCenter = centerDist < 0.06 ? 1.8 : 1;
      state.pain = Math.min(1, state.pain + dt * c.sensitivity * 0.32 * nearCenter);
    } else {
      state.pain = Math.max(0, state.pain - dt * 0.22);
    }
    state.flinchCooldown -= dt;
    if (state.pain > 0.85 && state.flinchCooldown <= 0) {
      const dir = Math.random() * Math.PI * 2;
      flinch.vel.set(Math.cos(dir) * 2.2, Math.sin(dir) * 1.6);
      state.pain = 0.55;
      state.flinchCooldown = 1.5;
      state.clench = 1;
      audio.yelp();
      say(FLINCH_LINES[Math.floor(Math.random() * FLINCH_LINES.length)], 1200);
    }

    state.quipTimer -= dt;
    if (state.quipTimer <= 0) {
      const tier = state.pain < 0.35 ? 0 : state.pain < 0.7 ? 1 : 2;
      const lines = PAIN_QUIPS[tier];
      say(`${c.name}: "${lines[Math.floor(Math.random() * lines.length)]}"`);
      state.quipTimer = 5 + Math.random() * 4;
    }

    state.timeLeft -= dt;
    $('time-bar').style.width = `${Math.max(0, (state.timeLeft / state.timeLimit) * 100)}%`;
    $('time-text').textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
    $('pain-bar').style.width = `${state.pain * 100}%`;
    $('pain-text').textContent = state.pain < 0.3 ? '😐' : state.pain < 0.6 ? '😬' : state.pain < 0.85 ? '😣' : '😱';
    if (state.timeLeft <= 0) {
      say('Time! Put the gun down.', 1500);
      finishJob();
    }
  }

  // Gentle camera breathing so the room feels alive.
  world.camera.position.set(CAMERA_POS.x + Math.sin(elapsed * 0.25) * 0.05, CAMERA_POS.y, CAMERA_POS.z);
  world.camera.lookAt(CAMERA_TARGET);

  painter.flush();
}

let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  frame(dt);
  world.renderer.render(world.scene, world.camera);
  requestAnimationFrame(loop);
}

// Placeholder skin behind the title screen.
painter.prepare(makeCustomer(1));
showTitle();
requestAnimationFrame(loop);

// Debug/automation hook (used by the screenshot smoke test).
(window as unknown as { __cheekInk: unknown }).__cheekInk = { state, painter, world };
