import { MapObjectBase, ObjectKind } from '../../core/types';

export interface Fire extends MapObjectBase {
  kind: ObjectKind.Fire;
  /** Fire intensity from 0 (dying embers) to 1 (full blaze). */
  intensity: number;
  /** How many ticks this fire has been alive. */
  ticksAlive: number;
  /** Ticks remaining before the fire can attempt to spread again. */
  spreadCooldown: number;
}
