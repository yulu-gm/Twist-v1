import {
  evaluateFatigueStage,
  evaluateHungerStage,
  type NeedStage
} from "./threshold-rules";

export type { NeedStage } from "./threshold-rules";

export type NeedSnapshot = Readonly<{
  pawnId: string;
  /** 0..100，越高越饱。 */
  satiety: number;
  /** 0..100，越高越有精神。 */
  energy: number;
  hungerStage: NeedStage;
  fatigueStage: NeedStage;
}>;

function clampNeedStat(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function snapshotFromValues(
  pawnId: string,
  satiety: number,
  energy: number
): NeedSnapshot {
  const s = clampNeedStat(satiety);
  const e = clampNeedStat(energy);
  return {
    pawnId,
    satiety: s,
    energy: e,
    hungerStage: evaluateHungerStage(s),
    fatigueStage: evaluateFatigueStage(e)
  };
}

export function createNeedProfile(
  pawnId: string,
  satiety: number,
  energy: number
): NeedSnapshot {
  return snapshotFromValues(pawnId, satiety, energy);
}

export function updateNeedProfile(
  profile: NeedSnapshot,
  deltaSatiety: number,
  deltaEnergy: number
): NeedSnapshot {
  return snapshotFromValues(
    profile.pawnId,
    profile.satiety + deltaSatiety,
    profile.energy + deltaEnergy
  );
}
