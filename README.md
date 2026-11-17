# VOXEL TANKS — Artillery Unleashed

A fully client-side, voxel-based 3D tactical artillery game for desktop browsers and landscape mobile browsers.

## Play v0.3

**GitHub Pages:** https://achallakiran.github.io/voxel_tanks/

**Offline:** Download the repository's root [index.html](index.html) and open it directly in a WebGL 2-capable browser. The HTML embeds all runtime JavaScript and CSS. The game does not use external assets, CDNs, accounts or a game server.

> GitHub Pages must be configured under Settings → Pages → Deploy from branch `main`, directory `/(root)`.

## Controls

| Action | Desktop | Touch device |
| --- | --- | --- |
| Aim left / right | Select tank, click ◀ or ▶ | Select tank, tap ◀ or ▶ |
| Adjust barrel height | Select tank, click ▲ or ▼ | Select tank, tap ▲ or ▼ |
| Power | Vertical slider at the bottom-right | Same vertical slider |
| Fire | Space or Fire button | Fire button |
| Choose weapon | Click visual dropdown / keys 1–6 | Tap visual weapon dropdown |
| Select / deselect tank | Click tank | Tap tank |
| Move | With your tank selected, click traversable nearby land | Tap traversable nearby land |
| Zoom | Mouse wheel | Browser-device gestures where supported |
| Pause / settings / restart / main menu | Pause button / Escape | Pause button |

No bearing or elevation sliders or joystick. **Tap the player tank to reveal four arrows around it.** Each arrow tap adjusts aim by 2°; holding an arrow repeats in smaller 1° increments. Accidental screen drags cannot change the aim. A translucent golden trajectory is shown only for approximately the first 55% of the predicted shell flight, concealing the landing point. There is no Sandbox mode or separate in-game settings/menu button.

## Six movement actions per match

Each tank has **exactly six movement opportunities for the entire match**. Each move can cover at most approximately **four voxels along a traversable route** and always consumes **one move**, whether the actual destination is near or far inside that limit. Unreachable/too-far taps consume none. The tank automatically deselects when moving. Cliff slopes, narrow clearances, caves and crater walls can make movement impossible until the terrain is modified. The AI operates under the same limits.

## Battlefield discovery and combat

- A downward-looking elevated camera follows the fired projectile and shows the landscape beneath it. It does **not** target the enemy or reveal hidden positions.
- The selected tank exposes four precise directional aiming arrows. The camera follows deliberate turret adjustments; incidental dragging does not change bearing or elevation.
- An eye-catching translucent partial ballistic arc previews roughly half the shell's flight; it never projects a precise impact marker.
- No radar, enemy location indicator or automatic target camera.
- The AI derives estimates from actual line-of-sight and approximate firing directions rather than perfect access to hidden player positions.
- Health bars are anchored to **visible** tanks. The enemy bar is hidden if the tank is off-camera or terrain-occluded.
- Both tanks can suffer their own projectile, blast, fall or terrain-induced damage.
- Match results use remaining health rather than an on-screen points display.

## Weapons (six available)

Cannon, Mega Blast, Cluster, Digger, Builder and Roller. These have separate projectile graphics, procedural audio layers and impact effects, including excavation, tunnels, constructed earth, clusters and bouncing projectiles.

**v0.3 destruction improvements:** projectiles collide with tree trunks/foliage, rocks and ruins; affected trees tilt and fall; breaking props produces airborne fragments; explosion craters eject coloured debris and gradually deposit some of the excavated material into **persistent voxel mounds** around the crater. Those deposits alter subsequent terrain collision and movement.

## Source structure and build

Node.js 18 or higher, with **zero npm dependencies**.

```bash
npm run build
npm test
```

- `src/renderer.js` — dependency-free WebGL2 renderer, shaders and primitive geometry
- `src/world.js` — volumetric editable voxel world, materials, props, crater deposits and falling vegetation
- `src/tanks.js` — detailed procedural tanks and tank animation
- `src/game.js` — base turn logic, ballistics, impact resolution, input and audio
- `src/tactics.js` — navigation, sight-limited AI, shell camera and weapon cinematics
- `src/v03.js` — camera-aim controls, one-credit tank selection/movement, visual weapon picker, health bars and debris
- `src/shell.html`, `src/style.css` — game UI
- `scripts/build.mjs` — deterministic, self-contained `index.html` generator
- `tests/smoke.mjs` — regression checks for ballistics, movement, environment and offline packaging
- `index.html` — committed standalone and GitHub Pages entry point

## Development status

v0.3 is a playable **alpha**, not the complete original design. Advanced structural collapse, a full 30-weapon arsenal, robust continuous roller physics, extensive enemy multi-turn tactics, more biomes and performance tuning on actual mobile devices remain for future versions. The initial crater rims and prop breakage are localized simulations; a complete physics engine has not yet been implemented.

## License

Project source copyright its owner. This is an independently implemented original game inspired by the artillery genre, not affiliated with Pocket Tanks.
