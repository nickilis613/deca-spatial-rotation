import test from "node:test";
import assert from "node:assert/strict";
import {
  PUZZLE_BANK,
  PROPER_ROTATIONS,
  applyGridRotation,
  areRotationEquivalent,
  canonicalKey,
  createPuzzle,
  hashString,
  validatePuzzle,
} from "../src/polycube.js";

test("the rotation group contains all 24 orientation-preserving cube rotations", () => {
  assert.equal(PROPER_ROTATIONS.length, 24);
  assert.equal(new Set(PROPER_ROTATIONS.map((matrix) => JSON.stringify(matrix))).size, 24);
});

test("the bank contains 32 distinct references at every difficulty", () => {
  assert.equal(PUZZLE_BANK.length, 96);
  for (const count of [6, 8, 10]) {
    const puzzles = PUZZLE_BANK.filter((puzzle) => puzzle.cubeCount === count);
    assert.equal(puzzles.length, 32);
    assert.equal(new Set(puzzles.map((puzzle) => canonicalKey(puzzle.reference.points))).size, 32);
  }
});

test("every puzzle has exactly one correct answer and four unique valid solids", () => {
  for (const puzzle of PUZZLE_BANK) {
    const validation = validatePuzzle(puzzle);
    assert.equal(validation.valid, true, `${puzzle.id}: ${validation.errors.join(", ")}`);
    assert.equal(validation.matchCount, 1, puzzle.id);
    assert.equal(puzzle.options.filter((option) => option.isCorrect).length, 1, puzzle.id);
    assert.equal(puzzle.options[puzzle.correctIndex].isCorrect, true, puzzle.id);
  }
});

test("canonical matching recognizes every proper rotation of every reference", () => {
  for (const puzzle of PUZZLE_BANK) {
    for (const rotation of PROPER_ROTATIONS) {
      const rotated = puzzle.reference.points.map((point) => applyGridRotation(rotation, point));
      assert.equal(areRotationEquivalent(puzzle.reference.points, rotated), true, puzzle.id);
    }
  }
});

test("every selectable block count from 6 through 100 produces one uniquely solvable puzzle", () => {
  for (let cubeCount = 6; cubeCount <= 100; cubeCount += 1) {
    const puzzle = createPuzzle(hashString(`slider-validation-${cubeCount}`), cubeCount);
    const validation = validatePuzzle(puzzle);
    assert.equal(validation.valid, true, `${cubeCount} blocks: ${validation.errors.join(", ")}`);
    assert.equal(validation.matchCount, 1, `${cubeCount} blocks`);
  }
});

