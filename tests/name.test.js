// Feature: personal-dashboard
// Property-based tests for NameController name validation (Properties 2 and 3).
// Requirements: 2.5, 2.6

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ─────────────────────────────────────────────────────────────────────────────
// validateName — pure function extracted from NameController._handleSave()
//
// The production version lives inside the NameController IIFE in js/app.js
// (a browser IIFE with no module exports). This pure function mirrors the
// exact validation logic so property tests can run in a Node.js/Vitest env.
//
// Validation rules (Requirements 2.5, 2.6):
//   - Empty or whitespace-only → { valid: false, error: "Name cannot be empty" }
//   - Trimmed length > 50     → { valid: false, error: "Name must be 50 characters or fewer" }
//   - Otherwise               → { valid: true, value: trimmedName }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a raw name string according to the NameController rules.
 *
 * @param {string} raw  Raw string from the name input field.
 * @returns {{ valid: true, value: string } | { valid: false, error: string }}
 */
function validateName(raw) {
  const trimmedName = raw.trim();

  // Empty or whitespace-only
  if (trimmedName.length === 0) {
    return { valid: false, error: 'Name cannot be empty' };
  }

  // Exceeds 50-character limit (after trim)
  if (trimmedName.length > 50) {
    return { valid: false, error: 'Name must be 50 characters or fewer' };
  }

  // Valid name
  return { valid: true, value: trimmedName };
}

// ─────────────────────────────────────────────────────────────────────────────
// StorageService mock
//
// A minimal in-memory stand-in for StorageService so tests can assert that
// `StorageService.get(KEY_NAME)` returns the expected value after a valid
// save, and that storage remains unchanged after a rejected name.
// ─────────────────────────────────────────────────────────────────────────────

const KEY_NAME = 'pd_name';

function makeMockStorage() {
  const store = new Map();
  return {
    get(key, defaultValue = null) {
      if (!store.has(key)) return defaultValue;
      try {
        return JSON.parse(store.get(key));
      } catch (_e) {
        return defaultValue;
      }
    },
    set(key, value) {
      store.set(key, JSON.stringify(value));
    },
    remove(key) {
      store.delete(key);
    },
    // Helper: read raw stored string (bypasses JSON so tests can inspect it).
    _rawGet(key) {
      return store.has(key) ? store.get(key) : null;
    },
  };
}

/**
 * Simulate the full save flow: validate then persist if valid.
 * Returns the validation result so callers can inspect it.
 *
 * @param {object} storage   Mock StorageService instance.
 * @param {string} raw       Raw input string.
 * @returns {{ valid: true, value: string } | { valid: false, error: string }}
 */
function simulateSave(storage, raw) {
  const result = validateName(raw);
  if (result.valid) {
    storage.set(KEY_NAME, result.value);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Property 2: Custom name round-trip
// Feature: personal-dashboard, Property 2: Custom name round-trip
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 2: Custom name round-trip', () => {
  // Each property run gets a fresh storage instance so runs are independent.
  let storage;

  beforeEach(() => {
    storage = makeMockStorage();
  });

  it(
    'validation accepts any valid name and storage returns the trimmed input',
    () => {
      // Generator: non-empty strings up to 50 chars that are not whitespace-only.
      // This matches the design spec arbitrary:
      //   fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
          (name) => {
            // Fresh storage per sample so each run is independent.
            const s = makeMockStorage();

            const result = simulateSave(s, name);

            // The validation must accept the input.
            expect(result.valid).toBe(true);

            // Storage must contain the trimmed version of the input.
            expect(s.get(KEY_NAME)).toBe(name.trim());
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 3: Name validation rejects invalid inputs
// Feature: personal-dashboard, Property 3: Name validation rejects invalid inputs
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 3: Name validation rejects invalid inputs', () => {
  it(
    'rejects empty strings and leaves storage unchanged',
    () => {
      fc.assert(
        fc.property(
          fc.constant(''),
          (name) => {
            const s = makeMockStorage();
            const before = s._rawGet(KEY_NAME);

            const result = simulateSave(s, name);

            // Validation must fail.
            expect(result.valid).toBe(false);

            // Storage must remain unchanged.
            expect(s._rawGet(KEY_NAME)).toBe(before);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'rejects whitespace-only strings and leaves storage unchanged',
    () => {
      // Generator: strings of length ≥ 1 that trim to empty.
      const whitespaceOnlyArb = fc
        .string({ minLength: 1, maxLength: 60 })
        .filter((s) => s.trim().length === 0);

      fc.assert(
        fc.property(whitespaceOnlyArb, (name) => {
          const s = makeMockStorage();
          const before = s._rawGet(KEY_NAME);

          const result = simulateSave(s, name);

          // Validation must fail.
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Name cannot be empty');

          // Storage must remain unchanged.
          expect(s._rawGet(KEY_NAME)).toBe(before);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'rejects strings longer than 50 characters (after trim) and leaves storage unchanged',
    () => {
      // Generator: strings whose trimmed length exceeds 50.
      // We use minLength: 51 on a non-whitespace string to ensure trim() can't
      // reduce it to ≤ 50. Prepend and append non-space chars to make sure.
      const tooLongArb = fc
        .string({ minLength: 51, maxLength: 200 })
        .map((s) => 'A' + s.replace(/\s+/g, 'X') + 'Z')
        .filter((s) => s.trim().length > 50);

      fc.assert(
        fc.property(tooLongArb, (name) => {
          const s = makeMockStorage();
          const before = s._rawGet(KEY_NAME);

          const result = simulateSave(s, name);

          // Validation must fail.
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Name must be 50 characters or fewer');

          // Storage must remain unchanged.
          expect(s._rawGet(KEY_NAME)).toBe(before);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'rejects all three invalid categories (empty, whitespace-only, too-long) in one property',
    () => {
      // Combined generator matching the design spec:
      //   fc.oneof(fc.constant(''), whitespaceOnlyArb, fc.string({ minLength: 51 }))
      const invalidNameArb = fc.oneof(
        // Empty string
        fc.constant(''),
        // Whitespace-only
        fc.string({ minLength: 1, maxLength: 60 }).filter((s) => s.trim().length === 0),
        // Too long after trim (guaranteed > 50 non-whitespace chars)
        fc
          .string({ minLength: 51, maxLength: 200 })
          .map((s) => 'A' + s.replace(/\s+/g, 'X') + 'Z')
          .filter((s) => s.trim().length > 50),
      );

      fc.assert(
        fc.property(invalidNameArb, (name) => {
          const s = makeMockStorage();
          const before = s._rawGet(KEY_NAME);

          const result = simulateSave(s, name);

          // Validation must always fail for these inputs.
          expect(result.valid).toBe(false);

          // The error must be one of the two known messages.
          const validErrors = [
            'Name cannot be empty',
            'Name must be 50 characters or fewer',
          ];
          expect(validErrors).toContain(result.error);

          // Storage must remain unchanged.
          expect(s._rawGet(KEY_NAME)).toBe(before);
        }),
        { numRuns: 100 },
      );
    },
  );
});
