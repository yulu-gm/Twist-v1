import { mergeTaskMarkerOverlayWithWorldSnapshot } from "../data/task-markers";
import {
  cloneWorldCoreState,
  getWorldSnapshot,
  type WorldCore
} from "../game/world-core";
import { applyDomainCommandToWorldCore } from "./apply-domain-command";
import type { DomainCommand, LineAReadPort, WorldSubmitResult } from "./s0-contract";
import type { MockWorldPortConfig, PlayerWorldPort } from "./world-port-types";
import { filterCellKeysForToolbarTaskMarkers } from "./task-marker-target-cells";
import type { OrchestratorWorldBridge } from "./orchestrator-world-bridge";

const DEFAULT_CONFIG: MockWorldPortConfig = {
  alwaysAccept: true,
  rejectIfTouchesCellKeys: new Set()
};

/**
 * A 线 WorldCore + B 线验收用的「冲突格 / 全局拒绝」规则。
 * 回放时从 {@link resetSession} 记录的基线重放命令序列。
 */
export class WorldCoreWorldPort implements PlayerWorldPort, OrchestratorWorldBridge {
  private world: WorldCore;
  private sessionBaseline: WorldCore;
  private config: MockWorldPortConfig;
  private readonly log: DomainCommand[] = [];
  private readonly results: WorldSubmitResult[] = [];

  public constructor(initialWorld: WorldCore, config: Partial<MockWorldPortConfig> = {}) {
    this.world = initialWorld;
    this.sessionBaseline = cloneWorldCoreState(initialWorld);
    this.config = {
      alwaysAccept: config.alwaysAccept ?? DEFAULT_CONFIG.alwaysAccept,
      rejectIfTouchesCellKeys:
        config.rejectIfTouchesCellKeys !== undefined
          ? new Set(config.rejectIfTouchesCellKeys)
          : new Set()
    };
  }

  public getWorld(): WorldCore {
    return this.world;
  }

  public setWorld(next: WorldCore): void {
    this.world = next;
  }

  public resetSession(): void {
    this.log.length = 0;
    this.results.length = 0;
    this.sessionBaseline = cloneWorldCoreState(this.world);
  }

  /**
   * @inheritdoc PlayerWorldPort.applyMockConfig — 仅供 headless 场景与测试；非生产游戏入口。
   */
  public applyMockConfig(partial: Partial<MockWorldPortConfig>): void {
    this.config = {
      alwaysAccept: partial.alwaysAccept ?? this.config.alwaysAccept,
      rejectIfTouchesCellKeys:
        partial.rejectIfTouchesCellKeys !== undefined
          ? new Set(partial.rejectIfTouchesCellKeys)
          : new Set(this.config.rejectIfTouchesCellKeys)
    };
  }

  public get lineA(): LineAReadPort {
    const snap = getWorldSnapshot(this.world);
    return {
      snapshotLabel: `world-core·实体${snap.entities.length}·工单${snap.workItems.length}·标记${snap.markers.length}`
    };
  }

  public getCommandLog(): readonly DomainCommand[] {
    return this.log;
  }

  public getSubmitResults(): readonly WorldSubmitResult[] {
    return this.results;
  }

  public mergeTaskMarkerOverlayWithWorld(overlay: ReadonlyMap<string, string>): Map<string, string> {
    return mergeTaskMarkerOverlayWithWorldSnapshot(overlay, getWorldSnapshot(this.world));
  }

  public filterTaskMarkerTargetCells(
    toolId: string,
    inputShape: "rect-selection" | "brush-stroke" | "single-cell",
    cellKeys: ReadonlySet<string>
  ): ReadonlySet<string> {
    return filterCellKeysForToolbarTaskMarkers(this.world, toolId, inputShape, cellKeys);
  }

  public submit(raw: DomainCommand, nowMs: number): WorldSubmitResult {
    const cmd: DomainCommand = {
      ...raw,
      issuedAtMs: raw.issuedAtMs ?? nowMs
    };
    this.log.push(cmd);

    for (const key of cmd.targetCellKeys) {
      if (this.config.rejectIfTouchesCellKeys.has(key)) {
        const rejected: WorldSubmitResult = {
          accepted: false,
          messages: [`网关：与注入冲突格重叠（${key}）`],
          conflictCellKeys: [key]
        };
        this.results.push(rejected);
        return rejected;
      }
    }

    if (!this.config.alwaysAccept) {
      const rejected: WorldSubmitResult = {
        accepted: false,
        messages: ["网关：验收项关闭 alwaysAccept，未提交领域"]
      };
      this.results.push(rejected);
      return rejected;
    }

    const applied = applyDomainCommandToWorldCore(this.world, cmd);
    this.world = applied.world;
    this.results.push(applied.result);
    return applied.result;
  }

  public replayAll(nowMsStart: number): readonly WorldSubmitResult[] {
    const previous = [...this.log];
    this.log.length = 0;
    this.results.length = 0;
    this.world = cloneWorldCoreState(this.sessionBaseline);
    const out: WorldSubmitResult[] = [];
    let t = nowMsStart;
    for (const cmd of previous) {
      out.push(this.submit(cmd, t));
      t += 1;
    }
    return out;
  }
}
