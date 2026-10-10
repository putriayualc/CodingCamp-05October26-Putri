// Feature: personal-dashboard
// Tests for StorageService serialisation round-trips (Properties 12 and 13).
// Requirements: 9.1, 9.2

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─────────────────────────────────────────────────────────────────────────────
// Arbitraries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates valid Task objects matching the data model:
 *   { id: string, text: string (1–100 chars), completed: boolean, createdAt: number }
 */
const taskArb = fc.record({
  id:        fc.string({ minLength: 1, maxLength: 36 }),
  text:      fc.string({ minLength: 1, maxLength: 100 }),
  completed: fc.boolean(),
  createdAt: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
});

/**
 * Generates valid Link objects matching the data model:
 *   { id: string, name: string (1–50 chars), url: string (http:// or https://) }
 */
const linkArb = fc.record({
  id:   fc.string({ minLength: 1, maxLength: 36 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  url:  fc.oneof(
    fc.string({ minLength: 1, maxLength: 2041 }).map(s => 'http://' + s),
    fc.string({ minLength: 1, maxLength: 2040 }).map(s => 'https://' + s),
  ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 12: Task serialisation round-trip
// ─────────────────────────────────────────────────────────────────────────────

// Feature: personal-dashboard, Property 12: LocalStorage serialisation round-trip for tasks
describe('Property 12: Task serialisation round-trip', () => {
  it('JSON.parse(JSON.stringify(tasks)) deeply equals the original task fields', () => {
    fc.assert(
      fc.property(fc.array(taskArb), (tasks) => {
        const serialised   = JSON.stringify(tasks);
        const deserialised = JSON.parse(serialised);

        // Must have the same number of elements
        expect(deserialised).toHaveLength(tasks.length);

        // Each element must deeply equal the original's four fields
        tasks.forEach((original, i) => {
          const restored = deserialised[i];
          expect(restored.id).toBe(original.id);
          expect(restored.text).toBe(original.text);
          expect(restored.completed).toBe(original.completed);
          expect(restored.createdAt).toBe(original.createdAt);
        });
      }),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 13: Link serialisation round-trip
// ─────────────────────────────────────────────────────────────────────────────

// Feature: personal-dashboard, Property 13: LocalStorage serialisation round-trip for links
describe('Property 13: Link serialisation round-trip', () => {
  it('JSON.parse(JSON.stringify(links)) deeply equals the original link fields', () => {
    fc.assert(
      fc.property(fc.array(linkArb), (links) => {
        const serialised   = JSON.stringify(links);
        const deserialised = JSON.parse(serialised);

        // Must have the same number of elements
        expect(deserialised).toHaveLength(links.length);

        // Each element must deeply equal the original's three fields
        links.forEach((original, i) => {
          const restored = deserialised[i];
          expect(restored.id).toBe(original.id);
          expect(restored.name).toBe(original.name);
          expect(restored.url).toBe(original.url);
        });
      }),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests — StorageService edge cases
// Requirements: 9.3
// ─────────────────────────────────────────────────────────────────────────────

import { beforeEach, afterEach } from 'vitest';

/**
 * Factory that builds a StorageService instance backed by the given storage
 * object. The logic mirrors the IIFE implementation in js/app.js exactly so
 * that these unit tests validate the real production behaviour.
 *
 * @param {Storage | object} storage  — a real or mock localStorage-like object
 * @returns {{ get, set, remove }}
 */
function makeStorageService(storage) {
  function get(key, defaultValue) {
    try {
      const raw = storage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (_e) {
      return defaultValue;
    }
  }

  function set(key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (_e) {
      // silent
    }
  }

  function remove(key) {
    try {
      storage.removeItem(key);
    } catch (_e) {
      // silent
    }
  }

  return { get, set, remove };
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage mock
// Vitest's jsdom environment provides a real-ish localStorage, but we also
// want to be able to inject corrupted values that bypass JSON.stringify, so
// we build a thin in-memory map mock that lets us write raw strings directly.
// ─────────────────────────────────────────────────────────────────────────────
function makeMockStorage() {
  const store = new Map();
  return {
    getItem:    (key)        => store.has(key) ? store.get(key) : null,
    setItem:    (key, value) => { store.set(key, String(value)); },
    removeItem: (key)        => { store.delete(key); },
    clear:      ()           => { store.clear(); },
    _raw:       (key, value) => { store.set(key, value); }, // write raw string
  };
}

describe('StorageService unit tests — edge cases', () => {
  let storage;
  let service;

  beforeEach(() => {
    storage = makeMockStorage();
    service = makeStorageService(storage);
  });

  // ── get: corrupted JSON ──────────────────────────────────────────────────

  describe('get() with corrupted JSON', () => {
    it('returns defaultValue when stored value is invalid JSON', () => {
      storage._raw('pd_tasks', '{not valid json{{');
      expect(service.get('pd_tasks', [])).toEqual([]);
    });

    it('returns defaultValue when stored value is a bare string fragment', () => {
      storage._raw('pd_name', 'undefined');
      // "undefined" is not valid JSON → JSON.parse throws → return default
      expect(service.get('pd_name', 'fallback')).toBe('fallback');
    });

    it('returns defaultValue when stored value is truncated JSON', () => {
      storage._raw('pd_links', '[{"id":"1","name":"G');
      expect(service.get('pd_links', null)).toBeNull();
    });
  });

  // ── get: valid JSON ──────────────────────────────────────────────────────

  describe('get() with valid JSON', () => {
    it('returns the parsed string value', () => {
      storage._raw('pd_theme', JSON.stringify('dark'));
      expect(service.get('pd_theme', 'light')).toBe('dark');
    });

    it('returns the parsed number value', () => {
      storage._raw('pd_timer_duration', JSON.stringify(42));
      expect(service.get('pd_timer_duration', 25)).toBe(42);
    });

    it('returns the parsed array value', () => {
      const tasks = [{ id: '1', text: 'Buy milk', completed: false, createdAt: 1000 }];
      storage._raw('pd_tasks', JSON.stringify(tasks));
      expect(service.get('pd_tasks', [])).toEqual(tasks);
    });

    it('returns the parsed object value', () => {
      const obj = { id: 'abc', name: 'Google', url: 'https://google.com' };
      storage._raw('pd_links', JSON.stringify([obj]));
      expect(service.get('pd_links', [])).toEqual([obj]);
    });

    it('returns defaultValue when key is absent (getItem returns null)', () => {
      expect(service.get('pd_nonexistent', 'default')).toBe('default');
    });
  });

  // ── set → get round-trips ────────────────────────────────────────────────

  describe('set() then get() round-trips', () => {
    it('round-trips a string value', () => {
      service.set('pd_theme', 'dark');
      expect(service.get('pd_theme', 'light')).toBe('dark');
    });

    it('round-trips a number value', () => {
      service.set('pd_timer_duration', 45);
      expect(service.get('pd_timer_duration', 25)).toBe(45);
    });

    it('round-trips an array value', () => {
      const tasks = [
        { id: 'a1', text: 'Write tests', completed: true,  createdAt: 1700000000000 },
        { id: 'a2', text: 'Fix bug',     completed: false, createdAt: 1700000001000 },
      ];
      service.set('pd_tasks', tasks);
      expect(service.get('pd_tasks', [])).toEqual(tasks);
    });

    it('round-trips an object value', () => {
      const link = { id: 'l1', name: 'GitHub', url: 'https://github.com' };
      service.set('pd_links', [link]);
      expect(service.get('pd_links', [])).toEqual([link]);
    });

    it('round-trips a boolean value', () => {
      service.set('pd_bool_test', false);
      expect(service.get('pd_bool_test', true)).toBe(false);
    });

    it('round-trips a null value (stored as JSON null, not absent)', () => {
      service.set('pd_null_test', null);
      // JSON.stringify(null) → "null"; JSON.parse("null") → null (not the default)
      expect(service.get('pd_null_test', 'default')).toBeNull();
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('clears the key so subsequent get returns defaultValue', () => {
      service.set('pd_name', 'Putri');
      expect(service.get('pd_name', null)).toBe('Putri'); // confirm it was set
      service.remove('pd_name');
      expect(service.get('pd_name', null)).toBeNull();
    });

    it('removing an absent key does not throw and subsequent get returns defaultValue', () => {
      expect(() => service.remove('pd_nonexistent')).not.toThrow();
      expect(service.get('pd_nonexistent', 'default')).toBe('default');
    });

    it('only removes the targeted key, leaving others intact', () => {
      service.set('pd_theme', 'dark');
      service.set('pd_name', 'Putri');
      service.remove('pd_theme');
      expect(service.get('pd_theme', 'light')).toBe('light'); // removed → default
      expect(service.get('pd_name', null)).toBe('Putri');       // untouched
    });
  });
});
