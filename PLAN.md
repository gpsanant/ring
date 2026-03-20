# Plan: Fix Player Name Size and Nickname Field Positioning

## Problem Analysis

### Issue 1: Player name overlaps with character

In `client/client.js:373-376`, the name label is rendered with:
- Font size: `Math.max(8, r * 0.35)` — effectively always 8px since `r * 0.35` rarely exceeds 8
- Position: `py + r * 1.3` (text baseline)

The stick figure legs end at `py + r * 0.8`. The text top (ascender) is approximately `baseline - fontSize`, so the text occupies from `py + r*1.3 - 8` to `py + r*1.3`.

For overlap check with typical `r ≈ 8-14`:
- Legs bottom: `py + r*0.8` ≈ `py + 6.4` to `py + 11.2`
- Text top: `py + r*1.3 - 8` ≈ `py + 2.4` to `py + 10.2`
- **The text clearly overlaps with the legs in all typical screen sizes.**

### Issue 2: Nickname input overlaps with map

In `client/index.html:138-147`, `#nickname-container` uses `position: absolute; top: 60px; left: 50%; transform: translateX(-50%)`. The canvas is vertically centered via flexbox. On typical screens (viewport 700-900px), the canvas top can be as low as 40px, meaning the centered nickname field at 60px sits directly on top of the map canvas.

## Solution

### `client/client.js` — Name label (2 changes)

1. **Reduce font size**: Change `Math.max(8, r * 0.35)` to `Math.max(7, r * 0.25)` — slightly smaller minimum
2. **Position dynamically below feet**: Instead of a fixed multiplier `py + r * 1.3`, compute the position as `py + r * 0.8 + fontSize + 2`. This places the text baseline at: feet bottom (`r*0.8`) + full font height + 2px padding. This guarantees no overlap at any scale since the text ascender starts exactly 2px below the feet.

### `client/index.html` — Nickname container (1 change)

Reposition `#nickname-container` to the top-right corner:
- Change from: `top: 60px; left: 50%; transform: translateX(-50%)`
- Change to: `top: 10px; right: 16px`
- Remove `left` and `transform` properties

This places the nickname field in the top-right where it won't overlap with either the centered HUD text or the map canvas below.

## Scope

**Mode: single** — Two client-side files, three localized CSS/JS changes, no server changes, no dependencies.

## Verification

- `npm test` still passes (all 887 tests — server-only, unaffected by client changes)
- Visual: player names appear in smaller font clearly below the stick figure with no overlap
- Visual: nickname input field sits in top-right corner, away from map canvas and HUD
