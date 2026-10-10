// Personal Dashboard — js/app.js
// All modules are IIFE-based and concatenated in dependency order.
// StorageService MUST be defined first; all other modules depend on it.

// ─────────────────────────────────────────────────────────────────────────────
// Storage Key Constants
// ─────────────────────────────────────────────────────────────────────────────
const KEY_THEME          = 'pd_theme';
const KEY_NAME           = 'pd_name';
const KEY_TIMER_DURATION = 'pd_timer_duration';
const KEY_TASKS          = 'pd_tasks';
const KEY_SORT_PREF      = 'pd_sort_pref';
const KEY_LINKS          = 'pd_links';

// ─────────────────────────────────────────────────────────────────────────────
// StorageService
// Thin LocalStorage wrapper. Every read/write is wrapped in try/catch so a
// corrupted value or an unavailable storage API never crashes the app.
// ─────────────────────────────────────────────────────────────────────────────
const StorageService = (() => {
  /**
   * Probe LocalStorage availability once at module initialisation time.
   * Uses a write → read → remove cycle so the result is reliable even in
   * browsers that define `window.localStorage` but throw on access
   * (e.g. Safari in private-browsing mode with cookies blocked).
   *
   * @returns {boolean} true if LocalStorage is readable and writable
   */
  function isLocalStorageAvailable() {
    const probe = '__pd_probe__';
    try {
      localStorage.setItem(probe, probe);
      const readBack = localStorage.getItem(probe);
      localStorage.removeItem(probe);
      return readBack === probe;
    } catch (_e) {
      return false;
    }
  }

  // Cache the result so every other module can call `isAvailable()` cheaply.
  const _available = isLocalStorageAvailable();

  /**
   * Read and JSON-parse a value from LocalStorage.
   * Returns `defaultValue` if the key is absent, the stored value is `null`,
   * or JSON.parse throws (corrupted data).
   *
   * @param {string} key
   * @param {*} defaultValue
   * @returns {*}
   */
  function get(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (_e) {
      return defaultValue;
    }
  }

  /**
   * JSON-stringify a value and write it to LocalStorage.
   * Fails silently on any error (storage full, unavailable, etc.).
   *
   * @param {string} key
   * @param {*} value
   */
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_e) {
      // Silent — storage may be full or unavailable; app continues in-memory.
    }
  }

  /**
   * Remove a key from LocalStorage.
   * Fails silently on any error.
   *
   * @param {string} key
   */
  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (_e) {
      // Silent.
    }
  }

  /**
   * Return the cached probe result.
   *
   * @returns {boolean} true if LocalStorage is available
   */
  function isAvailable() {
    return _available;
  }

  return { get, set, remove, isAvailable };
})();

// ─────────────────────────────────────────────────────────────────────────────
// ThemeController
// Manages light/dark mode state: reads the saved theme from LocalStorage,
// applies it to the document root, and wires the toggle button.
// ─────────────────────────────────────────────────────────────────────────────
const ThemeController = (() => {
  // The current theme is tracked in module-private state so toggle() does not
  // need to re-read the DOM on every call.
  let _currentTheme = 'light';

  /**
   * Apply `theme` to the document by setting or removing the
   * `data-theme="dark"` attribute on `<html>`. Also keeps the toggle
   * button's `aria-pressed` attribute in sync.
   *
   * This is a single synchronous DOM attribute update, so the colour scheme
   * change is visible within the same rendering frame — well under the 200 ms
   * requirement (Requirements 8.2, 8.3).
   *
   * @param {'light'|'dark'} theme
   */
  function _apply(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    // Keep the toggle button's accessible state in sync (Requirement 8.1).
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    }
  }

  /**
   * Swap the active theme between "light" and "dark", apply the change
   * immediately, and persist the new value to LocalStorage.
   * (Requirements 8.2, 8.3, 8.4)
   */
  function toggle() {
    _currentTheme = _currentTheme === 'dark' ? 'light' : 'dark';
    _apply(_currentTheme);
    StorageService.set(KEY_THEME, _currentTheme);
  }

  /**
   * Read the saved theme from LocalStorage, validate it, apply it, and wire
   * the `#theme-toggle` button's click event.
   *
   * Falls back to "light" if the stored value is absent, unreadable, or is
   * neither "light" nor "dark" (Requirements 8.5, 8.6).
   */
  function init() {
    const stored = StorageService.get(KEY_THEME, 'light');
    _currentTheme = (stored === 'light' || stored === 'dark') ? stored : 'light';

    _apply(_currentTheme);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggle);
    }
  }

  return { init, toggle };
})();

// ─────────────────────────────────────────────────────────────────────────────
// GreetingWidget
// Drives the clock, date, and greeting display. Updates every second via
// setInterval. Reads the saved custom name from StorageService on each tick
// so any name change is reflected within one second.
// ─────────────────────────────────────────────────────────────────────────────
const GreetingWidget = (() => {
  // Day and month name lookup arrays for formatting the date string.
  const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

  // Internal interval handle — kept private so only init() can start it.
  let _intervalId = null;

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Return the appropriate greeting string for the given 24-hour hour value.
   *
   * Ranges (inclusive):
   *   05–11 → "Good Morning"    (Requirement 1.3)
   *   12–17 → "Good Afternoon"  (Requirement 1.4)
   *   18–21 → "Good Evening"    (Requirement 1.5)
   *   22–23, 0–4 → "Good Night" (Requirement 1.6)
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

  /**
   * Zero-pad a number to at least two digits.
   *
   * @param {number} n
   * @returns {string}
   */
  function _pad(n) {
    return String(n).padStart(2, '0');
  }

  /**
   * Called on every interval tick (and immediately on init).
   * Reads the device clock, formats time/date/greeting, and writes them to
   * the three DOM elements: #time-display, #date-display, #greeting-text.
   *
   * If the clock is unavailable (isNaN check), renders safe fallback strings
   * with no greeting (Requirement 1.9).
   */
  function _tick() {
    const date = new Date();

    const timeEl     = document.getElementById('time-display');
    const dateEl     = document.getElementById('date-display');
    const greetingEl = document.getElementById('greeting-text');

    // Guard: elements may not exist in non-browser (test) environments.
    if (!timeEl || !dateEl || !greetingEl) return;

    if (isNaN(date.getTime())) {
      // Clock unavailable — render fallback values (Requirement 1.9).
      timeEl.textContent     = '--:--';
      dateEl.textContent     = 'Date unavailable';
      greetingEl.textContent = '';
      return;
    }

    // ── Format time as HH:MM (Requirement 1.1) ─────────────────────────────
    const hours   = date.getHours();
    const minutes = date.getMinutes();
    timeEl.textContent = `${_pad(hours)}:${_pad(minutes)}`;

    // ── Format date as "DayName, MonthName DD, YYYY" (Requirement 1.2) ─────
    const dayName   = DAY_NAMES[date.getDay()];
    const monthName = MONTH_NAMES[date.getMonth()];
    const day       = date.getDate();
    const year      = date.getFullYear();
    dateEl.textContent = `${dayName}, ${monthName} ${day}, ${year}`;

    // ── Build greeting string (Requirements 1.3–1.8) ───────────────────────
    const greetingText = _getGreeting(hours);
    const savedName    = StorageService.get(KEY_NAME, null);

    if (savedName && typeof savedName === 'string' && savedName.trim().length > 0) {
      // Append name with a comma separator (Requirement 1.7).
      greetingEl.textContent = `${greetingText}, ${savedName.trim()}`;
    } else {
      // No name saved — greeting only (Requirement 1.8).
      greetingEl.textContent = greetingText;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Start the 1-second clock interval and render the initial state immediately.
   * Calling init() more than once is safe — the old interval is cleared first.
   * (Requirement 1.1)
   */
  function init() {
    if (_intervalId !== null) {
      clearInterval(_intervalId);
    }
    _tick(); // render immediately so there is no 1-second blank flash on load
    _intervalId = setInterval(_tick, 1000);
  }

  /**
   * Re-render only the greeting suffix (#greeting-text) without touching the
   * time or date elements and without restarting the interval.
   * Called by NameController when the user saves or clears their custom name.
   * (Requirements 1.7, 1.8)
   */
  function refreshName() {
    const greetingEl = document.getElementById('greeting-text');
    if (!greetingEl) return;

    const date = new Date();
    if (isNaN(date.getTime())) {
      greetingEl.textContent = '';
      return;
    }

    const greetingText = _getGreeting(date.getHours());
    const savedName    = StorageService.get(KEY_NAME, null);

    if (savedName && typeof savedName === 'string' && savedName.trim().length > 0) {
      greetingEl.textContent = `${greetingText}, ${savedName.trim()}`;
    } else {
      greetingEl.textContent = greetingText;
    }
  }

  return { init, refreshName, _getGreeting };
})();

// ─────────────────────────────────────────────────────────────────────────────
// NameController
// Handles the custom-name configuration form: populates the input on load,
// validates user input, persists valid names, and tells GreetingWidget to
// refresh whenever the name changes.
// ─────────────────────────────────────────────────────────────────────────────
const NameController = (() => {
  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Display an inline error message in #name-error.
   *
   * @param {string} message
   */
  function _showError(message) {
    const errorEl = document.getElementById('name-error');
    if (errorEl) { errorEl.textContent = message; }
  }

  /**
   * Clear the inline error message.
   */
  function _clearError() {
    const errorEl = document.getElementById('name-error');
    if (errorEl) { errorEl.textContent = ''; }
  }

  /**
   * Flash a "Saved!" confirmation in #name-confirm for 2 seconds.
   * (Requirement 2.2)
   */
  function _flashConfirmation() {
    const confirmEl = document.getElementById('name-confirm');
    if (!confirmEl) return;

    confirmEl.textContent = 'Saved!';
    confirmEl.classList.add('confirmation');

    setTimeout(() => {
      confirmEl.textContent = '';
      confirmEl.classList.remove('confirmation');
    }, 2000);
  }

  // ── Save handler ───────────────────────────────────────────────────────────

  /**
   * Handle the save-button click event.
   *
   * Validation rules (Requirements 2.5, 2.6):
   *   - Trimmed value is empty / whitespace-only → if raw is blank treat as
   *       "clear" (Requirement 2.4); if raw is whitespace-only show error.
   *   - Trimmed value is longer than 50 characters → reject with inline error.
   *   - Otherwise → persist the trimmed name and refresh the greeting.
   */
  function _handleSave() {
    const inputEl = document.getElementById('name-input');
    if (!inputEl) return;

    const raw         = inputEl.value;
    const trimmedName = raw.trim();

    // Clear any stale error before each save attempt.
    _clearError();

    // ── Case 1: whitespace-only content (not blank) ──────────────────────────
    if (raw.length > 0 && trimmedName.length === 0) {
      _showError('Name cannot be empty');
      return;
    }

    // ── Case 2: blank input → clear stored name (Requirement 2.4) ───────────
    if (trimmedName.length === 0) {
      StorageService.remove(KEY_NAME);
      GreetingWidget.refreshName();
      _flashConfirmation();
      return;
    }

    // ── Case 3: name exceeds 50 characters (Requirement 2.5) ────────────────
    if (trimmedName.length > 50) {
      _showError('Name must be 50 characters or fewer');
      return;
    }

    // ── Case 4: valid name ───────────────────────────────────────────────────
    StorageService.set(KEY_NAME, trimmedName);
    GreetingWidget.refreshName();
    _flashConfirmation();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Populate the name input with any previously saved name, wire the save
   * button's click event, and wire the input's keyup event to clear inline
   * errors while the user types.
   *
   * (Requirements 2.1, 2.3)
   */
  function init() {
    const inputEl = document.getElementById('name-input');
    const saveBtn = document.getElementById('name-save');

    // Populate the input with the saved name if one exists (Requirement 2.3).
    if (inputEl) {
      const savedName = StorageService.get(KEY_NAME, '');
      if (savedName && typeof savedName === 'string') {
        inputEl.value = savedName;
      }

      // Clear inline error on every keypress (design spec).
      inputEl.addEventListener('keyup', _clearError);
    }

    // Wire the save button.
    if (saveBtn) {
      saveBtn.addEventListener('click', _handleSave);
    }
  }

  return { init };
})();

// ─────────────────────────────────────────────────────────────────────────────
// TimerModule
// Manages the Pomodoro countdown timer: configurable duration, countdown
// display, and Start / Stop / Reset controls. Plays an audio alert when the
// countdown reaches zero.
// ─────────────────────────────────────────────────────────────────────────────
const TimerModule = (() => {
  // ── Internal state ─────────────────────────────────────────────────────────
  let configuredMinutes = 25;   // integer 1–120; persisted to KEY_TIMER_DURATION
  let remainingSeconds  = 0;    // current countdown value in seconds
  let intervalId        = null; // setInterval handle; null when stopped
  let isRunning         = false;
  let _startWallClock   = 0;    // Date.now() snapshot taken when start() is called
  let _secondsAtStart   = 0;    // remainingSeconds value at the moment start() was called

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Format a total-seconds value into a zero-padded "MM:SS" string.
   *
   * The minutes component is NOT capped at 59 — values >= 3600 s produce
   * strings like "60:00" or "120:00" (Requirements 3.1, 4.2).
   *
   * Examples:
   *   _formatMMSS(0)    → "00:00"
   *   _formatMMSS(59)   → "00:59"
   *   _formatMMSS(3661) → "61:01"
   *   _formatMMSS(7200) → "120:00"
   *
   * @param {number} totalSeconds  Non-negative integer.
   * @returns {string}  "MM:SS" with both parts zero-padded to at least 2 digits.
   */
  function _formatMMSS(totalSeconds) {
    const secs   = totalSeconds % 60;
    const mins   = Math.floor(totalSeconds / 60);
    const mmStr  = String(mins).padStart(2, '0');
    const ssStr  = String(secs).padStart(2, '0');
    return `${mmStr}:${ssStr}`;
  }

  /**
   * Show or hide the inline error message for the duration input.
   *
   * @param {string} message  Error text, or empty string to clear.
   */
  function _setDurationError(message) {
    const errEl = document.getElementById('timer-error');
    if (!errEl) return;
    errEl.textContent = message;
    errEl.classList.toggle('hidden', message === '');
  }

  /**
   * Update the countdown display and synchronise button/input enabled states
   * based on `isRunning`.
   *
   * While running  → disable Start, enable Stop,  disable duration input.
   * While stopped  → enable Start,  disable Stop, enable duration input.
   * (Requirements 3.7, 3.8, 4.6)
   */
  function _render() {
    const displayEl  = document.getElementById('timer-display');
    const startBtn   = document.getElementById('timer-start');
    const stopBtn    = document.getElementById('timer-stop');
    const durationEl = document.getElementById('timer-duration');

    // Update countdown text (Requirement 3.1).
    if (displayEl) {
      displayEl.textContent = _formatMMSS(remainingSeconds);
    }

    // Sync button states (Requirements 3.7, 3.8).
    if (startBtn) startBtn.disabled = isRunning;
    if (stopBtn)  stopBtn.disabled  = !isRunning;

    // Sync duration input (Requirement 4.6).
    if (durationEl) {
      durationEl.disabled = isRunning;
      // Keep the input value in sync with configuredMinutes when not running
      // so a reset / init always reflects the configured value.
      if (!isRunning) {
        durationEl.value = configuredMinutes;
      }
    }
  }

  /**
   * Validate a candidate duration value and, if valid, update internal state.
   *
   * Accepts only integers in the range 1–120 (Requirements 4.1, 4.5).
   * On failure: shows inline error and leaves `configuredMinutes` unchanged.
   * On success: updates `configuredMinutes`, persists to storage, resets
   *             `remainingSeconds`, and calls `_render()`.
   *
   * @param {string|number} raw  The raw value from the duration input.
   * @returns {boolean}  true if the value was accepted and state was updated.
   */
  function _validateAndSetDuration(raw) {
    const num = Number(raw);

    if (!Number.isInteger(num) || num < 1 || num > 120) {
      _setDurationError('Duration must be a whole number between 1 and 120 minutes.');
      return false;
    }

    _setDurationError('');
    configuredMinutes = num;
    StorageService.set(KEY_TIMER_DURATION, configuredMinutes);
    remainingSeconds  = configuredMinutes * 60;
    _render();
    return true;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Restore the configured duration from LocalStorage, validate it, set the
   * initial countdown, and render the widget.
   * Also wires the duration input's change and Enter-key events.
   * (Requirements 3.2, 4.4)
   */
  function init() {
    const stored = StorageService.get(KEY_TIMER_DURATION, 25);

    // Validate: must be an integer in 1–120; fall back to 25 otherwise.
    if (Number.isInteger(stored) && stored >= 1 && stored <= 120) {
      configuredMinutes = stored;
    } else {
      configuredMinutes = 25;
    }

    remainingSeconds = configuredMinutes * 60;
    isRunning        = false;
    intervalId       = null;

    _render();

    // ── Wire the duration input ──────────────────────────────────────────────
    const durationEl = document.getElementById('timer-duration');
    if (durationEl) {
      // Validate on blur / native change (covers <input type="number"> spinner).
      durationEl.addEventListener('change', () => {
        if (!isRunning) {
          _validateAndSetDuration(durationEl.value);
        }
      });

      // Validate when the user presses Enter inside the field.
      durationEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !isRunning) {
          _validateAndSetDuration(durationEl.value);
        } else if (e.key !== 'Enter') {
          // Clear error while the user is actively typing.
          _setDurationError('');
        }
      });
    }

    // ── Wire Start, Stop, Reset buttons (task 8.2) ──────────────────────────
    const startBtn = document.getElementById('timer-start');
    const stopBtn  = document.getElementById('timer-stop');
    const resetBtn = document.getElementById('timer-reset');

    if (startBtn) startBtn.addEventListener('click', start);
    if (stopBtn)  stopBtn.addEventListener('click', stop);
    if (resetBtn) resetBtn.addEventListener('click', reset);
  }

  /**
   * Synthesise a short beep using the Web Audio API to signal timer completion.
   * Uses an oscillator with a gain ramp for a pleasant fade-out.
   * Wrapped in try/catch so the timer still reaches 00:00 and stops even if
   * the browser blocks or does not support AudioContext (Requirement 3.6).
   */
  function _playAlert() {
    try {
      // `window.AudioContext` or the legacy `window.webkitAudioContext` (Safari).
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return; // API not available — silent fallback

      const ctx        = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gainNode   = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // A pleasant, mellow tone (A4 = 440 Hz).
      oscillator.type      = 'sine';
      oscillator.frequency.setValueAtTime(440, ctx.currentTime);

      // Start at full volume and ramp down to silence over ~0.8 s.
      gainNode.gain.setValueAtTime(0.6, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.8);

      // Clean up the AudioContext after the beep finishes to avoid leaking
      // resources. Close is called after a short delay so the audio finishes.
      oscillator.onended = () => {
        ctx.close().catch(() => {});
      };
    } catch (_e) {
      // Silent fallback — audio is best-effort (Requirement 3.6).
    }
  }

  /**
   * Begin or resume the countdown from the current `remainingSeconds`.
   *
   * Records the current wall-clock time and remaining-second count so each
   * tick can correct for any `setInterval` drift by computing how many whole
   * seconds have actually elapsed against the wall clock (Design doc: "Timer
   * tick implementation").
   *
   * Calls `clearInterval` before scheduling a new interval to prevent
   * multiple concurrent intervals from running (Design doc: error handling).
   *
   * When `remainingSeconds` reaches 0 the countdown stops automatically and
   * `_playAlert()` fires (Requirements 3.3, 3.6, 3.7, 3.9).
   */
  function start() {
    if (isRunning) return; // no-op if already running

    isRunning       = true;
    _startWallClock = Date.now();
    _secondsAtStart = remainingSeconds;

    // Guard: clear any stale interval before starting a new one.
    clearInterval(intervalId);

    intervalId = setInterval(() => {
      // Compute how many whole seconds have elapsed since start() was called.
      const elapsedMs      = Date.now() - _startWallClock;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);

      // Derive remaining time from wall-clock elapsed, not from decrementing
      // a counter, so accumulated drift is corrected on every tick.
      const newRemaining = _secondsAtStart - elapsedSeconds;

      if (newRemaining <= 0) {
        // Timer has expired.
        remainingSeconds = 0;
        stop();
        _playAlert();
        // Requirements 3.9: remain at 00:00 in a stopped state until Reset.
      } else {
        remainingSeconds = newRemaining;
        _render();
      }
    }, 1000);

    _render(); // update button states immediately (Requirement 3.7)
  }

  /**
   * Pause the countdown at the current remaining time.
   * (Requirements 3.4, 3.8)
   */
  function stop() {
    clearInterval(intervalId);
    intervalId = null;
    isRunning  = false;
    _render();
  }

  /**
   * Stop any active countdown and restore the display to the configured
   * duration. (Requirement 3.5)
   */
  function reset() {
    stop();
    remainingSeconds = configuredMinutes * 60;
    _render();
  }

  return {
    init,
    start,
    stop,
    reset,
    _formatMMSS,    // exposed for unit / property tests (tasks 8.3, 8.4)
  };
})();

// ─────────────────────────────────────────────────────────────────────────────
// TodoModule
// Manages the task list: loading from storage, sorting, and rendering.
// CRUD handlers (add, delete, toggle-done, edit) are added in tasks 10.2–10.3.
// Task 10.2 adds: _addTask, _deleteTask, _toggleDone, and their event wiring.
// ─────────────────────────────────────────────────────────────────────────────
const TodoModule = (() => {
  // ── Internal state ─────────────────────────────────────────────────────────
  let tasks    = [];          // Task[] — authoritative in-memory list
  let sortPref = 'default';   // 'default' | 'completed-last' | 'alpha'

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Check whether a candidate value is a well-formed Task object.
   * A valid task must have:
   *   - id        {string}  non-empty
   *   - text      {string}  non-empty
   *   - completed {boolean}
   *   - createdAt {number}  finite
   *
   * Malformed entries are silently discarded on load (Requirement 9.3).
   *
   * @param {*} t
   * @returns {boolean}
   */
  function _isValidTask(t) {
    return (
      t !== null &&
      typeof t === 'object' &&
      typeof t.id === 'string' && t.id.length > 0 &&
      typeof t.text === 'string' && t.text.length > 0 &&
      typeof t.completed === 'boolean' &&
      typeof t.createdAt === 'number' && isFinite(t.createdAt)
    );
  }

  /**
   * Return a new sorted copy of `taskArray`.
   * The source array is NEVER mutated (Requirement 6.2 / Property 9).
   *
   * Sort modes:
   *   "default"        — createdAt ascending (oldest first)       (Requirement 6.1)
   *   "completed-last" — incomplete first; each group by createdAt (Requirement 6.1)
   *   "alpha"          — case-insensitive A–Z by text             (Requirement 6.1)
   *
   * @param {Task[]} taskArray
   * @returns {Task[]}
   */
  function _getSorted(taskArray) {
    // Shallow copy so the caller's array is not affected.
    const copy = taskArray.slice();

    switch (sortPref) {
      case 'completed-last':
        copy.sort((a, b) => {
          // Incomplete (completed = false) before complete (completed = true).
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }
          // Within each group, sort by createdAt ascending.
          return a.createdAt - b.createdAt;
        });
        break;

      case 'alpha':
        copy.sort((a, b) =>
          a.text.toLowerCase().localeCompare(b.text.toLowerCase())
        );
        break;

      case 'default':
      default:
        copy.sort((a, b) => a.createdAt - b.createdAt);
        break;
    }

    return copy;
  }

  /**
   * Build and insert DOM nodes for the current task list into `#todo-list`.
   * Also toggles the empty-state message (`#todo-empty`) and keeps the sort
   * dropdown (`#todo-sort`) in sync with the current `sortPref`.
   *
   * Sort is applied to a render copy — the authoritative `tasks` array is
   * never reordered (Requirements 6.1–6.4).
   */
  function _render() {
    const listEl  = document.getElementById('todo-list');
    const emptyEl = document.getElementById('todo-empty');
    const sortEl  = document.getElementById('todo-sort');

    // ── Sync sort dropdown ──────────────────────────────────────────────────
    if (sortEl) {
      sortEl.value = sortPref;
    }

    // ── Empty-state message (Requirement 5.2) ───────────────────────────────
    if (emptyEl) {
      if (tasks.length === 0) {
        emptyEl.textContent = 'No tasks yet. Add one above!';
        emptyEl.classList.remove('hidden');
      } else {
        emptyEl.classList.add('hidden');
      }
    }

    if (!listEl) return;

    // Clear previous render.
    listEl.innerHTML = '';

    if (tasks.length === 0) return;

    // ── Build list items from the sorted render copy ─────────────────────────
    const sorted = _getSorted(tasks);

    sorted.forEach((task) => {
      const li = document.createElement('li');
      li.className   = 'todo-item';
      li.dataset.id  = task.id;

      // ── Checkbox (toggle done) ─────────────────────────────────────────────
      const checkbox = document.createElement('input');
      checkbox.type              = 'checkbox';
      checkbox.checked           = task.completed;
      checkbox.className         = 'todo-checkbox';
      checkbox.setAttribute('aria-label', `Mark "${task.text}" as ${task.completed ? 'incomplete' : 'complete'}`);
      checkbox.dataset.action    = 'toggle';
      checkbox.dataset.id        = task.id;

      // ── Task text span ─────────────────────────────────────────────────────
      const textSpan = document.createElement('span');
      textSpan.className   = 'todo-text' + (task.completed ? ' todo-text--done' : '');
      textSpan.textContent = task.text;

      // ── Edit button ────────────────────────────────────────────────────────
      const editBtn = document.createElement('button');
      editBtn.type            = 'button';
      editBtn.className       = 'todo-btn todo-btn--edit';
      editBtn.textContent     = 'Edit';
      editBtn.setAttribute('aria-label', `Edit task: ${task.text}`);
      editBtn.dataset.action  = 'edit';
      editBtn.dataset.id      = task.id;

      // ── Delete button ──────────────────────────────────────────────────────
      const deleteBtn = document.createElement('button');
      deleteBtn.type            = 'button';
      deleteBtn.className       = 'todo-btn todo-btn--delete';
      deleteBtn.textContent     = 'Delete';
      deleteBtn.setAttribute('aria-label', `Delete task: ${task.text}`);
      deleteBtn.dataset.action  = 'delete';
      deleteBtn.dataset.id      = task.id;

      li.appendChild(checkbox);
      li.appendChild(textSpan);
      li.appendChild(editBtn);
      li.appendChild(deleteBtn);

      listEl.appendChild(li);
    });
  }

  // ── CRUD helpers ───────────────────────────────────────────────────────────

  /**
   * Show or clear the inline error message for the task-add input.
   *
   * @param {string} message  Error text, or empty string to clear.
   */
  function _setTodoError(message) {
    const errEl = document.getElementById('todo-error');
    if (errEl) {
      errEl.textContent = message;
      errEl.classList.toggle('hidden', message === '');
    }
  }

  /**
   * Validate and add a new task to the list.
   *
   * Rules (Requirements 5.3, 5.8, 5.9):
   *   - Trimmed text is empty / whitespace-only → reject with inline error.
   *   - Trimmed text is longer than 100 characters → reject with inline error.
   *   - Case-insensitive duplicate of an existing task text → reject with
   *     duplicate warning.
   *   - Otherwise → create a Task object, push to `tasks`, persist, re-render.
   *
   * @param {string} text  Raw input value from the task input field.
   * @returns {boolean}  true if the task was added, false if rejected.
   */
  function _addTask(text) {
    const trimmed = (text || '').trim();

    // ── Validation ──────────────────────────────────────────────────────────
    if (trimmed.length === 0) {
      _setTodoError('Task cannot be empty.');
      return false;
    }

    if (trimmed.length > 100) {
      _setTodoError('Task must be 100 characters or fewer.');
      return false;
    }

    const lowerTrimmed = trimmed.toLowerCase();
    const isDuplicate  = tasks.some(t => t.text.toLowerCase() === lowerTrimmed);
    if (isDuplicate) {
      _setTodoError('A task with that name already exists.');
      return false;
    }

    // ── Create and persist ───────────────────────────────────────────────────
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString();

    const newTask = {
      id,
      text:      trimmed,
      completed: false,
      createdAt: Date.now(),
    };

    tasks.push(newTask);
    StorageService.set(KEY_TASKS, tasks);
    _setTodoError(''); // clear any stale error on success
    _render();
    return true;
  }

  /**
   * Remove a task from the list by its `id`.
   * (Requirement 5.5)
   *
   * @param {string} id  Task identifier.
   */
  function _deleteTask(id) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return; // defensive: id not found, no-op
    tasks.splice(idx, 1);
    StorageService.set(KEY_TASKS, tasks);
    _render();
  }

  /**
   * Flip the `completed` boolean on the task with the given `id`.
   * (Requirement 5.4)
   *
   * @param {string} id  Task identifier.
   */
  function _toggleDone(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return; // defensive: id not found, no-op
    task.completed = !task.completed;
    StorageService.set(KEY_TASKS, tasks);
    _render();
  }

  // ── Edit-in-place helpers ──────────────────────────────────────────────────

  /**
   * Replace a task's text span with an inline edit `<input>` pre-filled with
   * the current task text. Also renders Save and Cancel buttons.
   *
   * Only one task can be in editing mode at a time; if another task is already
   * in edit mode, calling `_startEdit` for a different id first calls
   * `_render()` (via `_cancelEdit`) to discard the uncommitted edit.
   *
   * (Requirement 5.6)
   *
   * @param {string} id  The id of the task to edit.
   */
  function _startEdit(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Find the list item for this task.
    const listEl = document.getElementById('todo-list');
    if (!listEl) return;

    const li = listEl.querySelector(`[data-id="${id}"]`);
    if (!li) return;

    // Replace the static text span with an edit input.
    const textSpan = li.querySelector('.todo-text');
    if (!textSpan) return;

    // ── Build the edit input ─────────────────────────────────────────────────
    const editInput = document.createElement('input');
    editInput.type        = 'text';
    editInput.className   = 'todo-edit-input';
    editInput.value       = task.text;
    editInput.maxLength   = 100;
    editInput.setAttribute('aria-label', `Edit text for task: ${task.text}`);

    // ── Build inline error span for edit validation ──────────────────────────
    const editErrorSpan = document.createElement('span');
    editErrorSpan.className = 'error-msg todo-edit-error';
    editErrorSpan.setAttribute('role', 'alert');

    // ── Build Save button ────────────────────────────────────────────────────
    const saveBtn = document.createElement('button');
    saveBtn.type        = 'button';
    saveBtn.className   = 'todo-btn todo-btn--save';
    saveBtn.textContent = 'Save';
    saveBtn.setAttribute('aria-label', `Save edit for task: ${task.text}`);

    // ── Build Cancel button ──────────────────────────────────────────────────
    const cancelBtn = document.createElement('button');
    cancelBtn.type        = 'button';
    cancelBtn.className   = 'todo-btn todo-btn--cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.setAttribute('aria-label', `Cancel edit for task: ${task.text}`);

    // ── Swap the static text span for the editing controls ───────────────────
    textSpan.replaceWith(editInput);

    // Hide the static Edit button while editing.
    const staticEditBtn = li.querySelector('.todo-btn--edit');
    if (staticEditBtn) staticEditBtn.classList.add('hidden');

    // Hide the static Delete button while editing to avoid accidental deletes.
    const staticDeleteBtn = li.querySelector('.todo-btn--delete');
    if (staticDeleteBtn) staticDeleteBtn.classList.add('hidden');

    // Insert: [editInput] [editErrorSpan] [saveBtn] [cancelBtn]
    li.appendChild(editErrorSpan);
    li.appendChild(saveBtn);
    li.appendChild(cancelBtn);

    // ── Wire Save button ─────────────────────────────────────────────────────
    saveBtn.addEventListener('click', () => _saveEdit(id, editInput.value));

    // ── Wire Cancel button ───────────────────────────────────────────────────
    cancelBtn.addEventListener('click', () => _cancelEdit(id));

    // ── Wire Enter key on the edit input ────────────────────────────────────
    editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        _saveEdit(id, editInput.value);
      } else if (e.key === 'Escape') {
        _cancelEdit(id);
      }
    });

    // ── Clear edit error while the user is typing ────────────────────────────
    editInput.addEventListener('input', () => {
      editErrorSpan.textContent = '';
    });

    // Focus the input so the user can start typing immediately.
    editInput.focus();
    // Place cursor at the end of the pre-filled text.
    editInput.setSelectionRange(editInput.value.length, editInput.value.length);
  }

  /**
   * Validate `newText`, update the task in memory + storage, and re-render.
   *
   * Validation rules (Requirements 5.6, 5.8):
   *   - Trimmed value is empty / whitespace-only → reject, show inline error.
   *   - Otherwise → update `task.text`, persist, call `_render()`.
   *
   * The 100-character cap from `_addTask` does NOT apply here — the edit input
   * already enforces `maxLength=100` at the DOM level, so any value reaching
   * this function is at most 100 characters.
   *
   * @param {string} id       The id of the task being edited.
   * @param {string} newText  Raw value from the edit input.
   */
  function _saveEdit(id, newText) {
    const trimmed = (newText || '').trim();

    if (trimmed.length === 0) {
      // Show inline error inside the currently-open edit row.
      const listEl = document.getElementById('todo-list');
      if (listEl) {
        const editErrorSpan = listEl.querySelector(`[data-id="${id}"] .todo-edit-error`);
        if (editErrorSpan) {
          editErrorSpan.textContent = 'Task cannot be empty.';
        }
      }
      return; // leave edit mode open so the user can correct the value
    }

    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.text = trimmed;
    StorageService.set(KEY_TASKS, tasks);
    _render(); // re-render restores the static view (Requirement 5.6)
  }

  /**
   * Discard any uncommitted edits and restore the static task row.
   * (Requirement 5.7)
   *
   * @param {string} id  The id of the task whose edit to cancel.
   */
  function _cancelEdit(id) {
    // Re-rendering unconditionally restores the original text because `tasks`
    // was never mutated — only the DOM was changed by `_startEdit`.
    _render();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Load tasks and sort preference from LocalStorage, validate each task,
   * discard malformed entries, and render the initial list.
   *
   * (Requirements 5.1, 5.2, 6.3, 6.4)
   */
  function init() {
    // ── Load and validate tasks ──────────────────────────────────────────────
    const rawTasks = StorageService.get(KEY_TASKS, []);
    if (Array.isArray(rawTasks)) {
      tasks = rawTasks.filter(_isValidTask);
    } else {
      tasks = [];
    }

    // ── Load and validate sort preference ────────────────────────────────────
    const rawSort = StorageService.get(KEY_SORT_PREF, 'default');
    if (rawSort === 'default' || rawSort === 'completed-last' || rawSort === 'alpha') {
      sortPref = rawSort;
    } else {
      sortPref = 'default'; // Requirement 6.4: fall back silently
    }

    _render();

    // ── Wire sort dropdown change event (Requirement 6.2: within 300 ms) ─────
    const sortEl = document.getElementById('todo-sort');
    if (sortEl) {
      sortEl.addEventListener('change', () => {
        sortPref = sortEl.value;
        StorageService.set(KEY_SORT_PREF, sortPref);
        // _render() is synchronous so it completes well within 300 ms.
        _render();
      });
    }

    // ── Wire add-task form submit event (Requirements 5.3, 5.8, 5.9) ─────────
    const addForm    = document.getElementById('todo-form');
    const addInputEl = document.getElementById('todo-input');

    if (addForm) {
      addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!addInputEl) return;
        const added = _addTask(addInputEl.value);
        if (added) {
          addInputEl.value = ''; // clear input on successful add
        }
      });
    }

    // Clear the inline error as the user types into the add-task input.
    if (addInputEl) {
      addInputEl.addEventListener('input', () => _setTodoError(''));
    }

    // ── Wire delete and toggle events via event delegation (Requirements 5.4, 5.5) ──
    const listEl = document.getElementById('todo-list');
    if (listEl) {
      listEl.addEventListener('click', (e) => {
        const target = e.target;
        const action = target.dataset.action;
        const id     = target.dataset.id;

        if (!action || !id) return;

        if (action === 'delete') {
          _deleteTask(id);
        } else if (action === 'toggle') {
          _toggleDone(id);
        } else if (action === 'edit') {
          // _startEdit will be implemented in task 10.3
        }
      });

      // Checkbox change fires separately from click on some browsers.
      listEl.addEventListener('change', (e) => {
        const target = e.target;
        if (target.dataset.action === 'toggle' && target.dataset.id) {
          _toggleDone(target.dataset.id);
        }
      });
    }
  }

  return {
    init,
    // Exposed for unit / property tests (tasks 10.4, 10.5):
    _getSorted,
    _isValidTask,
    _addTask,
    _deleteTask,
    _toggleDone,
    _startEdit,
    _saveEdit,
    _cancelEdit,
    // Expose getters for test inspection:
    getTasks:    () => tasks,
    getSortPref: () => sortPref,
    // Exposed so tasks 10.2 and 10.3 can mutate shared state and re-render:
    _render,
    _setTasks:    (t) => { tasks = t; },
    _setSortPref: (p) => { sortPref = p; },
  };
})();

// ─────────────────────────────────────────────────────────────────────────────
// QuickLinksModule
// Manages the quick-links panel: loading from storage, rendering link cards,
// adding links, and opening them in a new tab.
// Task 12.2 will add _deleteLink and wire the delete buttons.
// ─────────────────────────────────────────────────────────────────────────────
const QuickLinksModule = (() => {
  // ── Internal state ─────────────────────────────────────────────────────────
  let links = []; // Link[] — authoritative in-memory list

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Check whether a candidate value is a well-formed Link object.
   * A valid link must have:
   *   - id   {string}  non-empty
   *   - name {string}  non-empty
   *   - url  {string}  non-empty
   *
   * Malformed entries are silently discarded on load (Requirement 9.3).
   *
   * @param {*} l
   * @returns {boolean}
   */
  function _isValidLink(l) {
    return (
      l !== null &&
      typeof l === 'object' &&
      typeof l.id   === 'string' && l.id.length   > 0 &&
      typeof l.name === 'string' && l.name.length  > 0 &&
      typeof l.url  === 'string' && l.url.length   > 0
    );
  }

  /**
   * Show or clear the inline error message for the link-name input.
   *
   * @param {string} message  Error text, or empty string to clear.
   */
  function _setNameError(message) {
    const errEl = document.getElementById('link-name-error');
    if (!errEl) return;
    errEl.textContent = message;
    errEl.classList.toggle('hidden', message === '');
  }

  /**
   * Show or clear the inline error message for the link-url input.
   *
   * @param {string} message  Error text, or empty string to clear.
   */
  function _setUrlError(message) {
    const errEl = document.getElementById('link-url-error');
    if (!errEl) return;
    errEl.textContent = message;
    errEl.classList.toggle('hidden', message === '');
  }

  /**
   * Build and insert DOM nodes for the current links list into `#links-list`.
   * Each card shows the link name as a clickable button that opens the URL
   * in a new tab, plus a delete button for removal.
   * (Requirements 7.1, 7.3)
   */
  function _render() {
    const listEl = document.getElementById('links-list');
    if (!listEl) return;

    // Clear previous render.
    listEl.innerHTML = '';

    links.forEach((link) => {
      const card = document.createElement('div');
      card.className  = 'link-card';
      card.dataset.id = link.id;

      // ── Clickable link button (opens URL in new tab) ───────────────────────
      const linkBtn = document.createElement('button');
      linkBtn.type          = 'button';
      linkBtn.className     = 'link-card__name';
      linkBtn.textContent   = link.name;
      linkBtn.setAttribute('aria-label', `Open ${link.name}`);
      linkBtn.addEventListener('click', () => {
        // Requirement 7.3: open in new tab without navigating away.
        window.open(link.url, '_blank', 'noopener,noreferrer');
      });

      // ── Delete button (stub — handler wired in task 12.2) ─────────────────
      const deleteBtn = document.createElement('button');
      deleteBtn.type          = 'button';
      deleteBtn.className     = 'link-card__delete';
      deleteBtn.textContent   = 'Delete';
      deleteBtn.setAttribute('aria-label', `Delete link: ${link.name}`);
      deleteBtn.dataset.action = 'delete';
      deleteBtn.dataset.id     = link.id;

      card.appendChild(linkBtn);
      card.appendChild(deleteBtn);
      listEl.appendChild(card);
    });
  }

  /**
   * Validate inputs and add a new link to the list.
   *
   * Validation rules (Requirements 7.6, 7.7, 7.8):
   *   - Trimmed name is empty           → inline error on name field
   *   - Trimmed URL is empty            → inline error on URL field
   *   - URL does not start with http:// or https:// → inline error on URL field
   *   - links.length >= 50              → inline error "Maximum number of links reached"
   *   - Otherwise → create Link object, push, persist, re-render within 500 ms
   *
   * @param {string} name  Raw value from the name input.
   * @param {string} url   Raw value from the URL input.
   * @returns {boolean}  true if the link was added, false if rejected.
   */
  function _addLink(name, url) {
    const trimmedName = (name || '').trim();
    const trimmedUrl  = (url  || '').trim();

    // Clear any stale errors before each attempt.
    _setNameError('');
    _setUrlError('');

    // ── Validation ──────────────────────────────────────────────────────────
    if (trimmedName.length === 0) {
      _setNameError('Link name cannot be empty.');
      return false;
    }

    if (trimmedUrl.length === 0) {
      _setUrlError('URL cannot be empty.');
      return false;
    }

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      _setUrlError('URL must begin with http:// or https://');
      return false;
    }

    if (links.length >= 50) {
      _setUrlError('Maximum number of links reached.');
      return false;
    }

    // ── Create and persist ───────────────────────────────────────────────────
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString();

    const newLink = { id, name: trimmedName, url: trimmedUrl };

    links.push(newLink);
    StorageService.set(KEY_LINKS, links);
    // _render() is synchronous — satisfies the 500 ms requirement (Requirement 7.2).
    _render();
    return true;
  }

  /**
   * Remove a link from the list by its `id`.
   * Splices the matching entry from `links`, persists the updated array, and
   * re-renders the panel within 500 ms (Requirement 7.4).
   *
   * @param {string} id  Link identifier.
   */
  function _deleteLink(id) {
    const idx = links.findIndex(l => l.id === id);
    if (idx === -1) return; // defensive: id not found, no-op
    links.splice(idx, 1);
    StorageService.set(KEY_LINKS, links);
    // _render() is synchronous — completes well within 500 ms (Requirement 7.4).
    _render();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Restore links from LocalStorage, validate each entry, discard malformed
   * entries, and render the initial list.
   * Wires the add-link form submit event.
   *
   * (Requirements 7.1, 7.2, 7.5, 7.6, 7.7, 7.8)
   */
  function init() {
    // ── Load and validate links ──────────────────────────────────────────────
    // init() is called from App.init() which is wired to DOMContentLoaded,
    // so _render() runs synchronously within the page-load frame — well under
    // the 1000 ms requirement (Requirement 7.5).
    const rawLinks = StorageService.get(KEY_LINKS, []);
    if (Array.isArray(rawLinks)) {
      links = rawLinks.filter(_isValidLink);
    } else {
      links = [];
    }

    _render();

    // ── Wire add-link form submit event ──────────────────────────────────────
    const addForm    = document.getElementById('link-add-form');
    const nameInputEl = document.getElementById('link-name-input');
    const urlInputEl  = document.getElementById('link-url-input');

    if (addForm) {
      addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameVal = nameInputEl ? nameInputEl.value : '';
        const urlVal  = urlInputEl  ? urlInputEl.value  : '';
        const added   = _addLink(nameVal, urlVal);
        if (added) {
          // Clear inputs on successful add.
          if (nameInputEl) nameInputEl.value = '';
          if (urlInputEl)  urlInputEl.value  = '';
        }
      });
    }

    // Clear inline errors while the user types.
    if (nameInputEl) {
      nameInputEl.addEventListener('input', () => _setNameError(''));
    }
    if (urlInputEl) {
      urlInputEl.addEventListener('input', () => _setUrlError(''));
    }

    // ── Wire delete events via event delegation on the links container ────────
    // The links list may be re-rendered at any time so attaching handlers to
    // individual cards would require re-wiring after every _render() call.
    // Delegating to the stable container element avoids that problem
    // (Requirement 7.4).
    const linksListEl = document.getElementById('links-list');
    if (linksListEl) {
      linksListEl.addEventListener('click', (e) => {
        const target = e.target;
        if (target.dataset.action === 'delete' && target.dataset.id) {
          _deleteLink(target.dataset.id);
        }
      });
    }
  }

  return {
    init,
    // Exposed for unit / property tests (tasks 12.3, 12.4):
    _addLink,
    _deleteLink,
    _isValidLink,
    _render,
    getLinks: () => links,
    _setLinks: (l) => { links = l; },
  };
})();

// ─────────────────────────────────────────────────────────────────────────────
// App (Orchestrator)
// Coordinates module initialisation on DOMContentLoaded. Also shows the
// LocalStorage unavailability warning banner and wires its dismiss button.
// (Requirements 9.4, 10.1, 10.2, 10.5)
// ─────────────────────────────────────────────────────────────────────────────
const App = {
  /**
   * Initialise all modules in dependency order.
   *
   * Sequence:
   *   1. Check LocalStorage availability — show the warning banner if absent.
   *   2. ThemeController — applies saved/default theme immediately so the page
   *      never flashes the wrong colour scheme.
   *   3. GreetingWidget  — starts the 1-second clock interval.
   *   4. NameController  — wires name input and restore saved name.
   *   5. TimerModule     — restores saved duration and renders the countdown.
   *   6. TodoModule      — loads and renders saved tasks.
   *   7. QuickLinksModule — loads and renders saved links.
   *
   * (Requirements 9.4, 10.5)
   */
  init() {
    // ── LocalStorage availability check (Requirement 9.4) ───────────────────
    if (!StorageService.isAvailable()) {
      const banner = document.getElementById('storage-warning');
      if (banner) {
        banner.classList.remove('hidden');
      }
    }

    // ── Wire dismiss button for the storage warning banner ───────────────────
    const dismissBtn = document.getElementById('storage-warning-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        const banner = document.getElementById('storage-warning');
        if (banner) {
          banner.classList.add('hidden');
        }
      });
    }

    // ── Initialise modules in dependency order ───────────────────────────────
    ThemeController.init();
    GreetingWidget.init();
    NameController.init();
    TimerModule.init();
    TodoModule.init();
    QuickLinksModule.init();
  },
};

// Wire App.init() to run as soon as the DOM is fully parsed and interactive.
// (Requirement 10.5: initial render within 3 seconds on broadband)
document.addEventListener('DOMContentLoaded', App.init.bind(App));
