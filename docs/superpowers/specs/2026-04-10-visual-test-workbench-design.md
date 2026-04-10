# Visual Test Workbench Design

**Date:** 2026-04-10  
**Topic:** Redesign the `visual-test` entry into a single-page scenario workbench so users can enter a scenario, manually start it, adjust time controls, debug step progression, and return to scenario selection without refreshing the page  
**Related Docs:**
- [scenario-testing.md](D:/CC/Twist-v1/docs/testing/scenario-testing.md)
- [2026-04-10-simulation-scenario-testing-design.md](D:/CC/Twist-v1/docs/superpowers/specs/2026-04-10-simulation-scenario-testing-design.md)
- [2026-04-10-scenario-boundaries-and-long-regression-design.md](D:/CC/Twist-v1/docs/superpowers/specs/2026-04-10-scenario-boundaries-and-long-regression-design.md)

---

## 1. Background

The current `visual-test` flow already opens `scenario-select.html`, but once a scenario is chosen the page immediately switches into execution mode and leaves no clean session boundary behind.

The current pain points are:

1. After selecting and running one scenario, there is no supported way to exit back to the selector and run a different scenario in the same page session.
2. Time control exists only as keyboard shortcuts inherited from the main game scene, so it is effectively undiscoverable inside the visual runner workflow.
3. The visual runner controller acts like a one-shot executor. It exposes `run()` but does not own a full session lifecycle such as `start`, `pause`, `restart`, `exit`, or `destroy`.
4. The current selector page directly starts the controller, while the controller bootstraps Phaser without preserving a teardown handle. This makes repeated scenario runs likely to leak old `Phaser.Game` instances, scene input listeners, or stale world state.

These issues make the visual runner awkward as a debugging surface, especially for longer scenarios where users need to pause, single-step, speed up, or back out and try another scenario.

---

## 2. Goals

### 2.1 Primary Goals

1. Turn `visual-test` into a single-page workbench that supports both scenario selection and scenario execution without page reload.
2. Separate "scenario selected" from "scenario started" so users enter a ready state first and manually choose when execution begins.
3. Add explicit, visible time controls to the workbench UI rather than relying on hidden keyboard commands.
4. Support debug-grade stepping controls:
   - pause
   - 1x / 2x / 3x speed
   - step 1 tick
   - step 10 ticks
   - run until the next meaningful execution gate
5. Add a clean return-to-selector flow that destroys the current visual session before loading another scenario.
6. Ensure restart always creates a fresh scenario session with a fresh world and fresh Phaser instance.

### 2.2 Non-Goals

1. This redesign does not try to replace the existing scenario DSL or headless runner.
2. This redesign does not attempt to build a full breakpoint debugger for every individual script step.
3. This redesign does not change core simulation speed semantics in the production runtime.
4. This redesign does not require introducing a separate routing library or a large app shell framework.

---

## 3. Product Direction

The chosen direction is a **single-page workbench**.

Behaviorally, the workbench should work like this:

1. Open `visual-test`.
2. See the scenario list.
3. Pick a scenario.
4. Enter a workbench view for that scenario in a `ready` state.
5. Manually click `Start` to begin execution.
6. During execution, use visible controls to pause, change speed, single-step, or run to the next gate.
7. At any time, exit back to the selector without reloading the page.
8. Restarting the same scenario always creates a brand-new session and returns to `ready`.

The key product decision is that **selection is not execution**. Choosing a scenario loads a workbench session, but does not auto-run it.

---

## 4. Recommended Architecture

The workbench should be split into three layers:

### 4.1 Page Shell

File: [scenario-select-main.ts](D:/CC/Twist-v1/src/testing/visual-runner/scenario-select-main.ts)

Responsibilities:

1. Maintain top-level page mode:
   - selector mode
   - workbench mode
2. Read and write the `scenario` URL parameter.
3. Create and dispose the current controller session.
4. Wire controller state into the HUD view.
5. Handle user actions from the HUD:
   - start
   - pause
   - resume
   - speed change
   - step ticks
   - run to next gate
   - restart
   - exit to selector

The page shell should not manipulate the world directly.

### 4.2 Session Controller

File: [visual-scenario-controller.ts](D:/CC/Twist-v1/src/testing/visual-runner/visual-scenario-controller.ts)

Responsibilities:

1. Own a single visual runner session from creation to teardown.
2. Build and destroy:
   - `visualHarness`
   - `shadowHarness`
   - `Phaser.Game`
3. Track session state and expose it as a single read-only snapshot for the HUD.
4. Provide explicit session commands:
   - `start`
   - `pause`
   - `resume`
   - `setSpeed`
   - `stepTicks`
   - `runUntilNextGate`
   - `restart`
   - `destroy`

This is the center of the redesign. The current controller is only a runner; the new controller must be a lifecycle owner.

### 4.3 Workbench HUD

File: [scenario-hud.tsx](D:/CC/Twist-v1/src/testing/visual-runner/scenario-hud.tsx)

Responsibilities:

1. Display current scenario metadata and session state.
2. Render visible action buttons and time controls.
3. Show current tick, current speed, and current step.
4. Continue showing visual vs. shadow step progress and divergence data.
5. Emit user intents through callbacks rather than directly mutating runtime state.

The HUD should remain a view layer. It should not hold business state beyond local rendering concerns.

---

## 5. Session State Model

The workbench should formalize session status instead of inferring it from partial fields.

Recommended states:

1. `idle`
   No scenario selected.
2. `ready`
   Scenario selected and session created, but execution has not started.
3. `running`
   Scenario is actively advancing.
4. `paused`
   Scenario has started, but automatic advancement is stopped.
5. `completed`
   Scenario finished successfully.
6. `failed`
   Scenario hit a failed step or runtime error, and the scene remains available for inspection.

State rules:

1. Selecting a scenario transitions `idle -> ready`.
2. Clicking `Start` transitions `ready -> running`.
3. Clicking `Pause` transitions `running -> paused`.
4. Clicking `Resume` transitions `paused -> running`.
5. Successful completion transitions `running -> completed`.
6. Failed execution transitions `running -> failed`.
7. `Restart` always destroys the old session and returns to `ready`.
8. `Exit to Selector` always destroys the old session and returns to `idle`.

This state model removes ambiguity around which buttons are legal at any point.

---

## 6. Controller Interface Design

The controller should evolve from a one-shot `run()` API into an explicit session API.

Recommended shape:

```ts
type VisualScenarioController = {
  getState(): ControllerState;
  subscribe(listener: (state: ControllerState) => void): () => void;
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  setSpeed(speed: SimSpeed): void;
  stepTicks(count: number): Promise<void>;
  runUntilNextGate(): Promise<void>;
  restart(): Promise<void>;
  destroy(): Promise<void>;
};
```

### 6.1 `start()`

Responsibilities:

1. Bootstrap Phaser if this is the first run of the session.
2. Run setup work if it has not already completed.
3. Begin automatic advancement of the visual scenario script.
4. Emit state changes throughout execution.

### 6.2 `pause()` and `resume()`

These should be the canonical entry points for pausing and continuing the session. Both HUD clicks and keyboard shortcuts should flow through them.

Internally this still maps to `world.speed`, but the workbench should no longer depend on hidden keyboard-only affordances.

### 6.3 `setSpeed(speed)`

Supported values:

1. `Paused`
2. `Normal`
3. `Fast`
4. `UltraFast`

The controller state should expose both the raw enum and a user-facing label so the HUD can display current speed cleanly.

### 6.4 `stepTicks(count)`

Purpose:

Advance the world manually while paused.

Constraints:

1. Only valid in `paused`.
2. Should reject or no-op in `ready`, `running`, `completed`, or `failed`.
3. Must update the HUD after each advancement batch.
4. Should preserve divergence tracking and current-step tracking.

The chosen workbench controls require at least:

1. `stepTicks(1)`
2. `stepTicks(10)`

### 6.5 `runUntilNextGate()`

This is the highest-value debug control beyond basic stepping.

A gate should be defined as one of:

1. a `waitFor` condition becoming satisfied
2. completion of the next script-step boundary
3. scenario completion
4. scenario failure

This lets users move through long scenarios meaningfully without either tapping `+1 tick` repeatedly or overshooting a point of interest with full-speed execution.

### 6.6 `restart()`

Responsibilities:

1. Fully destroy the current session.
2. Recreate harnesses and fresh controller state using the same scenario and deterministic seed.
3. Return the new session to `ready`.
4. Clear tick counters, step summaries, divergence state, and result state.

`restart()` must not reuse a dirty world or stale `Phaser.Game`.

### 6.7 `destroy()`

This is mandatory for the redesign.

Responsibilities:

1. Call `game.destroy(true)` on the active `Phaser.Game` if present.
2. Remove any leftover DOM content inside `scenario-game-container` if Phaser leaves remnants behind.
3. Release controller subscriptions or polling loops.
4. Mark the session as inactive so late async work cannot mutate a dead session.

Without a formal destroy path, exit and rerun behavior will remain fragile.

---

## 7. Workbench UI Layout

The current HUD should become a right-side workbench panel rather than a read-only overlay.

Recommended sections, top to bottom:

### 7.1 Session Header

Show:

1. scenario title
2. scenario id
3. session state
4. current tick
5. current speed
6. current step title

This gives users immediate orientation.

### 7.2 Primary Actions

Main buttons:

1. `Start`
2. `Pause`
3. `Resume`
4. `Restart`
5. `Back to Scenarios`

Visibility rules:

1. `ready`: show `Start`
2. `running`: show `Pause`
3. `paused`: show `Resume`
4. `completed` and `failed`: show `Restart` and `Back to Scenarios`

`Restart` and `Back to Scenarios` may also remain visible in paused/ready states if the layout stays clear.

### 7.3 Time Controls

Required visible controls:

1. `Pause`
2. `1x`
3. `2x`
4. `3x`
5. `+1 tick`
6. `+10 ticks`
7. `Run to Next Gate`

Behavior:

1. Speed buttons should be available once the session has started.
2. `+1 tick`, `+10 ticks`, and `Run to Next Gate` should only be enabled in `paused`.
3. Current speed should be highlighted visually.

### 7.4 Result Summary

Show:

1. pass/fail/completed summary
2. divergence presence
3. last completed step
4. first failed step, if any

This gives users a quick read before they scan the full step list.

### 7.5 Step Panels

Keep the existing dual-column concept:

1. `Visual Runner`
2. `Shadow Headless Runner`

Continue showing per-step statuses and divergence information, since that remains core to the visual runner's debugging value.

---

## 8. URL Behavior

The workbench should keep the URL useful without making it responsible for runtime state.

### 8.1 URL Rules

1. Selector page with no chosen scenario:
   - `scenario-select.html`
2. Chosen scenario in workbench:
   - `scenario-select.html?scenario=<id>`

### 8.2 Refresh Behavior

If the page loads with a valid `scenario=<id>` parameter:

1. the app should load that scenario into `ready`
2. the app should not auto-run it

This preserves shareable deep links while honoring the chosen manual-start workflow.

### 8.3 Exit Behavior

When the user clicks `Back to Scenarios`:

1. destroy the active session
2. remove the `scenario` parameter from the URL
3. return to selector mode

---

## 9. Execution Flow

### 9.1 Enter Scenario

1. User clicks a scenario card.
2. Page shell updates the URL with `?scenario=<id>`.
3. Page shell creates a controller for that scenario.
4. Controller builds a fresh session and emits `ready`.
5. Workbench view appears, but no scenario steps run yet.

### 9.2 Start Run

1. User clicks `Start`.
2. Controller bootstraps Phaser if needed.
3. Controller begins scenario execution.
4. Session transitions to `running`.

### 9.3 Pause And Debug

1. User clicks `Pause`.
2. Controller transitions to `paused`.
3. User can now:
   - set speed back to 1x / 2x / 3x before resuming
   - step 1 tick
   - step 10 ticks
   - run to next gate

### 9.4 Restart

1. User clicks `Restart`.
2. Controller destroys the current session.
3. Controller recreates a fresh deterministic session.
4. Workbench returns to `ready`.

### 9.5 Exit To Selector

1. User clicks `Back to Scenarios`.
2. Controller destroys the current session.
3. Page shell removes the `scenario` URL parameter.
4. Selector view becomes active again.

---

## 10. Phaser Lifecycle Requirements

The current implementation bootstraps Phaser but does not retain a full lifecycle contract around it.

The redesign should make the `Phaser.Game` instance an explicit field of the controller session.

Required rules:

1. Only one live `Phaser.Game` instance may exist per workbench page at a time.
2. Starting a new scenario must destroy the old game first if one exists.
3. Restarting the same scenario must destroy and recreate the game.
4. Exiting to selector must destroy the game and clear the runner container.

This avoids stacked scenes, duplicate keyboard listeners, and stale render state.

---

## 11. Data Flow

Recommended data flow is one-directional:

1. Page shell owns the active controller reference.
2. Controller emits immutable state snapshots.
3. HUD renders snapshots and exposes callbacks.
4. Callbacks flow back into the page shell.
5. Page shell invokes controller methods.

The HUD should not access `world`, `harness`, or `Phaser.Game` directly.

This keeps the view testable and avoids accidental runtime coupling.

---

## 12. Error Handling

Two error scopes should be treated differently.

### 12.1 Session-Level Failures

Examples:

1. a scenario step fails
2. a `waitFor` times out
3. divergence is detected

Handling:

1. transition to `failed`
2. preserve the scene and HUD state
3. allow the user to inspect, step, restart, or return to selector

The workbench should not immediately throw the user back to the selector.

### 12.2 Page-Level Failures

Examples:

1. invalid scenario id in URL
2. controller cannot initialize
3. Phaser bootstrap fails before a usable session exists

Handling:

1. show a clear error banner
2. fall back to selector mode where possible

---

## 13. Testing Strategy

The redesign needs tests for both UI behavior and session boundaries.

### 13.1 HUD Component Tests

File: [scenario-hud.test.tsx](D:/CC/Twist-v1/src/testing/visual-runner/scenario-hud.test.tsx)

Add coverage for:

1. `ready`, `running`, `paused`, `completed`, and `failed` button states
2. current speed label rendering
3. tick display rendering
4. enabling and disabling of:
   - `+1 tick`
   - `+10 ticks`
   - `Run to Next Gate`

### 13.2 Page Shell Tests

The page entry should have extractable logic or helpers so it can be tested without booting a real Phaser session.

Add coverage for:

1. selecting a scenario enters `ready` instead of auto-starting
2. exiting to selector clears the URL
3. reloading with `?scenario=<id>` lands in `ready`
4. restart replaces the old controller session rather than reusing it

### 13.3 Controller Tests

Add focused tests around session lifecycle:

1. `destroy()` destroys the live `Phaser.Game`
2. `restart()` resets ticks, steps, divergence, and result state
3. `setSpeed()` updates session state correctly
4. `stepTicks()` is only valid while paused
5. `runUntilNextGate()` stops on a valid gate instead of running through to the end

These tests are essential because the redesign's hardest bugs are session-boundary bugs, not rendering bugs.

---

## 14. Implementation Notes

The most likely code changes are:

1. [scenario-select-main.ts](D:/CC/Twist-v1/src/testing/visual-runner/scenario-select-main.ts)
   - split selector mode from workbench mode
   - stop auto-running on scenario selection
   - coordinate URL, controller creation, and exit
2. [visual-scenario-controller.ts](D:/CC/Twist-v1/src/testing/visual-runner/visual-scenario-controller.ts)
   - add session states
   - own `Phaser.Game`
   - add explicit lifecycle and debug-control methods
3. [scenario-hud.tsx](D:/CC/Twist-v1/src/testing/visual-runner/scenario-hud.tsx)
   - render action buttons
   - render speed and stepping controls
   - render richer session status
4. [bootstrap.ts](D:/CC/Twist-v1/src/adapter/bootstrap.ts)
   - likely no behavior change needed
   - but its `Phaser.Game` return value must be preserved and destroyed by the controller
5. [scenario-select.html](D:/CC/Twist-v1/scenario-select.html)
   - layout adjustments may be needed if the control panel grows

---

## 15. Risks And Trade-Offs

### 15.1 Risk: Overloading The HUD

Adding too many buttons could make the panel cluttered.

Mitigation:

1. keep a single-column structure
2. group controls into sections
3. only enable advanced debug controls in `paused`

### 15.2 Risk: Async Session Races

If `destroy()` happens while async run work is still in flight, stale promises could update dead state.

Mitigation:

1. add a session token or `isDisposed` guard
2. ignore late async completions after teardown

### 15.3 Risk: Stepping Semantics Drift From Runtime

If manual stepping bypasses the same runtime path used by normal visual execution, users may see inconsistent behavior.

Mitigation:

1. route stepping through the same harness and world advancement logic
2. keep one canonical advancement path inside the controller

---

## 16. Conclusion

The right redesign is not a small button patch on top of the current selector page. The real need is a proper visual-test workbench with explicit session ownership.

The core decisions are:

1. single-page workbench rather than page-jump flow
2. scenario selection loads a `ready` session but does not auto-run
3. visible time controls replace hidden-only keyboard discovery
4. the controller becomes a lifecycle owner with `start`, `pause`, `resume`, `setSpeed`, `stepTicks`, `runUntilNextGate`, `restart`, and `destroy`
5. every exit and restart path destroys the old Phaser session first

If these boundaries are implemented cleanly, the visual runner becomes a practical debugging surface instead of a one-shot demo entry.
