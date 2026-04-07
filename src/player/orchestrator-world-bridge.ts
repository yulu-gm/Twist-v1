import type { WorldCore } from "../game/world-core";
import type { PlayerWorldPort } from "./world-port-types";

/** 编排器 / 模拟 tick 对 {@link WorldCore} 的读写句柄，与玩家提交面 {@link PlayerWorldPort} 分离。 */
export interface WorldSimAccess {
  getWorld(): WorldCore;
  setWorld(next: WorldCore): void;
}

/**
 * 真机路径上常由同一实现（如 {@link import("./world-core-world-port").WorldCoreWorldPort}）同时承担模拟访问与玩家网关；
 * 类型上仍拆出 {@link WorldSimAccess}，供场景等只读内核处使用 {@link import("../game/game-orchestrator").GameOrchestrator.getWorldSimAccess}，避免对整桥做断言。
 */
export interface OrchestratorWorldBridge extends PlayerWorldPort, WorldSimAccess {}
