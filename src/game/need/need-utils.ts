import type { NeedKind, PawnNeeds, PawnState } from "../pawn-state";

/** 与 {@link describePawnDebugLabel} 同源，供需求模块与 pawn-state 共用。 */
export function formatPawnDebugLabel(pawn: PawnState): string {
  const goal = pawn.currentGoal?.kind ?? "none";
  const action = pawn.currentAction?.kind ?? "idle";
  const targetId = pawn.currentAction?.targetId ?? pawn.currentGoal?.targetId ?? pawn.reservedTargetId;
  return targetId
    ? `goal:${goal} action:${action} target:${targetId}`
    : `goal:${goal} action:${action}`;
}

function clampNeedValue(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function withDebugLabel(pawn: PawnState): PawnState {
  return {
    ...pawn,
    debugLabel: formatPawnDebugLabel(pawn)
  };
}

export const DEFAULT_PAWN_NEEDS: PawnNeeds = {
  hunger: 20,
  rest: 10,
  recreation: 20
};

export function withPawnNeeds(pawn: PawnState, needs: PawnNeeds): PawnState {
  return withDebugLabel({
    ...pawn,
    needs: {
      hunger: clampNeedValue(needs.hunger),
      rest: clampNeedValue(needs.rest),
      recreation: clampNeedValue(needs.recreation)
    }
  });
}

export function advanceNeeds(
  pawn: PawnState,
  deltaSeconds: number,
  ratesPerSecond: Record<NeedKind, number>
): PawnState {
  const dh = ratesPerSecond.hunger * deltaSeconds;
  const dr = ratesPerSecond.rest * deltaSeconds;
  const drec = ratesPerSecond.recreation * deltaSeconds;
  return withDebugLabel({
    ...withPawnNeeds(pawn, {
      hunger: pawn.needs.hunger + dh,
      rest: pawn.needs.rest + dr,
      recreation: pawn.needs.recreation + drec
    }),
    satiety: clampNeedValue(pawn.satiety - dh),
    energy: clampNeedValue(pawn.energy - dr)
  });
}

export function applyNeedDelta(
  pawn: PawnState,
  deltas: Partial<Record<NeedKind, number>>
): PawnState {
  return withPawnNeeds(pawn, {
    hunger: pawn.needs.hunger + (deltas.hunger ?? 0),
    rest: pawn.needs.rest + (deltas.rest ?? 0),
    recreation: pawn.needs.recreation + (deltas.recreation ?? 0)
  });
}
