# Implementation Plan: Personal Dashboard

## Overview

Build a standalone, single-page productivity dashboard in plain HTML, CSS, and Vanilla JavaScript. All persistence uses the Browser LocalStorage API. The app is structured as one HTML file, one CSS file (`css/style.css`), and one JavaScript file (`js/app.js`). JavaScript modules are self-contained IIFEs coordinated by a top-level `App.init()` orchestrator.

Implementation proceeds from the ground up: storage layer → HTML scaffold → styling → widget modules (greeting, timer, todo, links) → wiring → tests.

---

## Tasks

- [x] 1. Create the project file structure and HTML scaffold
  - Create `index.html` with the full page structure: `<html>`, `<head>`, `<body>`, links to `css/style.css` and `js/app.js`
  - Add the `data-theme` attribute hook on `<html>` for CSS theming
  - Add the `.dashboard-grid` wrapper containing four widget sections: `#widget-greeting`, `#widget-timer`, `#widget-todo`, `#widget-links`
  - Add the theme toggle button (`#theme-toggle`) in the header with `aria-pressed`
  - Add the LocalStorage unavailability warning banner (`#storage-warning`) with a dismiss button, initially hidden
  - Add all interactive elements for each widget (inputs, buttons, lists, error spans) with correct `id` attributes, ARIA labels, and `aria-describedby` references matching the JS module expectations from the design
  - Create the empty `css/style.css` file inside a `css/` directory
  - Create the empty `js/app.js` file inside a `js/` directory
  - _Requirements: 10.1_

- [x] 2. Implement CSS layout and theming
  - [x] 2.1 Write CSS custom properties and theme tokens
    - Define all colour tokens under `:root` (light mode) and `[data-theme="dark"]` (dark mode) in `css/style.css`
    - Include at minimum: `--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--accent`, `--border`, `--error`
    - Ensure WCAG 2.1 AA contrast ratios are met for both themes
    - _Requirements: 8.2, 8.3_

  - [x] 2.2 Write base reset, typography, and layout grid
    - Add box-sizing reset, margin/padding resets, and base font stack
    - Implement the `.dashboard-grid` CSS Grid: two columns × two rows (`1fr 1fr`) with `1.5rem` gap for viewports ≥ 1024px
    - Add responsive overrides: single-column stack below 768px width, vertically scrollable stacked layout at 320px
    - Ensure no widget overflows the viewport width across the 320px–2560px range
    - _Requirements: 10.2, 10.4_

  - [x] 2.3 Write widget-level component styles
    - Style each widget card (background, padding, border-radius, shadow using theme tokens)
    - Style the Greeting Widget: time display (large monospace), date line, greeting text
    - Style the Timer Widget: countdown display, Start/Stop/Reset buttons, duration input, button disabled states
    - Style the Todo Widget: add-task input + button row, task list items (strikethrough for completed), edit-in-place controls, sort dropdown, empty-state message
    - Style the Quick Links Widget: link card grid, add-link form inputs, link delete button
    - Style the theme toggle button and its `aria-pressed` visual states
    - Add `.hidden`, `.error-msg`, and `.confirmation` utility classes
    - _Requirements: 8.2, 8.3, 10.2, 10.4_

- [x] 3. Implement `StorageService` in `js/app.js`
  - [x] 3.1 Write the `StorageService` IIFE module
    - Implement `isLocalStorageAvailable()` using a probe write/read/remove cycle inside `try/catch`
    - Implement `get(key, defaultValue)` — wraps `JSON.parse(localStorage.getItem(key))` in `try/catch`; returns `defaultValue` on any error
    - Implement `set(key, value)` — wraps `JSON.stringify` + `localStorage.setItem` in `try/catch`; silent on error
    - Implement `remove(key)` — wraps `localStorage.removeItem` in `try/catch`; silent on error
    - Implement `isAvailable()` returning the cached probe result
    - Define all storage key constants: `KEY_THEME`, `KEY_NAME`, `KEY_TIMER_DURATION`, `KEY_TASKS`, `KEY_SORT_PREF`, `KEY_LINKS`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 3.2 Write property tests for StorageService serialisation round-trips
    - Set up `package.json` with `vitest` and `fast-check` as dev dependencies
    - Create `tests/storage.test.js`
    - **Property 12: Task serialisation round-trip** — for any `fc.array(taskArb)`, `JSON.parse(JSON.stringify(tasks))` must deeply equal the original array's `id`, `text`, `completed`, `createdAt` fields
    - **Property 13: Link serialisation round-trip** — for any `fc.array(linkArb)`, `JSON.parse(JSON.stringify(links))` must deeply equal the original array's `id`, `name`, `url` fields
    - Configure each property test with `{ numRuns: 100 }`
    - Tag each test: `// Feature: personal-dashboard, Property 12: ...` and `// Feature: personal-dashboard, Property 13: ...`
    - _Requirements: 9.1, 9.2_

  - [x] 3.3 Write unit tests for StorageService edge cases
    - Test `get` with corrupted JSON returns `defaultValue`
    - Test `get` with valid JSON returns parsed value
    - Test `set` then `get` round-trip for each data type (string, number, array, object)
    - Test `remove` clears the key so subsequent `get` returns `defaultValue`
    - _Requirements: 9.3_

- [x] 4. Checkpoint — Ensure StorageService tests pass
  - Run `npx vitest --run` and confirm all StorageService tests pass before continuing.

- [x] 5. Implement `ThemeController`
  - [x] 5.1 Write the `ThemeController` IIFE module
    - Implement `init()`: read theme from `KEY_THEME` via `StorageService.get`; fall back to `"light"` if stored value is not `"light"` or `"dark"`; call `_apply(theme)` and wire the `#theme-toggle` button's `click` event to `toggle()`
    - Implement `toggle()`: swap current theme, call `_apply`, persist via `StorageService.set(KEY_THEME, theme)`
    - Implement `_apply(theme)`: set/remove `data-theme="dark"` on `document.documentElement`; update `aria-pressed` on `#theme-toggle`
    - Apply theme within 200 ms of user interaction (single synchronous DOM attribute update satisfies this)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 5.2 Write unit tests for ThemeController
    - Test that `init()` with a `"dark"` stored value applies `data-theme="dark"` on `<html>`
    - Test that `init()` with no stored value defaults to light (no `data-theme` attribute)
    - Test that `toggle()` switches from light to dark and persists `"dark"` to storage
    - Test that `toggle()` switches from dark to light and persists `"light"` to storage
    - _Requirements: 8.4, 8.5, 8.6_

- [x] 6. Implement `GreetingWidget` and `NameController`
  - [x] 6.1 Write the `GreetingWidget` IIFE module
    - Implement `init()`: start a 1-second `setInterval` calling `_tick()`
    - Implement `_tick()`: call `new Date()`; if `isNaN(date.getTime())` render `--:--` for time and `"Date unavailable"` for the date with no greeting; otherwise format time as `HH:MM` (zero-padded 24-hour) and date as `"DayName, MonthName DD, YYYY"`; call `_getGreeting(hour)` for the greeting text; append saved name from `StorageService.get(KEY_NAME)` if present
    - Implement `_getGreeting(hour)`: return `"Good Morning"` for 5–11, `"Good Afternoon"` for 12–17, `"Good Evening"` for 18–21, `"Good Night"` for 22–23 and 0–4
    - Implement `refreshName()`: re-render the greeting suffix without restarting the interval
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [x] 6.2 Write property test for greeting coverage
    - Create `tests/greeting.test.js`
    - **Property 1: Greeting covers all hours without gaps or overlaps** — for any `fc.integer({ min: 0, max: 23 })`, `_getGreeting(h)` must return exactly one of the four valid greeting strings and never `null`, `undefined`, or any other value
    - Configure with `{ numRuns: 100 }`
    - Tag: `// Feature: personal-dashboard, Property 1: Greeting text covers all hours without gaps or overlaps`
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [x] 6.3 Write the `NameController` IIFE module
    - Implement `init()`: populate the name input (`#name-input`) with saved name on load; wire the save button (`#name-save`) click event
    - Implement save handler: trim input; if empty/whitespace → show inline error "Name cannot be empty"; if length > 50 → show inline error "Name must be 50 characters or fewer"; if valid → `StorageService.set(KEY_NAME, trimmedName)`, flash `"Saved!"` confirmation for 2 s, call `GreetingWidget.refreshName()`
    - Implement clear: if input is blank and user saves → `StorageService.remove(KEY_NAME)`, call `GreetingWidget.refreshName()`
    - Clear inline errors on each keypress in the input
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 6.4 Write property tests for name validation
    - Create or extend `tests/name.test.js`
    - **Property 2: Custom name round-trip** — for any `fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)`, the validation function must accept it and a subsequent `StorageService.get(KEY_NAME)` must equal the input
    - **Property 3: Name validation rejects invalid inputs** — for any string that is empty, whitespace-only, or longer than 50 characters, the validation must return failure and storage must remain unchanged
    - Configure each with `{ numRuns: 100 }`
    - Tag each test with Properties 2 and 3 respectively
    - _Requirements: 2.5, 2.6_

- [x] 7. Checkpoint — Ensure Greeting and Name tests pass
  - Run `npx vitest --run` and confirm all greeting and name tests pass before continuing.

- [x] 8. Implement `TimerModule`
  - [x] 8.1 Write the `TimerModule` IIFE module — state, display, and duration input
    - Declare internal state: `configuredMinutes`, `remainingSeconds`, `intervalId`, `isRunning`
    - Implement `init()`: load `configuredMinutes` from `StorageService.get(KEY_TIMER_DURATION, 25)`; validate it is an integer in 1–120, else default to 25; set `remainingSeconds = configuredMinutes * 60`; call `_render()`
    - Implement `_formatMMSS(totalSeconds)`: return zero-padded `MM:SS` string
    - Implement `_render()`: update the countdown display element; enable/disable Start, Stop, and duration input correctly per Requirements 3.7 and 3.8; update duration input value to reflect `configuredMinutes`
    - Wire the duration input change/confirm event: validate integer 1–120; if invalid show inline error and retain previous value; if valid update `configuredMinutes`, persist to `KEY_TIMER_DURATION`, reset `remainingSeconds`, call `_render()`; disable input while running (Requirement 4.6)
    - _Requirements: 3.1, 3.2, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 8.2 Write `start()`, `stop()`, `reset()` and the audio alert
    - Implement `start()`: record `Date.now()` as `_startWallClock`; call `clearInterval(intervalId)` before `setInterval`; on each tick, compute elapsed time against wall clock to correct drift; decrement `remainingSeconds`; call `_render()`; when `remainingSeconds <= 0` call `stop()` then `_playAlert()` (Requirement 3.6, 3.9)
    - Implement `stop()`: `clearInterval(intervalId)`, set `isRunning = false`, call `_render()`
    - Implement `reset()`: call `stop()`, restore `remainingSeconds = configuredMinutes * 60`, call `_render()`
    - Implement `_playAlert()`: create `AudioContext`, synthesise a short beep (oscillator, gain ramp), wrap in `try/catch` for silent fallback
    - Wire Start, Stop, Reset button click events to the corresponding public methods
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x] 8.3 Write property tests for timer formatting and duration validation
    - Create `tests/timer.test.js`
    - **Property 4: Timer display is always valid MM:SS** — for any `fc.integer({ min: 0, max: 7200 })`, `_formatMMSS(s)` must match `/^\d{2}:\d{2}$/` and the seconds component must be in 0–59
    - **Property 5: Timer duration validation rejects out-of-range inputs** — for any `fc.oneof(fc.float({ noInteger: true }), fc.integer({ max: 0 }), fc.integer({ min: 121 }))`, the validation function must return failure and `configuredMinutes` must remain unchanged
    - Configure each with `{ numRuns: 100 }`
    - Tag tests with Properties 4 and 5 respectively
    - _Requirements: 3.1, 4.5_

  - [x] 8.4 Write unit tests for TimerModule boundary values
    - Test `_formatMMSS(0)` → `"00:00"`, `_formatMMSS(59)` → `"00:59"`, `_formatMMSS(3600)` → `"60:00"`, `_formatMMSS(7200)` → `"120:00"`
    - Test `init()` with stored duration 1 → `configuredMinutes = 1`; stored 120 → `configuredMinutes = 120`; stored 200 → `configuredMinutes = 25` (default)
    - Test that `stop()` after `start()` sets `isRunning = false` and `intervalId = null`
    - _Requirements: 3.1, 4.4, 4.5_

- [x] 9. Checkpoint — Ensure Timer tests pass
  - Run `npx vitest --run` and confirm all timer tests pass before continuing.

- [x] 10. Implement `TodoModule`
  - [x] 10.1 Write the `TodoModule` IIFE module — state, load, and render
    - Declare internal state: `tasks = []`, `sortPref = 'default'`
    - Implement `init()`: load `tasks` from `StorageService.get(KEY_TASKS, [])`, load `sortPref` from `StorageService.get(KEY_SORT_PREF, 'default')`; validate each loaded task has `id`, `text`, `completed`, `createdAt` — discard malformed entries; call `_render()`
    - Implement `_getSorted(taskArray)`: return a new sorted copy (never mutate the source array); `"default"` → sort by `createdAt` ascending; `"completed-last"` → incomplete first, each group by `createdAt`; `"alpha"` → case-insensitive alphabetical by `text`
    - Implement `_render()`: apply `_getSorted(tasks)` to a render copy; build list items for each task (checkbox for done, text span, edit button, delete button); show empty-state message if `tasks.length === 0`; set the sort dropdown to the current `sortPref`
    - Wire the sort dropdown `change` event: update `sortPref`, persist to `KEY_SORT_PREF`, call `_render()` within 300 ms
    - _Requirements: 5.1, 5.2, 6.1, 6.2, 6.3, 6.4_

  - [x] 10.2 Write add, delete, and toggle-done handlers
    - Implement `_addTask(text)`: trim input; if empty/whitespace → show inline error; if length > 100 → show inline error; if case-insensitive duplicate exists → show duplicate warning; otherwise create Task object with `id = crypto.randomUUID() || Date.now().toString()`, `text`, `completed: false`, `createdAt: Date.now()`; push to `tasks`; persist; call `_render()`
    - Implement `_deleteTask(id)`: splice task by `id` from `tasks`; persist; call `_render()`
    - Implement `_toggleDone(id)`: flip `completed` on the matching task; persist; call `_render()`
    - Wire the add-task form submit event to `_addTask`; wire delete and done-toggle events via event delegation on the task list
    - _Requirements: 5.3, 5.4, 5.5, 5.8, 5.9_

  - [x] 10.3 Write edit-in-place handler
    - Implement `_startEdit(id)`: replace the task text span with an `<input>` pre-filled with the current text; show Save and Cancel controls
    - Implement `_saveEdit(id, newText)`: trim `newText`; if empty/whitespace reject and show inline error; otherwise update `tasks[i].text`; persist; call `_render()`
    - Implement `_cancelEdit(id)`: call `_render()` to restore the task to its previous display without saving
    - Wire Enter key on edit input to `_saveEdit`; wire Cancel button to `_cancelEdit`
    - _Requirements: 5.6, 5.7_

  - [x] 10.4 Write property tests for task list invariants
    - Create `tests/todo.test.js`
    - **Property 6: Task addition grows list by exactly one** — for any `fc.array(taskArb)` and valid unique `fc.string({ minLength: 1, maxLength: 100 })`, calling `_addTask` must increase `tasks.length` by exactly 1 and the new task must have `completed = false` and the submitted text
    - **Property 7: Task text validation rejects invalid inputs** — for any empty string, whitespace-only string, or case-insensitive duplicate of an existing task, `_addTask` must reject and `tasks.length` must remain unchanged
    - **Property 8: Task edit round-trip** — for any task in the list and valid replacement text, `_saveEdit` must update `text` while `id`, `completed`, and `createdAt` remain identical
    - **Property 9: Sort does not mutate stored task order** — for any `fc.array(taskArb)` and any `fc.constantFrom('default', 'completed-last', 'alpha')`, calling `_getSorted` must not change the original array; a subsequent raw read from storage must equal the original insertion order
    - Configure each with `{ numRuns: 100 }`
    - Tag tests with Properties 6, 7, 8, and 9 respectively
    - _Requirements: 5.3, 5.8, 5.9, 5.6, 6.2_

  - [x] 10.5 Write unit tests for TodoModule edge cases
    - Test empty-state message appears when `tasks = []`
    - Test duplicate detection is case-insensitive (`"Buy Milk"` blocks `"buy milk"`)
    - Test cancel edit restores original text
    - Test sort `"completed-last"` puts all completed tasks after all incomplete tasks while preserving `createdAt` order within each group
    - _Requirements: 5.2, 5.7, 5.9, 6.1_

- [x] 11. Checkpoint — Ensure Todo tests pass
  - Run `npx vitest --run` and confirm all TodoModule tests pass before continuing.

- [x] 12. Implement `QuickLinksModule`
  - [x] 12.1 Write the `QuickLinksModule` IIFE module — load, render, and add link
    - Declare internal state: `links = []`
    - Implement `init()`: load `links` from `StorageService.get(KEY_LINKS, [])`; validate each entry has `id`, `name`, `url`; discard malformed entries; call `_render()` within 1000 ms of page load
    - Implement `_render()`: build link cards each showing the link `name` as a clickable element; attach click handler opening `window.open(url, '_blank', 'noopener,noreferrer')`; attach delete button to each card; render the add-link form below the cards
    - Implement `_addLink(name, url)`: trim inputs; if name empty → inline error on name field; if url empty → inline error on url field; if url does not start with `http://` or `https://` → inline error on url field; if `links.length >= 50` → inline error "Maximum number of links reached"; otherwise create Link object with `id`, `name`, `url`; push to `links`; persist; call `_render()` within 500 ms
    - Wire the add-link form submit event to `_addLink`
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7, 7.8_

  - [x] 12.2 Write delete link handler
    - Implement `_deleteLink(id)`: splice link by `id` from `links`; persist `links` via `StorageService.set(KEY_LINKS, links)`; call `_render()` within 500 ms
    - Wire delete button events via event delegation on the links container
    - _Requirements: 7.4_

  - [x] 12.3 Write property tests for link validation
    - Create `tests/links.test.js`
    - **Property 10: URL validation rejects non-http(s) prefixes** — for any `fc.string().filter(s => !s.startsWith('http://') && !s.startsWith('https://'))`, the URL validation function must return failure and `links` must remain unchanged
    - **Property 11: Link addition rejected when cap is reached** — for any 50-element `links` array, attempting `_addLink` with a valid new link must return failure and `links.length` must remain 50
    - Configure each with `{ numRuns: 100 }`
    - Tag tests with Properties 10 and 11 respectively
    - _Requirements: 7.7, 7.8_

  - [x] 12.4 Write unit tests for QuickLinksModule edge cases
    - Test valid `http://` URL is accepted
    - Test valid `https://` URL is accepted
    - Test URL without prefix is rejected
    - Test adding the 50th link succeeds; adding the 51st is rejected
    - Test delete removes the correct link by `id` and updates storage
    - _Requirements: 7.2, 7.4, 7.7, 7.8_

- [x] 13. Checkpoint — Ensure QuickLinks tests pass
  - Run `npx vitest --run` and confirm all QuickLinksModule tests pass before continuing.

- [x] 14. Implement `App.init()` and wire all modules together
  - [x] 14.1 Write `App.init()` and the storage warning banner
    - Implement the `App` object with an `init()` method in `js/app.js`
    - In `init()`: call `StorageService.isAvailable()`; if false, show `#storage-warning` banner (remove the `.hidden` class); then call `ThemeController.init()`, `GreetingWidget.init()`, `NameController.init()`, `TimerModule.init()`, `TodoModule.init()`, `QuickLinksModule.init()` in that order
    - Wire `document.addEventListener('DOMContentLoaded', App.init.bind(App))`
    - Wire the dismiss button on `#storage-warning` to re-add `.hidden`
    - Verify all four core widgets render in a single viewport at 1024×768 with no vertical scroll required (inspect layout via dev tools)
    - _Requirements: 9.4, 10.1, 10.2, 10.5_

  - [x] 14.2 Write integration tests for the full App initialization sequence
    - Test that `App.init()` calls each module's `init()` exactly once in the correct order using stubs
    - Test that the storage warning banner is shown when `StorageService.isAvailable()` returns false
    - Test that the storage warning banner is hidden when `StorageService.isAvailable()` returns true
    - _Requirements: 9.4_

- [x] 15. Final checkpoint — Full test suite and cross-browser verification
  - Run `npx vitest --run` and confirm every test in the suite passes
  - Manually open `index.html` in Chrome, Firefox, Edge, and Safari; verify all four widgets render, the theme toggle works, the timer alert fires, and LocalStorage persist/restore works on reload
  - Ask the user if any questions arise before considering the implementation complete.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. All 13 correctness properties have dedicated property tests; skip `*` tasks if time-boxing.
- Each task references specific requirements for traceability.
- Checkpoints (tasks 4, 7, 9, 11, 13, 15) ensure no module is wired before its tests pass.
- Property tests use `fast-check` with `{ numRuns: 100 }` and are tagged with their property number.
- Unit tests use `vitest`; run with `npx vitest --run` for single-pass execution (no watch mode).
- `StorageService` module must be defined before all other modules in `js/app.js` to avoid reference errors.
- `GreetingWidget` must be defined before `NameController` because `NameController` calls `GreetingWidget.refreshName()`.
- All IIFE modules are concatenated in dependency order in the single `js/app.js` file.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["3.1"] },
    { "id": 1, "tasks": ["3.2", "3.3", "5.1"] },
    { "id": 2, "tasks": ["5.2", "6.1"] },
    { "id": 3, "tasks": ["6.2", "6.3", "8.1"] },
    { "id": 4, "tasks": ["6.4", "8.2", "10.1"] },
    { "id": 5, "tasks": ["8.3", "8.4", "10.2"] },
    { "id": 6, "tasks": ["10.3", "12.1"] },
    { "id": 7, "tasks": ["10.4", "10.5", "12.2"] },
    { "id": 8, "tasks": ["12.3", "12.4", "14.1"] },
    { "id": 9, "tasks": ["14.2"] }
  ]
}
```
