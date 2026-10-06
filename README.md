# Cheek Ink

A 3D tattoo-parlor sim for one very specific clientele. Customers walk in, bend over,
and ask for a tattoo *right there*. You ink it freehand while they squirm, and you're
judged on how much your work actually looks like what they asked for.

Built with **Three.js + TypeScript + Vite**. Runs in any modern browser, desktop or mobile.

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
| `Space` or `Enter` | Done inking |
| `M` | Mute the gun buzz |

- Each day has **5 clients**. Each one wants a design from the library (heart, star, bullseye, black-hole spiral, and so on).
- **They squirm.** Every client has a trait (Ticklish, Too much coffee, Ex-Marine...) that sets their wiggle, pain sensitivity and tipping.
- **Pain builds while you ink**, and faster near the... center. Max it out and they flinch hard. Ease off to let it fade.
- **No undo.** Tattoos are permanent. That's the whole thing.
- Later days give you less time and more caffeinated clients.

## How scoring works

`src/scoring.ts` is pure, DOM-free and unit-tested.

1. The reference design is rasterized into the same UV canvas space the player paints in.
2. Ink and design are both reduced to 128×128 binary masks.
3. **Accuracy (precision)**: how much of your ink lands within 2 cells (~16 px of 1024) of the design. This catches scribbling and flooding.
4. **Coverage (recall)**: how much of the design has ink within 2 cells. This catches half-finished work.
5. **Likeness** = F1 of the two, curved slightly downward (`f1^1.2`). Grades run S / A / B / C / D / F. Under 30% means the client refuses to pay.

## Architecture

```
src/
  main.ts       game state machine (title → intro → inking → result → dayEnd), input, per-frame sim
  scene.ts      parlor, customer rig (heightfield rear + body), tattoo gun, lighting, camera
  painter.ts    layered skin canvas (base / irritation / ink), silhouette alpha cut, mask extraction
  designs.ts    tattoo design library; one draw() feeds both the reference card and the score mask
  customers.ts  customer generation, traits, reactions, Yelp-style reviews
  scoring.ts    tolerant precision/recall scoring (pure)
  audio.ts      procedural tattoo-gun buzz + yelp (WebAudio, no assets)
tests/
  scoring.test.ts
```

Design decisions worth knowing:

- **Planar UVs on a displaced plane.** The rear is a 220×220 plane displaced by `cheekHeight()`. Its UVs stay planar, so the scoring canvas and the visible surface share one coordinate space.
- **Near head-on camera with a long lens** (`CAMERA_POS` in `scene.ts`). A steep camera angle parallax-warps strokes drawn across the crease: a screen-space circle came out heart-shaped in UV space and scored unfairly. Keep the camera roughly frontal if you change it.
- **Silhouette via alpha cut.** The plane is cut to a rear-shaped outline (`silhouettePath()` in `painter.ts`) with `alphaTest`. Raycast hits outside the outline are ignored.
- **Zero binary assets.** Every texture, sign, poster and sound is generated at runtime.

## Roadmap

**Phase 1: MVP (this PR)**
- [x] 3D parlor, customer rig, tattoo gun that follows the surface
- [x] 12 designs, randomized clients with traits, squirm, pain and flinch
- [x] Tolerant precision/recall scoring with a unit test suite
- [x] Results screen (your work vs. overlay), day loop, reviews, best-day record
- [x] Mobile layout and touch input

**Phase 2: Depth**
- [ ] Ink colors and fill/shading designs (score per color channel)
- [ ] Shop upgrades: steadier hands, numbing cream (slows pain), stencil transfer (faint guide on the skin)
- [ ] Reputation meter that gates harder, better-paying clients
- [ ] Stencil-free "freestyle" requests judged by a looser shape metric (e.g. Hu moments)

**Phase 3: Juice**
- [ ] Animated customer walk-in and bend-over
- [ ] Hand-mirror reveal cinematic and reaction faces
- [ ] Sound pass: shop ambience, voice barks
- [ ] Shareable result cards (export PNG)

**Phase 4: Content**
- [ ] Text tattoos ("MOM", "EXIT ONLY") with glyph-aware scoring
- [ ] Boss clients (the Bodybuilder who clenches on a timer, the Grandma who talks the whole time)
- [ ] Daily seeded challenge with a shared leaderboard

## Known limitations

- Three.js ships as one ~565 kB chunk (~145 kB gzipped). Fine for a single-page game.
- On narrow phones the customer renders fairly small. The camera FOV scales with aspect, but a dedicated portrait framing would help.
- Shadows plus a 1024² canvas texture re-uploaded while inking is fine on real GPUs, but slow under software rendering.
