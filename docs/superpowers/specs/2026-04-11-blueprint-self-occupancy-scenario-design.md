# Blueprint Self-Occupancy Scenario Design

## Goal

Add a shared testing scenario that answers one narrow question:

When the last material delivery completes while the delivering pawn is still standing on the blueprint cell or within the blueprint footprint, does that pawn's own occupancy block blueprint promotion to a construction site?

The scenario should be runnable in both headless regression and the visual workbench through the existing shared `ScenarioDefinition`.

## Scope

This design covers only a diagnostic regression scenario.

It does not change construction logic, retry behavior, occupancy rules, or delivery behavior.

## Existing Constraints

- `executeDeliver()` already calls `tryPromoteBlueprintToConstructionSite()` immediately after the final delivery.
- That call passes `ignoreIds: [pawn.id]`, so the delivering pawn is intentionally ignored during occupancy checks.
- The current test harness can observe pawn state, blueprints, construction sites, and buildings, but it does not yet expose a direct `findConstructionSiteAt()` query helper.

## Scenario Shape

Create a scenario focused on a single builder and a single `wall_wood` blueprint:

1. Spawn one builder and one stack of wood that exactly satisfies the wall cost.
2. Place a `wall_wood` blueprint close enough that the builder will carry the full batch in one trip.
3. Wait until the builder is carrying wood.
4. Wait until the builder reaches the blueprint cell while still carrying wood.
5. Wait for the blueprint to promote into a construction site without requiring the builder to first vacate the tile.
6. Wait for the final building to complete.

If this scenario passes, it disproves the "self-occupancy blocks promote" hypothesis.

If it fails specifically because the blueprint remains fully delivered but never promotes while the same pawn occupies the cell, it supports the hypothesis.

## Required Observability

The scenario needs to observe:

- the builder's current position
- whether the builder is still carrying wood
- whether a blueprint still exists at the target cell
- whether a construction site exists at the target cell
- whether a final building exists at the target cell

The smallest harness extension is a query helper that can find a construction site by target def and origin cell.

## Assertions

The scenario should assert:

- the builder did carry wood to the blueprint
- a construction site appeared at the blueprint cell
- the final `wall_wood` building was created
- the builder ended without carrying items

The scenario should not try to prove why a failure happened beyond these observable milestones.

## Non-Goals

- no retry-system coverage in this scenario
- no external blocker setup
- no forced jobs or manual pawn repositioning
- no construction-system production change
