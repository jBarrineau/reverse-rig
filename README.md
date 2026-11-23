# 🚛 Reverse Rig

A Three.js semi-truck racer with one rule: **you can only drive in reverse.** Back an 18-wheeler and its trailer through tight courses as fast as you can. Avoid cones, don't jackknife, and park it in Dock 7.

There's no build step: plain HTML, CSS and an ES module. Three.js loads from a CDN through an import map.

## Run locally

Browsers block ES modules on `file://`, so serve the folder over HTTP. Pick whichever you have:

```bash
npm run dev            # uses npx serve, opens on http://localhost:3000
# or
python3 -m http.server 8000   # then open http://localhost:8000
```

No `npm install` is needed. `npm run dev` downloads `serve` on first run.

## Project layout

```
index.html        Markup for the HUD, menus and overlays; the import map for three
css/style.css     All styling
src/main.js       The whole game (see sections below)
.github/workflows/pages.yml   Optional GitHub Actions deploy
.nojekyll         Tells GitHub Pages to serve files as-is
```

`src/main.js` is split into commented sections:

| Section | What's there |
|---|---|
| `RIG CONSTANTS` | Wheelbase, trailer length, steering limit, jackknife angle |
| `LEVELS` | Course definitions (see below), cones, diesel cans, time of day |
| `AUDIO` | Synthesized Web Audio: engine, reverse beeper, horn, effects |
| `RIG MODEL` | Truck and trailer built from primitives plus canvas textures |
| `TRACK` | Turns a level into a track, barriers, gates, dock and scenery |
| `PHYSICS` | Kinematic tractor-trailer model, wall collisions, jackknife |
| `UPDATE LOOP` / `HUD` / `INPUT` / `MENU` | Game flow and UI |

## Making your own levels

Courses are written turtle-style in `LEVELS`:

```js
{ name:'My Course', sub:'Tagline', w:14, tod:'sunset', icon:'🔥',
  segs:[ ['S',40],          // straight, 40 m
         ['L',25,90],       // left arc, radius 25 m, 90°
         ['R',20,180,16],   // right hairpin, optional width override 16 m
         ['S',30] ],
  cones:[[.3,.5],[.6,-.5]], // [fraction along the course, lateral offset -1..1]
  cans:[[.2,0],[.5,.4]] }
```

`tod` can be `morning`, `noon`, `sunset` or `night`. Keep curve radii at about 18 m or more. Anything tighter is hard for the trailer, especially in Pro mode. Medal times come from the course length (`targetsFor`).

## Deploy to GitHub Pages

**Option A: deploy from a branch (simplest)**
1. Push this folder to a GitHub repo, with its files at the repo root.
2. In the repo, go to **Settings → Pages → Build and deployment**, set Source to **Deploy from a branch**, and pick `main` and `/ (root)`.
3. The site will be at `https://<username>.github.io/<repo>/`.

**Option B: GitHub Actions**
Set Source to **GitHub Actions** instead. The included `.github/workflows/pages.yml` deploys on every push to `main`.

All paths are relative, so it works under a `/<repo>/` subpath without changes.

## Controls

| Key | Action |
|---|---|
| S / ↓ | Reverse (gas) |
| W / ↑ / Space | Brake (no forward gear!) |
| A D / ← → | Steer |
| Shift | Reverse nitro |
| H | Air horn |
| C | Camera: chase / drone / mirror |
| G | Path guide on/off |
| T | Back to last checkpoint (+3s) |
| R | Restart · P / Esc pause · M mute |

On touch/coarse-pointer devices, hold **REV**, **STOP**, the steering arrows, and **Nitro** to drive. A compact toolbar provides **Pause**, **Restart**, **Checkpoint Reset (+3s)**, **Air Horn**, and **Camera** controls. The HUD adapts to portrait/landscape layouts and hides the desktop keyboard legend. Held controls are released when pausing, restarting, leaving a race, or losing focus.

Best times and ghost runs are saved in `localStorage`.
