# Deca Spatial Rotation — Three.js edition

A ground-up JavaScript rewrite of [nickilis613/deca-spatial-rotation](https://github.com/nickilis613/deca-spatial-rotation), using Three.js for true 3D rendering.

## What changed

- True orthographic 3D rendering with beveled cube geometry and shadow-free studio lighting for visual clarity.
- A 6–100 block slider with a bounded, deterministic 24-puzzle pool generated lazily for every selected size.
- Four answer options per puzzle with exactly one rotation-equivalent match.
- Proper-rotation canonicalization across all 24 orientations of a cube; reflections are not treated as rotations.
- Automated validation for connectivity, cube counts, unique option structures, and single-answer correctness.
- Instanced Three.js rendering so even 100-block puzzles use one cube draw call per view.
- Ten-question sessions, scoring, streaks, keyboard controls, and responsive layouts.

## Run

ES modules must be served over HTTP. From this folder, run:

```sh
npm start
```

Then open `http://localhost:4173`.

## Validate the puzzle bank

No package installation is required for the data tests:

```sh
npm test
```

Three.js 0.180.0 is pinned through the import map in `index.html`.

