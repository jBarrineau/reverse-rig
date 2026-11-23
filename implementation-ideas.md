# 🚛 Reverse Rig — Implementation Ideas & Roadmap

A curated backlog of bug fixes, game-feel polish, and creative features for **Reverse Rig**. Everything here is designed to stay 100% client-side and zero-build for GitHub Pages.

---

## 1. Bugs & Code Quality Fixes

- [ ] **Cancel results timeout on restart/menu** (`src/main.js` — `finishRace`, `startLevel`, `toMenu`)
  - Store the `setTimeout(() => showResults(...), 2200)` handle and clear it when starting a level or returning to the menu so the Results modal never pops up mid-countdown.
- [ ] **Populate night sky stars & moon** (`src/main.js` — `skyTex`)
  - Fill in the empty `if (p.night) { ... }` loop with twinkling stars and a crescent moon for *Docking Gauntlet*.
- [ ] **Fix ghost angle wraparound & reset teleporting** (`src/main.js` — `updateVisuals`)
  - Use shortest-angle interpolation for `gt` and `gp` instead of linear `lerp`, and snap instead of interpolating when consecutive ghost samples jump across a checkpoint reset.
- [ ] **Add back-wall collision inside Dock 7** (`src/main.js` — `physics`, `buildLevel`)
  - Constrain longitudinal travel past `P[N-1]` so high-speed nitro finishes can't coast through the back wall of the warehouse.
- [ ] **Improve mobile / touch UX** (`index.html`, `css/style.css`, `src/main.js`)
  - Add compact touch buttons for **Pause**, **Restart**, **Checkpoint Reset**, **Air Horn**, and **Camera Toggle**.
  - Hide the desktop keyboard legend (`#br`) on coarse-pointer / touch screens so it doesn't overlap touch controls.
- [ ] **Clean up minor resource leaks** (`src/main.js` — `buildLevel`)
  - Dispose the previous `scene.background` texture before assigning a new one.
  - Replace the `window._dt` global used for the Dock 7 sign with a local variable.
  - Dispose template materials (`canM0`, `capM0`) or share them cleanly instead of leaving un-disposed originals.

---

## 2. Game Feel & Polish Upgrades

- [ ] **Dock 7 alignment zone & parking-sensor beeps** (`src/main.js` — `buildLevel`, `finishRace`, `SFX`)
  - Paint a glowing target box inside Dock 7 and play accelerating ultrasonic parking-sensor beeps (`beep... beep... beep-beep-BEEEEEP`) as the rear bumper approaches so players discover and aim for the `PERFECT DOCK! -2.0s` bonus.
- [ ] **Trailer deflection on wall scrapes** (`src/main.js` — `physics`)
  - Apply a small angular impulse to `S.ph` when the trailer's rear corners scrape a barrier instead of only translating `S.x, S.z`, making wall contact feel physical and less sticky.
- [ ] **Expanded Web Audio juice** (`src/main.js` — `SFX`)
  - **Air-brake hiss** (`PSSSHH!`) when braking hard or coming to a stop.
  - **Metallic fifth-wheel creak / stress groan** as hitch angle approaches the jackknife limit, giving Pro-mode players an audio cue without looking down at the gauge.
  - **HUD/Pause mute button, volume slider, and "Invert Steering (Pro)" toggle**.
- [ ] **Tire skid marks & dynamic lights** (`src/main.js` — `buildRig`, `updateVisuals`)
  - Leave fading rubber tracks behind trailer axles under hard braking, nitro, or high hitch angles.
  - Brighten taillights (`mats.tail`) while braking and flash amber marker lights as hazard blinkers while reversing.
- [ ] **Working side-mirror PiP (Picture-in-Picture)** (`src/main.js` — `updateVisuals`)
  - Render a small rear-view mirror overlay using a second `THREE.PerspectiveCamera` + `renderer.setViewport` / `renderer.setScissor` so players can check their trailer angle even in Chase or Drone cam.

---

## 3. Creative & Fun Features

### 🚛 Wild Trailer & Cargo Types (Unlockable by Medals)
- [ ] **Road Train (Double Trailer / B-Double):** Two articulation joints (`th`, `ph1`, `ph2`) for maximum Pro-mode chaos and bragging rights.
- [ ] **Sloshing Liquid Tanker:** Chrome tanker trailer with simulated lateral liquid momentum that gently tugs the trailer wide out of sharp turns.
- [ ] **Precarious Flatbed Cargo:** Open flatbed carrying stacked rubber ducks, traffic cones, or a giant disco ball; harsh braking or wall hits knock items onto the track, while keeping everything onboard awards a delivery bonus.
- [ ] **Twitchy Pup Trailer:** Short-wheelbase trailer (small `DH`) that pivots twice as fast for frantic slalom runs.

### 🚧 Interactive Hazards (Give the Air Horn a Gameplay Role!)
- [ ] **Crossing Forklifts & Yard Geese:** Animated forklifts or stubborn geese crossing the lane on timers; blasting the air horn (`H`) makes forklifts slam their brakes and wave, or scatters geese out of the way.
- [ ] **Surface Variety:** Oil slicks (temporary low-traction drift), rain puddles with splashes, rumble strips that shake the camera, and elevated ramps / banked corners (backing uphill into a raised loading bay).
- [ ] **Swinging Warehouse Gates:** Timed security arms or sliding doors to thread cleanly.

### 🌍 Infinite Replayability (Static GitHub Pages Friendly)
- [ ] **Daily Delivery Challenge:** Seed `rng()` with today's date (`YYYY-MM-DD`) to generate a deterministic, non-self-intersecting daily course for everyone, plus a **Copy Result** button for Wordle-style clipboard sharing (`🚛 Reverse Rig #142 | 🥇 0:38.40 | 🚧0 💥0 ⚡4`).
- [ ] **URL-Shareable Track Editor:** Lightweight 2D top-down turtle-track builder that encodes `segs`, `cones`, and `cans` into a URL hash (`#custom=...`) so friends can challenge each other with custom courses.
- [ ] **Shareable Ghost Links:** Compress `S.ghost` into a base64 URL parameter so friends can race each other's ghost runs directly on GitHub Pages with no backend.
- [ ] **Reverse Gymkhana / Style Mode:** Score multipliers for cone near-misses (`CLOSE SHAVE!`), holding steep hitch angles without jackknifing (`DANGER DRIFT!`), honking past cheering fans, and chaining diesel cans.

### 🎨 Personality, Customization & Atmosphere
- [ ] **Custom Rear-Door Bumper Sticker:** Let players enter or randomize their own rear-door slogan rendered onto `rearTex`.
- [ ] **Unlockable Air Horns & Cab Flair:** Medal unlocks for train horns, foghorns, musical horns (*La Cucaracha*), chrome bullbars, night-mode neon underglow, dash bobbleheads, and custom nitro flame colors.
- [ ] **CB Radio Chatter:** Occasional trucker-slang radio popups with a quick static-squelch synth sound on dramatic events (cone hits, jackknifes, clean hairpins, checkpoints).
- [ ] **Dynamic Weather & Atmosphere:** Rain streaks with wet asphalt reflections on *Docking Gauntlet*, drifting golden dust motes on *Hairpin Heights*, and animated beacon lights.
