/**
 * Cheeky Business: game loop and state machine.
 *
 *   title -> arriving -> intro -> inking -> result -> leaving -> arriving ... -> dayEnd
 */
import * as THREE from 'three';
import { buildWorld, CAMERA_POS, HI_RES_LAYER, ZOOM } from './scene';
import { BRUSHES, GRID, SkinPainter, drawReferenceCard, targetMask, toleranceFor } from './painter';
import {
  makeBoss, makeCouple, makeCustomer, makeReturningCustomer, reactionFor, reviewFor,
  type Customer, type CustomerOptions, type Regret,
} from './customers';
import { makeLogo } from './logo';
import { DESIGNS, fillDesign } from './designs';
import { buildShareCard, shareCard } from './share';
import { countOn, gradeFor, scoreMasks, type ScoreBreakdown } from './scoring';
import { drawPortrait, moodForPain, moodForScore, type Mood } from './portrait';
import { PS1Pipeline } from './ps1';
import { GunAudio } from './audio';
import { aside, nextSideGag, type SideGag } from './humor';
import { frontPage } from './newspaper';
import { UPGRADES, effectsOf, type UpgradeId } from './upgrades';

const CLIENTS_PER_DAY = 5;
/** The very first client of a fresh game is a softball. */
const TUTORIAL_CLIENT: CustomerOptions = {
  job: 'cheek', trait: 'Calm as a cucumber', design: 'bigheart', surprise: false, mindChange: false,
};
const BEST_KEY = 'cheeky-business:best-day';
/** Where customers stand while waiting off-screen, and how fast they waddle. */
const OFFSTAGE_X = 7.5;
const WADDLE_SPEED = 4.2;

type Phase = 'title' | 'arriving' | 'intro' | 'inking' | 'result' | 'leaving' | 'dayEnd';

interface JobResult {
  customer: Customer;
  score: ScoreBreakdown;
  pay: number;
  /** Square crop of the finished skin, for the newspaper photo. */
  snap: HTMLCanvasElement;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- Setup ----------
const stage = $('stage');
const painter = new SkinPainter();
/** Second skin, for the partner in couples jobs. */
const partnerPainter = new SkinPainter();
const world = buildWorld(stage, painter.texture, partnerPainter.texture);
/** Couples stand side by side, this far either side of center. */
const COUPLE_OFFSET = 1.35;
/** Couples need a wider shot to fit both. */
const COUPLE_WIDE_FOV = 40;
const pipeline = new PS1Pipeline(world.renderer, world.snapRes);
const audio = new GunAudio();
const raycaster = new THREE.Raycaster();
raycaster.layers.set(HI_RES_LAYER);
const pointer = new THREE.Vector2(0, 0);
let pointerInside = false;
let pointerDown = false;
// A finger waits a beat before inking, so the first finger of a pinch or pan leaves no dot.
let inkReadyAt = 0;
const TOUCH_INK_DELAY_MS = 80;

const state = {
  phase: 'title' as Phase,
  clientsToday: CLIENTS_PER_DAY,
  /** Shop upgrades owned this run. */
  upgrades: new Set<UpgradeId>(),
  /** Botched jobs that may come back for a cover-up. */
  regrets: [] as Regret[],
  /** At most one returning client per day. */
  returnedToday: false,
  /** "Before" photo of the current cover-up client's old work. */
  coverUpSnap: null as HTMLCanvasElement | null,
  /** Test hook: force the next client's type once (used by automated playthroughs). */
  forceNext: null as 'couple' | 'boss' | null,
  /** Seconds until the boss's next disruption; and the bodybuilder's flex (0..1). */
  bossTimer: 0,
  flex: 0,
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
  /** Clock for the current job, including bonuses (for the time bar). */
  timeTotal: 45,
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
  /** Seconds left on the clock when a mind-changer swaps designs (-1 = never). */
  changeAt: -1,
  walkX: -OFFSTAGE_X,
  walkTarget: -OFFSTAGE_X,
  onArrive: null as (() => void) | null,
  /** 1 = standing, 0 = bent over. */
  upright: 0,
  /** 1 = jeans up, 0 = at the knees. */
  pantsUp: 0,
  /** Camera pan (world units). Slides the camera and its target together so the view
   * angle, and therefore the stroke-to-score mapping, never changes. */
  pan: new THREE.Vector2(),
};
const PAN_LIMIT = { x: 1.6, yMin: -1.6, yMax: 1.3 };
const CAMERA_DIST = 7.2;

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
  const zoomingIn = state.zoomTarget <= 0.5;
  // Couples: zoom onto whichever client the cursor is over.
  if (zoomingIn && state.customer?.partner) state.pan.x = pointer.x < 0 ? -COUPLE_OFFSET : COUPLE_OFFSET;
  setZoom(zoomingIn ? 1 : 0);
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
  $('hud-day').textContent = `Day ${state.day}`;
  $('hud-client').textContent = `Client ${Math.min(state.clientIndex + 1, state.clientsToday)}/${state.clientsToday}`;
  $('hud-cash').textContent = `$${state.cash.toLocaleString()}`;
}

function setMood(mood: Mood): void {
  if (mood === state.mood || !state.customer) return;
  state.mood = mood;
  drawPortrait($<HTMLCanvasElement>('client-portrait'), state.customer.looks, mood);
}

let bubbleTimeout = 0;
/** Who's talking: one name, even when a couple is on the bench. */
function speaker(c: Customer): string {
  return c.name.split(' & ')[0];
}
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

/** Reference card, or a big "?" for surprise-me clients. */
function drawCard(canvas: HTMLCanvasElement, c: Customer, overlay?: HTMLCanvasElement): void {
  drawReferenceCard(canvas, c, painter.outline, overlay);
  if (!c.surprise) return;
  const ctx = canvas.getContext('2d')!;
  const S = canvas.width;
  ctx.save();
  ctx.fillStyle = overlay ? 'rgba(255, 63, 164, 0.85)' : '#ff3fa4';
  ctx.font = `bold ${Math.round(S * 0.55)}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (overlay) ctx.globalAlpha = 0.5;
  ctx.fillText('?', S / 2, S / 2);
  ctx.restore();
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
      { label: 'Play', primary: true, onClick: () => startDay(1) },
    ],
  );
  const logo = makeLogo();
  logo.className = 'logo';
  card.querySelector('.logo-wrap')!.appendChild(logo);
}

function startDay(day: number): void {
  hideModal();
  state.clientsToday = CLIENTS_PER_DAY;
  state.day = day;
  state.clientIndex = 0;
  state.dayCash = 0;
  if (day === 1) {
    state.cash = 0;
    state.upgrades.clear();
    state.regrets = [];
  }
  state.results = [];
  state.usedDesigns = [];
  state.returnedToday = false;
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
  say(`${speaker(c)}: "${aside(c.coverUp ? 'returnArrival' : 'arrival')}"`, 1600);
  await wait(0.5);
  await tweenPose(1, 0, 0.45);
  await wait(0.35);
  await tweenPose(0, 0, 0.75, easeBack);
  await wait(0.2);
}

function nextClient(): void {
  const opts = state.day === 1 && state.clientIndex === 0 ? TUTORIAL_CLIENT : {};
  // Couples are stored as "A & B"; split them so neither name repeats today.
  const todaysNames = state.results.flatMap((r) => r.customer.name.split(' & '));
  // From day 2, one botched client a day may come back for a cover-up.
  const regretIdx = state.regrets.findIndex((r) => !todaysNames.includes(r.customer.name));
  const returning = state.day >= 2 && !state.returnedToday && state.clientIndex >= 1 && state.clientIndex <= 3
    && regretIdx >= 0 && Math.random() < 0.5;
  let regret: Regret | null = null;
  let c: Customer;
  // From day 2, the last client of the day is usually a boss.
  const forced = state.forceNext;
  state.forceNext = null;
  const bossTime = forced === 'boss'
    || (!forced && state.day >= 2 && state.clientIndex === state.clientsToday - 1 && Math.random() < 0.75);
  // From day 2, a few mid-day jobs are couples.
  const coupleTime = forced === 'couple' || (!forced && state.day >= 2 && !bossTime && !returning
    && state.clientIndex >= 1 && state.clientIndex <= 3 && Math.random() < 0.18);
  if (bossTime) {
    c = makeBoss(state.day);
  } else if (coupleTime) {
    c = makeCouple(state.day, Math.random, [...todaysNames, ...state.regrets.map((r) => r.customer.name)]);
  } else if (returning) {
    regret = state.regrets.splice(regretIdx, 1)[0];
    c = makeReturningCustomer(regret);
    state.returnedToday = true;
  } else {
    // New clients never share a name with someone who might come back for a cover-up.
    const avoidNames = [...todaysNames, ...state.regrets.map((r) => r.customer.name)];
    c = makeCustomer(state.day, Math.random, state.usedDesigns, { ...opts, avoidNames });
  }
  state.customer = c;
  state.coverUpSnap = regret?.snap ?? null;
  state.usedDesigns.push(c.design.id);
  painter.prepare(c);
  if (regret) painter.loadInk(regret.ink);
  for (const m of world.skinMaterials) m.color.set(c.skin);
  world.shirtMaterial.color.set(c.looks.shirt);
  const p = c.partner;
  world.partner.customer.visible = !!p;
  if (p) {
    partnerPainter.prepare(p);
    for (const m of world.partner.skinMaterials) m.color.set(p.skin);
    world.partner.shirtMaterial.color.set(p.looks.shirt);
    world.partner.setLooks(p.looks, p.body);
  }
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
       <div class="job-tag job-${c.job.kind}">${escapeHtml(c.job.label)}</div>
       ${c.coverUp ? '<div class="job-tag job-cover">COVER-UP · 1.5× PAY</div>' : ''}
       ${c.boss ? '<div class="job-tag job-boss">BOSS · 2× PAY</div>' : ''}</div>
     </div>
     <div class="quote">"${escapeHtml(c.request)}"</div>
     <div style="display:flex;gap:14px;align-items:center">
       ${state.coverUpSnap ? '<figure class="before"><canvas id="intro-before" width="200" height="200"></canvas>Current situation</figure>' : ''}
       <canvas id="intro-ref" width="200" height="200" style="width:150px;border-radius:10px;border:3px solid #fff"></canvas>
       <p style="margin:0"><strong>${c.surprise ? 'Surprise me.' : escapeHtml(c.design.name) + '.'}</strong> ${escapeHtml(c.design.tip)}<br/><br/>
       ${escapeHtml(c.job.blurb)}<br/><br/>You have <strong>${state.timeLimit + c.job.timeBonus + effectsOf(state.upgrades).bonusSeconds}s</strong>.
       <span class="small-print">${escapeHtml(aside('introAside'))}</span></p>
     </div>`,
    [{ label: "Let's ink 🖊️", primary: true, onClick: startInking }],
  );
  drawPortrait(card.querySelector<HTMLCanvasElement>('#intro-portrait')!, c.looks, 'nervous');
  if (c.partner) {
    const second = document.createElement('canvas');
    second.className = 'portrait';
    second.style.cssText = 'width:80px;height:80px;margin-left:-14px';
    drawPortrait(second, c.partner.looks, 'nervous');
    card.querySelector('#intro-portrait')!.after(second);
  }
  drawCard(card.querySelector<HTMLCanvasElement>('#intro-ref')!, c);
  if (state.coverUpSnap) card.querySelector<HTMLCanvasElement>('#intro-before')!.getContext('2d')!.drawImage(state.coverUpSnap, 0, 0);
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
  drawCard($<HTMLCanvasElement>('ref-card'), c);

  const fx = effectsOf(state.upgrades);
  state.timeLeft = state.timeLimit + c.job.timeBonus + fx.bonusSeconds;
  painter.setStencil(fx.stencil ? c : null);
  if (c.partner) partnerPainter.setStencil(fx.stencil ? c.partner : null);
  state.pain = 0;
  state.flinchCooldown = 0;
  state.quipTimer = 4;
  state.winkTimer = 2 + Math.random() * 2;
  // Most clients pull one random side gag, somewhere in the middle of the job.
  const total = state.timeLeft;
  state.timeTotal = total;
  const tutorial = state.day === 1 && state.clientIndex === 0;
  state.gagAt = !tutorial && Math.random() < 0.75 ? total * (0.3 + Math.random() * 0.4) : -1;
  state.squirmBoost = 0;
  state.changeAt = c.mindChange ? total * (0.4 + Math.random() * 0.2) : -1;
  state.bossTimer = 2.5;
  state.flex = 0;
  if (c.boss) state.gagAt = -1; // bosses are chaotic enough
  setZoom(c.job.zoom === 'close' ? 1 : 0);
  state.pan.set(0, 0);
  // Fine needle for detail work, Liner for the big pieces.
  setBrush(c.coverUp === 'blackout' ? 2 : c.job.kind === 'hole' ? 0 : 1);
  flinch.pos.set(0, 0);
  flinch.vel.set(0, 0);
  state.phase = 'inking';
  if (state.day === 1 && state.clientIndex === 0) {
    say('Trace the design on the card. Hold to ink. Hit Done when finished!', 4500);
    state.quipTimer = 7;
  } else {
    say(`${speaker(c)}: "${aside('start')}"`);
  }
}

/** Play a side gag: its lines in sequence, then its effect on the client. */
function playSideGag(gag: SideGag): void {
  const c = state.customer!;
  gag.lines.forEach((line, i) => {
    window.setTimeout(() => {
      if (state.phase !== 'inking' || state.customer !== c) return;
      const isSound = line.startsWith('*') || line.startsWith('💨');
      say(isSound ? line : `${speaker(c)}: "${line}"`, 1500);
      // A fart clenches on the sound itself; everything else lands on the punchline.
      const hitAt = gag.effect === 'clench' ? 0 : gag.lines.length - 1;
      if (i !== hitAt) return;
      if (gag.effect === 'jolt') {
        const dir = Math.random() * Math.PI * 2;
        flinch.vel.set(Math.cos(dir) * 1.6, Math.sin(dir) * 1.2);
        pointerDown = false;
        liftPens();
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

/** A boss does their thing. Called on a timer while inking. */
function bossAct(): void {
  const c = state.customer!;
  if (c.boss === 'bodybuilder') {
    state.flex = 1;
    pointerDown = false; // the flex knocks the gun off
    liftPens();
    flinch.vel.y += 1.2;
    say(`${speaker(c)}: "${aside('bossFlex')}"`, 1300);
    state.bossTimer = 3.2 + Math.random() * 2;
  } else if (c.boss === 'grandma') {
    const el = document.createElement('div');
    el.className = 'chat';
    el.textContent = aside('bossGrandma');
    // Right over the work area, where it's most in the way.
    el.style.left = `${15 + Math.random() * 40}%`;
    el.style.top = `${18 + Math.random() * 45}%`;
    $('chatter').appendChild(el);
    window.setTimeout(() => el.remove(), 4000);
    state.bossTimer = 1.6 + Math.random() * 1.4;
  } else if (c.boss === 'influencer') {
    const f = $('flash');
    f.classList.remove('pop');
    void f.offsetWidth;
    f.classList.add('pop');
    say(`${speaker(c)}: "${aside('bossInfluencer')}"`, 1600);
    state.bossTimer = 3.5 + Math.random() * 2.5;
  }
}

/** The client changes their mind: swap the design, keep the old one for forgiveness. */
function changeMind(): void {
  const c = state.customer!;
  if (!c.mindChange) return;
  c.originalDesign = c.design;
  c.design = c.mindChange;
  c.mindChange = undefined;
  const line = fillDesign(aside('mindChange'), c.design);
  say(`${speaker(c)}: "${line}"`, 2600);
  $('ref-name').textContent = `${c.design.name} · ${c.job.label}`;
  $('ref-tip').textContent = 'They changed their mind. The old one stays on, of course.';
  drawCard($<HTMLCanvasElement>('ref-card'), c);
  if (effectsOf(state.upgrades).stencil) painter.setStencil(c);
  const card = $('ref-card');
  card.classList.remove('swapped');
  void card.offsetWidth;
  card.classList.add('swapped');
  state.quipTimer = Math.max(state.quipTimer, 4);
}

function payFor(score: number, c: Customer): number {
  if (score < 30) return 0;
  return Math.round((40 + score * 1.6) * c.generosity * c.job.payMult * effectsOf(state.upgrades).tipMult);
}

function finishJob(): void {
  if (state.phase !== 'inking') return;
  const c = state.customer!;
  state.phase = 'result';
  pointerDown = false;
  liftPens();
  audio.setBuzzing(false);
  stage.classList.remove('inking');
  $('bubble').classList.add('hidden');
  $('chatter').replaceChildren();
  state.zoomTarget = c.job.zoom === 'close' ? 1 : 0;

  const ink = painter.inkMask(c.job);
  let score: ScoreBreakdown;
  let couple: { a: number; b: number; match: number; better: string; worse: string } | null = null;
  if (c.partner) {
    // Each partner is judged on the design, then on how well the two match each other.
    const tol = toleranceFor(c.job);
    const inkB = partnerPainter.inkMask(c.job);
    const sA = scoreMasks(ink.mask, targetMask(c), GRID, tol, ink.stray);
    const sB = scoreMasks(inkB.mask, targetMask(c.partner), GRID, tol, inkB.stray);
    const match = scoreMasks(ink.mask, inkB.mask, GRID, tol).score;
    const final = Math.round(((sA.score + sB.score) / 2) * (0.7 + 0.3 * (match / 100)));
    const [nameA] = c.name.split(' & ');
    const nameB = c.partner.name;
    couple = {
      a: sA.score, b: sB.score, match,
      better: sA.score >= sB.score ? nameA : nameB,
      worse: sA.score >= sB.score ? nameB : nameA,
    };
    score = {
      precision: (sA.precision + sB.precision) / 2,
      recall: (sA.recall + sB.recall) / 2,
      score: final,
      grade: gradeFor(final),
    };
  } else if (c.surprise) {
    // No reference, so the grade is pure vibes. Doing nothing gets nothing.
    const inked = countOn(ink.mask) + ink.stray;
    const vibes = inked < 40 ? 0 : Math.round(30 + Math.random() * 70);
    score = { precision: 1, recall: 1, score: vibes, grade: gradeFor(vibes) };
  } else {
    const forgiven = c.originalDesign ? targetMask({ ...c, design: c.originalDesign }) : undefined;
    score = scoreMasks(ink.mask, targetMask(c), GRID, toleranceFor(c.job), ink.stray, forgiven);
  }
  const pay = payFor(score.score, c);
  state.cash += pay;
  state.dayCash += pay;
  const thumb = painter.snapshot(c.job, 200);
  state.results.push({ customer: c, score, pay, snap: thumb });
  if (!c.surprise && !c.coverUp && !c.boss && !c.partner && score.score < 60) {
    state.regrets.push({ customer: c, score: score.score, ink: painter.exportInk(), snap: thumb });
    // Each regret holds a full-size ink copy; keep only the freshest few so long runs stay light.
    if (state.regrets.length > 3) state.regrets.shift();
  }
  updateTopHud();

  const quote = couple
    ? Math.abs(couple.a - couple.b) >= 20
      ? aside('coupleMismatch').replaceAll('{better}', couple.better).replaceAll('{worse}', couple.worse)
      : aside(score.score >= 70 ? 'coupleGood' : 'coupleBad')
    : !c.surprise
    ? reactionFor(score.score, c)
    : score.score === 0 ? aside('surpriseNothing')
    : score.score >= 75 ? aside('surpriseGood')
    : score.score >= 45 ? aside('surpriseMid') : aside('surpriseBad');
  const lastOfDay = state.clientIndex + 1 >= state.clientsToday;
  const card = showModal(
    `<div class="client" style="gap:14px">
       ${portraitHtml('res-portrait', 64)}
       <h2 style="margin:0">${escapeHtml(c.name)} ${c.partner ? 'check' : 'checks'} the mirror…</h2>
     </div>
     <div class="quote">"${escapeHtml(quote)}"</div>
     <div class="compare">
       <figure><canvas id="res-ink" width="260" height="260"></canvas>${couple ? escapeHtml(c.name.split(' & ')[0]) : 'Your work'}</figure>
       <figure><canvas id="res-overlay" width="260" height="260"></canvas>${couple ? escapeHtml(c.partner!.name) : c.surprise ? 'vs. "surprise me"' : 'vs. the request'}</figure>
     </div>
     <div class="score-row">
       <div class="grade ${score.grade}">${score.grade}</div>
       <dl class="stats">
         ${couple
           ? `<dt>${escapeHtml(c.name.split(' & ')[0])}</dt><dd>${couple.a}%</dd>
         <dt>${escapeHtml(c.partner!.name)}</dt><dd>${couple.b}%</dd>
         <dt>Matching</dt><dd>${couple.match}% <span class="muted">(how alike the two are)</span></dd>
         <dt>Overall</dt><dd>${score.score}%</dd>`
           : c.surprise
           ? `<dt>Vibes</dt><dd>${score.score}% <span class="muted">(there was no design, so it's all vibes)</span></dd>`
           : `<dt>Likeness</dt><dd>${score.score}%</dd>
         <dt>Accuracy</dt><dd>${Math.round(score.precision * 100)}% <span class="muted">of your ink was on-design${c.originalDesign ? ' (old design forgiven)' : ''}</span></dd>
         <dt>Coverage</dt><dd>${Math.round(score.recall * 100)}% <span class="muted">of the ${c.originalDesign ? 'new ' : ''}design got inked</span></dd>`}
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
          drawCard(overlay, c, big);
          const cardImg = buildShareCard({ customer: c, score, quote, yourWork: big, overlay });
          shareCard(cardImg, c.name)
            .then((how) => { if (how === 'downloaded') say('Saved! Check your downloads.', 1800); })
            .catch(() => say("Couldn't save the picture on this device.", 2000));
        },
      },
      {
        label: lastOfDay ? 'Close up shop' : 'Next client',
        primary: true,
        onClick: () => {
          if (state.phase !== 'result') return;
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
  if (c.partner) {
    // Couples: show both results side by side, each with the design overlaid.
    drawCard(card.querySelector<HTMLCanvasElement>('#res-ink')!, c, snap);
    drawCard(card.querySelector<HTMLCanvasElement>('#res-overlay')!, c.partner, partnerPainter.snapshot(c.job, 260));
  } else {
    drawCard(card.querySelector<HTMLCanvasElement>('#res-overlay')!, c, snap);
  }
}

function endDay(): void {
  state.phase = 'dayEnd';
  $('hud').classList.add('hidden');
  const avg = Math.round(state.results.reduce((s, r) => s + r.score.score, 0) / state.results.length);
  const usedReviews = new Set<string>();
  const reviews = state.results.map((r) => `<li>${escapeHtml(reviewFor(r.score.score, r.customer, usedReviews))}</li>`).join('');
  const best = readBest();
  const record = state.dayCash > best;
  if (record) writeBest(state.dayCash);
  // The paper covers the day's worst job (or the best, if even the worst was great).
  const worst = state.results.reduce((w, r) => (r.score.score < w.score.score ? r : w));
  const featured = worst.score.score >= 80
    ? state.results.reduce((b, r) => (r.score.score > b.score.score ? r : b))
    : worst;
  const paper = frontPage({
    clientName: featured.customer.name,
    sex: featured.customer.sex,
    couple: !!featured.customer.partner,
    designName: featured.customer.design.name,
    score: featured.score.score,
  });
  const card = showModal(
    `<div class="paper">
       <div class="masthead">THE DAILY CHEEK</div>
       <div class="dateline">Day ${state.day} · Late edition · 25¢ (or one warm quarter)</div>
       <div class="headline">${escapeHtml(paper.headline)}</div>
       <div class="paper-body">
         <figure><canvas id="paper-photo" width="200" height="200"></canvas>
           <figcaption>${escapeHtml(featured.customer.name)}'s ${escapeHtml(featured.customer.design.name.toLowerCase())}, as photographed by a witness.</figcaption></figure>
         <div class="paper-col">
           <p class="subhead">${escapeHtml(paper.subhead)}</p>
           <p class="brief">${escapeHtml(paper.sidebar)}</p>
           <p class="brief classified">${escapeHtml(paper.classified)}</p>
         </div>
       </div>
     </div>
     <h2>Day ${state.day} complete</h2>
     <p>Earned <strong style="color:var(--green)">$${state.dayCash}</strong> today · average likeness <strong>${avg}%</strong>
     ${record ? ' · <strong style="color:var(--yellow)">New record!</strong>' : ''}</p>
     <p style="margin-bottom:0">Your online reviews:</p>
     <ul class="reviews">${reviews}</ul>
     <p style="font-size:13px">Tomorrow's clients are more caffeinated, puckerier, and you get less time.
     <br/><span class="small-print">Shop notes: ${escapeHtml(aside('shopNotes'))}</span></p>`,
    [
      { label: 'Quit to title', onClick: showTitle },
      { label: 'Visit the supply shop 🛒', primary: true, onClick: showShop },
    ],
  );
  card.querySelector<HTMLCanvasElement>('#paper-photo')!.getContext('2d')!.drawImage(featured.snap, 0, 0);
}

/** Between-days shop: spend the day's earnings on upgrades. */
function showShop(): void {
  const items = UPGRADES.map((u) => {
    const owned = state.upgrades.has(u.id);
    const afford = state.cash >= u.price;
    return `<div class="shop-item ${owned ? 'owned' : ''}">
        <div class="shop-icon">${u.icon}</div>
        <div class="shop-text"><strong>${escapeHtml(u.name)}</strong>
          <div>${escapeHtml(u.effect)}</div><div class="small-print">${escapeHtml(u.blurb)}</div></div>
        <button class="buy" data-id="${u.id}" ${owned || !afford ? 'disabled' : ''}>
          ${owned ? 'Owned' : `$${u.price}`}</button>
      </div>`;
  }).join('');
  const card = showModal(
    `<div class="shop">
       <h2>🛒 Supply Shop</h2>
       <p>Cash on hand: <strong style="color:var(--green)">$${state.cash.toLocaleString()}</strong></p>
       <div class="shop-list">${items}</div>
     </div>`,
    [
      { label: 'Quit to title', onClick: showTitle },
      { label: `Open Day ${state.day + 1}`, primary: true, onClick: () => startDay(state.day + 1) },
    ],
  );
  card.querySelectorAll<HTMLButtonElement>('button.buy').forEach((b) =>
    b.addEventListener('click', () => {
      const u = UPGRADES.find((x) => x.id === b.dataset.id)!;
      if (state.upgrades.has(u.id) || state.cash < u.price) return;
      state.cash -= u.price;
      state.upgrades.add(u.id);
      updateTopHud();
      showShop();
    }),
  );
}

// ---------- Input ----------
function updatePointer(e: PointerEvent): void {
  const r = world.renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  pointerInside = true;
}
const canvasEl = world.renderer.domElement;

// Gestures: two fingers pan (drag) and zoom (pinch); on desktop, right or middle drag pans.
// While a gesture is active, nothing gets inked, even when one finger lifts first.
const touches = new Map<number, { x: number; y: number }>();
let gesture: { mid: { x: number; y: number }; dist: number } | null = null;
let mousePan: { x: number; y: number } | null = null;

function touchGeometry(): { mid: { x: number; y: number }; dist: number } {
  const [a, b] = [...touches.values()];
  return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.hypot(a.x - b.x, a.y - b.y) };
}

/** Pan by a screen-space delta (px), so the skin follows your fingers. */
function panBy(dx: number, dy: number): void {
  const worldPerPx = (2 * CAMERA_DIST * Math.tan(THREE.MathUtils.degToRad(world.camera.fov) / 2)) / canvasEl.clientHeight;
  const limX = state.customer?.partner ? PAN_LIMIT.x + COUPLE_OFFSET : PAN_LIMIT.x;
  state.pan.x = THREE.MathUtils.clamp(state.pan.x - dx * worldPerPx, -limX, limX);
  state.pan.y = THREE.MathUtils.clamp(state.pan.y + dy * worldPerPx, PAN_LIMIT.yMin, PAN_LIMIT.yMax);
}

canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());
canvasEl.addEventListener('pointerdown', (e) => {
  audio.unlock();
  canvasEl.setPointerCapture(e.pointerId);
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size >= 2) {
      // Second finger down: cancel any stroke the first finger started and switch to gesture.
      pointerDown = false;
      liftPens();
      gesture = touchGeometry();
      return;
    }
  }
  if (gesture) return;
  if (e.button === 1 || e.button === 2) {
    mousePan = { x: e.clientX, y: e.clientY };
    return;
  }
  updatePointer(e);
  pointerDown = true;
  inkReadyAt = e.pointerType === 'touch' ? performance.now() + TOUCH_INK_DELAY_MS : 0;
  liftPens();
});
canvasEl.addEventListener('pointermove', (e) => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesture && touches.size >= 2) {
    const g = touchGeometry();
    if (state.phase === 'inking') {
      panBy(g.mid.x - gesture.mid.x, g.mid.y - gesture.mid.y);
      if (gesture.dist > 0 && g.dist > 0) {
        const z = THREE.MathUtils.clamp(state.zoomTarget + Math.log(g.dist / gesture.dist) * 1.4, 0, 1);
        state.zoomTarget = z;
        state.zoom = z;
        $('zoom-btn').innerHTML = `${z > 0.5 ? '🔭 Zoom out' : '🔍 Zoom in'}<kbd>Z</kbd>`;
      }
    }
    gesture = g;
    return;
  }
  if (gesture) return;
  if (mousePan) {
    if (state.phase === 'inking') panBy(e.clientX - mousePan.x, e.clientY - mousePan.y);
    mousePan = { x: e.clientX, y: e.clientY };
    return;
  }
  updatePointer(e);
});
const release = (e?: PointerEvent) => {
  if (e) touches.delete(e.pointerId);
  if (touches.size === 0) gesture = null;
  mousePan = null;
  pointerDown = false;
  liftPens();
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
window.addEventListener('blur', () => {
  // A lost pointerup must never leave a stale gesture that blocks inking.
  touches.clear();
  release();
});

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
let activeSkin = painter;
/** End the current stroke on both skins (couples have two). */
function liftPens(): void {
  painter.lift();
  partnerPainter.lift();
}
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
  const couple = !!c?.partner && world.partner.customer.visible;
  if (couple) world.partner.setPose(state.upright, state.pantsUp);

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
  world.partner.legs[0].rotation.x = -stride * 0.35;
  world.partner.legs[1].rotation.x = stride * 0.35;

  // ---- Squirm: idle sway + pain jitter + flinch spring.
  state.squirmBoost = Math.max(0, state.squirmBoost - dt * 0.15);
  const squirm = (c ? c.squirm : 0.2) + state.squirmBoost;
  // Hole work is fiddly enough already; clients hold stiller for it (tuned so a typical
  // squirm stays within about one line-width at hole scale).
  const holdStill = (c?.job.kind === 'hole' ? 0.5 : 1) * effectsOf(state.upgrades).squirm;
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
  if (couple) {
    // Side by side; the partner squirms on their own rhythm.
    world.customer.position.x -= COUPLE_OFFSET;
    const t2 = t + 1.9;
    world.partner.customer.position.set(
      state.walkX + COUPLE_OFFSET + amp * (Math.sin(t2 * 1.6) + 0.6 * Math.sin(t2 * 3.1 + 0.4)),
      amp * 0.7 * Math.sin(t2 * 1.4) + Math.abs(stride) * 0.08,
      0,
    );
    world.partner.customer.rotation.z = amp * 0.6 * Math.sin(t2 * 1.2) - stride * 0.06;
  }

  // ---- Cheek clench and hole pucker.
  if (inking && Math.random() < dt * squirm * 0.25) state.clench = 1;
  state.clench = Math.max(0, state.clench - dt * 2.5);
  world.canvasMesh.scale.x = 1 - 0.05 * Math.sin(state.clench * Math.PI);
  state.flex = Math.max(0, state.flex - dt * 1.4);
  world.setFlex(Math.sin(Math.min(1, state.flex) * Math.PI * 0.5));

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
  const wideFov = couple ? COUPLE_WIDE_FOV : ZOOM.wide.fov;
  const closeFov = couple ? 16 : ZOOM.close.fov;
  world.setFov(THREE.MathUtils.lerp(THREE.MathUtils.lerp(wideFov, closeFov, ez), ZOOM.entrance.fov, stand));
  lookTarget.lerpVectors(ZOOM.wide.target, ZOOM.close.target, ez).lerp(ZOOM.entrance.target, stand);
  if (!inking) state.pan.multiplyScalar(Math.max(0, 1 - dt * 4));
  world.camera.position.set(
    CAMERA_POS.x + state.pan.x + Math.sin(elapsed * 0.25) * 0.05 * (1 - ez),
    CAMERA_POS.y + state.pan.y,
    CAMERA_POS.z,
  );
  lookTarget.x += state.pan.x;
  lookTarget.y += state.pan.y;
  world.camera.lookAt(lookTarget);
  world.camera.updateMatrixWorld();

  // ---- Raycast the gun onto the skin.
  let hit: THREE.Intersection | undefined;
  if (pointerInside) {
    raycaster.setFromCamera(pointer, world.camera);
    const targets = couple ? [world.canvasMesh, world.partner.canvasMesh] : [world.canvasMesh];
    hit = raycaster.intersectObjects(targets, false)[0];
  }
  // Which skin are we on? (Couples have two.)
  const skin = hit && hit.object === world.partner.canvasMesh ? partnerPainter : painter;
  if (skin !== activeSkin) {
    liftPens();
    activeSkin = skin;
  }
  // The plane is alpha-cut to a silhouette; hits on the invisible part don't count.
  if (hit && !(hit.uv && skin.isOnSkin(hit.uv))) hit = undefined;
  const buzzing = inking && pointerDown && !!hit && performance.now() >= inkReadyAt;
  audio.setBuzzing(buzzing);
  world.gun.visible = inking && pointerInside;
  // Keep the gun the same size on screen regardless of zoom.
  world.gun.scale.setScalar(world.camera.fov / ZOOM.wide.fov);

  if (hit && hit.face) {
    tmpNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    toCam.copy(world.camera.position).sub(hit.point).normalize();
    const dir = tmpNormal.multiplyScalar(0.5).addScaledVector(toCam, 0.5).add(tilt).normalize();
    world.gun.quaternion.setFromUnitVectors(UP, dir);
    const lift = buzzing ? 0 : 0.06 * world.gun.scale.x;
    world.gun.position.copy(hit.point).addScaledVector(dir, lift);
    if (buzzing) {
      const jitter = 0.006 * world.gun.scale.x;
      world.gun.position.x += (Math.random() - 0.5) * jitter;
      world.gun.position.y += (Math.random() - 0.5) * jitter;
      skin.paintAt(hit.uv!, BRUSHES[state.brush].radius);
    }
  } else if (pointerInside) {
    // Off the skin: float the gun on a plane in front of the customer.
    raycaster.setFromCamera(pointer, world.camera);
    if (raycaster.ray.intersectPlane(offSkinPlane, tmpPoint)) world.gun.position.copy(tmpPoint);
    world.gun.quaternion.setFromUnitVectors(UP, tmpNormal.set(0.35, 0.45, 0.6).normalize());
    liftPens();
  }
  world.gunLight.intensity = buzzing ? 1.4 : 0;

  if (inking && c) {
    // Pain: builds while inking (worse right at the hole), fades while resting.
    if (buzzing) {
      const centerDist = hit && hit.uv ? Math.hypot(hit.uv.x - 0.5, hit.uv.y - 0.5) : 1;
      const nearHole = centerDist < 0.05 ? 1.5 : 1;
      state.pain = Math.min(1, state.pain + dt * c.sensitivity * 0.22 * nearHole * effectsOf(state.upgrades).painRate);
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
      liftPens();
      say(aside('flinch'), 1200);
    }
    setMood(moodForPain(state.pain));

    state.quipTimer -= dt;
    if (state.quipTimer <= 0) {
      const tier = state.pain < 0.35 ? 'painLow' : state.pain < 0.7 ? 'painMid' : 'painHigh';
      say(`${speaker(c)}: "${aside(tier)}"`);
      state.quipTimer = 5 + Math.random() * 4;
    }

    state.timeLeft -= dt;
    if (c.boss) {
      state.bossTimer -= dt;
      if (state.bossTimer <= 0) bossAct();
    }
    if (state.changeAt > 0 && state.timeLeft <= state.changeAt) {
      state.changeAt = -1;
      changeMind();
    }
    if (state.gagAt > 0 && state.timeLeft <= state.gagAt) {
      state.gagAt = -1;
      playSideGag(nextSideGag());
    }
    const total = state.timeTotal;
    $('time-bar').style.width = `${Math.max(0, (state.timeLeft / total) * 100)}%`;
    $('time-text').textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
    $('pain-bar').style.width = `${state.pain * 100}%`;
    $('pain-bar').parentElement!.classList.toggle('danger', state.pain > 0.68);
    if (state.timeLeft <= 0) {
      finishJob();
      say('Time! Put the gun down.', 1500);
    }
  }

  painter.flush();
  partnerPainter.flush();
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
(window as unknown as { __cheeky: unknown }).__cheeky = { state, painter, world, DESIGNS, drawReferenceCard, makeCustomer };
