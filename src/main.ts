/**
 * Cheeky Business: game loop and state machine.
 *
 *   title -> arriving -> intro -> inking -> result -> leaving -> arriving ... -> dayEnd
 */
import * as THREE from 'three';
import { buildWorld, CAMERA_POS, HI_RES_LAYER, ZOOM } from './scene';
import { BRUSHES, GRID, SkinPainter, drawReferenceCard, targetMask, toleranceFor } from './painter';
import { makeCustomer, reactionFor, reviewFor, type Customer, type CustomerOptions } from './customers';
import { makeLogo } from './logo';
import { buildShareCard, shareCard } from './share';
import { scoreMasks, type ScoreBreakdown } from './scoring';
import { drawPortrait, moodForPain, moodForScore, type Mood } from './portrait';
import { PS1Pipeline } from './ps1';
import { GunAudio } from './audio';
import { aside, nextSideGag, type SideGag } from './humor';

const CLIENTS_PER_DAY = 5;
/** Demo Day: one of each job type, gentle clients, ~3 minutes. */
const DEMO_SCRIPT: CustomerOptions[] = [
  { job: 'cheek', trait: 'Calm as a cucumber', design: 'bigheart' },
  { job: 'hole', trait: 'Nervous winker', design: 'birdeye' },
  { job: 'moon', trait: 'Ticklish', design: 'phoenix' },
];
/** The very first client of a fresh game is a softball. */
const TUTORIAL_CLIENT: CustomerOptions = { job: 'cheek', trait: 'Calm as a cucumber', design: 'bigheart' };
const BEST_KEY = 'cheeky-business:best-day';
/** Where customers stand while waiting off-screen, and how fast they waddle. */
const OFFSTAGE_X = 7.5;
const WADDLE_SPEED = 4.2;

type Phase = 'title' | 'arriving' | 'intro' | 'inking' | 'result' | 'leaving' | 'dayEnd';

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
const pipeline = new PS1Pipeline(world.renderer, world.snapRes);
const audio = new GunAudio();
const raycaster = new THREE.Raycaster();
raycaster.layers.set(HI_RES_LAYER);
const pointer = new THREE.Vector2(0, 0);
let pointerInside = false;
let pointerDown = false;

const state = {
  phase: 'title' as Phase,
  /** Demo Day mode: scripted 3-client run. */
  demo: false,
  clientsToday: CLIENTS_PER_DAY,
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
  /** 0 = wide, 1 = close-up; `zoom` eases toward `zoomTarget`. */
  zoom: 0,
  zoomTarget: 0,
  pucker: 0,
  winkTimer: 2,
  winkT: -1,
  mood: 'calm' as Mood,
  /** Seconds left on the clock when this client's side gag fires (-1 = none). */
  gagAt: -1,
  /** Extra squirm from a side gag, decays to 0. */
  squirmBoost: 0,
  walkX: -OFFSTAGE_X,
  walkTarget: -OFFSTAGE_X,
  onArrive: null as (() => void) | null,
  /** 1 = standing, 0 = bent over. */
  upright: 0,
  /** 1 = jeans up, 0 = at the knees. */
  pantsUp: 0,
};

// ---------- Tiny scripting helpers for cutscene beats (driven by the frame loop) ----------
interface Tween { t: number; dur: number; tick(k: number): void; resolve(): void }
const tweens: Tween[] = [];
function tween(dur: number, tick: (k: number) => void): Promise<void> {
  return new Promise((resolve) => tweens.push({ t: 0, dur, tick, resolve }));
}
const wait = (seconds: number) => tween(seconds, () => {});
const easeInOut = (k: number) => k * k * (3 - 2 * k);
/** Ease with a little overshoot at the end, for the bend-over "flop". */
const easeBack = (k: number) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
function tweenPose(upright: number, pantsUp: number, dur: number, ease = easeInOut): Promise<void> {
  const u0 = state.upright;
  const p0 = state.pantsUp;
  return tween(dur, (k) => {
    const e = ease(k);
    state.upright = u0 + (upright - u0) * e;
    state.pantsUp = p0 + (pantsUp - p0) * e;
  });
}
function walk(x: number): Promise<void> {
  return new Promise((resolve) => {
    state.walkTarget = x;
    state.onArrive = resolve;
  });
}
function runTweens(dt: number): void {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t = Math.min(tw.dur, tw.t + dt);
    tw.tick(tw.dur ? tw.t / tw.dur : 1);
    if (tw.t >= tw.dur) {
      tweens.splice(i, 1);
      tw.resolve();
    }
  }
}

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

function setZoom(target: 0 | 1): void {
  state.zoomTarget = target;
  $('zoom-btn').innerHTML = `${target ? '🔭 Zoom out' : '🔍 Zoom in'}<kbd>Z</kbd>`;
}
function toggleZoom(): void {
  setZoom(state.zoomTarget > 0.5 ? 0 : 1);
}

$('finish-btn').addEventListener('click', () => finishJob());
$('zoom-btn').addEventListener('click', toggleZoom);
$('mute-btn').addEventListener('click', (e) => {
  (e.currentTarget as HTMLElement).textContent = audio.toggleMute() ? '🔇' : '🔊';
});

// Every button beeps; primary buttons get the brighter "confirm" chirp.
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  if (!btn || btn.disabled) return;
  audio.beep(btn.classList.contains('primary') ? 'confirm' : 'select');
});

function updateTopHud(): void {
  $('hud-day').textContent = state.demo ? 'Demo Day' : `Day ${state.day}`;
  $('hud-client').textContent = `Client ${Math.min(state.clientIndex + 1, state.clientsToday)}/${state.clientsToday}`;
  $('hud-cash').textContent = `$${state.cash.toLocaleString()}`;
}

function setMood(mood: Mood): void {
  if (mood === state.mood || !state.customer) return;
  state.mood = mood;
  drawPortrait($<HTMLCanvasElement>('client-portrait'), state.customer.looks, mood);
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

function portraitHtml(id: string, size = 72): string {
  return `<canvas id="${id}" class="portrait" style="width:${size}px;height:${size}px"></canvas>`;
}

// ---------- Flow ----------
function showTitle(): void {
  state.phase = 'title';
  $('hud').classList.add('hidden');
  const best = readBest();
  const card = showModal(
    `<div class="logo-wrap"></div>
     <p class="tagline">A tattoo parlor for one very specific body part. Okay, two.<br/>
       <strong class="slogan">Behind every great tattoo is a great behind.</strong><br/>
       <span class="small-print">${escapeHtml(aside('titleSmallPrint'))}</span></p>
     <ul>
       <li>Clients waddle in, drop trou, and ask for a design. Ink it <strong>exactly</strong> as shown.</li>
       <li><strong>Hole Jobs</strong> are close-up and the hole <em>puckers</em>. <strong>Cheek Jobs</strong> go big. <strong>Full Moon</strong> is both.</li>
       <li>Hold the mouse (or a finger) to ink. <strong>1 / 2 / 3</strong> switch needles, <strong>Z</strong> or the scroll wheel zooms.</li>
       <li>They squirm. Pain makes them flinch. Watch their face.</li>
       <li>There is no undo. Tattoos are permanent.</li>
     </ul>
     ${best ? `<p>Best single-day earnings: <strong style="color:var(--green)">$${best}</strong></p>` : ''}`,
    [
      { label: 'Open the shop', onClick: () => startDay(1, false) },
      { label: 'Demo Day (3 clients)', primary: true, onClick: () => startDay(1, true) },
    ],
  );
  const logo = makeLogo();
  logo.className = 'logo';
  card.querySelector('.logo-wrap')!.appendChild(logo);
}

function startDay(day: number, demo = state.demo): void {
  hideModal();
  state.demo = demo;
  state.clientsToday = demo ? DEMO_SCRIPT.length : CLIENTS_PER_DAY;
  state.day = day;
  state.clientIndex = 0;
  state.dayCash = 0;
  if (day === 1) state.cash = 0;
  state.results = [];
  state.usedDesigns = [];
  state.timeLimit = Math.max(28, 50 - (day - 1) * 5);
  // Whoever is on stage (the title-screen model) waddles off first.
  void leave().then(nextClient);
}

/** Current client stands up and waddles off (pants still down, obviously). */
async function leave(): Promise<void> {
  if (Math.abs(state.walkX) >= OFFSTAGE_X - 0.01) return;
  state.phase = 'leaving';
  await tweenPose(1, 0, 0.5);
  await walk(OFFSTAGE_X);
}

/** New client waddles in with their pants on, drops them, and bends over the bench. */
async function arrive(): Promise<void> {
  const c = state.customer!;
  state.phase = 'arriving';
  state.walkX = -OFFSTAGE_X;
  state.upright = 1;
  state.pantsUp = 1;
  await walk(0);
  await wait(0.35);
  say(`${c.name}: "${aside('arrival')}"`, 1400);
  await wait(0.5);
  await tweenPose(1, 0, 0.45);
  await wait(0.35);
  await tweenPose(0, 0, 0.75, easeBack);
  await wait(0.2);
}

function nextClient(): void {
  const opts = state.demo
    ? DEMO_SCRIPT[state.clientIndex]
    : state.day === 1 && state.clientIndex === 0 ? TUTORIAL_CLIENT : {};
  const c = makeCustomer(state.day, Math.random, state.usedDesigns, {
    ...opts,
    avoidNames: state.results.map((r) => r.customer.name),
  });
  state.customer = c;
  state.usedDesigns.push(c.design.id);
  painter.prepare(c);
  for (const m of world.skinMaterials) m.color.set(c.skin);
  world.shirtMaterial.color.set(c.looks.shirt);
  state.zoom = state.zoomTarget = 0;
  state.pucker = 0;
  updateTopHud();
  $('hud').classList.add('hidden');

  world.setLooks(c.looks, c.body);
  void arrive().then(showIntro);
}

function showIntro(): void {
  const c = state.customer!;
  state.phase = 'intro';
  const card = showModal(
    `<div class="client" style="gap:14px">
       ${portraitHtml('intro-portrait', 80)}
       <div><h2>${escapeHtml(c.name)}</h2><div class="trait">${escapeHtml(c.trait)}</div>
       <div class="job-tag job-${c.job.kind}">${escapeHtml(c.job.label)}</div></div>
     </div>
     <div class="quote">"${escapeHtml(c.request)}"</div>
     <div style="display:flex;gap:14px;align-items:center">
       <canvas id="intro-ref" width="200" height="200" style="width:150px;border-radius:10px;border:3px solid #fff"></canvas>
       <p style="margin:0"><strong>${escapeHtml(c.design.name)}.</strong> ${escapeHtml(c.design.tip)}<br/><br/>
       ${escapeHtml(c.job.blurb)}<br/><br/>You have <strong>${state.timeLimit + c.job.timeBonus}s</strong>.
       <span class="small-print">${escapeHtml(aside('introAside'))}</span></p>
     </div>`,
    [{ label: "Let's ink 🖊️", primary: true, onClick: startInking }],
  );
  drawPortrait(card.querySelector<HTMLCanvasElement>('#intro-portrait')!, c.looks, 'nervous');
  drawReferenceCard(card.querySelector<HTMLCanvasElement>('#intro-ref')!, c, painter.outline);
}

function startInking(): void {
  const c = state.customer!;
  hideModal();
  $('hud').classList.remove('hidden');
  stage.classList.add('inking');
  state.mood = 'happy'; // force a redraw
  setMood('calm');
  $('client-name').textContent = c.name;
  $('client-trait').textContent = c.trait;
  $('ref-name').textContent = `${c.design.name} · ${c.job.label}`;
  $('ref-tip').textContent = c.design.tip;
  $('fine-print').textContent = aside('hudFinePrint');
  drawReferenceCard($<HTMLCanvasElement>('ref-card'), c, painter.outline);

  state.timeLimit = Math.max(28, 50 - (state.day - 1) * 5);
  state.timeLeft = state.timeLimit + c.job.timeBonus;
  state.pain = 0;
  state.flinchCooldown = 0;
  state.quipTimer = 4;
  state.winkTimer = 2 + Math.random() * 2;
  // Most clients pull one random side gag, somewhere in the middle of the job.
  const total = state.timeLimit + c.job.timeBonus;
  const tutorial = state.day === 1 && state.clientIndex === 0 && !state.demo;
  state.gagAt = !tutorial && Math.random() < 0.75 ? total * (0.3 + Math.random() * 0.4) : -1;
  state.squirmBoost = 0;
  setZoom(c.job.zoom === 'close' ? 1 : 0);
  // Fine needle for detail work, Liner for the big pieces.
  setBrush(c.job.kind === 'hole' ? 0 : 1);
  flinch.pos.set(0, 0);
  flinch.vel.set(0, 0);
  state.phase = 'inking';
  if (state.day === 1 && state.clientIndex === 0) {
    say('Trace the design on the card. Hold to ink. Hit Done when finished!', 4500);
    state.quipTimer = 7;
  } else {
    say(`${c.name}: "${aside('start')}"`);
  }
}

/** Play a side gag: its lines in sequence, then its effect on the client. */
function playSideGag(gag: SideGag): void {
  const c = state.customer!;
  gag.lines.forEach((line, i) => {
    window.setTimeout(() => {
      if (state.phase !== 'inking' || state.customer !== c) return;
      const isSound = line.startsWith('*') || line.startsWith('💨');
      say(isSound ? line : `${c.name}: "${line}"`, 1500);
      // A fart clenches on the sound itself; everything else lands on the punchline.
      const hitAt = gag.effect === 'clench' ? 0 : gag.lines.length - 1;
      if (i !== hitAt) return;
      if (gag.effect === 'jolt') {
        const dir = Math.random() * Math.PI * 2;
        flinch.vel.set(Math.cos(dir) * 1.6, Math.sin(dir) * 1.2);
        pointerDown = false;
        painter.lift();
      } else if (gag.effect === 'clench') {
        state.clench = 1;
        flinch.vel.y += 0.6;
      } else if (gag.effect === 'squirm') {
        state.squirmBoost = 0.6;
      }
    }, i * 1500);
  });
  state.quipTimer = Math.max(state.quipTimer, gag.lines.length * 1.5 + 2);
}

function payFor(score: number, c: Customer): number {
  if (score < 30) return 0;
  return Math.round((40 + score * 1.6) * c.generosity * c.job.payMult);
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
  state.zoomTarget = c.job.zoom === 'close' ? 1 : 0;

  const ink = painter.inkMask(c.job);
  const score = scoreMasks(ink.mask, targetMask(c), GRID, toleranceFor(c.job), ink.stray);
  const pay = payFor(score.score, c);
  state.cash += pay;
  state.dayCash += pay;
  state.results.push({ customer: c, score, pay });
  updateTopHud();

  const quote = reactionFor(score.score, c);
  const lastOfDay = state.clientIndex + 1 >= state.clientsToday;
  const card = showModal(
    `<div class="client" style="gap:14px">
       ${portraitHtml('res-portrait', 64)}
       <h2 style="margin:0">${escapeHtml(c.name)} checks the mirror…</h2>
     </div>
     <div class="quote">"${escapeHtml(quote)}"</div>
     <div class="compare">
       <figure><canvas id="res-ink" width="260" height="260"></canvas>Your work</figure>
       <figure><canvas id="res-overlay" width="260" height="260"></canvas>vs. the request</figure>
     </div>
     <div class="score-row">
       <div class="grade ${score.grade}">${score.grade}</div>
       <dl class="stats">
         <dt>Likeness</dt><dd>${score.score}%</dd>
         <dt>Accuracy</dt><dd>${Math.round(score.precision * 100)}% <span class="muted">of your ink was on-design</span></dd>
         <dt>Coverage</dt><dd>${Math.round(score.recall * 100)}% <span class="muted">of the design got inked</span></dd>
         <dt>Paid</dt><dd style="color:${pay ? 'var(--green)' : 'var(--red)'}">${pay ? `$${pay}` : escapeHtml(aside('refusedToPay'))}</dd>
       </dl>
     </div>`,
    [
      {
        label: '📸 Share',
        onClick: () => {
          const big = painter.snapshot(c.job, 450);
          const overlay = document.createElement('canvas');
          overlay.width = overlay.height = 450;
          drawReferenceCard(overlay, c, painter.outline, big);
          const cardImg = buildShareCard({ customer: c, score, quote, yourWork: big, overlay });
          shareCard(cardImg, c.name)
            .then((how) => { if (how === 'downloaded') say('Saved! Check your downloads.', 1800); })
            .catch(() => say("Couldn't save the picture on this device.", 2000));
        },
      },
      {
        label: lastOfDay ? (state.demo ? 'Finish demo' : 'Close up shop') : 'Next client',
        primary: true,
        onClick: () => {
          hideModal();
          state.clientIndex++;
          void leave().then(state.clientIndex >= state.clientsToday ? endDay : nextClient);
        },
      },
    ],
  );
  drawPortrait(card.querySelector<HTMLCanvasElement>('#res-portrait')!, c.looks, moodForScore(score.score));
  const snap = painter.snapshot(c.job, 260);
  card.querySelector<HTMLCanvasElement>('#res-ink')!.getContext('2d')!.drawImage(snap, 0, 0);
  drawReferenceCard(card.querySelector<HTMLCanvasElement>('#res-overlay')!, c, painter.outline, snap);
}

function endDay(): void {
  state.phase = 'dayEnd';
  $('hud').classList.add('hidden');
  const avg = Math.round(state.results.reduce((s, r) => s + r.score.score, 0) / state.results.length);
  const usedReviews = new Set<string>();
  const reviews = state.results.map((r) => `<li>${escapeHtml(reviewFor(r.score.score, r.customer, usedReviews))}</li>`).join('');
  if (state.demo) {
    showModal(
      `<h2>Demo complete!</h2>
       <p>You earned <strong style="color:var(--green)">$${state.dayCash}</strong> · average likeness <strong>${avg}%</strong></p>
       <p style="margin-bottom:0">Your reviews:</p>
       <ul class="reviews">${reviews}</ul>
       <p style="font-size:13px">The full game runs five clients a day, and every day they get squirmier.
       <br/><span class="small-print">Shop notes: ${escapeHtml(aside('shopNotes'))}</span></p>`,
      [
        { label: 'Back to title', onClick: showTitle },
        { label: 'Play the full game', primary: true, onClick: () => startDay(1, false) },
      ],
    );
  } else {
    const best = readBest();
    const record = state.dayCash > best;
    if (record) writeBest(state.dayCash);
    showModal(
      `<h2>Day ${state.day} complete</h2>
       <p>Earned <strong style="color:var(--green)">$${state.dayCash}</strong> today · average likeness <strong>${avg}%</strong>
       ${record ? ' · <strong style="color:var(--yellow)">New record!</strong>' : ''}</p>
       <p style="margin-bottom:0">Your online reviews:</p>
       <ul class="reviews">${reviews}</ul>
       <p style="font-size:13px">Tomorrow's clients are more caffeinated, puckerier, and you get less time.
       <br/><span class="small-print">Shop notes: ${escapeHtml(aside('shopNotes'))}</span></p>`,
      [
        { label: 'Quit to title', onClick: showTitle },
        { label: `Open Day ${state.day + 1}`, primary: true, onClick: () => startDay(state.day + 1) },
      ],
    );
  }
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
canvasEl.addEventListener('wheel', (e) => {
  if (state.phase !== 'inking') return;
  e.preventDefault();
  if ((e.deltaY < 0) !== (state.zoomTarget > 0.5)) toggleZoom();
}, { passive: false });
window.addEventListener('blur', release);

window.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') $('mute-btn').click();
  if (state.phase !== 'inking') return;
  if (e.key === '1' || e.key === '2' || e.key === '3') setBrush(Number(e.key) - 1);
  if (e.key === 'z' || e.key === 'Z') toggleZoom();
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    finishJob();
  }
});

function onResize(): void {
  world.resize();
  pipeline.setSize(stage.clientWidth, stage.clientHeight);
}
window.addEventListener('resize', onResize);
onResize();

// ---------- Per-frame simulation ----------
const tmpNormal = new THREE.Vector3();
const toCam = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tilt = new THREE.Vector3(0.35, 0.45, 0);
const lookTarget = new THREE.Vector3();
const offSkinPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.8);
const tmpPoint = new THREE.Vector3();

function frame(dt: number): void {
  elapsed += dt;
  const c = state.customer;
  const inking = state.phase === 'inking';
  const t = elapsed;

  runTweens(dt);
  world.setPose(state.upright, state.pantsUp);

  // ---- Waddle: walk toward the target with swinging legs and a hip bob.
  const dx = state.walkTarget - state.walkX;
  const walking = Math.abs(dx) > 0.01;
  if (walking) {
    state.walkX += Math.sign(dx) * Math.min(Math.abs(dx), WADDLE_SPEED * dt);
    if (Math.abs(state.walkTarget - state.walkX) <= 0.01) {
      state.walkX = state.walkTarget;
      const cb = state.onArrive;
      state.onArrive = null;
      cb?.();
    }
  }
  const stride = walking ? Math.sin(t * 14) : 0;
  world.legs[0].rotation.x = stride * 0.35;
  world.legs[1].rotation.x = -stride * 0.35;

  // ---- Squirm: idle sway + pain jitter + flinch spring.
  state.squirmBoost = Math.max(0, state.squirmBoost - dt * 0.15);
  const squirm = (c ? c.squirm : 0.2) + state.squirmBoost;
  // Hole work is fiddly enough already; clients hold stiller for it (tuned so a typical
  // squirm stays within about one line-width at hole scale).
  const holdStill = c?.job.kind === 'hole' ? 0.5 : 1;
  const amp = inking ? (0.008 + squirm * 0.035 + state.pain * 0.04) * holdStill : 0.006;
  const k = 90;
  const damping = 9;
  flinch.vel.x += (-k * flinch.pos.x - damping * flinch.vel.x) * dt;
  flinch.vel.y += (-k * flinch.pos.y - damping * flinch.vel.y) * dt;
  flinch.pos.addScaledVector(flinch.vel, dt);
  world.customer.position.set(
    state.walkX + amp * (Math.sin(t * 1.7) + 0.6 * Math.sin(t * 3.3 + 1.2) + 0.3 * Math.sin(t * 7.1)) + flinch.pos.x,
    amp * 0.7 * (Math.sin(t * 1.3 + 0.4) + 0.5 * Math.sin(t * 4.1)) + flinch.pos.y + Math.abs(stride) * 0.08,
    0,
  );
  world.customer.rotation.z = amp * 0.6 * Math.sin(t * 1.1 + 2) + flinch.pos.x * 0.3 + stride * 0.06;

  // ---- Cheek clench and hole pucker.
  if (inking && Math.random() < dt * squirm * 0.25) state.clench = 1;
  state.clench = Math.max(0, state.clench - dt * 2.5);
  world.canvasMesh.scale.x = 1 - 0.05 * Math.sin(state.clench * Math.PI);

  if (inking && c) {
    state.winkTimer -= dt * (0.4 + c.puckeriness + state.pain);
    if (state.winkTimer <= 0 && state.winkT < 0) {
      state.winkT = 0;
      state.winkTimer = 2.5 + Math.random() * 3;
      if (state.zoom > 0.5 && Math.random() < 0.35) say(aside('wink'), 1000);
    }
  }
  let puckerGoal = 0.08 + 0.06 * Math.sin(t * 2.2); // resting "breathing"
  if (state.winkT >= 0) {
    state.winkT += dt;
    // Quick squeeze, short hold, slow release.
    const w = state.winkT;
    puckerGoal = w < 0.12 ? w / 0.12 : w < 0.35 ? 1 : Math.max(0, 1 - (w - 0.35) / 0.5);
    if (w > 0.85) state.winkT = -1;
  }
  puckerGoal = Math.max(puckerGoal, state.clench * 0.6);
  state.pucker += (puckerGoal - state.pucker) * Math.min(1, dt * 18);
  world.setPucker(state.pucker);

  // ---- Camera zoom (FOV only; see scene.ts on why the camera never moves).
  state.zoom += (state.zoomTarget - state.zoom) * Math.min(1, dt * 6);
  const ez = state.zoom * state.zoom * (3 - 2 * state.zoom);
  // Pull back to show the whole client while they're standing.
  const stand = easeInOut(Math.min(1, state.upright));
  world.setFov(THREE.MathUtils.lerp(THREE.MathUtils.lerp(ZOOM.wide.fov, ZOOM.close.fov, ez), ZOOM.entrance.fov, stand));
  lookTarget.lerpVectors(ZOOM.wide.target, ZOOM.close.target, ez).lerp(ZOOM.entrance.target, stand);
  world.camera.position.set(CAMERA_POS.x + Math.sin(elapsed * 0.25) * 0.05 * (1 - ez), CAMERA_POS.y, CAMERA_POS.z);
  world.camera.lookAt(lookTarget);
  world.camera.updateMatrixWorld();

  // ---- Raycast the gun onto the skin.
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
  // Keep the gun the same size on screen regardless of zoom.
  world.gun.scale.setScalar(world.camera.fov / ZOOM.wide.fov);

  if (hit && hit.face) {
    tmpNormal.copy(hit.face.normal).transformDirection(world.canvasMesh.matrixWorld);
    toCam.copy(world.camera.position).sub(hit.point).normalize();
    const dir = tmpNormal.multiplyScalar(0.5).addScaledVector(toCam, 0.5).add(tilt).normalize();
    world.gun.quaternion.setFromUnitVectors(UP, dir);
    const lift = buzzing ? 0 : 0.06 * world.gun.scale.x;
    world.gun.position.copy(hit.point).addScaledVector(dir, lift);
    if (buzzing) {
      const jitter = 0.006 * world.gun.scale.x;
      world.gun.position.x += (Math.random() - 0.5) * jitter;
      world.gun.position.y += (Math.random() - 0.5) * jitter;
      painter.paintAt(hit.uv!, BRUSHES[state.brush].radius);
    }
  } else if (pointerInside) {
    // Off the skin: float the gun on a plane in front of the customer.
    raycaster.setFromCamera(pointer, world.camera);
    if (raycaster.ray.intersectPlane(offSkinPlane, tmpPoint)) world.gun.position.copy(tmpPoint);
    world.gun.quaternion.setFromUnitVectors(UP, tmpNormal.set(0.35, 0.45, 0.6).normalize());
    painter.lift();
  }
  world.gunLight.intensity = buzzing ? 1.4 : 0;

  if (inking && c) {
    // Pain: builds while inking (worse right at the hole), fades while resting.
    if (buzzing) {
      const centerDist = hit && hit.uv ? Math.hypot(hit.uv.x - 0.5, hit.uv.y - 0.5) : 1;
      const nearHole = centerDist < 0.05 ? 1.5 : 1;
      state.pain = Math.min(1, state.pain + dt * c.sensitivity * 0.22 * nearHole);
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
      // The jolt knocks the gun off the skin: it interrupts the stroke instead of
      // dragging a streak across the design. Press again to keep going.
      pointerDown = false;
      painter.lift();
      say(aside('flinch'), 1200);
    }
    setMood(moodForPain(state.pain));

    state.quipTimer -= dt;
    if (state.quipTimer <= 0) {
      const tier = state.pain < 0.35 ? 'painLow' : state.pain < 0.7 ? 'painMid' : 'painHigh';
      say(`${c.name}: "${aside(tier)}"`);
      state.quipTimer = 5 + Math.random() * 4;
    }

    state.timeLeft -= dt;
    if (state.gagAt > 0 && state.timeLeft <= state.gagAt) {
      state.gagAt = -1;
      playSideGag(nextSideGag());
    }
    const total = state.timeLimit + c.job.timeBonus;
    $('time-bar').style.width = `${Math.max(0, (state.timeLeft / total) * 100)}%`;
    $('time-text').textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
    $('pain-bar').style.width = `${state.pain * 100}%`;
    $('pain-bar').parentElement!.classList.toggle('danger', state.pain > 0.68);
    if (state.timeLeft <= 0) {
      say('Time! Put the gun down.', 1500);
      finishJob();
    }
  }

  painter.flush();
}

let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  frame(dt);
  pipeline.render(world.scene, world.camera);
  requestAnimationFrame(loop);
}

// Someone is already bent over behind the title screen.
state.customer = makeCustomer(1);
painter.prepare(state.customer);
for (const m of world.skinMaterials) m.color.set(state.customer.skin);
world.shirtMaterial.color.set(state.customer.looks.shirt);
state.walkX = state.walkTarget = 0;
world.setLooks(state.customer.looks, state.customer.body);
showTitle();
requestAnimationFrame(loop);

// Debug/automation hook (used by the screenshot smoke test).
(window as unknown as { __cheeky: unknown }).__cheeky = { state, painter, world };
