import type {
  ObjectKind,
  MapObjectBase,
  QualityLevel,
} from '../../core/types';

// ── Item ──
export interface Item extends MapObjectBase {
  kind: ObjectKind.Item;
  stackCount: number;
  maxStack: number;
  quality?: QualityLevel;
}
