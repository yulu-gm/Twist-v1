# Construction Ghost Rendering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render blueprints and construction sites as translucent build-state overlays and show blocked footprints with an obvious warning style.

**Architecture:** Split blueprint and construction-site rendering out of the shared default rectangle renderer into a dedicated construction renderer. Keep the construction rules unchanged and reuse `hasConstructionOccupants()` from the construction helpers so the rendering layer reflects the same blockage state used by gameplay.

**Tech Stack:** TypeScript, Phaser, Vitest, existing object renderer registry

---

### Task 1: Lock the desired visuals with renderer tests

**Files:**
- Create: `src/adapter/render/object-renderers/construction-renderer.test.ts`

**Step 1: Write the failing test for blueprint translucency**

Add a test that:
- creates a fake scene and fake layer container
- creates a `Blueprint`
- calls `ConstructionRenderer.createSprite(...)`
- asserts the fill alpha is below `1`
- asserts the normal blueprint stroke color is not the blocked warning color

**Step 2: Run test to verify it fails**

Run: `npm test -- src/adapter/render/object-renderers/construction-renderer.test.ts`
Expected: FAIL because the renderer does not exist yet.

**Step 3: Write the failing test for construction-site translucency**

Add a test that:
- creates a `ConstructionSite`
- calls `createSprite(...)`
- asserts the fill alpha is below `1`
- asserts the normal site style differs from the blueprint style

**Step 4: Run test to verify it fails**

Run: `npm test -- src/adapter/render/object-renderers/construction-renderer.test.ts`
Expected: FAIL because the dedicated renderer and style logic still do not exist.

**Step 5: Write the failing test for blocked warning style**

Add a test that:
- builds a fake `GameMap`
- reports a physical occupant inside the blueprint or site footprint
- updates the sprite through `updateSprite(...)`
- asserts the stroke switches to warning red and the fill style changes to the blocked palette

**Step 6: Run test to verify it fails**

Run: `npm test -- src/adapter/render/object-renderers/construction-renderer.test.ts`
Expected: FAIL because blocked-state styling is not implemented.

### Task 2: Implement the dedicated construction renderer

**Files:**
- Create: `src/adapter/render/object-renderers/construction-renderer.ts`
- Modify: `src/adapter/render/object-renderers/default-renderer.ts`

**Step 1: Add the renderer class**

Create a renderer that owns:
- `ObjectKind.Blueprint`
- `ObjectKind.ConstructionSite`

Use a rectangle sprite with explicit fill alpha and stroke alpha so the object remains translucent and readable.

**Step 2: Add style helpers**

Implement helpers that:
- choose normal blueprint style
- choose normal construction-site style
- choose blocked warning style when `hasConstructionOccupants()` is true

Keep the style selection pure and local to the renderer.

**Step 3: Remove blueprint and construction-site handling from the default renderer**

Leave the default renderer responsible for:
- `ObjectKind.Building`
- `ObjectKind.Fire`
- `ObjectKind.Designation`

This prevents generic object styling from overriding the construction visuals.

**Step 4: Run targeted test**

Run: `npm test -- src/adapter/render/object-renderers/construction-renderer.test.ts`
Expected: PASS

### Task 3: Register the construction renderer in render sync

**Files:**
- Modify: `src/adapter/render/render-sync.ts`

**Step 1: Instantiate the new renderer**

Construct `ConstructionRenderer` with the scene, the building layer, and the active map.

**Step 2: Register it before the default renderer**

Ensure `ObjectKind.Blueprint` and `ObjectKind.ConstructionSite` resolve to the new renderer instead of falling through to `DefaultRenderer`.

**Step 3: Run targeted test**

Run: `npm test -- src/adapter/render/object-renderers/construction-renderer.test.ts`
Expected: PASS and renderer registration compiles cleanly.

### Task 4: Verify targeted rendering behavior

**Files:**
- Test: `src/adapter/render/object-renderers/construction-renderer.test.ts`
- Test: `src/adapter/render/selection-highlight.test.ts`
- Test: `src/adapter/render/world-preview.test.ts`

**Step 1: Run the rendering-focused suite**

Run: `npm test -- src/adapter/render/object-renderers/construction-renderer.test.ts src/adapter/render/selection-highlight.test.ts src/adapter/render/world-preview.test.ts`
Expected:
- PASS for all targeted tests
- no regressions in existing rectangle-based render helpers

**Step 2: Commit**

```bash
git add docs/plans/2026-04-14-construction-ghost-rendering-design.md docs/plans/2026-04-14-construction-ghost-rendering.md src/adapter/render/object-renderers/construction-renderer.test.ts src/adapter/render/object-renderers/construction-renderer.ts src/adapter/render/object-renderers/default-renderer.ts src/adapter/render/render-sync.ts
git commit -m "feat: improve construction ghost rendering"
```
