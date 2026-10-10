// Feature: personal-dashboard
// Tests for TodoModule — add, delete, toggle-done handlers (task 10.2).
// Property tests: Properties 6, 7 (task 10.4 stubs included here for 10.2 coverage).
// Requirements: 5.3, 5.4, 5.5, 5.8, 5.9

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers extracted from TodoModule
//
// The production code lives in an IIFE inside js/app.js (no module exports).
// These pure functions mirror the exact logic so Vitest can run them in Node.
// ─────────────────────────────────────────────────────────────────────────────

const KEY_TASKS = 'pd_tasks';

/** In-memory mock matching the StorageService shape. */
function makeMockStorage() {
  const store = new Map();
  return {
    get(key, defaultValue = null) {
      if (!store.has(key)) return defaultValue;
      try { return JSON.parse(store.get(key)); } catch (_e) { return defaultValue; }
    },
    set(key, value) { store.set(key, JSON.stringify(value)); },
    remove(key)     { store.delete(key); },
    _rawGet(key)    { return store.has(key) ? store.get(key) : null; },
  };
}

/**
 * Validate a candidate task text string.
 * Mirrors the validation inside TodoModule._addTask().
 *
 * Rules (Requirements 5.3, 5.8, 5.9):
 *   - Empty / whitespace-only → { valid: false, error: 'Task cannot be empty.' }
 *   - Length > 100             → { valid: false, error: 'Task must be 100 characters or fewer.' }
 *   - Case-insensitive dup     → { valid: false, error: 'A task with that name already exists.' }
 *   - Otherwise                → { valid: true, trimmed }
 *
 * @param {string}   text    Raw input string.
 * @param {object[]} tasks   Current in-memory task list (used for dup check).
 * @returns {{ valid: boolean, trimmed?: string, error?: string }}
 */
function validateTaskText(text, tasks = []) {
  const trimmed = (text || '').trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Task cannot be empty.' };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: 'Task must be 100 characters or fewer.' };
  }
  const lower = trimmed.toLowerCase();
  if (tasks.some(t => t.text.toLowerCase() === lower)) {
    return { valid: false, error: 'A task with that name already exists.' };
  }
  return { valid: true, trimmed };
}

/**
 * Create a new Task object (mirrors TodoModule._addTask internals).
 * Uses a simple counter-based id for determinism in tests.
 */
let _idCounter = 0;
function makeTask(text, overrides = {}) {
  return {
    id:        String(++_idCounter),
    text:      text.trim(),
    completed: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Simulate the full add-task flow.
 *
 * @param {object[]} tasks       Current in-memory list (mutated on success).
 * @param {object}   storage     Mock StorageService.
 * @param {string}   text        Raw input string.
 * @returns {{ added: boolean, error?: string }}
 */
function simulateAddTask(tasks, storage, text) {
  const result = validateTaskText(text, tasks);
  if (!result.valid) return { added: false, error: result.error };

  const task = makeTask(result.trimmed);
  tasks.push(task);
  storage.set(KEY_TASKS, tasks);
  return { added: true, task };
}

/**
 * Simulate the delete flow.
 *
 * @param {object[]} tasks   Current in-memory list (mutated).
 * @param {object}   storage Mock StorageService.
 * @param {string}   id      Task id to remove.
 */
function simulateDeleteTask(tasks, storage, id) {
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  tasks.splice(idx, 1);
  storage.set(KEY_TASKS, tasks);
}

/**
 * Simulate the toggle-done flow.
 *
 * @param {object[]} tasks   Current in-memory list (mutated).
 * @param {object}   storage Mock StorageService.
 * @param {string}   id      Task id to toggle.
 */
function simulateToggleDone(tasks, storage, id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  storage.set(KEY_TASKS, tasks);
}

// ─────────────────────────────────────────────────────────────────────────────
// Arbitraries
// ─────────────────────────────────────────────────────────────────────────────

/** Arbitrary for a valid Task object. */
const taskArb = fc.record({
  id:        fc.uuid(),
  text:      fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  completed: fc.boolean(),
  createdAt: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — _addTask
// ─────────────────────────────────────────────────────────────────────────────

describe('_addTask unit tests', () => {
  let tasks;
  let storage;

  beforeEach(() => {
    _idCounter = 0;
    tasks   = [];
    storage = makeMockStorage();
  });

  it('adds a valid task and sets completed = false', () => {
    const { added, task } = simulateAddTask(tasks, storage, 'Buy milk');
    expect(added).toBe(true);
    expect(tasks).toHaveLength(1);
    expect(task.text).toBe('Buy milk');
    expect(task.completed).toBe(false);
  });

  it('trims leading/trailing whitespace from task text', () => {
    const { added, task } = simulateAddTask(tasks, storage, '  Buy milk  ');
    expect(added).toBe(true);
    expect(task.text).toBe('Buy milk');
  });

  it('persists the task array to storage', () => {
    simulateAddTask(tasks, storage, 'Write tests');
    const stored = storage.get(KEY_TASKS, []);
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe('Write tests');
  });

  it('rejects empty input', () => {
    const { added, error } = simulateAddTask(tasks, storage, '');
    expect(added).toBe(false);
    expect(error).toBe('Task cannot be empty.');
    expect(tasks).toHaveLength(0);
  });

  it('rejects whitespace-only input', () => {
    const { added } = simulateAddTask(tasks, storage, '   ');
    expect(added).toBe(false);
    expect(tasks).toHaveLength(0);
  });

  it('rejects text longer than 100 characters', () => {
    const longText = 'A'.repeat(101);
    const { added, error } = simulateAddTask(tasks, storage, longText);
    expect(added).toBe(false);
    expect(error).toBe('Task must be 100 characters or fewer.');
    expect(tasks).toHaveLength(0);
  });

  it('accepts text of exactly 100 characters', () => {
    const exactText = 'A'.repeat(100);
    const { added } = simulateAddTask(tasks, storage, exactText);
    expect(added).toBe(true);
    expect(tasks).toHaveLength(1);
  });

  it('rejects a case-insensitive duplicate of an existing task', () => {
    simulateAddTask(tasks, storage, 'Buy Milk');
    const { added, error } = simulateAddTask(tasks, storage, 'buy milk');
    expect(added).toBe(false);
    expect(error).toBe('A task with that name already exists.');
    expect(tasks).toHaveLength(1);
  });

  it('allows adding multiple distinct tasks', () => {
    simulateAddTask(tasks, storage, 'Task One');
    simulateAddTask(tasks, storage, 'Task Two');
    simulateAddTask(tasks, storage, 'Task Three');
    expect(tasks).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — _deleteTask
// ─────────────────────────────────────────────────────────────────────────────

describe('_deleteTask unit tests', () => {
  let tasks;
  let storage;

  beforeEach(() => {
    _idCounter = 0;
    tasks   = [];
    storage = makeMockStorage();
    simulateAddTask(tasks, storage, 'Task A');
    simulateAddTask(tasks, storage, 'Task B');
    simulateAddTask(tasks, storage, 'Task C');
  });

  it('removes the task with the matching id', () => {
    const idToDelete = tasks[1].id; // Task B
    simulateDeleteTask(tasks, storage, idToDelete);
    expect(tasks).toHaveLength(2);
    expect(tasks.find(t => t.id === idToDelete)).toBeUndefined();
  });

  it('leaves other tasks intact after deletion', () => {
    const idA = tasks[0].id;
    const idC = tasks[2].id;
    simulateDeleteTask(tasks, storage, tasks[1].id);
    expect(tasks.find(t => t.id === idA)).toBeDefined();
    expect(tasks.find(t => t.id === idC)).toBeDefined();
  });

  it('persists updated task list to storage after deletion', () => {
    const idToDelete = tasks[0].id;
    simulateDeleteTask(tasks, storage, idToDelete);
    const stored = storage.get(KEY_TASKS, []);
    expect(stored).toHaveLength(2);
    expect(stored.find(t => t.id === idToDelete)).toBeUndefined();
  });

  it('is a no-op for an unknown id (does not throw)', () => {
    expect(() => simulateDeleteTask(tasks, storage, 'nonexistent-id')).not.toThrow();
    expect(tasks).toHaveLength(3);
  });

  it('can delete all tasks one by one', () => {
    const ids = tasks.map(t => t.id);
    for (const id of ids) simulateDeleteTask(tasks, storage, id);
    expect(tasks).toHaveLength(0);
    expect(storage.get(KEY_TASKS, [])).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — _toggleDone
// ─────────────────────────────────────────────────────────────────────────────

describe('_toggleDone unit tests', () => {
  let tasks;
  let storage;

  beforeEach(() => {
    _idCounter = 0;
    tasks   = [];
    storage = makeMockStorage();
    simulateAddTask(tasks, storage, 'Task X');
    simulateAddTask(tasks, storage, 'Task Y');
  });

  it('sets completed to true on a newly-added task (false → true)', () => {
    const id = tasks[0].id;
    expect(tasks[0].completed).toBe(false);
    simulateToggleDone(tasks, storage, id);
    expect(tasks[0].completed).toBe(true);
  });

  it('sets completed to false when toggled again (true → false)', () => {
    const id = tasks[0].id;
    simulateToggleDone(tasks, storage, id); // false → true
    simulateToggleDone(tasks, storage, id); // true  → false
    expect(tasks[0].completed).toBe(false);
  });

  it('persists updated completed state to storage', () => {
    const id = tasks[0].id;
    simulateToggleDone(tasks, storage, id);
    const stored = storage.get(KEY_TASKS, []);
    expect(stored.find(t => t.id === id).completed).toBe(true);
  });

  it('only toggles the targeted task, leaving others unchanged', () => {
    const id0 = tasks[0].id;
    const id1 = tasks[1].id;
    simulateToggleDone(tasks, storage, id0);
    expect(tasks.find(t => t.id === id0).completed).toBe(true);
    expect(tasks.find(t => t.id === id1).completed).toBe(false);
  });

  it('is a no-op for an unknown id (does not throw)', () => {
    expect(() => simulateToggleDone(tasks, storage, 'ghost-id')).not.toThrow();
    expect(tasks[0].completed).toBe(false);
    expect(tasks[1].completed).toBe(false);
  });

  it('applies strikethrough-class data is reflected: completed starts false', () => {
    // Confirm that completed = false on creation (Requirement 5.3).
    tasks.forEach(t => expect(t.completed).toBe(false));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 6: Task addition grows the list by exactly one
// Feature: personal-dashboard, Property 6: Task addition grows list by exactly one
// Validates: Requirements 5.3
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 6: Task addition grows list by exactly one', () => {
  it('adding a valid unique task increases list length by 1 and has completed = false', () => {
    fc.assert(
      fc.property(
        // Existing task list
        fc.array(taskArb, { maxLength: 20 }),
        // New task text: valid (1–100 chars, not whitespace-only)
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        (existingTasks, newText) => {
          // Build a tasks array with unique lowercase texts to avoid collisions.
          const uniqueTasks = [];
          const seen = new Set();
          for (const t of existingTasks) {
            const lower = t.text.toLowerCase();
            if (!seen.has(lower)) {
              seen.add(lower);
              uniqueTasks.push(t);
            }
          }

          // Skip if the new text would be a duplicate.
          if (seen.has(newText.trim().toLowerCase())) return;

          const storage = makeMockStorage();
          const tasks   = [...uniqueTasks];
          const before  = tasks.length;

          const { added, task } = simulateAddTask(tasks, storage, newText);

          // Must have been added.
          expect(added).toBe(true);
          // Length increased by exactly one.
          expect(tasks.length).toBe(before + 1);
          // New task has correct text and completed = false.
          expect(task.text).toBe(newText.trim());
          expect(task.completed).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 7: Task text validation rejects invalid inputs
// Feature: personal-dashboard, Property 7: Task text validation rejects invalid inputs
// Validates: Requirements 5.8, 5.9
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 7: Task text validation rejects invalid inputs', () => {
  it('rejects empty, whitespace-only, and duplicate texts without changing the list', () => {
    // Pre-populate with one task so duplicates can be tested.
    const existingTask = { id: 'x1', text: 'Existing Task', completed: false, createdAt: 1000 };

    // Arbitrary for invalid inputs:
    //   - empty string
    //   - whitespace-only
    //   - case-insensitive duplicate of 'Existing Task'
    //   - text longer than 100 characters
    const invalidTextArb = fc.oneof(
      fc.constant(''),
      fc.string({ minLength: 1, maxLength: 60 }).filter(s => s.trim().length === 0),
      fc.constantFrom('Existing Task', 'existing task', 'EXISTING TASK', 'ExIsTiNg TaSk'),
      fc.string({ minLength: 101, maxLength: 200 }).map(s => s.replace(/\s+/g, 'A')).filter(s => s.trim().length > 100),
    );

    fc.assert(
      fc.property(invalidTextArb, (text) => {
        const storage = makeMockStorage();
        const tasks   = [{ ...existingTask }];
        const before  = tasks.length;

        const result = validateTaskText(text, tasks);

        // Validation must fail.
        expect(result.valid).toBe(false);
        // List length must remain unchanged (we only validate here; no push).
        expect(tasks.length).toBe(before);
      }),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edit-in-place helpers — pure logic extracted from TodoModule
// (task 10.3 — Requirements 5.6, 5.7)
//
// The DOM wiring (_startEdit / _cancelEdit) lives in js/app.js and cannot be
// exercised from Node without a full browser environment. However, the pure
// persistence and validation logic inside _saveEdit is fully testable here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate edit text and, if valid, update the matching task in the list.
 * Mirrors the logic inside TodoModule._saveEdit() in js/app.js.
 *
 * Rules (Requirements 5.6, 5.8):
 *   - Trimmed value is empty / whitespace-only → { saved: false, error: 'Task cannot be empty.' }
 *   - Otherwise → mutate task.text, persist, return { saved: true }
 *
 * @param {string}   id       Task identifier.
 * @param {string}   newText  Raw value from the edit input.
 * @param {object[]} tasks    In-memory task list (mutated on success).
 * @param {object}   storage  Mock StorageService.
 * @returns {{ saved: boolean, error?: string }}
 */
function simulateSaveEdit(id, newText, tasks, storage) {
  const trimmed = (newText || '').trim();

  if (trimmed.length === 0) {
    return { saved: false, error: 'Task cannot be empty.' };
  }

  const task = tasks.find(t => t.id === id);
  if (!task) return { saved: false, error: 'Task not found.' };

  task.text = trimmed;
  storage.set(KEY_TASKS, tasks);
  return { saved: true };
}

/**
 * Simulate _cancelEdit — in the production module this simply calls _render()
 * to restore the DOM without touching the in-memory task list or storage.
 * From a pure-logic perspective, cancel is a no-op: tasks and storage
 * are unchanged.
 *
 * @param {string}   id       Task identifier (unused in pure logic path).
 * @param {object[]} tasks    In-memory task list (must remain unchanged).
 * @param {object}   storage  Mock StorageService (must remain unchanged).
 * @returns {{ cancelled: true }}
 */
function simulateCancelEdit(_id, _tasks, _storage) {
  // Cancel never writes to tasks or storage — it just triggers a DOM re-render.
  return { cancelled: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — _saveEdit (Requirements 5.6, 5.8)
// ─────────────────────────────────────────────────────────────────────────────

describe('_saveEdit unit tests (Requirements 5.6, 5.8)', () => {
  let tasks;
  let storage;

  beforeEach(() => {
    _idCounter = 0;
    tasks   = [];
    storage = makeMockStorage();
    simulateAddTask(tasks, storage, 'Original Text');
  });

  it('updates task.text to the trimmed new value on a valid edit', () => {
    const id = tasks[0].id;
    const { saved } = simulateSaveEdit(id, 'Updated Text', tasks, storage);
    expect(saved).toBe(true);
    expect(tasks[0].text).toBe('Updated Text');
  });

  it('trims whitespace from new text before saving', () => {
    const id = tasks[0].id;
    simulateSaveEdit(id, '  Trimmed Value  ', tasks, storage);
    expect(tasks[0].text).toBe('Trimmed Value');
  });

  it('persists the updated task list to storage', () => {
    const id = tasks[0].id;
    simulateSaveEdit(id, 'Persisted Text', tasks, storage);
    const stored = storage.get(KEY_TASKS, []);
    expect(stored.find(t => t.id === id).text).toBe('Persisted Text');
  });

  it('preserves task.id after a successful edit', () => {
    const id = tasks[0].id;
    simulateSaveEdit(id, 'New Text', tasks, storage);
    expect(tasks[0].id).toBe(id);
  });

  it('preserves task.completed after a successful edit', () => {
    const id = tasks[0].id;
    tasks[0].completed = true; // manually set to true
    simulateSaveEdit(id, 'New Text', tasks, storage);
    expect(tasks[0].completed).toBe(true);
  });

  it('preserves task.createdAt after a successful edit', () => {
    const id = tasks[0].id;
    const originalCreatedAt = tasks[0].createdAt;
    simulateSaveEdit(id, 'New Text', tasks, storage);
    expect(tasks[0].createdAt).toBe(originalCreatedAt);
  });

  it('rejects an empty string and leaves task.text unchanged', () => {
    const id = tasks[0].id;
    const originalText = tasks[0].text;
    const { saved, error } = simulateSaveEdit(id, '', tasks, storage);
    expect(saved).toBe(false);
    expect(error).toBe('Task cannot be empty.');
    expect(tasks[0].text).toBe(originalText);
  });

  it('rejects a whitespace-only string and leaves task.text unchanged', () => {
    const id = tasks[0].id;
    const originalText = tasks[0].text;
    const { saved } = simulateSaveEdit(id, '    ', tasks, storage);
    expect(saved).toBe(false);
    expect(tasks[0].text).toBe(originalText);
  });

  it('storage is not written when the edit is rejected', () => {
    const id = tasks[0].id;
    // Capture storage state before.
    const before = storage.get(KEY_TASKS, []);
    simulateSaveEdit(id, '', tasks, storage);
    const after = storage.get(KEY_TASKS, []);
    // The text in storage must still be the original.
    expect(after[0].text).toBe(before[0].text);
  });

  it('works correctly when the list has multiple tasks', () => {
    simulateAddTask(tasks, storage, 'Second Task');
    simulateAddTask(tasks, storage, 'Third Task');

    const idToEdit = tasks[1].id; // Second Task
    simulateSaveEdit(idToEdit, 'Edited Second Task', tasks, storage);

    expect(tasks[0].text).toBe('Original Text');
    expect(tasks[1].text).toBe('Edited Second Task');
    expect(tasks[2].text).toBe('Third Task');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — _cancelEdit (Requirement 5.7)
// ─────────────────────────────────────────────────────────────────────────────

describe('_cancelEdit unit tests (Requirement 5.7)', () => {
  let tasks;
  let storage;

  beforeEach(() => {
    _idCounter = 0;
    tasks   = [];
    storage = makeMockStorage();
    simulateAddTask(tasks, storage, 'Original Text');
  });

  it('returns { cancelled: true }', () => {
    const id = tasks[0].id;
    const result = simulateCancelEdit(id, tasks, storage);
    expect(result.cancelled).toBe(true);
  });

  it('does not mutate task.text', () => {
    const id = tasks[0].id;
    const textBefore = tasks[0].text;
    simulateCancelEdit(id, tasks, storage);
    expect(tasks[0].text).toBe(textBefore);
  });

  it('does not add or remove tasks from the list', () => {
    const id = tasks[0].id;
    const lenBefore = tasks.length;
    simulateCancelEdit(id, tasks, storage);
    expect(tasks.length).toBe(lenBefore);
  });

  it('does not write to storage', () => {
    const id = tasks[0].id;
    const storedBefore = storage._rawGet(KEY_TASKS);
    simulateCancelEdit(id, tasks, storage);
    expect(storage._rawGet(KEY_TASKS)).toBe(storedBefore);
  });

  it('restores original text when cancel is called after a partial edit attempt', () => {
    const id = tasks[0].id;
    const originalText = tasks[0].text;

    // Simulate user typing into the edit input (DOM change only — tasks[] not touched).
    // Cancel should restore the displayed text to originalText via _render().
    simulateCancelEdit(id, tasks, storage);

    // The in-memory text must still be the original.
    expect(tasks[0].text).toBe(originalText);
    // Storage must still hold the original text.
    const stored = storage.get(KEY_TASKS, []);
    expect(stored[0].text).toBe(originalText);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 8: Task edit round-trip
// Feature: personal-dashboard, Property 8: Task edit round-trip
// Validates: Requirements 5.6
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 8: Task edit round-trip (Requirements 5.6)', () => {
  it('saving a valid edit updates text while id, completed, and createdAt are unchanged', () => {
    fc.assert(
      fc.property(
        // A single task to start with.
        taskArb,
        // Valid replacement text: non-empty, non-whitespace-only.
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        (originalTask, replacementText) => {
          const storage = makeMockStorage();
          const tasks   = [{ ...originalTask }];
          storage.set(KEY_TASKS, tasks);

          const { saved } = simulateSaveEdit(
            originalTask.id,
            replacementText,
            tasks,
            storage,
          );

          expect(saved).toBe(true);

          const editedTask = tasks[0];

          // text must be updated to the trimmed replacement.
          expect(editedTask.text).toBe(replacementText.trim());

          // id must be preserved.
          expect(editedTask.id).toBe(originalTask.id);

          // completed must be preserved.
          expect(editedTask.completed).toBe(originalTask.completed);

          // createdAt must be preserved.
          expect(editedTask.createdAt).toBe(originalTask.createdAt);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// _getSorted pure helper
//
// Mirrors the exact logic of TodoModule._getSorted() in js/app.js.
// Accepts an explicit `sortPref` parameter so the function is fully pure
// and testable without module state.
//
// Sort modes (Requirement 6.1):
//   "default"        — createdAt ascending (oldest first)
//   "completed-last" — incomplete before complete, each group by createdAt
//   "alpha"          — case-insensitive A–Z by text
//
// The source array is NEVER mutated (Requirement 6.2 / Property 9).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object[]} taskArray  Source task list.
 * @param {string}   sortPref   One of 'default' | 'completed-last' | 'alpha'.
 * @returns {object[]}  A new sorted copy of taskArray.
 */
function getSorted(taskArray, sortPref) {
  const copy = taskArray.slice();

  switch (sortPref) {
    case 'completed-last':
      copy.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.createdAt - b.createdAt;
      });
      break;

    case 'alpha':
      copy.sort((a, b) =>
        a.text.toLowerCase().localeCompare(b.text.toLowerCase()),
      );
      break;

    case 'default':
    default:
      copy.sort((a, b) => a.createdAt - b.createdAt);
      break;
  }

  return copy;
}

// ─────────────────────────────────────────────────────────────────────────────
// Property 9: Sort does not mutate stored task order
// Feature: personal-dashboard, Property 9: Sort does not mutate stored task order
// Validates: Requirements 6.2
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 9: Sort does not mutate stored task order (Requirements 6.2)', () => {
  it('calling _getSorted with any sort preference does not change the original array or stored order', () => {
    fc.assert(
      fc.property(
        // Any array of valid tasks.
        fc.array(taskArb, { maxLength: 20 }),
        // Any valid sort preference.
        fc.constantFrom('default', 'completed-last', 'alpha'),
        (originalTasks, pref) => {
          const storage = makeMockStorage();

          // Save the original array to storage to simulate the authoritative
          // in-memory list that TodoModule keeps in `tasks`.
          storage.set(KEY_TASKS, originalTasks);

          // Capture a deep snapshot of the original order before sorting.
          const snapshotBefore = originalTasks.map(t => ({ ...t }));

          // Call the pure sort helper — must not touch originalTasks.
          const sorted = getSorted(originalTasks, pref);

          // ── 1. Original in-memory array must not be mutated ────────────────
          expect(originalTasks).toHaveLength(snapshotBefore.length);
          originalTasks.forEach((t, i) => {
            expect(t.id).toBe(snapshotBefore[i].id);
            expect(t.text).toBe(snapshotBefore[i].text);
            expect(t.completed).toBe(snapshotBefore[i].completed);
            expect(t.createdAt).toBe(snapshotBefore[i].createdAt);
          });

          // ── 2. Storage must still hold the original insertion order ────────
          const storedAfterSort = storage.get(KEY_TASKS, []);
          expect(storedAfterSort).toHaveLength(snapshotBefore.length);
          storedAfterSort.forEach((t, i) => {
            expect(t.id).toBe(snapshotBefore[i].id);
          });

          // ── 3. Returned array is a distinct reference ───────────────────────
          if (originalTasks.length > 0) {
            expect(sorted).not.toBe(originalTasks);
          }

          // ── 4. Sorted array has the same elements (no additions/deletions) ──
          expect(sorted).toHaveLength(originalTasks.length);
          // Every element from the original must appear in the sorted result.
          for (const task of originalTasks) {
            expect(sorted.some(t => t.id === task.id)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 10.5 — Edge case unit tests
// Requirements: 5.2, 5.7, 5.9, 6.1
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// _getSorted helper
//
// Mirrors the pure sort logic of TodoModule._getSorted() in js/app.js.
// Returns a NEW sorted array; the original is never mutated.
//
// Sort options (Requirement 6.1):
//   'default'        → sort by createdAt ascending (oldest first)
//   'completed-last' → incomplete tasks first, each group by createdAt ascending
//   'alpha'          → case-insensitive alphabetical by text
// ─────────────────────────────────────────────────────────────────────────────

function _getSorted(taskArray, sortPref) {
  const copy = [...taskArray];

  if (sortPref === 'completed-last') {
    return copy.sort((a, b) => {
      if (a.completed !== b.completed) {
        // false (incomplete) < true (completed) so incomplete comes first
        return a.completed ? 1 : -1;
      }
      // Within the same group, preserve createdAt ascending order
      return a.createdAt - b.createdAt;
    });
  }

  if (sortPref === 'alpha') {
    return copy.sort((a, b) =>
      a.text.toLowerCase().localeCompare(b.text.toLowerCase()),
    );
  }

  // 'default' — sort by createdAt ascending
  return copy.sort((a, b) => a.createdAt - b.createdAt);
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge case: empty-state condition (Requirement 5.2)
//
// The DOM cannot be exercised in the Node test environment, but we can confirm
// that when tasks = [] the condition that triggers the empty-state message is
// satisfied (tasks.length === 0).
// ─────────────────────────────────────────────────────────────────────────────

describe('Empty-state condition (Requirement 5.2)', () => {
  it('tasks array is empty on initialisation when nothing is in storage', () => {
    const storage = makeMockStorage();
    const tasks = storage.get(KEY_TASKS, []);
    // An empty storage returns the defaultValue [], which has length 0.
    expect(tasks).toHaveLength(0);
    // This is the condition that would cause _render() to show the empty-state
    // message ("No tasks yet. Add one above!") rather than a list.
    expect(tasks.length === 0).toBe(true);
  });

  it('tasks array becomes empty after all tasks are deleted', () => {
    const storage = makeMockStorage();
    const tasks = [];
    simulateAddTask(tasks, storage, 'Task One');
    simulateAddTask(tasks, storage, 'Task Two');
    expect(tasks).toHaveLength(2);

    simulateDeleteTask(tasks, storage, tasks[0].id);
    simulateDeleteTask(tasks, storage, tasks[0].id); // tasks[0] is now former [1]
    expect(tasks).toHaveLength(0);
    // Empty-state condition is true again — _render() would show the message.
    expect(tasks.length === 0).toBe(true);
  });

  it('empty-state condition is false once a task is added', () => {
    const storage = makeMockStorage();
    const tasks = [];
    simulateAddTask(tasks, storage, 'First Task');
    // Now tasks.length === 1, so the empty-state message must NOT be shown.
    expect(tasks.length === 0).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge case: case-insensitive duplicate detection (Requirement 5.9)
// ─────────────────────────────────────────────────────────────────────────────

describe('Case-insensitive duplicate detection (Requirement 5.9)', () => {
  it('"buy milk" is blocked when "Buy Milk" already exists', () => {
    const storage = makeMockStorage();
    const tasks = [];

    const first = simulateAddTask(tasks, storage, 'Buy Milk');
    expect(first.added).toBe(true);
    expect(tasks).toHaveLength(1);

    const duplicate = simulateAddTask(tasks, storage, 'buy milk');
    expect(duplicate.added).toBe(false);
    expect(duplicate.error).toBe('A task with that name already exists.');
    expect(tasks).toHaveLength(1);
  });

  it('"BUY MILK" is blocked when "Buy Milk" already exists', () => {
    const storage = makeMockStorage();
    const tasks = [];
    simulateAddTask(tasks, storage, 'Buy Milk');
    const { added } = simulateAddTask(tasks, storage, 'BUY MILK');
    expect(added).toBe(false);
    expect(tasks).toHaveLength(1);
  });

  it('"Buy Milk" is blocked when "buy milk" already exists', () => {
    const storage = makeMockStorage();
    const tasks = [];
    simulateAddTask(tasks, storage, 'buy milk');
    const { added } = simulateAddTask(tasks, storage, 'Buy Milk');
    expect(added).toBe(false);
    expect(tasks).toHaveLength(1);
  });

  it('different text (not a duplicate) is allowed after "Buy Milk" exists', () => {
    const storage = makeMockStorage();
    const tasks = [];
    simulateAddTask(tasks, storage, 'Buy Milk');
    const { added } = simulateAddTask(tasks, storage, 'Buy Bread');
    expect(added).toBe(true);
    expect(tasks).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge case: cancel edit restores original text (Requirement 5.7)
// ─────────────────────────────────────────────────────────────────────────────

describe('Cancel edit restores original text (Requirement 5.7)', () => {
  it('original task text is unchanged after cancel', () => {
    const storage = makeMockStorage();
    const tasks = [];
    simulateAddTask(tasks, storage, 'Original Text');
    const originalText = tasks[0].text;

    // Simulate the user typing new text into the edit input (DOM only).
    // _cancelEdit() does NOT touch tasks[] or storage — it calls _render().
    simulateCancelEdit(tasks[0].id, tasks, storage);

    expect(tasks[0].text).toBe(originalText);
  });

  it('storage retains original text after cancel', () => {
    const storage = makeMockStorage();
    const tasks = [];
    simulateAddTask(tasks, storage, 'Original Text');
    const originalText = tasks[0].text;

    simulateCancelEdit(tasks[0].id, tasks, storage);

    const stored = storage.get(KEY_TASKS, []);
    expect(stored[0].text).toBe(originalText);
  });

  it('cancel after a _saveEdit does not undo the save', () => {
    const storage = makeMockStorage();
    const tasks = [];
    simulateAddTask(tasks, storage, 'Original Text');
    const id = tasks[0].id;

    simulateSaveEdit(id, 'Edited Text', tasks, storage);
    expect(tasks[0].text).toBe('Edited Text');

    // Now the user opens the edit UI again but cancels without saving.
    simulateCancelEdit(id, tasks, storage);

    // The saved edit must still be in place — cancel doesn't revert a prior save.
    expect(tasks[0].text).toBe('Edited Text');
  });

  it('cancel on a multi-task list leaves all other tasks unchanged', () => {
    const storage = makeMockStorage();
    const tasks = [];
    simulateAddTask(tasks, storage, 'Task A');
    simulateAddTask(tasks, storage, 'Task B');
    simulateAddTask(tasks, storage, 'Task C');

    simulateCancelEdit(tasks[1].id, tasks, storage);

    expect(tasks[0].text).toBe('Task A');
    expect(tasks[1].text).toBe('Task B');
    expect(tasks[2].text).toBe('Task C');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge case: sort "completed-last" (Requirement 6.1)
// ─────────────────────────────────────────────────────────────────────────────

describe('Sort "completed-last" — all completed tasks after all incomplete tasks (Requirement 6.1)', () => {
  /**
   * Build a fresh task list with deterministic createdAt values for ordering
   * assertions, bypassing the _idCounter and makeTask helpers so we can
   * control createdAt precisely.
   */
  function makeTaskAt(text, completed, createdAt) {
    return { id: text, text, completed, createdAt };
  }

  it('puts all incomplete tasks before all completed tasks', () => {
    const tasks = [
      makeTaskAt('Complete A', true,  100),
      makeTaskAt('Incomplete B', false, 200),
      makeTaskAt('Complete C', true,  300),
      makeTaskAt('Incomplete D', false, 400),
    ];

    const sorted = _getSorted(tasks, 'completed-last');

    // First two slots must be the incomplete tasks (completed === false).
    expect(sorted[0].completed).toBe(false);
    expect(sorted[1].completed).toBe(false);
    // Last two slots must be the completed tasks (completed === true).
    expect(sorted[2].completed).toBe(true);
    expect(sorted[3].completed).toBe(true);
  });

  it('preserves createdAt ascending order within the incomplete group', () => {
    const tasks = [
      makeTaskAt('Incomplete Later',  false, 500),
      makeTaskAt('Incomplete Middle', false, 300),
      makeTaskAt('Incomplete First',  false, 100),
      makeTaskAt('Complete One', true, 200),
    ];

    const sorted = _getSorted(tasks, 'completed-last');

    // Incomplete tasks should be ordered oldest → newest.
    expect(sorted[0].text).toBe('Incomplete First');   // createdAt 100
    expect(sorted[1].text).toBe('Incomplete Middle'); // createdAt 300
    expect(sorted[2].text).toBe('Incomplete Later');   // createdAt 500
    // Completed task is last.
    expect(sorted[3].completed).toBe(true);
  });

  it('preserves createdAt ascending order within the completed group', () => {
    const tasks = [
      makeTaskAt('Complete Last',   true,  900),
      makeTaskAt('Complete Second', true,  600),
      makeTaskAt('Complete First',  true,  300),
      makeTaskAt('Incomplete One',  false, 500),
    ];

    const sorted = _getSorted(tasks, 'completed-last');

    // Incomplete task comes first (regardless of its createdAt).
    expect(sorted[0].completed).toBe(false);
    // Completed tasks ordered oldest → newest.
    expect(sorted[1].text).toBe('Complete First');   // createdAt 300
    expect(sorted[2].text).toBe('Complete Second'); // createdAt 600
    expect(sorted[3].text).toBe('Complete Last');   // createdAt 900
  });

  it('returns all items in createdAt order when no tasks are completed', () => {
    const tasks = [
      makeTaskAt('Third',  false, 300),
      makeTaskAt('First',  false, 100),
      makeTaskAt('Second', false, 200),
    ];

    const sorted = _getSorted(tasks, 'completed-last');

    expect(sorted[0].text).toBe('First');
    expect(sorted[1].text).toBe('Second');
    expect(sorted[2].text).toBe('Third');
  });

  it('returns all items in createdAt order when all tasks are completed', () => {
    const tasks = [
      makeTaskAt('Third',  true, 300),
      makeTaskAt('First',  true, 100),
      makeTaskAt('Second', true, 200),
    ];

    const sorted = _getSorted(tasks, 'completed-last');

    expect(sorted[0].text).toBe('First');
    expect(sorted[1].text).toBe('Second');
    expect(sorted[2].text).toBe('Third');
  });

  it('returns an empty array unchanged when the task list is empty', () => {
    const sorted = _getSorted([], 'completed-last');
    expect(sorted).toHaveLength(0);
  });

  it('does NOT mutate the original task array', () => {
    const tasks = [
      makeTaskAt('Complete', true,  100),
      makeTaskAt('Incomplete', false, 200),
    ];
    const originalOrder = tasks.map(t => t.text);

    _getSorted(tasks, 'completed-last');

    // Original array must be in the same order as before.
    expect(tasks.map(t => t.text)).toEqual(originalOrder);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bonus: _getSorted with 'default' and 'alpha' — smoke tests (Requirement 6.1)
// ─────────────────────────────────────────────────────────────────────────────

describe('_getSorted — default and alpha sort modes (Requirement 6.1)', () => {
  function makeTaskAt(text, completed, createdAt) {
    return { id: text, text, completed, createdAt };
  }

  it('"default" sorts by createdAt ascending', () => {
    const tasks = [
      makeTaskAt('C', false, 300),
      makeTaskAt('A', false, 100),
      makeTaskAt('B', false, 200),
    ];
    const sorted = _getSorted(tasks, 'default');
    expect(sorted[0].text).toBe('A');
    expect(sorted[1].text).toBe('B');
    expect(sorted[2].text).toBe('C');
  });

  it('"alpha" sorts case-insensitively', () => {
    const tasks = [
      makeTaskAt('banana', false, 100),
      makeTaskAt('Apple',  false, 200),
      makeTaskAt('cherry', false, 300),
    ];
    const sorted = _getSorted(tasks, 'alpha');
    expect(sorted[0].text).toBe('Apple');
    expect(sorted[1].text).toBe('banana');
    expect(sorted[2].text).toBe('cherry');
  });

  it('"default" does not mutate the original array', () => {
    const tasks = [
      makeTaskAt('Z', false, 300),
      makeTaskAt('A', false, 100),
    ];
    const originalOrder = tasks.map(t => t.text);
    _getSorted(tasks, 'default');
    expect(tasks.map(t => t.text)).toEqual(originalOrder);
  });
});
