export const DIRECTIONS = Object.freeze([
  [1, 0, 0], [-1, 0, 0], [0, 1, 0],
  [0, -1, 0], [0, 0, 1], [0, 0, -1],
]);

const pointKey = ([x, y, z]) => `${x},${y},${z}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

function permutationParity(permutation) {
  let inversions = 0;
  for (let i = 0; i < permutation.length; i += 1) {
    for (let j = i + 1; j < permutation.length; j += 1) {
      if (permutation[i] > permutation[j]) inversions += 1;
    }
  }
  return inversions % 2 === 0 ? 1 : -1;
}

const permutations = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2],
  [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

export const PROPER_ROTATIONS = Object.freeze(permutations.flatMap((permutation) => {
  const matrices = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const signs = [sx, sy, sz];
        if (permutationParity(permutation) * sx * sy * sz !== 1) continue;
        const matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        for (let row = 0; row < 3; row += 1) {
          matrix[row][permutation[row]] = signs[row];
        }
        matrices.push(matrix);
      }
    }
  }
  return matrices;
}));

export function applyGridRotation(matrix, [x, y, z]) {
  return matrix.map((row) => row[0] * x + row[1] * y + row[2] * z);
}

export function normalizePoints(points) {
  const mins = [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis])));
  return points
    .map((point) => point.map((value, axis) => value - mins[axis]))
    .sort((a, b) => pointKey(a).localeCompare(pointKey(b)));
}

export function canonicalKey(points) {
  return PROPER_ROTATIONS
    .map((rotation) => normalizePoints(points.map((point) => applyGridRotation(rotation, point)))
      .map(pointKey).join(";"))
    .sort()[0];
}

export function areRotationEquivalent(a, b) {
  return a.length === b.length && canonicalKey(a) === canonicalKey(b);
}

export function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const choose = (items, rng) => items[Math.floor(rng() * items.length)];

function shuffled(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function degree(point, occupied) {
  return DIRECTIONS.reduce((total, direction) => total + Number(occupied.has(pointKey(add(point, direction)))), 0);
}

export function isConnected(points) {
  if (!points.length) return false;
  const occupied = new Set(points.map(pointKey));
  const visited = new Set([pointKey(points[0])]);
  const queue = [points[0]];
  while (queue.length) {
    const point = queue.shift();
    for (const direction of DIRECTIONS) {
      const neighbor = add(point, direction);
      const neighborKey = pointKey(neighbor);
      if (occupied.has(neighborKey) && !visited.has(neighborKey)) {
        visited.add(neighborKey);
        queue.push(neighbor);
      }
    }
  }
  return visited.size === points.length;
}

function spansThreeAxes(points) {
  return [0, 1, 2].every((axis) => {
    const values = points.map((point) => point[axis]);
    return Math.max(...values) > Math.min(...values);
  });
}

export function validatePolycube(points, expectedCount = points.length) {
  const errors = [];
  if (points.length !== expectedCount) errors.push(`expected ${expectedCount} cubes, found ${points.length}`);
  if (new Set(points.map(pointKey)).size !== points.length) errors.push("contains duplicate cube coordinates");
  if (points.some((point) => point.length !== 3 || point.some((value) => !Number.isInteger(value)))) {
    errors.push("contains a non-integer coordinate");
  }
  if (!isConnected(points)) errors.push("is not face-connected");
  return errors;
}

function generateSolid(count, rng) {
  for (let attempt = 0; attempt < 1200; attempt += 1) {
    const points = [[0, 0, 0]];
    const occupied = new Set(["0,0,0"]);
    let current = points[0];
    while (points.length < count) {
      let added = null;
      for (let anchorAttempt = 0; anchorAttempt < 180 && !added; anchorAttempt += 1) {
        const anchor = anchorAttempt === 0 && rng() < 0.7 ? current : choose(points, rng);
        if (degree(anchor, occupied) >= 4) continue;
        const candidates = shuffled(DIRECTIONS, rng)
          .map((direction) => add(anchor, direction))
          .filter((candidate) => !occupied.has(pointKey(candidate)))
          .filter((candidate) => degree(candidate, occupied) <= 2);
        if (candidates.length) added = choose(candidates, rng);
      }
      if (!added) break;
      current = added;
      points.push(added);
      occupied.add(pointKey(added));
    }
    if (points.length !== count || !spansThreeAxes(points)) continue;
    const orbitSize = new Set(PROPER_ROTATIONS.map((rotation) => (
      normalizePoints(points.map((point) => applyGridRotation(rotation, point))).map(pointKey).join(";")
    ))).size;
    if (orbitSize >= 12) return normalizePoints(points);
  }
  throw new Error(`Could not generate a valid ${count}-cube solid`);
}

function generateDistractor(base, forbidden, rng) {
  for (let attempt = 0; attempt < 700; attempt += 1) {
    const occupied = new Set(base.map(pointKey));
    const leaves = base.filter((point) => degree(point, occupied) === 1);
    if (!leaves.length) return null;
    const removed = choose(leaves, rng);
    const remaining = base.filter((point) => point !== removed);
    const remainingSet = new Set(remaining.map(pointKey));
    for (const anchor of shuffled(remaining, rng)) {
      for (const direction of shuffled(DIRECTIONS, rng)) {
        const added = add(anchor, direction);
        if (remainingSet.has(pointKey(added))) continue;
        if (degree(added, remainingSet) > 2) continue;
        const candidate = normalizePoints([...remaining, added]);
        if (!spansThreeAxes(candidate) || !isConnected(candidate)) continue;
        const signature = canonicalKey(candidate);
        if (forbidden.has(signature)) continue;
        forbidden.add(signature);
        return candidate;
      }
    }
  }
  return null;
}

function randomOrientation(rng) {
  const min = Math.PI * 0.18;
  const angle = () => (rng() * 2 - 1) * Math.PI;
  let orientation;
  do {
    orientation = { x: angle(), y: angle(), z: angle() };
  } while ([orientation.x, orientation.y, orientation.z].filter((value) => Math.abs(value) > min).length < 2);
  return orientation;
}

function shuffleOptions(options, rng) {
  return shuffled(options, rng).map((option, index) => ({ ...option, label: "ABCD"[index] }));
}

export function validatePuzzle(puzzle) {
  const errors = [];
  errors.push(...validatePolycube(puzzle.reference.points, puzzle.cubeCount).map((error) => `reference ${error}`));
  if (puzzle.options.length !== 4) errors.push(`expected 4 options, found ${puzzle.options.length}`);
  puzzle.options.forEach((option, index) => {
    errors.push(...validatePolycube(option.points, puzzle.cubeCount).map((error) => `option ${index + 1} ${error}`));
  });
  const signatures = puzzle.options.map((option) => canonicalKey(option.points));
  if (new Set(signatures).size !== signatures.length) errors.push("two answer options are rotationally equivalent");
  const matches = puzzle.options
    .map((option, index) => areRotationEquivalent(puzzle.reference.points, option.points) ? index : -1)
    .filter((index) => index >= 0);
  if (matches.length !== 1) errors.push(`expected exactly one correct answer, found ${matches.length}`);
  if (matches.length === 1 && matches[0] !== puzzle.correctIndex) errors.push("correctIndex does not identify the matching solid");
  return { valid: errors.length === 0, errors, matchCount: matches.length };
}

export function createPuzzle(seed, cubeCount) {
  for (let puzzleAttempt = 0; puzzleAttempt < 80; puzzleAttempt += 1) {
    const actualSeed = (seed + Math.imul(puzzleAttempt, 0x9e3779b1)) >>> 0;
    const rng = createRng(actualSeed);
    const referencePoints = generateSolid(cubeCount, rng);
    const forbidden = new Set([canonicalKey(referencePoints)]);
    const distractors = [];
    while (distractors.length < 3) {
      const distractor = generateDistractor(referencePoints, forbidden, rng);
      if (!distractor) break;
      distractors.push(distractor);
    }
    if (distractors.length !== 3) continue;
    const options = shuffleOptions([
      { points: referencePoints.map((point) => [...point]), orientation: randomOrientation(rng), isCorrect: true },
      ...distractors.map((points) => ({ points, orientation: randomOrientation(rng), isCorrect: false })),
    ], rng);
    const puzzle = {
      id: `${cubeCount}-${actualSeed.toString(16).padStart(8, "0")}`,
      seed: actualSeed,
      cubeCount,
      reference: { points: referencePoints, orientation: randomOrientation(rng) },
      options,
      correctIndex: options.findIndex((option) => option.isCorrect),
    };
    const validation = validatePuzzle(puzzle);
    if (validation.valid) return puzzle;
  }
  throw new Error(`Could not create a uniquely solvable ${cubeCount}-cube puzzle from seed ${seed}`);
}

export function buildPuzzleBank(perDifficulty = 32) {
  const bank = [];
  for (const cubeCount of [6, 8, 10]) {
    const seenReferences = new Set();
    let index = 0;
    while (seenReferences.size < perDifficulty) {
      const seed = hashString(`deca-three-${cubeCount}-${index}`);
      const puzzle = createPuzzle(seed, cubeCount);
      const signature = canonicalKey(puzzle.reference.points);
      if (!seenReferences.has(signature)) {
        seenReferences.add(signature);
        bank.push(puzzle);
      }
      index += 1;
      if (index > perDifficulty * 30) throw new Error(`Could not build the ${cubeCount}-cube puzzle bank`);
    }
  }
  return bank;
}

export const PUZZLE_BANK = Object.freeze(buildPuzzleBank());

