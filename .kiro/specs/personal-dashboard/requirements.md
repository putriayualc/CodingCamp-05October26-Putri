# Requirements Document

## Introduction

The Personal Dashboard is a standalone web application designed to serve as a personal new tab page. Built with HTML, CSS, and Vanilla JavaScript (no frameworks, no backend), it provides a clean and minimal interface for daily productivity. All data is stored client-side using the Browser Local Storage API.

The dashboard includes four core features: a time-based greeting, a Pomodoro focus timer, a to-do list, and a quick links launcher. Three optional challenges are included: light/dark mode toggle, custom name in greeting, and the ability to change Pomodoro duration.

---

## Glossary

- **Dashboard**: The single-page web application described in this document.
- **LocalStorage**: The Browser Local Storage API used for all persistent data.
- **Greeting_Widget**: The UI component displaying the current time, date, and personalized greeting message.
- **Timer**: The Pomodoro focus timer component.
- **Todo_List**: The to-do list component managing tasks.
- **Task**: A single to-do item with a text description and a completion state.
- **Quick_Links**: The component managing and displaying user-defined website shortcuts.
- **Link**: A single quick-link entry with a display name and a URL.
- **Theme_Controller**: The component responsible for managing light/dark mode state.
- **User**: The person using the dashboard in their browser.

---

## Requirements

### Requirement 1: Time, Date, and Personalized Greeting

**User Story:** As a user, I want to see the current time, date, and a greeting based on the time of day, so that I feel oriented and welcomed when I open the dashboard.

#### Acceptance Criteria

1. THE Greeting_Widget SHALL display the current local time in 24-hour clock HH:MM format, zero-padded, updated every second using the device's local clock.
2. THE Greeting_Widget SHALL display the current local date in the format "DayName, MonthName DD, YYYY" (e.g., "Saturday, October 26, 2026"), sourced from the device's local date.
3. WHEN the local time is between 05:00 and 11:59, THE Greeting_Widget SHALL display the greeting "Good Morning".
4. WHEN the local time is between 12:00 and 17:59, THE Greeting_Widget SHALL display the greeting "Good Afternoon".
5. WHEN the local time is between 18:00 and 21:59, THE Greeting_Widget SHALL display the greeting "Good Evening".
6. WHEN the local time is between 22:00 and 23:59, or between 00:00 and 04:59, THE Greeting_Widget SHALL display the greeting "Good Night".
7. WHERE a custom name of 1–50 characters has been saved, THE Greeting_Widget SHALL append the custom name to the greeting message (e.g., "Good Morning, Putri").
8. WHERE no custom name has been saved, THE Greeting_Widget SHALL display the greeting message without a name suffix.
9. IF the device clock is unavailable or returns an invalid value, THEN THE Greeting_Widget SHALL display "--:--" for the time and "Date unavailable" for the date, and apply no greeting text.

---

### Requirement 2: Custom Name Configuration

**User Story:** As a user, I want to set my own name so that the greeting feels personal and relevant to me.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a text input field and a save button that allow the user to enter and save a custom name.
2. WHEN the user saves a custom name, THE Dashboard SHALL persist the name to LocalStorage and display a visible confirmation indicator (e.g., a brief "Saved!" message) to the user.
3. WHEN the Dashboard is loaded and a custom name exists in LocalStorage, THE Greeting_Widget SHALL display the saved name without requiring re-entry.
4. WHEN the user clears the custom name field and saves, THE Dashboard SHALL remove the custom name from LocalStorage, and THE Greeting_Widget SHALL revert to displaying the greeting message without a name suffix.
5. IF the user attempts to save a name longer than 50 characters, THEN THE Dashboard SHALL reject the input and display an inline validation message stating the 50-character limit.
6. IF the user attempts to save an empty or whitespace-only name, THEN THE Dashboard SHALL reject the input and display an inline validation message indicating the name field cannot be empty.

---

### Requirement 3: Pomodoro Focus Timer

**User Story:** As a user, I want a Pomodoro focus timer so that I can structure my work sessions and stay productive.

#### Acceptance Criteria

1. THE Timer SHALL display a countdown in MM:SS format.
2. THE Timer SHALL have a default duration of 25 minutes.
3. WHEN the user clicks the Start button, THE Timer SHALL begin counting down from the current displayed time.
4. WHEN the user clicks the Stop button, THE Timer SHALL pause the countdown at the current remaining time.
5. WHEN the user clicks the Reset button, THE Timer SHALL stop any active countdown and restore the display to the configured duration (25 minutes by default, or the user's saved custom duration).
6. WHEN the countdown reaches 00:00, THE Timer SHALL stop automatically and play an audible alert sound in the browser.
7. WHILE the Timer is counting down, THE Dashboard SHALL disable the Start button and enable the Stop button.
8. WHILE the Timer is stopped, reset, or on initial page load, THE Dashboard SHALL enable the Start button and disable the Stop button.
9. WHEN the countdown reaches 00:00 and the alert has played, THE Timer SHALL remain at 00:00 in a stopped state until the user clicks Reset.

---

### Requirement 4: Configurable Pomodoro Duration

**User Story:** As a user, I want to change the Pomodoro timer duration so that I can adapt the timer to my preferred work session length.

#### Acceptance Criteria

1. THE Timer SHALL provide a numeric input control for the user to set a custom duration in whole minutes, accepting only integer values.
2. WHEN the user sets a custom duration and confirms, THE Timer SHALL update the countdown display to reflect the new duration in MM:SS format, starting from the entered number of minutes and 00 seconds.
3. WHEN the user confirms a valid custom duration, THE Dashboard SHALL persist the duration value as an integer number of minutes to LocalStorage.
4. WHEN the Dashboard is loaded, THE Timer SHALL restore the last saved custom duration from LocalStorage, or use 25 minutes if no saved value exists, and display it in the duration input control before any session starts.
5. IF the user enters a duration less than 1 minute or greater than 120 minutes, or a non-integer value, THEN THE Timer SHALL reject the input, retain the previously valid duration, and display an inline validation message indicating the accepted range of 1 to 120 minutes.
6. WHILE the Timer is counting down, THE Dashboard SHALL disable the duration input control, preventing any changes until the countdown completes or is stopped.

---

### Requirement 5: To-Do List

**User Story:** As a user, I want to manage a list of tasks so that I can track what I need to do and mark items as complete.

#### Acceptance Criteria

1. WHEN the Dashboard is loaded and tasks exist in LocalStorage, THE Todo_List SHALL display all saved tasks in a list in their saved state.
2. IF no tasks exist in LocalStorage when the Dashboard is loaded, THEN THE Todo_List SHALL display an empty-state message (e.g., "No tasks yet. Add one above!").
3. WHEN the user submits a new task via the input field with text between 1 and 100 characters, THE Todo_List SHALL add the task to the list with an incomplete state and persist the updated task list to LocalStorage.
4. WHEN the user marks a task as done, THE Todo_List SHALL apply a strikethrough style to the task text and update its completion state in LocalStorage.
5. WHEN the user deletes a task, THE Todo_List SHALL remove the task from the list and from LocalStorage.
6. WHEN the user edits a task's text and confirms the edit by pressing Enter or activating the save control, THE Todo_List SHALL update the task text in the list and in LocalStorage.
7. IF the user cancels an edit, THEN THE Todo_List SHALL restore the task text to its previous value without saving any changes.
8. IF the user attempts to submit a task with an empty or whitespace-only input, THEN THE Todo_List SHALL reject the submission and display an inline validation message.
9. IF the user attempts to add a task whose text exactly matches an existing task in the list (case-insensitive), THEN THE Todo_List SHALL reject the submission and display a duplicate warning message.

---

### Requirement 6: Task Sorting

**User Story:** As a user, I want to sort my task list so that I can prioritize and organize my work efficiently.

#### Acceptance Criteria

1. THE Todo_List SHALL provide a sort control with the following options: default order (sorted by creation time, oldest first), completed tasks last (incomplete tasks listed before completed tasks, each group preserving default order), and alphabetical order (sorted A–Z by task title, case-insensitive).
2. WHEN the user selects a sort option, THE Todo_List SHALL re-render the task list according to the selected sort criteria within 300 milliseconds without altering the underlying stored data.
3. WHEN the Dashboard is loaded, THE Todo_List SHALL restore and apply the last saved sort preference from LocalStorage, or apply the default order if no saved preference exists.
4. IF the sort preference cannot be read from LocalStorage, THEN THE Todo_List SHALL apply the default order (by creation time, oldest first) and continue without displaying an error.
5. THE Todo_List SHALL persist the selected sort preference to LocalStorage whenever the user changes the sort option, overwriting any previously stored preference.

---

### Requirement 7: Quick Links

**User Story:** As a user, I want to save and launch favorite website links so that I can quickly navigate to the sites I use most.

#### Acceptance Criteria

1. THE Quick_Links SHALL display all saved links as clickable buttons or cards, each showing the link's name.
2. WHEN the user adds a new link with a name of 1–50 characters and a URL of 1–2048 characters, THE Quick_Links SHALL add the link to the display within 500ms and persist it to LocalStorage.
3. WHEN the user clicks a link, THE Dashboard SHALL open the corresponding URL in a new browser tab without navigating away from the Dashboard.
4. WHEN the user deletes a link, THE Quick_Links SHALL remove it from the display within 500ms and delete its entry from LocalStorage.
5. WHEN the Dashboard is loaded, THE Quick_Links SHALL restore all saved links from LocalStorage and display them within 1000ms.
6. IF the user attempts to add a link with an empty name or an empty URL, THEN THE Quick_Links SHALL reject the submission and display an inline validation message indicating which field is empty.
7. IF the user attempts to add a URL that does not begin with "http://" or "https://", THEN THE Quick_Links SHALL reject the submission and display an inline validation message indicating the URL format requirement.
8. IF the user attempts to add a link when 50 or more links are already saved, THEN THE Quick_Links SHALL reject the submission and display an inline validation message indicating the maximum number of links has been reached.

---

### Requirement 8: Light / Dark Mode

**User Story:** As a user, I want to switch between light and dark mode so that I can use the dashboard comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a toggle control that is visible and accessible on every Dashboard page for switching between light mode and dark mode.
2. WHEN the user activates dark mode, THE Theme_Controller SHALL apply a dark color scheme to all Dashboard UI components within 200 milliseconds.
3. WHEN the user activates light mode, THE Theme_Controller SHALL apply a light color scheme to all Dashboard UI components within 200 milliseconds.
4. WHEN the user toggles the theme, THE Theme_Controller SHALL persist the selected theme as the string "light" or "dark" under a single designated LocalStorage key.
5. WHEN the Dashboard is loaded, THE Theme_Controller SHALL restore the last saved theme from LocalStorage within 500ms, or default to light mode if no saved value exists or the stored value is not "light" or "dark".
6. IF LocalStorage is unavailable or reading the theme key fails, THEN THE Theme_Controller SHALL apply light mode and continue without displaying an error.

---

### Requirement 9: Data Persistence and Recovery

**User Story:** As a user, I want my data to be saved automatically so that I never lose my tasks, links, or settings when I close or reload the page.

#### Acceptance Criteria

1. THE Dashboard SHALL save tasks, links, and settings to LocalStorage immediately after each individual change, without requiring any explicit save action from the user.
2. WHEN the Dashboard is loaded, THE Dashboard SHALL read all tasks, links, and settings from LocalStorage and restore them to their last saved state before any user interaction.
3. IF a LocalStorage value for any data category is unreadable or corrupted, THEN THE Dashboard SHALL silently discard that entry, initialize the affected category to its default empty or default state, and continue loading remaining data.
4. WHEN LocalStorage is unavailable, THE Dashboard SHALL display an inline, dismissible warning message that does not prevent the user from interacting with any Dashboard feature.
5. THE Dashboard SHALL allow the user to view, add, edit, and delete tasks, links, and settings regardless of network connectivity status.

---

### Requirement 10: Layout and Performance

**User Story:** As a user, I want the dashboard to load quickly and display correctly on my screen so that I can start using it without friction.

#### Acceptance Criteria

1. THE Dashboard SHALL consist of exactly one HTML file, one CSS file inside a `css/` directory, and one JavaScript file inside a `js/` directory.
2. THE Dashboard SHALL render all four core widgets (Greeting_Widget, Timer, Todo_List, Quick_Links) in a single viewport without requiring vertical scrolling on screens with a minimum height of 768px and minimum width of 1024px.
3. THE Dashboard SHALL be compatible with the latest stable versions of Chrome, Firefox, Edge, and Safari, such that all four core widgets render and function identically across those browsers with no layout breakage, missing content, or non-functional interactive elements.
4. THE Dashboard SHALL display a responsive layout that adapts to viewport widths between 320px and 2560px, such that all four core widgets remain visible and usable, with no content overflow beyond the viewport width and no widget overlapping another widget at any viewport width in that range.
5. WHEN the Dashboard is opened in a browser, THE Dashboard SHALL complete initial render of all four core widgets within 3 seconds on a standard broadband connection of 10 Mbps or faster.
