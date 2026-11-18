# VOXEL TANKS — Artillery Unleashed

A standalone, offline-compatible 3D voxel artillery game with destructible terrain, enemy AI, and precise aiming controls. Built for GitHub Pages, desktop browsers, and landscape mobile browsers.

## Play

- **GitHub Pages:** https://achallakiran.github.io/voxel_tanks/
- **Standalone:** Open [index.html](index.html) directly in a WebGL 2-capable browser, without a network connection.
- **Pages deployment:** Settings → Pages → Deploy from branch → `main` / `(root)`.

## Controls — compact HUD

| Action | Desktop | Touch |
| --- | --- | --- |
| Drive forward/reverse | W / S or up/down arrow | Push the left joystick up/down |
| Turn chassis | A / D or left/right arrow | Push joystick left/right |
| Select tank for aiming | Click your tank | Tap your tank |
| Aim turret left/right | Click or hold ◀ / ▶ beside selected tank | Tap or hold ◀ / ▶ |
| Raise/lower barrel | Click or hold ▲ / ▼ beside selected tank | Tap or hold ▲ / ▼ |
| Set power | Far-left vertical slider | Far-left vertical slider |
| Fine-adjust power | + / − buttons at the slider ends (one unit per tap) | Same |
| Change weapon | Small shell-icon dropdown near Fire; keys 1–6 | Tap the shell icon/chevron |
| Fire | Space or Fire button | Fire button |
| Pause, settings, restart, return to menu | Pause button / Escape | Small Pause button at upper-right |

**Aiming is controlled only by the four arrows, not by dragging the screen.** An individual arrow tap changes the barrel angle by 2°; holding repeats in 1° increments. The gold translucent arc shows approximately the first 55% of the projectile flight, not the landing point.

## Per-turn movement meter

The old six diamond counters and six individual move actions are removed. Instead:

- Each player turn starts with **8 world units of driving distance** on a small bar beside the left joystick.
- The bar drains only by the distance the tank actually travels—not by elapsed time or steering in place.
- The tank cannot translate once the bar is empty. Steering and aiming still work.
- A blocked cliff, crater, wall, or obstruction should prevent movement without draining the meter.
- The meter refills at the start of the player's next turn; the enemy operates with a matching turn-level mobility budget.
- Firing ends voluntary movement for that turn.

The 8-unit value is an initial gameplay-balancing setting. Fuel/mobility does not carry forward or accumulate between turns.

## Minimal battlefield HUD

There are no points or diamond counters on the game screen. Health bars are positioned above tanks only when visible, to avoid exposing concealed enemies. Rounds/wind are shown in a subtle translucent top-center pill, and Pause stays in the top-right corner. On the lower edge, controls are restricted to the slim power slider (left), compact joystick/movement gauge (left), small shell picker (right), and Fire (right).

The weapon dropdown provides six illustrated shell options: Cannon, Mega Blast, Cluster, Digger, Builder, and Roller. The Pause panel includes graphics, sound, difficulty, restart, and return-to-menu.

## Destructible battlefield

Voxel terrain is excavated, modified, or raised by the different weapon types. Shells can collide with trees, rocks, and ruins. Trees can break and fall, launching wood and leaf debris. Explosions create airborne chunks, lasting craters, and some permanent redeposited earth around the rim. Damage and falling can affect the firing tank as well as the opponent.

The projectile-follow camera looks downward towards the ground under the projectile, rather than revealing the enemy's location. Enemy AI relies on line-of-sight and uncertain sound bearings when a tank is not visible.

## Build and tests

Requires Node.js 18+; no external runtime or npm dependencies.

```bash
npm run build
npm test
```

- `src/renderer.js`: self-contained WebGL 2 rendering.
- `src/world.js`: editable volumetric terrain and destructible props.
- `src/tanks.js`: procedural tank bodies, turrets, suspension/ground contact.
- `src/game.js`: core game loop, ballistics, weapon and turn systems.
- `src/tactics.js`: line-of-sight enemy model and cinematic shell camera.
- `src/v03.js`: precise arrow aiming, weapon art, partial trajectory, health HUD.
- `src/mobility.js`: joystick drive, per-turn travel distance, mobility gauge and precision power buttons.
- `src/shell.html`, `src/style.css`: responsive interface.
- `scripts/build.mjs`: builds a single fully inlined `index.html`.
- `tests/smoke.mjs`: regression tests.

## Alpha status

This is an incremental playable alpha, not a full rigid-body terrain physics simulator. Advanced collapse mechanics, improved Roller physics, a wider 30-weapon arsenal, richer biomes, sophisticated AI repositioning and full real-device performance validation remain on the roadmap.

Independent original artillery game; not affiliated with Pocket Tanks.
