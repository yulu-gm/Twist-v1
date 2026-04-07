import { MapObjectBase, ObjectKind } from '../../core/types';

export interface Plant extends MapObjectBase {
  kind: ObjectKind.Plant;
  /** Growth progress from 0 (just planted) to 1 (fully grown). */
  growthProgress: number;
  /** Current visual growth stage index. */
  growthStage: number;
  /** Whether this plant was sown by a player (vs wild spawn). */
  sownByPlayer: boolean;
  /** Whether the plant is ready to be harvested. */
  harvestReady: boolean;
  /** Dying progress from 0 (healthy) to 1 (dead). */
  dyingProgress: number;
}
