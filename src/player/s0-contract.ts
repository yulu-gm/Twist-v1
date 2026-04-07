/**
 * 玩家编排层契约聚合：再导出领域命令类型。仅需类型的 headless / 场景 / 测试应直接 import `game/interaction/domain-command-types`。
 */
export type {
  DomainCommand,
  DomainVerb,
  InteractionSource,
  LineAReadPort,
  WorldSubmitResult
} from "../game/interaction/domain-command-types";
