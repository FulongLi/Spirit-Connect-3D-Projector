# Spirit Connect Particle Lab

Version 0.4 is a static MVP for turning natural-language scene descriptions,
local formation presets, and uploaded model vertices into live Three.js particle
scenes.

## What works now

- Casberry-inspired particle lab UI with a full-stage 3D viewport and a compact
  simulation console.
- Prompt input that maps descriptions into a validated scene spec.
- All prompts now route to the Three.js 3D renderer.
- Local formation presets: nebula, black hole, vortex, magnetic field, solar
  system, and particle text.
- Live controls for particle count, simulation speed, and glow intensity.
- Model upload foundation: `.obj`, `.fbx`, `.glb`, embedded `.gltf`, and `.stl`
  geometry can be normalized and displayed as a denser 22,000+ particle point
  cloud.
- Generic `scene_graph` mode for object + event + effect composition.
- Scene Graph v1 includes `objects`, `motions`, `forces`, `events`, `effects`,
  `camera`, and `world`.
- Particle-first 3D visual language: planets, projectiles, shockwaves, flashes,
  rings, jets, and debris are rendered as particle systems.
- Pointer interaction: moving the mouse over the 3D stage creates a soft spatial
  disturbance.
- View interaction: drag the 3D stage to rotate around the scene; use the mouse
  wheel to zoom in and out.
- Three.js 3D renderer with spatial scene types:
  - particle nebula
  - orbital / black-hole field
  - black-hole accretion disk with Kepler-like inner/outer disk motion
- Generic scene graph cases:
  - comet impact built from sphere, projectile, trail, collision, flash, shockwave, and debris primitives
  - binary star system orbiting a shared center of mass
  - magnetic / electromagnetic field with charged particle flow
  - solar system with nested planetary orbits
  - Earth-Moon motion with a shared orbital frame
  - fixed-shape particle car speeding on a highway
- Reusable motion/force cases:
  - attraction between two particle clouds
  - vortex flow around a glowing center
  - orbiting bodies
  - helical charged-particle flow
  - magnetic field-line influence
  - stable particle-shape objects with speed trails and scrolling ground
- Live JSON preview of the generated scene spec.
- Formation buttons, reset view, and pause/resume control.

## Model import direction

The first model-import path supports OBJ, FBX, GLB, embedded GLTF, and STL
geometry because it can run fully in the browser without a build step. The
intended next steps are:

```text
OBJ/FBX/GLB/STL upload -> geometry sampling -> particle point cloud -> live flow controls
```

Model data stays local in the browser and is converted into the same
`model_points` scene graph object used by the particle renderer. Text `.gltf`
files work best when their buffers are embedded; external buffer references may
need a project-level asset loader later.

## Why the parser is local for now

The current `parseScenePrompt()` function in `src/parser.js` is a stand-in for the
LLM parser. The intended production path is:

```text
user prompt -> LLM returns strict JSON -> schema validation -> renderer dispatcher
```

Keeping the first version local makes the rendering pipeline easy to test before
adding API keys, backend calls, or model-specific prompt contracts.

The important contract now uses 3D by default:

```json
{
  "renderer": "3d",
  "kind": "particle_nebula"
}
```

The new generic path uses:

```json
{
  "renderer": "3d",
  "kind": "scene_graph",
  "sceneGraph": {
    "objects": [],
    "motions": [],
    "forces": [],
    "events": [],
    "effects": [],
    "camera": {}
  }
}
```

## Run locally

From this folder:

```bash
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```
