const STORAGE_KEY = "top-set-records-v1";
const UNDO_KEY = "top-set-undo-v1";
const MIN_REPS = 1;
const MAX_REPS = 15;
const WEIGHT_STEP = 0.5;
const TARGET_REPS = [1, 5, 10];

const categories = [
  {
    id: "main",
    number: "1",
    title: "Main compound lifts",
    note: "Big moves · build strength",
    exercises: [
      { id: "barbell-back-squat", number: 1, name: "Barbell back squat", tone: "orange", tags: ["legs"] },
      { id: "deadlift-variation", number: 2, name: "Deadlift variation", subtitle: "Straight-bar deadlift / Trap-bar deadlift", tone: "orange", tags: ["legs", "pull"] },
      { id: "barbell-bench-press", number: 3, name: "Barbell bench press", tone: "blue", tags: ["push"] },
      { id: "pull-ups", number: 4, name: "Pull-ups", tone: "green", tags: ["pull"] },
      { id: "strict-landmine-press", number: 5, name: "Strict press / Landmine press", subtitle: "Joe / Jen", tone: "blue", tags: ["push"] },
      { id: "horizontal-row-machine", number: 6, name: "Horizontal row machine", tone: "green", tags: ["pull"] },
      { id: "bulgarian-split-squat", number: 7, name: "Dumbbell Bulgarian split squat", tone: "orange", tags: ["legs"] },
      { id: "hip-thrust-machine", number: 8, name: "Hip thrust machine", tone: "orange", tags: ["legs"] },
    ],
  },
  {
    id: "assistance",
    number: "2",
    title: "Assistance / accessories",
    note: "Build muscle · fill the gaps",
    exercises: [
      { id: "lat-pulldown", number: 9, name: "Lat pulldown", tone: "green", tags: ["pull"] },
      { id: "dumbbell-z-press", number: 10, name: "Dumbbell Z-press", tone: "blue", tags: ["push", "core"] },
      { id: "lying-leg-curl", number: 11, name: "Lying leg curl", tone: "orange", tags: ["legs"] },
      { id: "leg-extension", number: 12, name: "Leg extension", tone: "orange", tags: ["legs"] },
      { id: "standing-calf-raise", number: 13, name: "Standing calf raise", tone: "orange", tags: ["legs"] },
      { id: "cable-triceps-pushdown", number: 14, name: "Cable triceps pushdown", tone: "blue", tags: ["push"] },
      { id: "dumbbell-biceps-curl", number: 15, name: "Dumbbell biceps curl", tone: "green", tags: ["pull"] },
      { id: "cable-face-pull", number: 16, name: "Cable face pull", tone: "green", tags: ["pull"] },
      { id: "dumbbell-lateral-raise", number: 17, name: "Dumbbell lateral raise", tone: "blue", tags: ["push"] },
    ],
  },
  {
    id: "core",
    number: "3",
    title: "Core / trunk",
    note: "A stronger middle",
    exercises: [
      { id: "dead-bug", number: 18, name: "Dead bug", tone: "purple", tags: ["core"] },
      { id: "decline-sit-up", number: 19, name: "Decline sit-up / decline crunch", tone: "purple", tags: ["core"] },
      { id: "back-extension", number: 20, name: "45° back extension", tone: "purple", tags: ["legs", "core"] },
    ],
  },
];

const exerciseMap = new Map(categories.flatMap((category) => category.exercises.map((exercise) => [exercise.id, exercise])));
let records = readJson(STORAGE_KEY, {});
let undoState = readJson(UNDO_KEY, null);
let saveTimers = new Map();

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* local-only storage may be unavailable */ }
}

function epleyOneRepMax(reps, weight) {
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

function equivalentWeight(oneRepMax, reps) {
  return reps === 1 ? oneRepMax : oneRepMax / (1 + reps / 30);
}

function roundToHalf(value) {
  return Math.round(value / WEIGHT_STEP) * WEIGHT_STEP;
}

function formatWeight(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function isValidEntry(reps, weight) {
  return Number.isInteger(reps) && reps >= MIN_REPS && reps <= MAX_REPS && Number.isFinite(weight) && weight > 0 && Math.abs(weight / WEIGHT_STEP - Math.round(weight / WEIGHT_STEP)) < 0.0001;
}

function tagLabel(tag) {
  return ({ push: "Push", pull: "Pull / Back", legs: "Legs / Glutes", core: "Core / Trunk" })[tag];
}

function tagClass(tag) {
  return ({ push: "push", pull: "pull", legs: "legs", core: "core" })[tag];
}

function cardMarkup(exercise) {
  const record = records[exercise.id];
  const current = record ? `${record.reps} × ${formatWeight(record.weight)} kg` : "Not entered yet";
  const emptyClass = record ? "" : " empty";
  const oneRepMax = record ? epleyOneRepMax(record.reps, record.weight) : null;
  const equivalents = TARGET_REPS.map((reps) => record ? `${formatWeight(roundToHalf(equivalentWeight(oneRepMax, reps)))} kg` : "—");
  const tags = exercise.tags.map((tag) => `<span class="tag ${tagClass(tag)}">${tagLabel(tag)}</span>`).join("");
  const ariaCurrent = record ? `Best top set: ${current}` : "Not entered yet";
  return `
    <article class="exercise-card" data-id="${exercise.id}" data-tone="${exercise.tone}">
      <div class="exercise-top">
        <div class="exercise-name-wrap">
          <span class="exercise-number">${String(exercise.number).padStart(2, "0")}</span>
          <div>
            <h3 class="exercise-name">${exercise.name}</h3>
            ${exercise.subtitle ? `<p class="exercise-subtitle">${exercise.subtitle}</p>` : ""}
          </div>
        </div>
        <div class="tag-row" aria-label="Muscle group">${tags}</div>
      </div>
      <div class="saved-area">
        <div>
          <div class="saved-label">Best top set</div>
          <p class="saved-value${emptyClass}" aria-label="${ariaCurrent}">${current}</p>
        </div>
        ${record ? `<p class="saved-date">saved on this phone</p>` : ""}
      </div>
      <div class="equivalents${record ? "" : " empty-state"}" aria-label="Equivalent weights">
        ${TARGET_REPS.map((reps, index) => `<div class="equivalent"><span class="equivalent-label">${reps} rep${reps === 1 ? "" : "s"}</span><span class="equivalent-value">${equivalents[index]}</span></div>`).join("")}
      </div>
      <div class="entry-row">
        <div class="input-wrap">
          <label for="reps-${exercise.id}">Reps</label>
          <input class="entry-input reps-input" id="reps-${exercise.id}" inputmode="numeric" type="number" min="${MIN_REPS}" max="${MAX_REPS}" step="1" placeholder="—" aria-label="Reps for ${exercise.name}" />
          <span class="input-suffix">reps</span>
        </div>
        <div class="input-wrap">
          <label for="weight-${exercise.id}">Kg</label>
          <input class="entry-input weight-input" id="weight-${exercise.id}" inputmode="decimal" type="number" min="${WEIGHT_STEP}" step="${WEIGHT_STEP}" placeholder="—" aria-label="Kilograms for ${exercise.name}" />
          <span class="input-suffix">kg</span>
        </div>
      </div>
      <p class="entry-status" id="status-${exercise.id}" aria-live="polite"></p>
    </article>`;
}

function render() {
  const list = document.querySelector("#exerciseList");
  list.innerHTML = categories.map((category) => `
    <section class="category-section" data-category="${category.id}" aria-labelledby="heading-${category.id}">
      <div class="category-header">
        <span class="category-number">${category.number}</span>
        <h2 class="category-title" id="heading-${category.id}">${category.title}</h2>
        <span class="category-note">${category.note}</span>
      </div>
      ${category.exercises.map(cardMarkup).join("")}
    </section>`).join("");
  bindInputs();
  updateUndoButton();
}

function bindInputs() {
  document.querySelectorAll(".exercise-card").forEach((card) => {
    const id = card.dataset.id;
    const repsInput = card.querySelector(".reps-input");
    const weightInput = card.querySelector(".weight-input");
    const record = records[id];
    if (record) {
      repsInput.value = record.reps;
      weightInput.value = formatWeight(record.weight);
    }
    const queueSave = () => {
      clearTimeout(saveTimers.get(id));
      saveTimers.set(id, setTimeout(() => attemptSave(id), 650));
    };
    repsInput.addEventListener("input", queueSave);
    weightInput.addEventListener("input", queueSave);
    repsInput.addEventListener("keydown", (event) => { if (event.key === "Enter") weightInput.focus(); });
    weightInput.addEventListener("keydown", (event) => { if (event.key === "Enter") weightInput.blur(); });
  });
}

function attemptSave(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (!card) return;
  const repsInput = card.querySelector(".reps-input");
  const weightInput = card.querySelector(".weight-input");
  const status = card.querySelector(".entry-status");
  const reps = Number(repsInput.value);
  const weight = Number(weightInput.value);
  if (!repsInput.value || !weightInput.value) return;
  if (!isValidEntry(reps, weight)) {
    status.className = "entry-status caution";
    status.textContent = `Use ${MIN_REPS}–${MAX_REPS} reps and kg in 0.5 steps.`;
    return;
  }
  const candidate = { reps, weight: roundToHalf(weight) };
  const current = records[id];
  const candidateScore = epleyOneRepMax(candidate.reps, candidate.weight);
  const currentScore = current ? epleyOneRepMax(current.reps, current.weight) : -Infinity;
  if (candidateScore > currentScore + 0.0001) {
    undoState = { records: structuredClone(records), changedId: id };
    records = { ...records, [id]: candidate };
    writeJson(STORAGE_KEY, records);
    writeJson(UNDO_KEY, undoState);
    render();
    const newCard = document.querySelector(`[data-id="${id}"]`);
    const newStatus = newCard.querySelector(".entry-status");
    newStatus.className = "entry-status positive";
    newStatus.textContent = "Saved automatically.";
    window.setTimeout(() => { if (newStatus.textContent === "Saved automatically.") newStatus.textContent = ""; }, 1800);
    announce(`${exerciseMap.get(id).name} saved as a new best.`);
  } else if (current) {
    status.className = "entry-status caution";
    status.textContent = "This set is not higher than the saved best.";
  }
}

function updateUndoButton() {
  const button = document.querySelector("#undoButton");
  button.disabled = !undoState;
  button.setAttribute("aria-label", undoState ? "Undo last change" : "Nothing to undo");
}

function undoLastChange() {
  if (!undoState) return;
  records = undoState.records || {};
  writeJson(STORAGE_KEY, records);
  undoState = null;
  writeJson(UNDO_KEY, null);
  render();
  announce("Last change undone.");
}

function announce(message) {
  const liveRegion = document.querySelector("#liveRegion");
  liveRegion.textContent = message;
  window.setTimeout(() => { liveRegion.textContent = ""; }, 1000);
}

document.querySelector("#undoButton").addEventListener("click", undoLastChange);
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

// Expose the real app actions to supporting WebMCP-enabled browsers without changing the visible flow.
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const register = (tool) => Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
  register({
    name: "read_best_top_sets",
    title: "Read best top sets",
    description: "Read the saved best top set and equivalent 1, 5, and 10 rep weights for all exercises.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: () => ({ records }),
  });
  register({
    name: "save_top_set",
    title: "Save a top set",
    description: "Save a stronger top set for one of the listed exercises. It replaces the saved value only when its Epley estimate is higher.",
    inputSchema: {
      type: "object",
      properties: { exerciseId: { type: "string" }, reps: { type: "integer", minimum: MIN_REPS, maximum: MAX_REPS }, weightKg: { type: "number", minimum: WEIGHT_STEP } },
      required: ["exerciseId", "reps", "weightKg"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: ({ exerciseId, reps, weightKg }) => {
      const exercise = exerciseMap.get(exerciseId);
      if (!exercise || !isValidEntry(reps, weightKg)) throw new Error("Use a listed exercise, 1–15 reps, and kg in 0.5 steps.");
      const current = records[exerciseId];
      const candidate = { reps, weight: roundToHalf(weightKg) };
      if (current && epleyOneRepMax(candidate.reps, candidate.weight) <= epleyOneRepMax(current.reps, current.weight)) return { saved: false, reason: "not_higher", current };
      undoState = { records: structuredClone(records), changedId: exerciseId };
      records = { ...records, [exerciseId]: candidate };
      writeJson(STORAGE_KEY, records);
      writeJson(UNDO_KEY, undoState);
      render();
      return { saved: true, exerciseId, record: candidate };
    },
  });
}
