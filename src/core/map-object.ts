import type { Pawn } from '../features/pawn/pawn.types';
import type { Building } from '../features/building/building.types';
import type { Item } from '../features/item/item.types';
import type { Plant } from '../features/plant/plant.types';
import type { Fire } from '../features/fire/fire.types';
import type { Corpse } from '../features/corpse/corpse.types';
import type { Blueprint } from '../features/construction/blueprint.types';
import type { ConstructionSite } from '../features/construction/construction-site.types';
import type { Designation } from '../features/designation/designation.types';

export type MapObject =
  | Pawn
  | Building
  | Item
  | Plant
  | Fire
  | Corpse
  | Blueprint
  | ConstructionSite
  | Designation;
