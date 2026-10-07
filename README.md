# Cheeky Business

**Behind every great tattoo is a great behind.**

A PS1-style 3D tattoo-parlor sim for one very specific body part. Okay, two. Clients waddle
in, drop their pants, bend over the bench, and ask for a tattoo on the butt, on the
butthole, or both. You ink it freehand while they squirm, and you're judged on how much
your work actually looks like what they asked for. There is no undo.

**▶ Play it: https://jaredbahr.github.io/TattooSim/** (desktop or phone, nothing to install)

Built with Three.js + TypeScript + Vite. Every texture, sign, face and sound is generated
in code: there are no image or audio files.

---

## How to play

| Input | Action |
|---|---|
| Hold mouse / one finger | Ink |
| `1` `2` `3` | Fine / Liner / Shader needle (picked for you per job) |
| `Z`, scroll wheel, or pinch | Zoom in / out |
| Two-finger drag, or right/middle-drag | Pan the view |
| `Space` / `Enter` | Done inking |
| `M` | Mute |

- **Copy the card.** Each client shows a reference design. Ink it as exactly as you can.
- **They squirm.** Every client has a trait (Ticklish, Nervous winker, Too much coffee,
  Ex-Marine…) that sets how much they wiggle, how fast pain builds, and how well they tip.
- **Watch their face.** Pain builds while you ink, faster near the… center. The pixel
  portrait sweats, winces and cries, and the pain bar pulses before a flinch. A flinch
  knocks your gun off the skin, so ease off.
- **No undo.** Tattoos are permanent. That's the whole thing.

## A day at the shop

Five clients a day. Each day gets squirmier and shorter on time. The very first client of a
new game is always an easy one.

| Job | Camera | Designs | The catch |
|---|---|---|---|
| **Hole Job** | Close-up | 13 small designs built around the hole: Bullseye, Donut, Bird's-Eye View (the hole is the eye), Tribal Sun, Smooch, YOLO (the hole is the O)… | The hole **puckers and winks**, and it drags your linework with it |
| **Cheek Job** | Wide | 10 big pieces: Bald Eagle, Sailor Swallows, Tribal Tramp Stamp, Angel Wings, and text tattoos (EXIT ONLY with an arrow, NO RAGRETS, LOVE / HATE, BUTT, MOM) | Coverage, solid fills, squirming |
| **Full Moon** | Wide, zoom for detail | Phoenix Rising, Eye of the Tribe, Full Moon | Cheeks *and* hole. Pays 1.7× |

**Twists** (any day):
- **Surprise me** (~10%): no design, just a "?". Draw anything; you're graded on vibes.
- **Mind-changer** (~12%): halfway through, "Actually… make it a heart." The card swaps.
  Ink on the old design is forgiven, but you still have to cover the new one.
- **Side gags**: sneezes, hiccups and leg cramps jolt the client, and farts make them clench.
  Phone calls make them squirm. Plus small talk.

**From day 2:**
- **Cover-ups.** Botch a job (under 60%) and that client may come back days later with
  *your actual bad tattoo* still on them. Over 35% means "fix it": the same design, with your
  old ink still there. Under 35% means a solid Blackout Heart over the crime scene. They pay
  1.5× hazard pay.
- **Couples** (~18% of mid-day jobs): two clients side by side want matching tattoos. Each is
  scored on its own, then on how well the two match. The one who got the worse tattoo will
  say so, by name.
- **Bosses** (usually the last client, 2× pay):
  - **Big Brad** flexes without warning. His rear swells and your gun gets knocked off.
  - **Grandma Ruth** never stops talking. Her stories pop up right over your work.
  - **Kaylee** films everything. Camera flashes white out the screen.

**End of the day:**
- **The Daily Cheek**: a newspaper front page about your worst job (or your best, on a great day),
  with a "witness photo" of the actual tattoo.
- **Reviews** from every client, in Yelp style.
- **Supply Shop**: spend your earnings on one-time upgrades for the run.

| Upgrade | Price | Effect |
|---|---|---|
| 🧴 Numbing Cream | $150 | Pain builds 35% slower |
| 🪢 Bench Strap | $220 | Clients squirm 35% less |
| ☕ Espresso Machine | $180 | +8 seconds per client |
| 🟪 Stencil Transfer | $350 | Faint purple guide of the design on the skin (never scored) |
| 🍩 Donut Cushion | $90 | Clients tip 15% more |

After any job, **📸 Share** makes a 1080×1350 picture of your work vs. the request, with the grade
and the client's reaction. It opens the share sheet on phones and downloads on desktop.

## How scoring works

`src/scoring.ts` is pure, DOM-free and unit-tested.

1. The reference design is drawn into the same skin-canvas space you paint in, at the job's scale.
2. Your ink and the design are reduced to 128×128 masks over the job's area. Ink outside that
   area counts as stray.
3. **Accuracy** (precision): how much of your ink lands near the design. This catches scribbling.
4. **Coverage** (recall): how much of the design you inked. This catches half-finished work.
5. **Likeness** = F1 of the two, curved to `F1^1.6` so sloppy work drops fast. "Near" means about
   0.6 of a line-width.

Grades run S (92+), A, B, C, D, F. Under 30%, the client refuses to pay. Couples average the
two scores, then scale by how well they match. Mind-changers pass the old design as a
"forgiven" mask, so its ink doesn't count against accuracy.

**Tuning baseline** (a simulated player tracing the real designs with a wobbly hand):

| Hand | Big Heart (cheek) | Bird's-Eye View (hole) | Phoenix Rising (moon) |
|---|---|---|---|
| Steady (±0.5 line-width) | 88% A | 95% S | 70% B |
| Sloppy (±1.3 line-width) | 71% B | 86% A | 62% C |

The simulator ran on a software GPU at a few frames per second, so squirming and winks barely
acted during its strokes. Real play at 60 FPS is harder, especially Hole Jobs.

## Humor house rules

All jokes live in `src/humor.ts` (plus reactions and reviews in `src/customers.ts`). Every
list is a shuffle bag: each line plays once before any repeat, and never twice in a row.
When adding jokes:

- **Deadpan and butt-forward.** Bad taste is the point. Mean-spirited is not.
- **A running gag shows up once, not everywhere.** The "Bathroom was clean though" bit lives in
  a single review; a test keeps it out of the UI lists.
- **Only people have feelings.** No objects or body parts with thoughts or emotions.
- **Keep each list at 5+ lines** (a test enforces it) so frequent players keep seeing new ones.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # typecheck + production build to dist/
```

## Deploying

`.github/workflows/deploy.yml` runs the tests, builds, and publishes to GitHub Pages on every
push to `main` (the default branch). Changes go live by merging into `main`; it takes about a minute.
One-time setup was **Settings → Pages → Source: GitHub Actions**.

## Architecture

```
src/
  main.ts        state machine (title → arriving → intro → inking → result → leaving → dayEnd → shop),
                 input and gestures, per-frame sim, bosses, twists, cover-ups, couples
  scene.ts       parlor, posters, camera; buildRig() makes a client body (two for couples)
  ps1.ts         two-pass renderer: low-res dithered world + crisp skin/ink layer
  painter.ts     skin canvas layers (pixelated base / stencil / irritation / crisp ink), masks
  designs.ts     design library; one draw()/fill() feeds the reference card and the score mask
  strokefont.ts  single-stroke letters for traceable text tattoos
  jobs.ts        Hole / Cheek / Full Moon specs (scale, zoom, tolerance, pay)
  customers.ts   client generation, traits, twists, bosses, couples, cover-ups, reactions, reviews
  portrait.ts    procedural 32×32 pixel-art faces with live moods
  humor.ts       joke pools (shuffle bags) and mid-tattoo side gags
  newspaper.ts   The Daily Cheek front-page generator
  upgrades.ts    supply-shop upgrades and their effects
  scoring.ts     tolerant precision/recall scoring (pure)
  share.ts       share card (Web Share API, download fallback)
  logo.ts        bitmap-font pixel logo + mascot
  audio.ts       procedural gun buzz + retro button beeps (WebAudio)
tests/           scoring, customers, designs (dialogue grammar), humor, newspaper, upgrades
```

Design decisions worth knowing:

- **Planar UVs on a displaced plane.** The rear is a 220×220 plane shaped by `cheekHeight()`. Its
  UVs stay flat, so the scoring canvas and the visible skin share one coordinate space.
- **The camera never tilts.** A steep angle warps strokes drawn across the crease (a circle
  came out heart-shaped and scored unfairly). Zoom only changes the field of view, and pan slides
  the camera and its target together.
- **Two-pass PS1 look.** The world renders at ~270 px tall with vertex snapping and a dithered
  palette. The skin and gun render crisp on top, so anything that should appear in front of the
  skin must be on `HI_RES_LAYER`.
- **The pucker is real geometry.** `setPucker()` pulls vertices near the hole inward while the UVs
  stay put, so ink drawn mid-wink stretches when it relaxes.
- **Debug hook.** `window.__cheeky` exposes game state for automated playthroughs.
  `state.forceNext = 'couple' | 'boss'` forces the next client type.

## Roadmap

**Done:** PS1 look · three job types, 27 designs incl. text tattoos · pucker, squirm, pain and
flinch · walk-in / pants-drop / bend-over cutscene · women clients and body types · pixel
portraits · share card · supply shop · cover-ups · The Daily Cheek · surprise-me and
mind-changers · side gags · bosses · couples · two-finger pan and pinch zoom · button beeps

**Ideas for later:**
- [ ] Ink colors (scored per color)
- [ ] Reputation meter that unlocks harder, better-paying clients
- [ ] Hand-mirror reveal cinematic
- [ ] Daily seeded challenge (everyone gets the same clients)
- [ ] Phone layout that keeps the wall posters readable

## Known limitations

- **Phones:** the client renders fairly small on narrow screens, and the wall posters get cut
  off at the edges. Pinch and pan help.
- **Desktop:** while you're inking, the right-hand posters sit partly behind the side panel.
- **Difficulty:** tuning so far comes from a simulated player, so real-speed balance for bosses
  and couples still needs human playtesting.
- **Bundle size:** Three.js ships as one ~570 kB chunk (~150 kB gzipped). That's fine for a
  single-page game.
