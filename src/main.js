import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { canonicalKey, createPuzzle, hashString, validatePuzzle } from "./polycube.js";

const SESSION_LENGTH = 10;
const PUZZLES_PER_BLOCK_COUNT = 24;
const root = document.querySelector("#app");
const cubeCountInput = document.querySelector("#cube-count");
const cubeCountValue = document.querySelector("#cube-count-value");
const newSessionButton = document.querySelector("#new-session");
const nextButton = document.querySelector("#next-question");
const progressLabel = document.querySelector("#progress-label");
const progressBar = document.querySelector("#progress-bar");
const scoreLabel = document.querySelector("#score");
const streakLabel = document.querySelector("#streak");
const referenceHost = document.querySelector("#reference-view");
const optionsHost = document.querySelector("#options");
const feedback = document.querySelector("#feedback");
const questionHeading = document.querySelector("#question-heading");

const renderers = [];
const puzzlePools = new Map();
let state = { question: 0, score: 0, streak: 0, answered: false, current: null };

function randomShuffle(items) {
  const copy = [...items];
  const values = new Uint32Array(copy.length);
  crypto.getRandomValues(values);
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = values[i] % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function nextPuzzle(cubeCount) {
  if (!puzzlePools.has(cubeCount)) {
    puzzlePools.set(cubeCount, { puzzles: [], available: [], signatures: new Set(), seedIndex: 0 });
  }
  const pool = puzzlePools.get(cubeCount);
  if (pool.puzzles.length < PUZZLES_PER_BLOCK_COUNT) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const seed = hashString(`deca-slider-${cubeCount}-${pool.seedIndex}`);
      pool.seedIndex += 1;
      const puzzle = createPuzzle(seed, cubeCount);
      const signature = canonicalKey(puzzle.reference.points);
      if (pool.signatures.has(signature)) continue;
      pool.signatures.add(signature);
      pool.puzzles.push(puzzle);
      return puzzle;
    }
    throw new Error(`Could not create a distinct ${cubeCount}-block puzzle`);
  }
  if (pool.available.length === 0) pool.available = randomShuffle(pool.puzzles);
  return pool.available.pop();
}

class PolycubeView {
  constructor(host, points, orientation, label) {
    this.host = host;
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", label);
    host.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111722);
    this.camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
    this.camera.position.set(7, 6, 9);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene.add(new THREE.HemisphereLight(0xdce8ff, 0x273043, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
    keyLight.position.set(-5, 8, 7);
    this.scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x7aa7ff, 1.4);
    rimLight.position.set(6, 1, -5);
    this.scene.add(rimLight);

    this.group = new THREE.Group();
    const center = points.reduce((sum, point) => sum.map((value, axis) => value + point[axis]), [0, 0, 0])
      .map((value) => value / points.length);
    this.geometry = new RoundedBoxGeometry(0.92, 0.92, 0.92, 4, 0.075);
    this.material = new THREE.MeshStandardMaterial({ color: 0xd8e3f2, roughness: 0.4, metalness: 0.05 });
    const cubes = new THREE.InstancedMesh(this.geometry, this.material, points.length);
    const transform = new THREE.Matrix4();
    points.forEach((point, index) => {
      transform.makeTranslation(point[0] - center[0], point[1] - center[1], point[2] - center[2]);
      cubes.setMatrixAt(index, transform);
    });
    cubes.instanceMatrix.needsUpdate = true;
    cubes.computeBoundingBox();
    cubes.computeBoundingSphere();
    this.group.add(cubes);
    this.group.rotation.set(orientation.x, orientation.y, orientation.z, "XYZ");
    this.scene.add(this.group);

    const bounds = new THREE.Box3().setFromObject(this.group);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    this.radius = Math.max(sphere.radius, 1.8);

    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(host);
    this.render();
  }

  render() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    const vertical = this.radius * 2.65;
    this.camera.top = vertical / 2;
    this.camera.bottom = -vertical / 2;
    this.camera.left = -(vertical * aspect) / 2;
    this.camera.right = (vertical * aspect) / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}

function clearViews() {
  renderers.splice(0).forEach((renderer) => renderer.dispose());
  referenceHost.replaceChildren();
  optionsHost.replaceChildren();
}

function updateStatus() {
  const shown = Math.min(state.question + 1, SESSION_LENGTH);
  progressLabel.textContent = `Question ${shown} of ${SESSION_LENGTH}`;
  progressBar.style.width = `${(state.question / SESSION_LENGTH) * 100}%`;
  progressBar.parentElement.setAttribute("aria-valuenow", String(state.question));
  scoreLabel.textContent = `${state.score} pts`;
  streakLabel.textContent = state.streak ? `${state.streak} streak` : "No streak";
}

function renderQuestion() {
  clearViews();
  state.answered = false;
  state.current = nextPuzzle(Number(cubeCountInput.value));
  const validation = validatePuzzle(state.current);
  if (!validation.valid) throw new Error(`Invalid puzzle ${state.current.id}: ${validation.errors.join(", ")}`);

  root.dataset.state = "question";
  questionHeading.textContent = "Which option is the same solid, only rotated?";
  feedback.textContent = "Compare cube-to-cube connections. Reflections and moved cubes do not count.";
  feedback.className = "feedback";
  nextButton.hidden = true;
  renderers.push(new PolycubeView(
    referenceHost,
    state.current.reference.points,
    state.current.reference.orientation,
    `Reference solid made of ${state.current.cubeCount} connected cubes`,
  ));

  state.current.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    button.dataset.index = String(index);
    button.setAttribute("aria-label", `Option ${option.label}`);
    const label = document.createElement("span");
    label.className = "option-label";
    label.textContent = option.label;
    const view = document.createElement("span");
    view.className = "option-view";
    button.append(label, view);
    button.addEventListener("click", () => answer(index));
    optionsHost.appendChild(button);
    renderers.push(new PolycubeView(view, option.points, option.orientation, `Answer option ${option.label}`));
  });
  updateStatus();
}

function answer(index) {
  if (state.answered) return;
  state.answered = true;
  const isCorrect = index === state.current.correctIndex;
  const buttons = [...optionsHost.querySelectorAll(".option")];
  buttons.forEach((button, buttonIndex) => {
    button.disabled = true;
    if (buttonIndex === state.current.correctIndex) button.classList.add("is-correct");
    if (buttonIndex === index && !isCorrect) button.classList.add("is-wrong");
  });
  if (isCorrect) {
    state.streak += 1;
    state.score += 100 + Math.min(state.streak - 1, 5) * 20;
    feedback.textContent = "Correct — every cube-to-cube connection is preserved by rotation.";
    feedback.className = "feedback good";
  } else {
    state.streak = 0;
    const label = state.current.options[state.current.correctIndex].label;
    feedback.textContent = `Not quite. ${label} is the only option with the same connection pattern.`;
    feedback.className = "feedback bad";
  }
  state.question += 1;
  progressBar.style.width = `${(state.question / SESSION_LENGTH) * 100}%`;
  progressBar.parentElement.setAttribute("aria-valuenow", String(state.question));
  scoreLabel.textContent = `${state.score} pts`;
  streakLabel.textContent = state.streak ? `${state.streak} streak` : "No streak";
  nextButton.textContent = state.question >= SESSION_LENGTH ? "See results" : "Next puzzle";
  nextButton.hidden = false;
  nextButton.focus();
}

function finishSession() {
  clearViews();
  root.dataset.state = "complete";
  questionHeading.textContent = "Session complete";
  referenceHost.innerHTML = `<div class="result"><strong>${state.score}</strong><span>points across ${SESSION_LENGTH} puzzles</span></div>`;
  feedback.textContent = state.score >= 1000
    ? "Excellent rotation accuracy. Try a larger solid next."
    : "Good practice. Track branches and elbows before comparing the full silhouette.";
  feedback.className = "feedback";
  nextButton.textContent = "Play another session";
  nextButton.hidden = false;
}

function advance() {
  if (state.question >= SESSION_LENGTH) finishSession();
  else renderQuestion();
}

function resetSession() {
  state = { question: 0, score: 0, streak: 0, answered: false, current: null };
  renderQuestion();
}

newSessionButton.addEventListener("click", resetSession);
cubeCountInput.addEventListener("input", () => { cubeCountValue.value = cubeCountInput.value; });
cubeCountInput.addEventListener("change", resetSession);
nextButton.addEventListener("click", () => root.dataset.state === "complete" ? resetSession() : advance());
document.addEventListener("keydown", (event) => {
  if (state.answered || event.altKey || event.ctrlKey || event.metaKey) return;
  const keys = { "1": 0, a: 0, "2": 1, b: 1, "3": 2, c: 2, "4": 3, d: 3 };
  const index = keys[event.key.toLowerCase()];
  if (index !== undefined) answer(index);
});

resetSession();

