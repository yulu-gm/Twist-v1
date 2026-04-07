import {
  MapObjectBase,
  ObjectKind,
  DesignationType,
  ObjectId,
  CellCoord,
  WorkPriority,
} from '../../core/types';

export interface Designation extends MapObjectBase {
  kind: ObjectKind.Designation;
  /** What kind of work this designation requests. */
  designationType: DesignationType;
  /** The object this designation targets (e.g. a tree to cut). */
  targetObjectId?: ObjectId;
  /** The cell this designation targets (e.g. a cell to mine). */
  targetCell?: CellCoord;
  /** Priority level for work ordering. */
  priority: WorkPriority;
}
