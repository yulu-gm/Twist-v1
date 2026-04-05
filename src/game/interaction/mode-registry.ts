import type { DomainCommand, InteractionSource } from "./domain-command-types";
import type { SelectionModifier } from "./floor-selection";
import { coordKey, type GridCoord } from "../map/world-grid";

/** 模式解释函数的输入：格集合与选区修饰键语义。 */
export type ModeExplainInput = Readonly<{
  cells: readonly GridCoord[];
  modifier: SelectionModifier;
}>;

/** 解释结果可为缺省 id / 时间的片段，或由调用方写全的 {@link DomainCommand}。 */
export type ModeExplainResult =
  | Omit<DomainCommand, "commandId" | "issuedAtMs">
  | DomainCommand;

export type InteractionMode = Readonly<{
  modeId: string;
  displayName: string;
  /** 将采集到的输入解释为领域命令载荷（可不含 commandId / issuedAtMs）。 */
  explainRule: (input: ModeExplainInput) => ModeExplainResult;
  /** 输入形态提示，供会话与回放对齐 {@link DomainCommand.sourceMode.inputShape}。 */
  inputShape: "rect-selection" | "brush-stroke" | "single-cell";
  /** 进入该模式时在 {@link DomainCommand.sourceMode.source} 中记录的来源。 */
  interactionSource: InteractionSource;
  /** 扩展元数据（快捷键、图标 key 等），可选。 */
  metadata?: Readonly<Record<string, string>>;
}>;

export type ModeRegistry = Readonly<{
  /** 模式 id → 模式定义（可变 Map，由 registerMode 写入）。 */
  modes: Map<string, InteractionMode>;
}>;

function toolbarSource(toolId: string): InteractionSource {
  return { kind: "toolbar", toolId };
}

function targetKeysFromCells(cells: readonly GridCoord[]): readonly string[] {
  return cells.map((c) => coordKey(c));
}

function seedDefaultModes(registry: ModeRegistry): void {
  const defaults: readonly InteractionMode[] = [
    {
      modeId: "zone-create",
      displayName: "存储区创建",
      inputShape: "rect-selection",
      interactionSource: toolbarSource("zone-create"),
      explainRule: (input) => ({
        verb: "zone_create",
        targetCellKeys: targetKeysFromCells(input.cells),
        targetEntityIds: [],
        sourceMode: {
          source: toolbarSource("zone-create"),
          selectionModifier: input.modifier,
          inputShape: "rect-selection"
        }
      })
    },
    {
      modeId: "chop",
      displayName: "伐木标记",
      inputShape: "rect-selection",
      interactionSource: toolbarSource("chop"),
      explainRule: (input) => ({
        verb: "assign_tool_task:chop",
        targetCellKeys: targetKeysFromCells(input.cells),
        targetEntityIds: [],
        sourceMode: {
          source: toolbarSource("chop"),
          selectionModifier: input.modifier,
          inputShape: "rect-selection"
        }
      })
    },
    {
      modeId: "build-wall",
      displayName: "墙体蓝图",
      inputShape: "brush-stroke",
      interactionSource: toolbarSource("build-wall"),
      explainRule: (input) => ({
        verb: "build_wall_blueprint",
        targetCellKeys: targetKeysFromCells(input.cells),
        targetEntityIds: [],
        sourceMode: {
          source: toolbarSource("build-wall"),
          selectionModifier: input.modifier,
          inputShape: "brush-stroke"
        }
      })
    },
    {
      modeId: "build-bed",
      displayName: "床铺放置",
      inputShape: "single-cell",
      interactionSource: toolbarSource("build-bed"),
      explainRule: (input) => ({
        verb: "place_furniture:bed",
        targetCellKeys: targetKeysFromCells(input.cells),
        targetEntityIds: [],
        sourceMode: {
          source: toolbarSource("build-bed"),
          selectionModifier: input.modifier,
          inputShape: "single-cell"
        }
      })
    }
  ];

  for (const m of defaults) {
    registerMode(registry, m);
  }
}

export function createModeRegistry(): ModeRegistry {
  const registry: ModeRegistry = { modes: new Map() };
  seedDefaultModes(registry);
  return registry;
}

export function registerMode(registry: ModeRegistry, mode: InteractionMode): void {
  registry.modes.set(mode.modeId, mode);
}

export function getMode(registry: ModeRegistry, modeId: string): InteractionMode | undefined {
  return registry.modes.get(modeId);
}

export function listModes(registry: ModeRegistry): InteractionMode[] {
  return [...registry.modes.values()];
}
