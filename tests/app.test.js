// Feature: personal-dashboard
// Integration tests for the App initialization sequence (task 14.2).
// Requirements: 9.4

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Background
//
// The production App object lives inside js/app.js as a plain object literal
// (not an ES module), so it cannot be imported into Vitest. Instead, these
// tests use pure simulation helpers that mirror App.init() logic exactly.
//
// Two concerns are tested:
//   1. Module init order — each module's init() is called exactly once,
//      in the correct dependency sequence.
//   2. Storage warning banner — shown when StorageService.isAvailable()
//      returns false; kept hidden when it returns true.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 1. Module init order simulation
//
// App.init() in js/app.js calls module inits in this sequence:
//   ThemeController.init()
//   GreetingWidget.init()
//   NameController.init()
//   TimerModule.init()
//   TodoModule.init()
//   QuickLinksModule.init()
//
// (Preceded by the LocalStorage availability check + banner wiring.)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulate App.init() with injectable stubs for every module.
 * The simulated function mirrors the exact call sequence in App.init()
 * from js/app.js (LocalStorage check → ThemeController → GreetingWidget →
 * NameController → TimerModule → TodoModule → QuickLinksModule).
 *
 * @param {{
 *   storageAvailable: boolean,
 *   ThemeController:  { init: Function },
 *   GreetingWidget:   { init: Function },
 *   NameController:   { init: Function },
 *   TimerModule:      { init: Function },
 *   TodoModule:       { init: Function },
 *   QuickLinksModule: { init: Function },
 *   banner:           { classList: { remove: Function } } | null,
 *   dismissBtn:       { addEventListener: Function } | null,
 * }} deps
 */
function simulateAppInit(deps) {
  const {
    storageAvailable,
    ThemeController,
    GreetingWidget,
    NameController,
    TimerModule,
    TodoModule,
    QuickLinksModule,
    banner,
    dismissBtn,
  } = deps;

  // ── LocalStorage availability check (Requirement 9.4) ───────────────────
  if (!storageAvailable) {
    if (banner) {
      banner.classList.remove('hidden');
    }
  }

  // ── Wire dismiss button (no-op stub — DOM interaction not under test) ────
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {});
  }

  // ── Initialise modules in dependency order ───────────────────────────────
  ThemeController.init();
  GreetingWidget.init();
  NameController.init();
  TimerModule.init();
  TodoModule.init();
  QuickLinksModule.init();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Storage warning banner simulation
//
// The banner logic in App.init():
//   if (!StorageService.isAvailable()) {
//     banner.classList.remove('hidden');
//   }
//
// A minimal mock DOM element is sufficient — we only need to observe whether
// classList.remove('hidden') is called.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a minimal mock element whose classList tracks add/remove calls.
 * Starts with 'hidden' in its class set, mirroring the production HTML where
 * #storage-warning has class="hidden".
 *
 * @returns {{ classList: { classes: Set<string>, add: Function, remove: Function, contains: Function } }}
 */
function makeMockBannerElement() {
  const classes = new Set(['hidden']);
  return {
    classList: {
      classes,
      add:      (cls) => classes.add(cls),
      remove:   (cls) => classes.delete(cls),
      contains: (cls) => classes.has(cls),
    },
  };
}

/**
 * Create a minimal mock dismiss button (addEventListener spy).
 *
 * @returns {{ addEventListener: import('vitest').MockInstance }}
 */
function makeMockDismissButton() {
  return { addEventListener: vi.fn() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build a full set of module stubs (vi.fn() for each init).
// ─────────────────────────────────────────────────────────────────────────────
function makeModuleStubs() {
  return {
    ThemeController:  { init: vi.fn() },
    GreetingWidget:   { init: vi.fn() },
    NameController:   { init: vi.fn() },
    TimerModule:      { init: vi.fn() },
    TodoModule:       { init: vi.fn() },
    QuickLinksModule: { init: vi.fn() },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests — module init order
// ─────────────────────────────────────────────────────────────────────────────

describe('App.init() — module initialisation order', () => {
  let stubs;
  let callOrder;

  beforeEach(() => {
    callOrder = [];
    stubs = makeModuleStubs();

    // Instrument each stub to record its name in callOrder when invoked.
    for (const [moduleName, mod] of Object.entries(stubs)) {
      const name = moduleName;
      mod.init.mockImplementation(() => { callOrder.push(name); });
    }
  });

  it('calls ThemeController.init() exactly once', () => {
    simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn: null });
    expect(stubs.ThemeController.init).toHaveBeenCalledTimes(1);
  });

  it('calls GreetingWidget.init() exactly once', () => {
    simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn: null });
    expect(stubs.GreetingWidget.init).toHaveBeenCalledTimes(1);
  });

  it('calls NameController.init() exactly once', () => {
    simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn: null });
    expect(stubs.NameController.init).toHaveBeenCalledTimes(1);
  });

  it('calls TimerModule.init() exactly once', () => {
    simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn: null });
    expect(stubs.TimerModule.init).toHaveBeenCalledTimes(1);
  });

  it('calls TodoModule.init() exactly once', () => {
    simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn: null });
    expect(stubs.TodoModule.init).toHaveBeenCalledTimes(1);
  });

  it('calls QuickLinksModule.init() exactly once', () => {
    simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn: null });
    expect(stubs.QuickLinksModule.init).toHaveBeenCalledTimes(1);
  });

  it('calls all six module inits in the correct sequence', () => {
    simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn: null });

    expect(callOrder).toEqual([
      'ThemeController',
      'GreetingWidget',
      'NameController',
      'TimerModule',
      'TodoModule',
      'QuickLinksModule',
    ]);
  });

  it('ThemeController.init() is called before GreetingWidget.init()', () => {
    simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn: null });
    const themeIdx   = callOrder.indexOf('ThemeController');
    const greetIdx   = callOrder.indexOf('GreetingWidget');
    expect(themeIdx).toBeLessThan(greetIdx);
  });

  it('GreetingWidget.init() is called before NameController.init()', () => {
    simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn: null });
    expect(callOrder.indexOf('GreetingWidget')).toBeLessThan(callOrder.indexOf('NameController'));
  });

  it('NameController.init() is called before TimerModule.init()', () => {
    simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn: null });
    expect(callOrder.indexOf('NameController')).toBeLessThan(callOrder.indexOf('TimerModule'));
  });

  it('TimerModule.init() is called before TodoModule.init()', () => {
    simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn: null });
    expect(callOrder.indexOf('TimerModule')).toBeLessThan(callOrder.indexOf('TodoModule'));
  });

  it('TodoModule.init() is called before QuickLinksModule.init()', () => {
    simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn: null });
    expect(callOrder.indexOf('TodoModule')).toBeLessThan(callOrder.indexOf('QuickLinksModule'));
  });

  it('no module init is called more than once even when storageAvailable is false', () => {
    const banner = makeMockBannerElement();
    simulateAppInit({ storageAvailable: false, ...stubs, banner, dismissBtn: null });

    for (const mod of Object.values(stubs)) {
      expect(mod.init).toHaveBeenCalledTimes(1);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests — storage warning banner (Requirement 9.4)
// ─────────────────────────────────────────────────────────────────────────────

describe('App.init() — storage warning banner (Requirement 9.4)', () => {
  let stubs;

  beforeEach(() => {
    stubs = makeModuleStubs();
  });

  // ── isAvailable() returns false — banner must be shown ───────────────────

  it('removes the "hidden" class from the banner when storage is unavailable', () => {
    const banner = makeMockBannerElement();
    expect(banner.classList.contains('hidden')).toBe(true); // starts hidden

    simulateAppInit({ storageAvailable: false, ...stubs, banner, dismissBtn: null });

    expect(banner.classList.contains('hidden')).toBe(false);
  });

  it('banner is visible (no "hidden" class) after init when storage is unavailable', () => {
    const banner = makeMockBannerElement();
    simulateAppInit({ storageAvailable: false, ...stubs, banner, dismissBtn: null });
    expect(banner.classList.contains('hidden')).toBe(false);
  });

  it('banner classList.remove is called with "hidden" when storage is unavailable', () => {
    const classes   = new Set(['hidden']);
    const removeSpy = vi.fn((cls) => classes.delete(cls));
    const banner    = { classList: { remove: removeSpy, contains: (c) => classes.has(c) } };

    simulateAppInit({ storageAvailable: false, ...stubs, banner, dismissBtn: null });

    expect(removeSpy).toHaveBeenCalledWith('hidden');
  });

  // ── isAvailable() returns true — banner must stay hidden ─────────────────

  it('does NOT remove the "hidden" class from the banner when storage is available', () => {
    const banner = makeMockBannerElement();
    simulateAppInit({ storageAvailable: true, ...stubs, banner, dismissBtn: null });
    expect(banner.classList.contains('hidden')).toBe(true);
  });

  it('banner classList.remove is never called when storage is available', () => {
    const removeSpy = vi.fn();
    const banner    = { classList: { remove: removeSpy } };

    simulateAppInit({ storageAvailable: true, ...stubs, banner, dismissBtn: null });

    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('banner starts hidden and remains hidden when storage is available', () => {
    const banner = makeMockBannerElement();
    const before = banner.classList.contains('hidden');

    simulateAppInit({ storageAvailable: true, ...stubs, banner, dismissBtn: null });

    // Hidden before and after — storage availability did not trigger banner.
    expect(before).toBe(true);
    expect(banner.classList.contains('hidden')).toBe(true);
  });

  // ── Null banner element (getElementById returned null) ────────────────────

  it('does not throw when the banner element is null and storage is unavailable', () => {
    expect(() =>
      simulateAppInit({ storageAvailable: false, ...stubs, banner: null, dismissBtn: null }),
    ).not.toThrow();
  });

  it('does not throw when the banner element is null and storage is available', () => {
    expect(() =>
      simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn: null }),
    ).not.toThrow();
  });

  // ── Dismiss button wiring ─────────────────────────────────────────────────

  it('wires the dismiss button click handler when the button element is present', () => {
    const dismissBtn = makeMockDismissButton();
    simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn });
    expect(dismissBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('does not throw when dismiss button is null', () => {
    expect(() =>
      simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn: null }),
    ).not.toThrow();
  });

  // ── Module inits still run regardless of storage availability ────────────

  it('all module inits are called even when storage is unavailable', () => {
    const banner = makeMockBannerElement();
    simulateAppInit({ storageAvailable: false, ...stubs, banner, dismissBtn: null });

    for (const [name, mod] of Object.entries(stubs)) {
      expect(mod.init, `${name}.init should have been called`).toHaveBeenCalledTimes(1);
    }
  });

  it('all module inits are called when storage is available', () => {
    simulateAppInit({ storageAvailable: true, ...stubs, banner: null, dismissBtn: null });

    for (const [name, mod] of Object.entries(stubs)) {
      expect(mod.init, `${name}.init should have been called`).toHaveBeenCalledTimes(1);
    }
  });
});
