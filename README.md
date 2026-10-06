# Cheeky Business

A PS1-style 3D tattoo-parlor sim for one very specific body part. Okay, two.
Clients waddle in with their pants around their knees, bend over, and ask for a tattoo
on the butt, on the butthole, or both. You ink it freehand while they squirm, and you're
judged on how much your work actually looks like what they asked for.

Built with **Three.js + TypeScript + Vite**. Runs in any modern browser, desktop or mobile.

## Play it from GitHub

`.github/workflows/deploy.yml` builds and publishes the game to GitHub Pages on every push
to `main`. One-time setup: **Settings → Pages → Source: GitHub Actions**. The game then
lives at `https://<owner>.github.io/<repo>/`.

## Modes

- **Demo Day** (title screen, recommended for showing people): three scripted clients, one of each job type, about 3 minutes.
- **Open the shop**: the full game. Five random clients a day, with each day squirmier and shorter on time. The very first client is always an easy one.

At the end of a day, enter your initials for the **🏆 leaderboard**: Demo Day, Best Day, and the **Hall of Shame** (each day's worst tattoo; lowest likeness wins). Boards are saved on the device. `LeaderboardStore` in `src/leaderboard.ts` is the seam for a shared online backend.

After any job, **📸 Share** makes a 1080×1350 result card (your work vs. the request, grade, client quote). On phones it opens the share sheet; on desktop it downloads.

## Job types

| Job | Camera | Designs | Twist |
|---|---|---|---|
| **Hole Job** | Close-up | Small, built around the hole: Bird's-Eye View, Tribal Sun, Smooch, Bullseye, Donut… | The hole **puckers and winks**, dragging your linework with it |
| **Cheek Job** | Wide | Big pieces: Bald Eagle, Sailor Swallows, Tribal Tramp Stamp, Angel Wings, Big Heart | Coverage, filled tribal, squirming |
| **Full Moon** | Wide, zoom for detail | Phoenix Rising, Eye of the Tribe, Full Moon | Both at once. Pays 1.7× |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # scoring unit tests
npm run build      # typecheck + production build to dist/
```

## How to play

| Input | Action |
|---|---|
| Hold left mouse / finger | Ink |
| `1` `2` `3` | Fine / Liner / Shader needle |
| `Z` or scroll wheel | Zoom in / out |
| `Space` or `Enter` | Done inking |
| `M` | Mute the gun buzz |

- Each day has **5 clients**. Each one wants a Hole Job, a Cheek Job, or (more often on later days) a Full Moon.
- **They squirm.** Every client has a trait (Ticklish, Nervous winker, Too much coffee, Ex-Marine...) that sets their wiggle, pucker rate, pain sensitivity and tipping.
- **Watch their face.** The pixel portrait sweats, winces and cries as pain builds.
- **Pain builds while you ink**, and faster near the... center. Max it out and they flinch hard. Ease off to let it fade.
- **No undo.** Tattoos are permanent. That's the whole thing.
- Later days give you less time and more caffeinated clients.

## How scoring works

`src/scoring.ts` is pure, DOM-free and unit-tested.

1. The reference design is rasterized into the same UV canvas space the player paints in, at the job's scale.
   Tolerance is about 0.6 of a line-width; the score curve is `F1^1.6`. Both were tuned with a simulated player (see below).
2. Ink and design are both reduced to 128×128 binary masks over the job's crop square (tight for Hole Jobs, wide for Cheek/Full Moon). Ink outside the crop counts as stray.
3. **Accuracy (precision)**: how much of your ink lands within about one line-width of the design. This catches scribbling and flooding.
4. **Coverage (recall)**: how much of the design has ink within that tolerance. This catches half-finished work.
5. **Likeness** = F1 of the two, curved downward (`f1^1.6`). Grades run S / A / B / C / D / F. Under 30% means the client refuses to pay.

### Tuning baseline (simulated player, Demo Day)

| Hand | Big Heart (cheek) | Bird's-Eye View (hole) | Phoenix Rising (moon) |
|---|---|---|---|
| Steady (±0.5 line-width wobble) | 88% A | 95% S | 70% B |
| Sloppy (±1.3 line-width wobble) | 71% B | 86% A | 62% C |

The simulator runs on a software GPU at a few FPS, so client squirm and winks barely act during its strokes. Real play at 60 FPS is harder, especially Hole Jobs.

## Architecture

```
src/
  main.ts       state machine (title → arriving → intro → inking → result → leaving → dayEnd), input, sim
  scene.ts      parlor, customer rig (heightfield rear, hole pucker, swinging legs), gun, camera zoom
  ps1.ts        two-pass renderer: low-res dithered world + crisp skin/ink layer
  painter.ts    layered skin canvas (pixelated base / irritation / crisp ink), silhouette cut, masks
  designs.ts    tattoo design library; one draw()/fill() feeds both the reference card and the score mask
  jobs.ts       Hole / Cheek / Full Moon job specs (scale, zoom, tolerance, pay)
  customers.ts  customer generation, traits, reactions, Yelp-style reviews
  portrait.ts   procedural 32×32 pixel-art faces with live moods
  logo.ts       bitmap-font pixel logo + butt mascot
  share.ts      1080×1350 share card, Web Share API with download fallback
  leaderboard.ts  ranked boards (pure insert/rank) behind a swappable storage interface
  scoring.ts    tolerant precision/recall scoring (pure)
  audio.ts      procedural tattoo-gun buzz + yelp (WebAudio, no assets)
tests/
  scoring.test.ts
```

Design decisions worth knowing:

- **Planar UVs on a displaced plane.** The rear is a 220×220 plane displaced by `cheekHeight()`. Its UVs stay planar, so the scoring canvas and the visible surface share one coordinate space.
- **Near head-on camera with a long lens** (`CAMERA_POS` in `scene.ts`). A steep camera angle parallax-warps strokes drawn across the crease: a screen-space circle came out heart-shaped in UV space and scored unfairly. Zoom changes only the FOV for the same reason.
- **Two-pass PS1 look** (`ps1.ts`). The world renders at ~270 px tall with vertex snapping and a Bayer-dithered palette. The skin and gun render crisp on top, so anything that should appear *in front of* the skin must also be on `HI_RES_LAYER`.
- **The pucker is real geometry.** `setPucker()` pulls vertices near the hole inward. UVs don't move, so ink drawn mid-wink stretches when it relaxes.
- **Silhouette via alpha cut.** The plane is cut to a rear-shaped outline (`silhouettePath()` in `painter.ts`) with `alphaTest`. Raycast hits outside the outline are ignored.
- **Zero binary assets.** Every texture, sign, poster and sound is generated at runtime.

## Roadmap

**Phase 1: MVP**
- [x] 3D parlor, customer rig, tattoo gun that follows the surface
- [x] Randomized clients with traits, squirm, pain and flinch
- [x] Tolerant precision/recall scoring with a unit test suite
- [x] Results screen (your work vs. overlay), day loop, reviews, best-day record
- [x] Mobile layout and touch input

**Phase 1.5: Cheeky Business**
- [x] PS1 pixel look, pixel-art portraits with live moods
- [x] Hole / Cheek / Full Moon jobs, 20 designs incl. birds and tribal
- [x] Puckering, winking hole; zoom
- [x] Waddle-in / waddle-out
- [x] GitHub Pages deploy

**Phase 1.6: Demo-ready**
- [x] Walk-in, pants drop, bend-over cutscene; stand up and waddle out
- [x] Bolder hole that reads in the wide shot
- [x] Pixel logo title screen
- [x] Demo Day mode and an easy first client
- [x] Share card
- [x] Leaderboard (on-device): Demo Day, Best Day, Hall of Shame
- [x] Women clients (names, portraits, 3D hairstyles) and body-type variety for everyone
- [x] Difficulty pass: tighter scoring, flinch interrupts instead of streaking, slower pain, hole clients hold stiller, auto needle per job

**Phase 2: Depth**
- [ ] Ink colors and fill/shading designs (score per color channel)
- [ ] Shop upgrades: steadier hands, numbing cream (slows pain), stencil transfer (faint guide on the skin)
- [ ] Reputation meter that gates harder, better-paying clients
- [ ] Stencil-free "freestyle" requests judged by a looser shape metric (e.g. Hu moments)

**Phase 3: Juice**
- [ ] Hand-mirror reveal cinematic and reaction faces
- [x] Retro button beeps (buzz + flinch yelp + beeps is the whole soundtrack, on purpose)

**Phase 4: Content**
- [ ] Global online leaderboard (needs a small backend, e.g. Supabase)
- [ ] Text tattoos ("MOM", "EXIT ONLY") with glyph-aware scoring
- [ ] Boss clients (the Bodybuilder who clenches on a timer, the Grandma who talks the whole time)
- [ ] Daily seeded challenge with a shared leaderboard

## Known limitations

- Three.js ships as one ~565 kB chunk (~145 kB gzipped). Fine for a single-page game.
- On narrow phones the customer renders fairly small. The camera FOV scales with aspect, but a dedicated portrait framing would help.
- Shadows plus a 1024² canvas texture re-uploaded while inking is fine on real GPUs, but slow under software rendering.
