export {
  advanceNeeds,
  applyNeedDelta,
  DEFAULT_PAWN_NEEDS,
  formatPawnDebugLabel,
  withPawnNeeds
} from "./need-utils";
export {
  needSignalsFromNeeds,
  type NeedSignalSnapshot,
  type NeedUrgency
} from "./need-signals";
export {
  createNeedProfile,
  updateNeedProfile,
  type NeedSnapshot,
  type NeedStage
} from "./need-profile";
export {
  CRITICAL_THRESHOLD,
  evaluateFatigueStage,
  evaluateHungerStage,
  needActionSuggestion,
  WARNING_THRESHOLD,
  type NeedActionSuggestion
} from "./threshold-rules";
export {
  BASE_ENERGY_DRAIN_PER_SECOND,
  BASE_SATIETY_DRAIN_PER_SECOND,
  DEFAULT_EVOLUTION_BY_BEHAVIOR,
  EATING_SATIETY_RECOVERY_PER_SECOND,
  type EvolveNeedsOptions,
  evolveNeeds,
  RESTING_ENERGY_RECOVERY_PER_SECOND,
  type NeedEvolutionRates,
  WANDERING_ENERGY_MULTIPLIER,
  WANDERING_SATIETY_MULTIPLIER,
  WORKING_ENERGY_MULTIPLIER,
  WORKING_SATIETY_MULTIPLIER
} from "./need-evolution-engine";
export {
  isNeedSatisfied,
  PARTIAL_INTERRUPT_REFERENCE_SECONDS,
  type SatisfiableNeedKind,
  settleEating,
  settleInterrupted,
  settleResting
} from "./satisfaction-settler";
