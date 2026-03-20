# Task: Add controls dialog overlay
**Type**: feature | **Size**: small | **Priority**: normal

## Implementation Plan
See **PLAN.md** in this directory for technical approach and architecture.

## Acceptance Criteria
1. Controls dialog is shown on page load
2. Shows WASD for movement, Mouse for aim, Left Click for shoot
3. Dismissible via button, backdrop click, Escape key, or H key
4. H key toggles the dialog back open after dismissal
5. Does not block WebSocket connection (connect() called before dialog logic)
6. Existing tests still pass (dialog is client-only, no server changes)

## Changes in This Branch
- `client/index.html`: Added `#controls-overlay` with dialog markup, CSS styles for modal, backdrop, and hint label
- `client/client.js`: Added dismiss/show logic for the controls overlay (button, backdrop, Escape, H key toggle)
- `PLAN.md`: Implementation plan document