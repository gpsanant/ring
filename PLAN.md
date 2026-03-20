# Implementation Plan

## Task

Add a dialog with the controls — a client-side overlay that shows the player how to play the game (WASD to move, mouse to aim, click to shoot). The dialog must be dismissible and must not block WebSocket initialization.

## Approach

1. **HTML**: Add a `#controls-overlay` div containing a `#controls-dialog` with a table of keybindings (WASD/Mouse/Click) and a dismiss button. Also add a small `#controls-hint` label so the player can re-open the dialog.
2. **CSS**: Style the overlay as a centered modal with semi-transparent backdrop, matching the game's dark monospace theme.
3. **JS**: Wire up dismiss/show logic — clicking the button, clicking the backdrop, pressing Escape, or pressing H all toggle the dialog. The dialog code runs after `connect()` so it never blocks WebSocket initialization.

## Acceptance Criteria

- Controls dialog is shown on page load
- Shows WASD for movement, Mouse for aim, Left Click for shoot
- Dismissible via button, backdrop click, Escape key, or H key
- H key toggles the dialog back open after dismissal
- Does not block WebSocket connection (connect() called before dialog logic)
- Existing tests still pass (dialog is client-only, no server changes)
