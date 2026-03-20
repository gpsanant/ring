# Plan: Player Nicknames and Name Label Fix

## Overview

Two-part improvement: (1) fix name label rendering (too large, overlapping sprite), and (2) add nickname support via a `set_name` WebSocket message and client-side UI input.

## Part 1: Fix Name Label Rendering

### Current State (client/client.js, `drawStickFigure()`, lines 369–372)
- **Font size**: `Math.max(10, r * 0.5)px monospace` where `r = 15 * scale` — scales with zoom, often too large relative to the stick figure
- **Position**: `py + r * 1.1` — barely below the body, overlaps with stick figure legs (which end at `py + r * 0.8`)

### Fix
- **Reduce font size**: Change from `r * 0.5` to `r * 0.35`, lower minimum to `8` → `Math.max(8, r * 0.35)`
- **Reposition below feet**: Change y-position from `py + r * 1.1` to `py + r * 1.3` — clears the leg endpoints at `py + r * 0.8` with comfortable margin

## Part 2: Nickname Support

### Client-Side UI (client/index.html + client/client.js)

**HTML** — Add a nickname input element:
- A `<div id="nickname-container">` with an `<input type="text" id="nickname-input" maxlength="16" placeholder="Enter nickname...">` and a `<button id="nickname-set">Set</button>`
- Positioned in the HUD area (e.g., below the status text, above the canvas)
- Styled to match existing dark theme: `#1a1a2e` background, monospace font, `#4fc` accent color, similar to existing controls-dialog styling

**JavaScript** — Event handling:
- On submit (Enter key or button click): send `{ type: 'set_name', name: inputValue }` via WebSocket
- **WASD prevention**: In the existing `keydown`/`keyup` handlers, check `if (document.activeElement === nicknameInput) return;` to prevent game input while typing
- Similarly, prevent the 'H' key (controls dialog toggle) while input is focused

### Server-Side (server/index.js + server/game.js)

**server/index.js** — WebSocket `message` handler (line 85–93):
- Add handling for `msg.type === 'set_name'`: call `game.setPlayerName(playerId, msg.name)`

**server/game.js** — New method `setPlayerName(playerId, name)` on Game class:
1. Look up player by ID; return if not found
2. Validate `typeof name === 'string'`; if not, fall back to default
3. Trim whitespace: `name.trim()`
4. Enforce max 16 characters: `name.slice(0, 16)`
5. If result is empty after trim, fall back to `'Player N'`
6. Set `player.name = validatedName`

No further broadcast changes needed — the `name` field is already included in `getState()` and sent to all clients every tick.

### Win Announcement
Already handled: client.js line 171 uses `winner.name` for display. Once the server-side name is updated, it propagates automatically.

## Files Modified

1. **client/index.html** — Add nickname input `<div>` + styling
2. **client/client.js** — Fix name label font/position; prevent WASD when nickname input focused; send `set_name` message
3. **server/index.js** — Handle `set_name` WebSocket message
4. **server/game.js** — Add `setPlayerName()` method with validation
5. **test/game.test.js** — Add tests for `setPlayerName()` validation

## Testing Strategy

Add unit tests for `setPlayerName()`:
- Valid nickname is accepted and stored
- Whitespace is trimmed
- Names longer than 16 chars are truncated
- Empty/whitespace-only names fall back to `'Player N'`
- Non-string input falls back to `'Player N'`
- Name appears in serialized game state

Run full existing test suite to verify no regressions.

## Scope Assessment

**Mode: single** — All changes are tightly coupled (client UI → WebSocket message → server validation → state broadcast → client render). No benefit from parallel execution.
