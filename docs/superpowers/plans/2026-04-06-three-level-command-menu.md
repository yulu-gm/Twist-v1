# Three-Level Command Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current flat bottom toolbar with a persistent three-level command menu whose selected command behaves like the active brush/tool mode.

**Architecture:** Introduce a data-driven command menu tree, promote command selection to the single source of truth for HUD and interaction state, and adapt the existing scene/input bridge to consume command-derived interaction modes. Keep domain behavior compatible by reusing current tool/mode mappings wherever possible.

**Tech Stack:** TypeScript, Phaser 3, DOM HUD in `index.html`, Vitest + happy-dom

---

## File Structure

- Create: `D:\CC\Twist-v1\src\data\command-menu.ts`
  - Three-level menu data, command/category ids, mapping helpers.
- Create: `D:\CC\Twist-v1\tests\ui\command-menu-model.test.ts`
  - Pure state-model coverage for menu open/close, category switching, command persistence.
- Modify: `D:\CC\Twist-v1\src\ui\menu-model.ts`
  - Replace flat menu state with command-menu state and command-to-interaction helpers.
- Modify: `D:\CC\Twist-v1\src\ui\ui-types.ts`
  - Update HUD read model types away from flat toolbar selection.
- Modify: `D:\CC\Twist-v1\index.html`
  - Replace `villager-tool-bar` container with the new menu DOM anchors and styles.
- Modify: `D:\CC\Twist-v1\src\ui\hud-manager.ts`
  - Render and sync primary entry, categories, and command list.
- Modify: `D:\CC\Twist-v1\src\scenes\GameScene.ts`
  - Promote command menu state to scene state and connect HUD callbacks.
- Modify: `D:\CC\Twist-v1\src\scenes\game-scene-hud-sync.ts`
  - Derive player channel hint from active command instead of selected toolbar slot.
- Modify: `D:\CC\Twist-v1\src\scenes\game-scene-floor-interaction.ts`
  - Consume command-derived interaction mode instead of old build submenu state.
- Modify: `D:\CC\Twist-v1\src\player\interaction-mode-presenter.ts`
  - Add presentation mapping for command ids/categories.
- Modify: `D:\CC\Twist-v1\tests\scene-hud-markup.test.ts`
  - Update DOM/HUD tests to the new menu structure.

## Task 1: Build the pure command menu model

**Files:**
- Create: `D:\CC\Twist-v1\src\data\command-menu.ts`
- Modify: `D:\CC\Twist-v1\src\ui\menu-model.ts`
- Modify: `D:\CC\Twist-v1\src\ui\ui-types.ts`
- Test: `D:\CC\Twist-v1\tests\ui\command-menu-model.test.ts`

- [ ] Define category ids, command ids, and a three-level menu config that includes current live commands such as mine, demolish, lumber, haul, build-wall, and place-bed.
- [ ] Add a pure menu state type with at least `isOpen`, `activeCategoryId`, and `activeCommandId`, plus reducers/helpers for toggling open state, switching categories, and selecting commands without auto-closing.
- [ ] Add a pure helper that converts the active command into the existing interaction semantics (`inputShape`, underlying tool id / build sub id / mode presentation key).
- [ ] Write state-model tests that prove:
  - menu open/close does not clear the active command
  - switching categories changes the visible command group but not the active command
  - selecting a command persists across close/reopen
  - build-wall resolves to brush mode and place-bed resolves to single-cell mode

## Task 2: Replace the HUD structure and rendering

**Files:**
- Modify: `D:\CC\Twist-v1\index.html`
- Modify: `D:\CC\Twist-v1\src\ui\hud-manager.ts`
- Modify: `D:\CC\Twist-v1\tests\scene-hud-markup.test.ts`

- [ ] Replace the old `villager-tool-bar` root markup/styles with three anchors:
  - primary command button at lower-left
  - category rail at left-lower area
  - command list at bottom-center
- [ ] Replace `setupToolBar` / `syncToolBarSelection` with command-menu oriented APIs that render categories and commands from data, support persistent selected highlighting, and never special-case build submenu rendering.
- [ ] Keep `player-channel-hint` and other HUD areas intact.
- [ ] Update happy-dom HUD tests to verify:
  - the new containers exist
  - category clicks swap the command list
  - command clicks keep the selected item highlighted
  - no build submenu DOM is required anymore

## Task 3: Rewire scene state and player-channel presentation

**Files:**
- Modify: `D:\CC\Twist-v1\src\scenes\GameScene.ts`
- Modify: `D:\CC\Twist-v1\src\scenes\game-scene-hud-sync.ts`
- Modify: `D:\CC\Twist-v1\src\player\interaction-mode-presenter.ts`

- [ ] Introduce scene-level command menu state as the new source of truth.
- [ ] Remove direct dependence on `selectedToolIndex` + `buildSubTool` for HUD sync.
- [ ] Keep compatibility helpers if needed, but only the command state may drive the HUD and player-channel hint.
- [ ] Update the player channel line to describe the active command from the new model.
- [ ] Preserve existing scene restart, debug panel, time HUD, and pawn roster behavior.

## Task 4: Rewire map interaction and verify compatibility

**Files:**
- Modify: `D:\CC\Twist-v1\src\scenes\game-scene-floor-interaction.ts`
- Modify: `D:\CC\Twist-v1\src\ui\menu-model.ts`
- Modify: `D:\CC\Twist-v1\src\player\interaction-mode-presenter.ts`
- Test: existing targeted Vitest suites for HUD and headless behavior

- [ ] Replace old toolbar/build submenu reads with command-derived interaction mode.
- [ ] Verify that rectangle, brush, and single-cell inputs still route to the existing world commit APIs.
- [ ] Ensure command changes reset drag/brush gesture state the same way tool changes used to.
- [ ] Run focused tests for:
  - HUD markup and menu behavior
  - build wall flow
  - build bed flow
  - any scene HUD regression coverage

## Execution Notes

- Subagent slice A can own Task 1 (pure data/state model).
- Subagent slice B can own Task 2 (DOM/HUD rendering and HUD tests).
- Main agent should own Tasks 3-4 integration because they bridge both slices.
- After slice A and B land, reconcile interfaces before editing scene/input code.

## Self-Review

- Spec coverage: plan covers menu tree, persistent selection, HUD layout, active command state, and interaction compatibility.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: all tasks refer to command menu state, active category id, and active command id consistently.
