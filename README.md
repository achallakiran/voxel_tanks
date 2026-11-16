# VOXEL TANKS — Artillery Unleashed

A **self-contained WebGL 2 voxel artillery game**, built for GitHub Pages and offline desktop/mobile browsers.

## Play

- GitHub Pages (once Pages is enabled): https://achallakiran.github.io/voxel_tanks/
- Standalone offline file: save **[index.html](index.html)** from the repository, then open it locally in a WebGL 2-capable browser. It contains the code and styles; **no CDN or external game assets** are required.
- The first public build is **v0.1 playable alpha**, not the entire planned 30-weapon game.

## Included in v0.1

- Fully 3D voxel terrain with editable blocks and local chunk-mesh rebuilding.
- Procedural highland map, trees, ruins, rocks, distant clouds and water.
- Two detailed voxel tanks with rotating turrets, barrel elevation, separate wheels, treads, hull pitch, terrain-aware movement and visible damage.
- Classic ten-round turn-based artillery, score, health, wind and 3D ballistic aiming.
- Six **functional** weapons: Cannon (crater), Mega Blast (large crater), Cluster (splits into six bomblets), Digger (tunnel), Builder (adds a voxel mountain), and Roller (rebounding projectile).
- Enemy turn logic with projectile search, several difficulty presets, weapon choice and pre-shot repositioning.
- Free-building practice Sandbox, chase/overhead/orbit/projectile cameras, particle effects and synthesized offline sound.
- Touch joystick, swipe orbit, responsive HUD, keyboard controls, pause and settings.
- No remote runtime resources and no server/backend.

## Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Drive | W/A/S/D or arrow keys | Touch joystick |
| Orbit camera | Drag pointer | Drag in scene |
| Zoom | Mouse wheel | Zoom slider not available; scene drag offers camera orbit |
| Change camera | C | Camera icon |
| Aim | Azimuth, angle, power sliders | Same sliders |
| Choose weapon | 1–6 or weapon buttons | Weapon buttons |
| Fire | Space or FIRE | FIRE |
| Menu | Settings/pause buttons | Settings/pause icons |

Mobile play is designed for landscape orientation.

## Local source build

Requires Node.js >=18; **no npm installation or dependencies**.

```bash
npm run build
npm test
```

- `src/renderer.js`: dependency-free WebGL2 graphics and primitives
- `src/world.js`: volumetric editable voxel world and chunk meshes
- `src/tanks.js`: procedural tanks, movement and animations
- `src/game.js`: weapons, ballistics, enemy AI, sound, input and turns
- `src/style.css`, `src/shell.html`: responsive UI
- `scripts/build.mjs`: deterministic standalone builder
- `tests/smoke.mjs`: source/bundle/terrain/AI tests
- `index.html`: committed, generated GitHub Pages entry point and offline build

### GitHub Pages configuration

In **Settings → Pages**, select **Deploy from a branch**, choose **main** and **/(root)**. GitHub Pages then serves the root `index.html`.

## Planned, not yet built

This alpha is a tested foundation for the roadmap, rather than an assertion that the full design is already implemented. Remaining work includes:
- All 30 individually animated weapons and their advanced interactions (electricity, lava, freeze, gravity, shields, full bridge/tower construction).
- Five full biomes, region streaming, structural support solver, material-aware collapse, liquids, and richer props.
- More tank classes, smarter terrain-aware navigation and AI multi-turn planning.
- Survival, local hot-seat, tutorials, progression, additional soundscape and cinematic polish.
- Browser/device QA and sustained 30/60 fps optimization against real-world hardware.

## License

Project source copyright its owner. Pocket Tanks is an inspiration; this is an independent prototype with original procedural visuals and mechanics.
