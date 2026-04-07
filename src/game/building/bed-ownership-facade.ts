/**
 * 建筑系统对「建成后床铺归属」的门面，对齐设计中的归属规则器入口。
 * 实现委托 {@link assignBedToPawn}；编排层应通过本模块接入，而非直接依赖 `entity/relationship-rules`。
 */

import type { EntityRegistry } from "../entity/entity-registry";
import type { EntityId } from "../entity/entity-types";
import { assignBedToPawn, type AssignBedOutcome } from "../entity/relationship-rules";

export type { AssignBedOutcome };

/**
 * 建成结算之后将床铺归属分配给指定小人（归属规则器对外 API）。
 */
export function assignBedAfterConstruction(
  registry: EntityRegistry,
  bedBuildingId: EntityId,
  pawnId: EntityId
): AssignBedOutcome {
  return assignBedToPawn(registry, bedBuildingId, pawnId, "auto-after-construction");
}
