import type { DomainCommand, MockLineAPort, MockWorldSubmitResult } from "./s0-contract";

export type MockWorldPortConfig = Readonly<{
  alwaysAccept: boolean;
  rejectIfTouchesCellKeys: ReadonlySet<string>;
}>;

/** B 线「世界网关」：Mock 与 WorldCore 实现共用，供 {@link commitPlayerSelectionToWorld} 等调用。 */
export interface PlayerWorldPort {
  readonly lineA: MockLineAPort;
  submit(raw: DomainCommand, nowMs: number): MockWorldSubmitResult;
  getCommandLog(): readonly DomainCommand[];
  resetSession(): void;
  applyMockConfig(partial: Partial<MockWorldPortConfig>): void;
  replayAll(nowMsStart: number): readonly MockWorldSubmitResult[];
  /** 将 UI 意图叠加层与当前世界快照对齐（A 线实现读 WorldCore；纯 Mock 则为恒等）。 */
  mergeTaskMarkerOverlayWithWorld(overlay: ReadonlyMap<string, string>): Map<string, string>;
}
