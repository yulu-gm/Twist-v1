# Construction Ghost Rendering Design

**Date:** 2026-04-14

**Goal:** Improve blueprint and construction-site readability by rendering both as translucent build states, while making footprint blockage obvious at a glance.

## Context

Blueprints and construction sites currently share the generic rectangle renderer used by several unrelated object kinds. That renderer draws opaque filled rectangles, so build-state objects read too much like finished world objects and do not communicate why construction is blocked when items or other physical occupants overlap the footprint.

The construction domain already exposes the needed blockage signal through `hasConstructionOccupants()` in `src/features/construction/construction.helpers.ts`. The rendering layer can consume that signal without changing construction rules.

## Requirements

1. Blueprints and construction sites must render semi-transparently.
2. Blueprints and construction sites must remain visually distinct from each other.
3. A blocked blueprint or construction site must be visually obvious without selecting or inspecting it.
4. The blockage treatment must still allow the overlapping item or occupant below to remain visible through the build-state overlay.
5. Ordinary buildings, fires, and designations must keep their current rendering path.

## Options

### Option 1: Keep the default renderer and only lower alpha

This is the smallest code change, but it does not create enough separation between generic buildings and construction states. It also gives very little room to express blocked state beyond a simple color swap.

### Option 2: Keep the default renderer and add a conditional blocked outline

This improves blocked feedback, but blueprints and sites still inherit a renderer meant for unrelated objects. The visual language stays weak and future construction-specific styling remains awkward.

### Option 3: Add a dedicated construction renderer

This isolates build-state rendering from generic building rendering, makes translucent styling straightforward, and allows blocked-state treatment to evolve independently. This is the recommended option.

## Chosen Design

Introduce a dedicated `ConstructionRenderer` in `src/adapter/render/object-renderers/` responsible only for:

- `ObjectKind.Blueprint`
- `ObjectKind.ConstructionSite`

The renderer will:

- draw a semi-transparent fill for both object kinds
- use kind-specific outline colors so blueprints and sites remain easy to tell apart
- query `hasConstructionOccupants()` each sync to detect blocked footprints
- switch blocked objects into a warning style with a red outline and stronger warning fill

## Visual Rules

### Blueprint

- Fill uses the blueprint base color with low alpha
- Stroke uses a brighter blueprint-colored outline
- Purpose: reads as planned / not yet started

### Construction site

- Fill uses the construction-site base color with a slightly stronger alpha than blueprint
- Stroke uses a warm orange outline
- Purpose: reads as active work state

### Blocked state

- Applies to both blueprints and construction sites when `hasConstructionOccupants()` returns true
- Stroke switches to warning red
- Fill remains translucent but shifts toward warning red so the overlapped occupant is still visible underneath
- This creates two simultaneous cues:
  - the build-state object is blocked
  - the blocking occupant is still visible because the fill is not opaque

## Testing Strategy

Add renderer-focused tests that verify:

1. blueprint sprites are created with translucent fill
2. construction-site sprites are created with translucent fill
3. blocked state changes the style away from the normal blueprint/site style
4. the dedicated renderer is wired separately from the default renderer path

## Affected Files

- Create: `src/adapter/render/object-renderers/construction-renderer.ts`
- Create: `src/adapter/render/object-renderers/construction-renderer.test.ts`
- Modify: `src/adapter/render/render-sync.ts`
- Modify: `src/adapter/render/object-renderers/default-renderer.ts`

## Risks

- Phaser test doubles may need a small fake surface for alpha and stroke assertions.
- If construction occupancy semantics change later, the renderer should continue consuming the shared helper instead of duplicating footprint logic.
