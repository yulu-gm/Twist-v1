import type { DomainCommand, InteractionSource } from "./domain-command-types";
import type { SelectionModifier } from "./floor-selection";
import { coordKey, type GridCoord } from "../map/world-grid";

/**
 * 本模块实现 `oh-code-design/交互系统.yaml` 中「模式注册表」的**输入规则**侧：
 * 登记各模式的 `explainRule`、`inputShape` 与 `interactionSource`，供命令生成对齐。
 *
 * **进入条件 / 退出条件**不在此类型上建模：由选区会话、笔刷会话等管理器与 UI 模式切换状态机
 * 在切模式时落实；注册表仅提供「当前模式下如何把格集合解释成领域命令载荷」。
 */

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
  /**
   * 将采集到的输入解释为领域命令载荷（可不含 commandId / issuedAtMs）。
   * 对应设计文档中模式注册表的「输入规则」；进入/退出由会话层与 UI 负责，见文件头说明。
   */
  explainRule: (input: ModeExplainInput) => ModeExplainResult;
  /** 输入形态提示，供会话与回放对齐 {@link DomainCommand.sourceMode.inputShape}。 */
  inputShape: "rect-selection" | "brush-stroke" | "single-cell";
  /** 进入该模式时在 {@link DomainCommand.sourceMode.source} 中记录的来源。 */
  interactionSource: InteractionSource;
  /** 扩展元数据（快捷键、图标 key 等），可选。 */
  metadata?: Readonly<Record<string, string>>;
}>;

export type ModeRegistry = Readonly<{
  /** 模式 id → 模式定义（可变 Map，由 registerMode 写入）；仅承载解释规则登记，非会话生命周期。 */
  modes: Map<string, InteractionMode>;
}>;

function interactionModeSource(itemId: string): InteractionSource {
  return { kind: "menu", menuId: "interaction-mode", itemId };
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
      interactionSource: interactionModeSource("zone-create"),
      explainRule: (input) => ({
        verb: "zone_create",
        targetCellKeys: targetKeysFromCells(input.cells),
        targetEntityIds: [],
        sourceMode: {
          source: interactionModeSource("zone-create"),
          selectionModifier: input.modifier,
          inputShape: "rect-selection"
        }
      })
    },
    {
      modeId: "lumber",
      displayName: "伐木标记",
      inputShape: "rect-selection",
      interactionSource: interactionModeSource("lumber"),
      explainRule: (input) => ({
        verb: "assign_tool_task:lumber",
        targetCellKeys: targetKeysFromCells(input.cells),
        targetEntityIds: [],
        sourceMode: {
          source: interactionModeSource("lumber"),
          selectionModifier: input.modifier,
          inputShape: "rect-selection"
        }
      })
    },
    {
      modeId: "haul",
      displayName: "物资拾取标记",
      inputShape: "rect-selection",
      interactionSource: interactionModeSource("haul"),
      explainRule: (input) => ({
        verb: "assign_tool_task:haul",
        targetCellKeys: targetKeysFromCells(input.cells),
        targetEntityIds: [],
        sourceMode: {
          source: interactionModeSource("haul"),
          selectionModifier: input.modifier,
          inputShape: "rect-selection"
        }
      })
    },
    {
      modeId: "build-wall",
      displayName: "墙体蓝图",
      inputShape: "brush-stroke",
      interactionSource: interactionModeSource("build-wall"),
      explainRule: (input) => ({
        verb: "build_wall_blueprint",
        targetCellKeys: targetKeysFromCells(input.cells),
        targetEntityIds: [],
        sourceMode: {
          source: interactionModeSource("build-wall"),
          selectionModifier: input.modifier,
          inputShape: "brush-stroke"
        }
      })
    },
    {
      modeId: "build-bed",
      displayName: "床铺放置",
      inputShape: "single-cell",
      interactionSource: interactionModeSource("build-bed"),
      explainRule: (input) => ({
        verb: "place_furniture:bed",
        targetCellKeys: targetKeysFromCells(input.cells),
        targetEntityIds: [],
        sourceMode: {
          source: interactionModeSource("build-bed"),
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
