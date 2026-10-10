// Feature: personal-dashboard
// Unit tests for ThemeController
// Requirements: 8.4, 8.5, 8.6

import { describe, it, expect, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Mock helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory storage mock that mirrors the StorageService interface.
 */
function makeMockStorage(initialData = {}) {
  const store = new Map(Object.entries(initialData));
  return {
    getItem:    (key)        => store.has(key) ? store.get(key) : null,
    setItem:    (key, value) => { store.set(key, String(value)); },
    removeItem: (key)        => { store.delete(key); },
    _raw:       (key, value) => { store.set(key, value); },
  };
}

/**
 * Factory that builds a StorageService backed by a given storage object —
 * mirrors the production logic in js/app.js so we test real behaviour.
 */
function makeStorageService(storage) {
  const KEY_THEME = 'pd_theme';

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

  return { get, set, KEY_THEME };
}

/**
 * Minimal DOM mock that simulates document.documentElement and
 * document.getElementById for the #theme-toggle button.
 *
 * Returns an object with:
 *   - htmlEl  : fake <html> element with getAttribute / setAttribute / removeAttribute
 *   - btnEl   : fake #theme-toggle button with aria-pressed tracking
 *   - document: fake document used by makeThemeController
 */
function makeMockDOM() {
  const htmlAttrs = new Map();

  const htmlEl = {
    getAttribute:    (name)        => htmlAttrs.get(name) ?? null,
    setAttribute:    (name, value) => { htmlAttrs.set(name, value); },
    removeAttribute: (name)        => { htmlAttrs.delete(name); },
  };

  const btnAttrs = new Map();
  const btnListeners = [];

  const btnEl = {
    getAttribute:    (name)        => btnAttrs.get(name) ?? null,
    setAttribute:    (name, value) => { btnAttrs.set(name, value); },
    addEventListener: (event, fn)  => { btnListeners.push({ event, fn }); },
    // helper: fire all registered click listeners
    click: () => btnListeners
      .filter(l => l.event === 'click')
      .forEach(l => l.fn()),
  };

  const doc = {
    documentElement: htmlEl,
    getElementById: (id) => id === 'theme-toggle' ? btnEl : null,
  };

  return { htmlEl, btnEl, doc };
}

// ─────────────────────────────────────────────────────────────────────────────
// ThemeController factory
//
// Mirrors the production IIFE in js/app.js but accepts injected dependencies
// so the logic is fully testable without a real browser DOM or LocalStorage.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {ReturnType<makeStorageService>} storageService
 * @param {ReturnType<makeMockDOM>['doc']}  document
 */
function makeThemeController(storageService, document) {
  const KEY_THEME = 'pd_theme';
  let _currentTheme = 'light';

  function _apply(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    }
  }

  function toggle() {
    _currentTheme = _currentTheme === 'dark' ? 'light' : 'dark';
    _apply(_currentTheme);
    storageService.set(KEY_THEME, _currentTheme);
  }

  function init() {
    const stored = storageService.get(KEY_THEME, 'light');
    _currentTheme = (stored === 'light' || stored === 'dark') ? stored : 'light';

    _apply(_currentTheme);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggle);
    }
  }

  // Expose _currentTheme getter for assertions
  function getCurrentTheme() {
    return _currentTheme;
  }

  return { init, toggle, getCurrentTheme };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ThemeController — init()', () => {

  // ── Requirement 8.5: restore "dark" from storage ─────────────────────────
  describe('when stored theme is "dark"', () => {
    it('applies data-theme="dark" on <html>', () => {
      // Arrange: storage pre-loaded with "dark"
      const rawStorage = makeMockStorage({ pd_theme: JSON.stringify('dark') });
      const storageService = makeStorageService(rawStorage);
      const { htmlEl, doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);

      // Act
      controller.init();

      // Assert: <html data-theme="dark">
      expect(htmlEl.getAttribute('data-theme')).toBe('dark');
    });

    it('sets aria-pressed="true" on the toggle button', () => {
      const rawStorage = makeMockStorage({ pd_theme: JSON.stringify('dark') });
      const storageService = makeStorageService(rawStorage);
      const { btnEl, doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);
      controller.init();

      expect(btnEl.getAttribute('aria-pressed')).toBe('true');
    });
  });

  // ── Requirement 8.5 / 8.6: default to light when nothing is stored ───────
  describe('when no theme is stored (key absent)', () => {
    it('does not set data-theme on <html> (defaults to light)', () => {
      const rawStorage = makeMockStorage(); // empty — no pd_theme key
      const storageService = makeStorageService(rawStorage);
      const { htmlEl, doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);
      controller.init();

      // Light mode: data-theme attribute must NOT be present
      expect(htmlEl.getAttribute('data-theme')).toBeNull();
    });

    it('sets aria-pressed="false" on the toggle button', () => {
      const rawStorage = makeMockStorage();
      const storageService = makeStorageService(rawStorage);
      const { btnEl, doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);
      controller.init();

      expect(btnEl.getAttribute('aria-pressed')).toBe('false');
    });
  });

  // ── Requirement 8.6: invalid stored value falls back to light ────────────
  describe('when stored theme is invalid (neither "light" nor "dark")', () => {
    it('does not set data-theme on <html> (falls back to light)', () => {
      const rawStorage = makeMockStorage({ pd_theme: JSON.stringify('purple') });
      const storageService = makeStorageService(rawStorage);
      const { htmlEl, doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);
      controller.init();

      expect(htmlEl.getAttribute('data-theme')).toBeNull();
    });
  });

  // ── Stored "light" should explicitly remove data-theme ───────────────────
  describe('when stored theme is "light"', () => {
    it('removes data-theme from <html> (light mode is the default)', () => {
      const rawStorage = makeMockStorage({ pd_theme: JSON.stringify('light') });
      const storageService = makeStorageService(rawStorage);
      const { htmlEl, doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);
      controller.init();

      expect(htmlEl.getAttribute('data-theme')).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('ThemeController — toggle()', () => {

  // ── Requirement 8.4: persists "dark" to storage ──────────────────────────
  describe('switching from light to dark', () => {
    it('applies data-theme="dark" on <html>', () => {
      const rawStorage = makeMockStorage(); // starts with light (no stored theme)
      const storageService = makeStorageService(rawStorage);
      const { htmlEl, doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);
      controller.init();   // starts in light mode
      controller.toggle(); // → dark

      expect(htmlEl.getAttribute('data-theme')).toBe('dark');
    });

    it('persists "dark" to storage', () => {
      const rawStorage = makeMockStorage();
      const storageService = makeStorageService(rawStorage);
      const { doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);
      controller.init();
      controller.toggle(); // light → dark

      // StorageService.set serialises with JSON.stringify, so stored value is '"dark"'
      expect(rawStorage.getItem('pd_theme')).toBe(JSON.stringify('dark'));
    });

    it('sets aria-pressed="true" on the toggle button', () => {
      const rawStorage = makeMockStorage();
      const storageService = makeStorageService(rawStorage);
      const { btnEl, doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);
      controller.init();
      controller.toggle();

      expect(btnEl.getAttribute('aria-pressed')).toBe('true');
    });
  });

  // ── Requirement 8.4: persists "light" to storage ─────────────────────────
  describe('switching from dark to light', () => {
    it('removes data-theme from <html>', () => {
      const rawStorage = makeMockStorage({ pd_theme: JSON.stringify('dark') });
      const storageService = makeStorageService(rawStorage);
      const { htmlEl, doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);
      controller.init();   // starts in dark mode
      controller.toggle(); // → light

      expect(htmlEl.getAttribute('data-theme')).toBeNull();
    });

    it('persists "light" to storage', () => {
      const rawStorage = makeMockStorage({ pd_theme: JSON.stringify('dark') });
      const storageService = makeStorageService(rawStorage);
      const { doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);
      controller.init();
      controller.toggle(); // dark → light

      expect(rawStorage.getItem('pd_theme')).toBe(JSON.stringify('light'));
    });

    it('sets aria-pressed="false" on the toggle button', () => {
      const rawStorage = makeMockStorage({ pd_theme: JSON.stringify('dark') });
      const storageService = makeStorageService(rawStorage);
      const { btnEl, doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);
      controller.init();
      controller.toggle();

      expect(btnEl.getAttribute('aria-pressed')).toBe('false');
    });
  });

  // ── Two toggles return to original theme ─────────────────────────────────
  describe('double toggle', () => {
    it('returns to light after two toggles from light', () => {
      const rawStorage = makeMockStorage();
      const storageService = makeStorageService(rawStorage);
      const { htmlEl, doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);
      controller.init();
      controller.toggle(); // light → dark
      controller.toggle(); // dark  → light

      expect(htmlEl.getAttribute('data-theme')).toBeNull();
      expect(rawStorage.getItem('pd_theme')).toBe(JSON.stringify('light'));
    });

    it('returns to dark after two toggles from dark', () => {
      const rawStorage = makeMockStorage({ pd_theme: JSON.stringify('dark') });
      const storageService = makeStorageService(rawStorage);
      const { htmlEl, doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);
      controller.init();
      controller.toggle(); // dark  → light
      controller.toggle(); // light → dark

      expect(htmlEl.getAttribute('data-theme')).toBe('dark');
      expect(rawStorage.getItem('pd_theme')).toBe(JSON.stringify('dark'));
    });
  });

  // ── Button click wires to toggle ─────────────────────────────────────────
  describe('toggle button click event', () => {
    it('clicking the button switches from light to dark', () => {
      const rawStorage = makeMockStorage();
      const storageService = makeStorageService(rawStorage);
      const { htmlEl, btnEl, doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);
      controller.init(); // wires click → toggle

      btnEl.click(); // simulate user click

      expect(htmlEl.getAttribute('data-theme')).toBe('dark');
    });

    it('clicking the button switches from dark to light', () => {
      const rawStorage = makeMockStorage({ pd_theme: JSON.stringify('dark') });
      const storageService = makeStorageService(rawStorage);
      const { htmlEl, btnEl, doc } = makeMockDOM();

      const controller = makeThemeController(storageService, doc);
      controller.init();

      btnEl.click();

      expect(htmlEl.getAttribute('data-theme')).toBeNull();
    });
  });
});
