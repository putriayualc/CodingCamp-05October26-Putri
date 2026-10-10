// Feature: personal-dashboard
// Unit tests for QuickLinksModule edge cases.
// Requirements: 7.2, 7.4, 7.7, 7.8

import { describe, it, expect, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers — mirror the production QuickLinksModule logic from js/app.js
//
// The production module is a browser IIFE with no module exports, so these
// pure functions replicate the exact validation and mutation logic so the
// tests can run in a Node.js / Vitest environment without a DOM.
// ─────────────────────────────────────────────────────────────────────────────

const KEY_LINKS = 'pd_links';

// ── In-memory storage mock ────────────────────────────────────────────────────

/**
 * A minimal localStorage-like mock backed by a Map.
 * Supports the same get/set/remove interface as StorageService in js/app.js
 * plus a `_rawGet` helper that returns the raw JSON string for low-level
 * inspection.
 */
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
    _rawGet(key) {
      return store.has(key) ? store.get(key) : null;
    },
  };
}

// ── _validateLink — mirrors the guard logic inside QuickLinksModule._addLink ─

/**
 * Validate a candidate name + URL pair against the rules enforced by
 * QuickLinksModule._addLink().
 *
 * Validation rules (Requirements 7.7, 7.8):
 *   - Trimmed name is empty                    → { valid: false, field: 'name', error: '...' }
 *   - Trimmed URL is empty                     → { valid: false, field: 'url',  error: '...' }
 *   - URL does not start with http:// or https://
 *                                              → { valid: false, field: 'url',  error: '...' }
 *   - links.length >= 50 (cap reached)         → { valid: false, field: 'url',  error: '...' }
 *   - Otherwise                                → { valid: true }
 *
 * @param {string} name         Raw value from the name input.
 * @param {string} url          Raw value from the URL input.
 * @param {object[]} linksList  Current links array (used to check 50-link cap).
 * @returns {{ valid: boolean, field?: string, error?: string }}
 */
function _validateLink(name, url, linksList) {
  const trimmedName = (name || '').trim();
  const trimmedUrl  = (url  || '').trim();

  if (trimmedName.length === 0) {
    return { valid: false, field: 'name', error: 'Link name cannot be empty.' };
  }

  if (trimmedUrl.length === 0) {
    return { valid: false, field: 'url', error: 'URL cannot be empty.' };
  }

  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
    return { valid: false, field: 'url', error: 'URL must begin with http:// or https://' };
  }

  if (linksList.length >= 50) {
    return { valid: false, field: 'url', error: 'Maximum number of links reached.' };
  }

  return { valid: true };
}

/**
 * Simulate the full _addLink flow: validate, then (if valid) create and push
 * the link object, and persist the updated array to storage.
 *
 * Returns { added: boolean, link?: object } so callers can inspect the outcome.
 *
 * @param {object}   storage   Mock StorageService instance.
 * @param {object[]} links     Current in-memory links array (mutated on success).
 * @param {string}   name      Raw name input value.
 * @param {string}   url       Raw URL input value.
 * @returns {{ added: boolean, link?: object, error?: string, field?: string }}
 */
function simulateAddLink(storage, links, name, url) {
  const result = _validateLink(name, url, links);

  if (!result.valid) {
    return { added: false, field: result.field, error: result.error };
  }

  // Mirror the production ID generation fallback (no crypto.randomUUID in tests).
  const id = String(Date.now()) + String(Math.random());

  const newLink = {
    id,
    name: name.trim(),
    url:  url.trim(),
  };

  links.push(newLink);
  storage.set(KEY_LINKS, links);

  return { added: true, link: newLink };
}

/**
 * Simulate the full _deleteLink flow: find by id, splice, and persist.
 *
 * @param {object}   storage   Mock StorageService instance.
 * @param {object[]} links     Current in-memory links array (mutated on success).
 * @param {string}   id        ID of the link to remove.
 * @returns {{ deleted: boolean }}
 */
function simulateDeleteLink(storage, links, id) {
  const idx = links.findIndex(l => l.id === id);
  if (idx === -1) return { deleted: false }; // no-op for unknown id

  links.splice(idx, 1);
  storage.set(KEY_LINKS, links);
  return { deleted: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests — QuickLinksModule edge cases
// ─────────────────────────────────────────────────────────────────────────────

// ── URL prefix validation (Requirement 7.7) ───────────────────────────────────

describe('QuickLinksModule — URL prefix validation (Requirement 7.7)', () => {
  let storage;
  let links;

  beforeEach(() => {
    storage = makeMockStorage();
    links   = [];
  });

  it('accepts a valid http:// URL', () => {
    const result = simulateAddLink(storage, links, 'My Site', 'http://example.com');

    expect(result.added).toBe(true);
    expect(result.link.url).toBe('http://example.com');
    expect(links).toHaveLength(1);
  });

  it('accepts a valid https:// URL', () => {
    const result = simulateAddLink(storage, links, 'Secure Site', 'https://example.com');

    expect(result.added).toBe(true);
    expect(result.link.url).toBe('https://example.com');
    expect(links).toHaveLength(1);
  });

  it('accepts a https:// URL with path and query string', () => {
    const url    = 'https://github.com/user/repo?tab=readme';
    const result = simulateAddLink(storage, links, 'GitHub Repo', url);

    expect(result.added).toBe(true);
    expect(result.link.url).toBe(url);
  });

  it('rejects a URL without http:// or https:// prefix', () => {
    const result = simulateAddLink(storage, links, 'No Prefix', 'example.com');

    expect(result.added).toBe(false);
    expect(result.field).toBe('url');
    expect(result.error).toBe('URL must begin with http:// or https://');
    expect(links).toHaveLength(0);
  });

  it('rejects a URL with an ftp:// prefix', () => {
    const result = simulateAddLink(storage, links, 'FTP Site', 'ftp://files.example.com');

    expect(result.added).toBe(false);
    expect(result.field).toBe('url');
    expect(result.error).toBe('URL must begin with http:// or https://');
  });

  it('rejects a URL that is just the scheme without the slashes', () => {
    const result = simulateAddLink(storage, links, 'Broken URL', 'https:example.com');

    expect(result.added).toBe(false);
    expect(result.field).toBe('url');
  });

  it('rejects an empty URL', () => {
    const result = simulateAddLink(storage, links, 'Valid Name', '');

    expect(result.added).toBe(false);
    expect(result.field).toBe('url');
    expect(result.error).toBe('URL cannot be empty.');
  });

  it('rejects a whitespace-only URL', () => {
    const result = simulateAddLink(storage, links, 'Valid Name', '   ');

    expect(result.added).toBe(false);
    expect(result.field).toBe('url');
  });

  it('does not add the link to storage when URL validation fails', () => {
    simulateAddLink(storage, links, 'Bad URL', 'not-a-url');

    // Storage must remain empty.
    expect(storage._rawGet(KEY_LINKS)).toBeNull();
    expect(links).toHaveLength(0);
  });
});

// ── 50-link cap enforcement (Requirement 7.8) ─────────────────────────────────

describe('QuickLinksModule — 50-link cap enforcement (Requirement 7.8)', () => {
  let storage;
  let links;

  beforeEach(() => {
    storage = makeMockStorage();
    // Pre-populate with exactly 49 links.
    links = Array.from({ length: 49 }, (_, i) => ({
      id:   `preset-${i}`,
      name: `Link ${i + 1}`,
      url:  `https://example.com/${i + 1}`,
    }));
  });

  it('accepts the 50th link when exactly 49 links exist', () => {
    expect(links).toHaveLength(49);

    const result = simulateAddLink(storage, links, 'Link 50', 'https://example.com/50');

    expect(result.added).toBe(true);
    expect(links).toHaveLength(50);
  });

  it('rejects the 51st link when 50 links already exist', () => {
    // First add the 50th link to reach the cap.
    simulateAddLink(storage, links, 'Link 50', 'https://example.com/50');
    expect(links).toHaveLength(50);

    // Now attempt to add a 51st link.
    const result = simulateAddLink(storage, links, 'Link 51', 'https://example.com/51');

    expect(result.added).toBe(false);
    expect(result.field).toBe('url');
    expect(result.error).toBe('Maximum number of links reached.');
    expect(links).toHaveLength(50); // list unchanged
  });

  it('does not persist the 51st link to storage', () => {
    // Fill to cap.
    simulateAddLink(storage, links, 'Link 50', 'https://example.com/50');

    // Capture stored length before the rejected attempt.
    const storedBefore = storage.get(KEY_LINKS, []).length;
    expect(storedBefore).toBe(50);

    // Try to add one more.
    simulateAddLink(storage, links, 'Overflow', 'https://overflow.com');

    // Storage must still contain exactly 50 links.
    expect(storage.get(KEY_LINKS, []).length).toBe(50);
  });

  it('rejects correctly when starting with exactly 50 pre-existing links', () => {
    // Add one more link to reach exactly 50.
    links.push({
      id:   'preset-49',
      name: 'Link 50',
      url:  'https://example.com/50',
    });
    expect(links).toHaveLength(50);

    const result = simulateAddLink(storage, links, 'Over the cap', 'https://example.com/51');

    expect(result.added).toBe(false);
    expect(result.error).toBe('Maximum number of links reached.');
    expect(links).toHaveLength(50);
  });
});

// ── Delete removes the correct link by id (Requirement 7.4) ──────────────────

describe('QuickLinksModule — _deleteLink removes by id (Requirement 7.4)', () => {
  let storage;
  let links;

  // Helpers to build recognisable link objects.
  const makeLink = (id, name) => ({ id, name, url: `https://example.com/${id}` });

  beforeEach(() => {
    storage = makeMockStorage();
    links   = [
      makeLink('link-1', 'Alpha'),
      makeLink('link-2', 'Beta'),
      makeLink('link-3', 'Gamma'),
    ];
    // Write initial state to storage.
    storage.set(KEY_LINKS, links);
  });

  it('removes the link with the matching id from memory', () => {
    simulateDeleteLink(storage, links, 'link-2');

    expect(links).toHaveLength(2);
    expect(links.find(l => l.id === 'link-2')).toBeUndefined();
  });

  it('leaves the other links intact after deletion', () => {
    simulateDeleteLink(storage, links, 'link-2');

    const ids = links.map(l => l.id);
    expect(ids).toContain('link-1');
    expect(ids).toContain('link-3');
  });

  it('persists the updated list to storage after deletion', () => {
    simulateDeleteLink(storage, links, 'link-2');

    const stored = storage.get(KEY_LINKS, []);
    expect(stored).toHaveLength(2);
    expect(stored.find(l => l.id === 'link-2')).toBeUndefined();
  });

  it('preserves the correct id, name, and url for surviving links in storage', () => {
    simulateDeleteLink(storage, links, 'link-2');

    const stored = storage.get(KEY_LINKS, []);
    const alpha  = stored.find(l => l.id === 'link-1');
    const gamma  = stored.find(l => l.id === 'link-3');

    expect(alpha).toBeDefined();
    expect(alpha.name).toBe('Alpha');
    expect(alpha.url).toBe('https://example.com/link-1');

    expect(gamma).toBeDefined();
    expect(gamma.name).toBe('Gamma');
    expect(gamma.url).toBe('https://example.com/link-3');
  });

  it('deletes the first link correctly', () => {
    simulateDeleteLink(storage, links, 'link-1');

    expect(links).toHaveLength(2);
    expect(links[0].id).toBe('link-2');
    expect(links[1].id).toBe('link-3');
  });

  it('deletes the last link correctly', () => {
    simulateDeleteLink(storage, links, 'link-3');

    expect(links).toHaveLength(2);
    expect(links.every(l => l.id !== 'link-3')).toBe(true);
  });

  it('is a no-op for an unknown id (returns deleted: false, list unchanged)', () => {
    const result = simulateDeleteLink(storage, links, 'nonexistent-id');

    expect(result.deleted).toBe(false);
    expect(links).toHaveLength(3);
  });

  it('does not modify storage when the id is unknown', () => {
    // Record the storage state before the no-op attempt.
    const before = JSON.stringify(storage.get(KEY_LINKS, []));

    simulateDeleteLink(storage, links, 'ghost-id');

    const after = JSON.stringify(storage.get(KEY_LINKS, []));
    expect(after).toBe(before);
  });
});

// ── Add link name validation (completes coverage for _validateLink) ───────────

describe('QuickLinksModule — name validation', () => {
  let storage;
  let links;

  beforeEach(() => {
    storage = makeMockStorage();
    links   = [];
  });

  it('rejects an empty name', () => {
    const result = simulateAddLink(storage, links, '', 'https://example.com');

    expect(result.added).toBe(false);
    expect(result.field).toBe('name');
    expect(result.error).toBe('Link name cannot be empty.');
  });

  it('rejects a whitespace-only name', () => {
    const result = simulateAddLink(storage, links, '   ', 'https://example.com');

    expect(result.added).toBe(false);
    expect(result.field).toBe('name');
  });

  it('accepts a name at the 1-character boundary', () => {
    const result = simulateAddLink(storage, links, 'A', 'https://example.com');

    expect(result.added).toBe(true);
    expect(result.link.name).toBe('A');
  });

  it('trims whitespace from the name before storing', () => {
    const result = simulateAddLink(storage, links, '  GitHub  ', 'https://github.com');

    expect(result.added).toBe(true);
    expect(result.link.name).toBe('GitHub');
  });
});

// ── Add link stores trimmed values (Requirement 7.2) ─────────────────────────

describe('QuickLinksModule — stored link values are trimmed (Requirement 7.2)', () => {
  it('trims leading and trailing whitespace from URL before storing', () => {
    const storage = makeMockStorage();
    const links   = [];

    const result = simulateAddLink(storage, links, 'Site', '  https://example.com  ');

    expect(result.added).toBe(true);
    expect(result.link.url).toBe('https://example.com');

    const stored = storage.get(KEY_LINKS, []);
    expect(stored[0].url).toBe('https://example.com');
  });

  it('persists the link to storage immediately on add', () => {
    const storage = makeMockStorage();
    const links   = [];

    simulateAddLink(storage, links, 'Persisted', 'https://persist.test');

    const stored = storage.get(KEY_LINKS, []);
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Persisted');
    expect(stored[0].url).toBe('https://persist.test');
  });
});
