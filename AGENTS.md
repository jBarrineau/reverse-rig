# Project notes

## Architecture

- Reverse Rig is a static, zero-build browser game. `index.html` loads `src/main.js` as a native ES module; Three.js 0.160.0 comes from the CDN import map. Keep GitHub Pages paths relative and avoid introducing a build step without a clear need.
- `src/main.js` contains the game. Its main sections are `LEVELS` / `TOD`, `SFX`, renderer and shared textures, rig model, track/level construction, game state, physics, update/render loop, HUD/input, and menu.
- `LEVELS` are turtle-style course definitions. `buildTrack` turns them into track points and checkpoints; `buildLevel` creates the active scene; `S` holds current run state.
- Driving is reverse-only: negative `S.v` moves the tractor forward along its heading. Keep collision, steering, trailer articulation, scoring, and checkpoint behavior consistent with this convention.
- Ghost poses contain four values per sample (`x`, `z`, tractor heading, trailer heading) at 50 ms intervals. Checkpoint-reset sample indices are saved as `ghostResets` so playback can snap over resets; preserve compatibility with older records that lack markers.

## Editing and resource ownership

- Prefer small changes in the existing single-file game structure and match its compact JavaScript style. Keep markup in `index.html`, styling in `css/style.css`, and gameplay behavior in `src/main.js`.
- Update the relevant item in `implementation-ideas.md` as work is completed; update `README.md` when player-facing controls or setup instructions change.
- `buildLevel` disposes the previous `levelGroup`; add level objects to it so their resources are released together. `disposeGroup` intentionally preserves shared textures such as `trackTex`, `checkerTex`, and cached ground textures.
- The scene background is owned separately from `levelGroup` and must be disposed before replacement. Pickup materials are intentionally independent because each collected pickup fades on its own. Keep the Dock 7 sign texture local to its level.
- Touch driving buttons use pointer capture and `touchPointers`; call `clearInputs()` on game-state transitions so held keys and captured pointers cannot stick.

## Run and verify

- No test or lint scripts are currently defined in `package.json`. Run the game over HTTP rather than opening `index.html` directly; Three.js ES modules and the import map require a web server.
- `npm run dev` uses `npx serve` if Node.js/npm are installed. Node.js/npm were unavailable on the workstation during the last implementation pass; the verified alternative was `py -3 -m http.server 8765 --bind 127.0.0.1`, followed by opening `http://127.0.0.1:8765/`.
- Use the integrated browser, when available, to verify gameplay, rendering, and responsive/touch behavior. For scene resource changes, repeat level builds and check that GPU texture counts stabilize. A viewport-only resize is not enough to simulate a coarse pointer; emulate touch or test on a touch device.
- Keep each roadmap fix focused and commit it with a descriptive message after its behavior is verified.
