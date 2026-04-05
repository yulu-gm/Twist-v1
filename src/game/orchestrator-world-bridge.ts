import type { WorldCore } from "./world-core";
import type { PlayerWorldPort } from "../player/world-port-types";

/** 模拟 tick（读写 WorldCore）与玩家网关（submit）共用；由 {@link WorldCoreWorldPort} 实现。 */
export interface OrchestratorWorldBridge extends PlayerWorldPort {
  getWorld(): WorldCore;
  setWorld(next: WorldCore): void;
}
