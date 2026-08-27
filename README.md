# DECA Training Tool

An interactive, generative mental-rotation trainer inspired by classic 3D spatial-reasoning tests.

## Current capabilities

- Generates a new connected 3D cube structure for every question.
- Produces one matching rotation and three structurally altered distractors.
- Uses compound pitch, yaw, and roll rotations rather than a single-axis turn.
- Offers 6-, 8-, and 10-cube difficulty levels.
- Includes ten-question sessions, scoring, and immediate feedback.
- Works on desktop and mobile screens.

## Visual direction

The next renderer iteration should use a true 3D scene with:

- beveled cube geometry;
- orthographic perspective;
- soft studio lighting and contact shadows;
- clear depth separation without misleading overlaps;
- deterministic generation for reproducible questions;
- accessible keyboard and touch controls.

## Run locally

Open `index.html` in a modern browser.

## Reference

The exercise format is modeled after Professor LaMarr's [Mental Rotation Test](https://www.youtube.com/watch?v=VlBRj7qwGGk): one reference solid and four answer choices.


