import type { DomainCommand, LineAReadPort, WorldSubmitResult } from "./s0-contract";

export type MockWorldPortConfig = Readonly<{
  alwaysAccept: boolean;
  rejectIfTouchesCellKeys: ReadonlySet<string>;
}>;

/**
 * 玩家面向编排器的完整世界端口：命令面 + 任务标记叠加面 + 只读快照通道（`lineA`）。
 * Mock 与 {@link import("./world-core-world-port").WorldCoreWorldPort} 均实现本接口。
 */
export interface PlayerWorldPort {
  submit(raw: DomainCommand, nowMs: number): WorldSubmitResult;
  getCommandLog(): readonly DomainCommand[];
  /** 自本会话起每次 {@link submit} 的返回序列（与 {@link resetSession} 清零对齐）。 */
  getSubmitResults(): readonly WorldSubmitResult[];
  resetSession(): void;
  /**
   * 仅用于 headless 场景 / 单测夹具：覆盖网关的「一律接受」「按格拒绝」等验收规则。
   * 实机主循环不应依赖此方法；生产侧若需同类能力应走可注入的领域策略而非 Mock 命名 API。
   */
  applyMockConfig(partial: Partial<MockWorldPortConfig>): void;
  replayAll(nowMsStart: number): readonly WorldSubmitResult[];
  /** 将 UI 意图叠加层与当前世界快照对齐（A 线实现读 WorldCore；纯 Mock 则为恒等）。 */
  mergeTaskMarkerOverlayWithWorld(overlay: ReadonlyMap<string, string>): Map<string, string>;
  /**
   * 玩家选区中哪些格应叠加任务标记（Mock：整包原样返回；WorldCore：按领域可接单格过滤）。
   */
  filterTaskMarkerTargetCells(
    toolId: string,
    inputShape: "rect-selection" | "brush-stroke" | "single-cell",
    cellKeys: ReadonlySet<string>
  ): ReadonlySet<string>;
  readonly lineA: LineAReadPort;
}

/** commit 路径所需的「提交 + 回放历史」子端口（见 {@link commitPlayerSelectionToWorld}）。 */
export type PlayerWorldCommandPort = Pick<
  PlayerWorldPort,
  "submit" | "replayAll" | "getCommandLog" | "getSubmitResults"
>;

/** commit 路径所需的「任务标叠加 / 与世界对齐」子端口。 */
export type PlayerTaskMarkerOverlayPort = Pick<
  PlayerWorldPort,
  "filterTaskMarkerTargetCells" | "mergeTaskMarkerOverlayWithWorld"
>;
