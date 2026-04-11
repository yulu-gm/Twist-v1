# Carry Overflow Handling Design

## Goal

When a pawn delivers more of a material than a blueprint still needs, the pawn should deliver only the missing amount and keep the remainder in inventory instead of grounding it immediately.

## Rules

1. Partial blueprint delivery only consumes the missing amount.
2. Any remainder stays in `pawn.inventory.carrying`.
3. Carrying remainder does not globally change job priorities.
4. A carried remainder only matters when the next candidate job would be blocked by an existing carried stack, especially jobs with a `PickUp` toil.
5. If a pawn is blocked by carried remainder and has no better non-blocked job, the AI may assign a low-priority carry-resolution job:
   - First choice: deliver the carried material to a reachable blueprint that still needs it.
   - Fallback: move the carried material to stockpile or another legal drop cell.

## Implementation Shape

- Keep the delivery behavior change inside `src/features/ai/toil-handlers/deliver.handler.ts`.
- Keep carry-aware selection in `src/features/ai/job-selector.ts`.
- Introduce a small carry-resolution job factory if the existing haul job shape is too pickup-centric.

## Testing

1. Delivery regression:
   - Pawn carries more wood than a blueprint still needs.
   - Delivery completes.
   - Blueprint receives only the missing amount.
   - Pawn still carries the remainder.
   - No excess material is grounded near the blueprint.

2. Selection regressions:
   - If a pawn carries remainder and an unblocked `construct` job exists, `construct` should still win over carry-resolution.
   - If a pawn carries remainder and only pickup-based jobs are otherwise available, AI should choose a carry-resolution job instead of assigning a job that will fail on pickup.
