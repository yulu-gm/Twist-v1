/**
 * 线间 mock 网关：记录命令、返回固定结构，合并 A 线时替换实现即可。
 */

import type { DomainCommand, MockLineAPort, MockWorldSubmitResult } from "./s0-contract";
import type { MockWorldPortConfig, PlayerWorldPort } from "./world-port-types";

export type { MockWorldPortConfig } from "./world-port-types";

const DEFAULT_CONFIG: MockWorldPortConfig = {
  alwaysAccept: true,
  rejectIfTouchesCellKeys: new Set()
};

export class MockWorldPort implements PlayerWorldPort {
  private config: MockWorldPortConfig;
  private readonly log: DomainCommand[] = [];
  private readonly results: MockWorldSubmitResult[] = [];

  public constructor(config: Partial<MockWorldPortConfig> = {}) {
    this.config = {
      alwaysAccept: config.alwaysAccept ?? DEFAULT_CONFIG.alwaysAccept,
      rejectIfTouchesCellKeys:
        config.rejectIfTouchesCellKeys !== undefined
          ? new Set(config.rejectIfTouchesCellKeys)
          : new Set()
    };
  }

  /** 清空命令与结果历史（切换验收场景或重跑前调用）。 */
  public resetSession(): void {
    this.log.length = 0;
    this.results.length = 0;
  }

  /** 运行时切换 mock 规则；与当前配置按字段合并（未提供的字段保留原值）。 */
  public applyMockConfig(partial: Partial<MockWorldPortConfig>): void {
    this.config = {
      alwaysAccept: partial.alwaysAccept ?? this.config.alwaysAccept,
      rejectIfTouchesCellKeys:
        partial.rejectIfTouchesCellKeys !== undefined
          ? new Set(partial.rejectIfTouchesCellKeys)
          : new Set(this.config.rejectIfTouchesCellKeys)
    };
  }

  public get lineA(): MockLineAPort {
    return { snapshotLabel: "mock-A-snapshot:v0" };
  }

  public getCommandLog(): readonly DomainCommand[] {
    return this.log;
  }

  public getSubmitResults(): readonly MockWorldSubmitResult[] {
    return this.results;
  }

  public submit(raw: DomainCommand, nowMs: number): MockWorldSubmitResult {
    const cmd: DomainCommand = {
      ...raw,
      issuedAtMs: raw.issuedAtMs ?? nowMs
    };
    this.log.push(cmd);

    for (const key of cmd.targetCellKeys) {
      if (this.config.rejectIfTouchesCellKeys.has(key)) {
        const rejected: MockWorldSubmitResult = {
          accepted: false,
          messages: [`网关：与注入冲突格重叠（${key}）`],
          conflictCellKeys: [key]
        };
        this.results.push(rejected);
        return rejected;
      }
    }

    if (!this.config.alwaysAccept) {
      const rejected: MockWorldSubmitResult = {
        accepted: false,
        messages: ["网关：验收项关闭 alwaysAccept，未提交领域"]
      };
      this.results.push(rejected);
      return rejected;
    }

    const ok: MockWorldSubmitResult = {
      accepted: true,
      messages: [`网关：已接收 ${cmd.verb}，格数 ${cmd.targetCellKeys.length}`],
      workOrderId: `mock-wo-${this.log.length}`
    };
    this.results.push(ok);
    return ok;
  }

  public mergeTaskMarkerOverlayWithWorld(overlay: ReadonlyMap<string, string>): Map<string, string> {
    return new Map(overlay);
  }

  public filterTaskMarkerTargetCells(
    _toolId: string,
    _inputShape: "rect-selection" | "brush-stroke" | "single-cell",
    cellKeys: ReadonlySet<string>
  ): ReadonlySet<string> {
    return new Set(cellKeys);
  }

  /** 将历史命令按顺序再次提交（用于回放验收）。 */
  public replayAll(nowMsStart: number): readonly MockWorldSubmitResult[] {
    const previous = [...this.log];
    this.log.length = 0;
    this.results.length = 0;
    const out: MockWorldSubmitResult[] = [];
    let t = nowMsStart;
    for (const cmd of previous) {
      out.push(this.submit(cmd, t));
      t += 1;
    }
    return out;
  }
}
