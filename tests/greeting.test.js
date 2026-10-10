// Feature: personal-dashboard, Property 1: Greeting text covers all hours without gaps or overlaps
// Requirements: 1.3, 1.4, 1.5, 1.6

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─────────────────────────────────────────────────────────────────────────────
// _getGreeting — reimplemented here for Node.js/Vitest environment
//
// The production version lives inside the GreetingWidget IIFE in js/app.js
// (a browser script with no module exports). This copy mirrors it exactly:
//
//   05–11 → "Good Morning"    (Requirement 1.3)
//   12–17 → "Good Afternoon"  (Requirement 1.4)
//   18–21 → "Good Evening"    (Requirement 1.5)
//   22–23, 0–4 → "Good Night" (Requirement 1.6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the appropriate greeting string for a given 24-hour hour value.
 *
 * @param {number} hour  Integer 0–23.
 * @returns {string}
 */
function _getGreeting(hour) {
  if (hour >= 5 && hour <= 11) return 'Good Morning';
  if (hour >= 12 && hour <= 17) return 'Good Afternoon';
  if (hour >= 18 && hour <= 21) return 'Good Evening';
  return 'Good Night'; // covers 22–23 and 0–4
}

// ─────────────────────────────────────────────────────────────────────────────
// Property 1: Greeting covers all hours without gaps or overlaps
// ─────────────────────────────────────────────────────────────────────────────

const VALID_GREETINGS = new Set([
  'Good Morning',
  'Good Afternoon',
  'Good Evening',
  'Good Night',
]);

// Feature: personal-dashboard, Property 1: Greeting text covers all hours without gaps or overlaps
describe('Property 1: Greeting covers all hours without gaps or overlaps', () => {
  it('returns exactly one valid greeting string for every hour 0–23', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 23 }), (hour) => {
        const result = _getGreeting(hour);

        // Must not be null or undefined
        expect(result).not.toBeNull();
        expect(result).not.toBeUndefined();

        // Must be exactly one of the four valid greeting strings
        expect(VALID_GREETINGS.has(result)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // ── Boundary verification — one example per boundary hour ─────────────────

  it('returns "Good Morning" for hours 5–11', () => {
    for (let h = 5; h <= 11; h++) {
      expect(_getGreeting(h)).toBe('Good Morning');
    }
  });

  it('returns "Good Afternoon" for hours 12–17', () => {
    for (let h = 12; h <= 17; h++) {
      expect(_getGreeting(h)).toBe('Good Afternoon');
    }
  });

  it('returns "Good Evening" for hours 18–21', () => {
    for (let h = 18; h <= 21; h++) {
      expect(_getGreeting(h)).toBe('Good Evening');
    }
  });

  it('returns "Good Night" for hours 22–23 and 0–4', () => {
    for (const h of [22, 23, 0, 1, 2, 3, 4]) {
      expect(_getGreeting(h)).toBe('Good Night');
    }
  });
});
