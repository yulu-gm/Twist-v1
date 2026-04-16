/**
 * @file presentation-state.ts
 * @description 展示层状态定义，存储 UI 相关的瞬态数据（选中、悬停、预览、覆盖层等），
 *              以及右键返回导航所需的返回栈与相关操作函数
 * @dependencies core/types — ObjectId、CellCoord、DefId、Rotation、DesignationType
 * @part-of presentation — 展示层，连接游戏逻辑与 UI 渲染
 */

import {
  ObjectId,
  CellCoord,
  DefId,
  Rotation,
  DesignationType,
  ZoneType,
  Footprint,
} from '../core/types';

/**
 * 调试覆盖层类型枚举
 *
 * 控制地图上渲染哪种可视化覆盖信息
 */
export enum OverlayType {
  /** 无覆盖 */
  None = 'none',
  /** 温度分布 */
  Temperature = 'temperature',
  /** 美观度分布 */
  Beauty = 'beauty',
  /** 区域高亮 */
  Zones = 'zones',
  /** 房间高亮 */
  Rooms = 'rooms',
  /** 寻路可视化（通行性 + 路径） */
  Pathfinding = 'pathfinding',
}

/**
 * 建筑放置预览数据
 *
 * 当玩家使用建造工具时，显示建筑将被放置的位置和合法性
 */
export interface PlacementPreview {
  /** 建筑定义 ID */
  defId: DefId;
  /** 预览所在格子 */
  cell: CellCoord;
  /** 建筑占地尺寸 */
  footprint: Footprint;
  /** 旋转角度 */
  rotation: Rotation;
  /** 是否为合法放置位置 */
  valid: boolean;
}

/**
 * 指派预览数据
 *
 * 当玩家使用指派工具时，显示指派操作的目标位置和合法性
 */
interface DesignationPreview {
  /** 目标格子 */
  cell: CellCoord;
  /** 指派类型（采矿/收获/砍伐） */
  designationType: DesignationType;
  /** 是否为合法指派目标 */
  valid: boolean;
}

/**
 * 区域预览数据
 *
 * 用于展示当前正在创建/擦除的区域格子范围与合法性
 */
export interface ZonePreview {
  /** 预览模式：创建或擦除 */
  mode: 'create' | 'erase';
  /** 当前区域类型 */
  zoneType: ZoneType | null;
  /** 预览涉及的全部格子 */
  cells: CellCoord[];
  /** 其中合法的格子 */
  validCells: CellCoord[];
  /** 其中非法的格子 */
  invalidCells: CellCoord[];
  /** 预览整体是否有效 */
  valid: boolean;
}

/**
 * 返回栈条目 — 稳定交互状态快照
 *
 * 每次工具切换或有效选中时，将当前稳定状态压入栈，
 * 右键弹出时恢复到该快照。
 */
interface PresentationBackEntry {
  /** 工具类型 */
  activeTool: ToolType;
  /** 指派子类型 */
  activeDesignationType: DesignationType | null;
  /** 区域子类型 */
  activeZoneType: ZoneType | null;
  /** 建造定义ID */
  activeBuildDefId: DefId | null;
  /** 选中对象ID列表（独立拷贝） */
  selectedObjectIds: ObjectId[];
}

/**
 * 工具选择参数 — 传入 applyToolSelection 的选项对象
 */
interface ToolSelectionOptions {
  /** 目标工具 */
  tool: ToolType;
  /** 指派子类型（仅 Designate 工具时使用） */
  designationType?: DesignationType | null;
  /** 区域子类型（仅 Zone 工具时使用） */
  zoneType?: ZoneType | null;
  /** 建造定义ID（仅 Build 工具时使用） */
  buildDefId?: DefId | null;
}

/**
 * 展示层状态接口 — 存储所有 UI 相关的瞬态数据
 *
 * 这是游戏逻辑层和 UI 渲染层之间的桥梁，
 * 不影响游戏模拟，仅用于决定屏幕上显示什么。
 */
export interface PresentationState {
  /** 当前选中的对象 ID 集合 */
  selectedObjectIds: Set<ObjectId>;
  /** 鼠标悬停的格子坐标（null 表示不在地图上） */
  hoveredCell: CellCoord | null;
  /** 建筑放置预览（null 表示无预览） */
  placementPreview: PlacementPreview | null;
  /** 指派操作预览（null 表示无预览） */
  designationPreview: DesignationPreview | null;
  /** 当前激活的调试覆盖层类型 */
  activeOverlay: OverlayType;
  /** 摄像机位置 */
  cameraPosition: { x: number; y: number };
  /** 摄像机缩放倍率 */
  cameraZoom: number;
  /** 当前激活的工具类型 */
  activeTool: ToolType;
  /** 当前激活的指派子类型（用于 UI 高亮） */
  activeDesignationType: DesignationType | null;
  /** 当前激活的区域子类型（用于 UI 高亮） */
  activeZoneType: ZoneType | null;
  /** 最近一次使用的区域子类型（供 Z 快捷键回到上次类型） */
  lastZoneType: ZoneType;
  /** 当前选中的建筑定义 ID（用于 UI 高亮） */
  activeBuildDefId: DefId | null;
  /** 是否显示调试面板 */
  showDebugPanel: boolean;
  /** 是否显示网格线 */
  showGrid: boolean;
  /** 拖拽选框（null 表示未在拖拽） */
  dragRect: { startCell: CellCoord; endCell: CellCoord } | null;
  /** 区域预览（null 表示当前没有区域交互预览） */
  zonePreview: ZonePreview | null;
  /** 右键返回导航栈 — 存储稳定交互状态快照，供 popBackNavigation 恢复 */
  backStack: PresentationBackEntry[];
}

/**
 * 工具类型枚举 — 定义玩家当前的交互模式
 */
export enum ToolType {
  /** 选择模式 — 点击选中对象 */
  Select = 'select',
  /** 建造模式 — 点击放置建筑蓝图 */
  Build = 'build',
  /** 指派模式 — 点击创建采矿/收获/砍伐指派 */
  Designate = 'designate',
  /** 区域模式 — 点击划定区域 */
  Zone = 'zone',
  /** 取消模式 — 点击取消指派/蓝图/工地 */
  Cancel = 'cancel',
}

/**
 * 切换工具并重置不相关的子状态
 * 这是工具切换的唯一入口 — 键盘快捷键和工具栏按钮都应调用此函数
 */
export function switchTool(presentation: PresentationState, tool: ToolType): void {
  presentation.activeTool = tool;
  if (tool !== ToolType.Designate) {
    presentation.activeDesignationType = null;
  }
  if (tool !== ToolType.Zone) {
    presentation.activeZoneType = null;
  }
  if (tool !== ToolType.Build) {
    presentation.activeBuildDefId = null;
  }
  if (tool !== ToolType.Select) {
    presentation.selectedObjectIds.clear();
  }
  presentation.zonePreview = null;
}

/**
 * 创建展示层状态的默认初始值
 *
 * @returns 新的 PresentationState 对象，所有字段为默认值
 */
export function createPresentationState(): PresentationState {
  return {
    selectedObjectIds: new Set(),
    hoveredCell: null,
    placementPreview: null,
    designationPreview: null,
    activeOverlay: OverlayType.None,
    cameraPosition: { x: 0, y: 0 },
    cameraZoom: 1,
    activeTool: ToolType.Select,
    activeDesignationType: null,
    activeZoneType: null,
    lastZoneType: ZoneType.Stockpile,
    activeBuildDefId: null,
    showDebugPanel: false,
    showGrid: false,
    dragRect: null,
    zonePreview: null,
    /** 初始返回栈为空 */
    backStack: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 返回导航辅助函数
// 导出供测试使用，实际使用场景通过 applyToolSelection / applyObjectSelection /
// popBackNavigation 这三个公开入口操作。
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 从当前展示状态生成一个稳定状态快照，用于压入返回栈
 */
function captureBackEntry(presentation: PresentationState): PresentationBackEntry {
  return {
    activeTool: presentation.activeTool,
    activeDesignationType: presentation.activeDesignationType,
    activeZoneType: presentation.activeZoneType,
    activeBuildDefId: presentation.activeBuildDefId,
    // 独立拷贝，避免引用污染
    selectedObjectIds: Array.from(presentation.selectedObjectIds),
  };
}

/**
 * 比较两个返回栈条目是否代表相同的稳定状态（用于去重）
 */
function isSameBackEntry(a: PresentationBackEntry, b: PresentationBackEntry): boolean {
  if (a.activeTool !== b.activeTool) return false;
  if (a.activeDesignationType !== b.activeDesignationType) return false;
  if (a.activeZoneType !== b.activeZoneType) return false;
  if (a.activeBuildDefId !== b.activeBuildDefId) return false;
  // 比较选中ID列表（顺序无关）
  if (a.selectedObjectIds.length !== b.selectedObjectIds.length) return false;
  const setA = new Set(a.selectedObjectIds);
  return b.selectedObjectIds.every((id) => setA.has(id));
}

/**
 * 清除所有瞬态交互状态（悬停、各类预览、拖拽选框）
 *
 * 在恢复返回栈条目后调用，确保不残留旧的预览信息。
 */
export function clearTransientInteractionState(presentation: PresentationState): void {
  presentation.hoveredCell = null;
  presentation.placementPreview = null;
  presentation.designationPreview = null;
  presentation.zonePreview = null;
  presentation.dragRect = null;
}

/**
 * 若当前状态与栈顶不同，则将当前状态压入返回栈（去重压栈）
 */
function pushBackEntryIfNeeded(presentation: PresentationState): void {
  const current = captureBackEntry(presentation);
  const top = presentation.backStack[presentation.backStack.length - 1];
  if (!top || !isSameBackEntry(top, current)) {
    presentation.backStack.push(current);
  }
}

/**
 * 切换工具/子模式的入口 — 带返回栈感知
 *
 * 压栈时机：
 * - 工具类型发生变化，或
 * - 相同工具但子模式变化（buildDefId / designationType / zoneType 不同）
 *
 * 切换到非 Select 工具时，清空 selectedObjectIds。
 */
export function applyToolSelection(
  presentation: PresentationState,
  options: ToolSelectionOptions,
): void {
  const { tool, designationType = null, zoneType = null, buildDefId = null } = options;

  // 判断是否发生了有效变更（工具或子模式不同）
  const toolChanged = presentation.activeTool !== tool;
  const submodeChanged =
    presentation.activeBuildDefId !== buildDefId ||
    presentation.activeDesignationType !== designationType ||
    presentation.activeZoneType !== zoneType;

  if (toolChanged || submodeChanged) {
    // 压入当前状态供右键返回
    pushBackEntryIfNeeded(presentation);
  }

  // 应用新工具与子模式
  presentation.activeTool = tool;
  presentation.activeDesignationType = tool === ToolType.Designate ? designationType : null;
  presentation.activeZoneType = tool === ToolType.Zone ? zoneType : null;
  presentation.activeBuildDefId = tool === ToolType.Build ? buildDefId : null;

  // 非选择模式下清空已选对象
  if (tool !== ToolType.Select) {
    presentation.selectedObjectIds = new Set();
  }

  // 区域预览在工具切换时失效
  presentation.zonePreview = null;
}

/**
 * 选中对象的入口 — 带返回栈感知
 *
 * 压栈时机：
 * - 当前不在 Select 模式（需先切换到 Select）
 * - 在 Select 模式下，从无选中变为有选中
 *
 * 从一个非空选中变为另一个非空选中时，不再压栈（避免连续点击堆栈膨胀）。
 */
export function applyObjectSelection(presentation: PresentationState, ids: ObjectId[]): void {
  const wasEmpty = presentation.selectedObjectIds.size === 0;
  const notInSelectMode = presentation.activeTool !== ToolType.Select;

  if (notInSelectMode) {
    // 从其他模式切换到选择模式，压入当前工具状态
    pushBackEntryIfNeeded(presentation);
    presentation.activeTool = ToolType.Select;
    presentation.activeDesignationType = null;
    presentation.activeZoneType = null;
    presentation.activeBuildDefId = null;
    presentation.zonePreview = null;
  } else if (wasEmpty && ids.length > 0) {
    // 在选择模式下，从无选中变为有选中，压入空选中状态
    pushBackEntryIfNeeded(presentation);
  }
  // 从一个非空选中变为另一个非空选中：不压栈

  presentation.selectedObjectIds = new Set(ids);
}

/**
 * 弹出返回栈，恢复上一个稳定状态
 *
 * @returns true 表示成功恢复，false 表示栈已空（仅清除瞬态状态）
 */
export function popBackNavigation(presentation: PresentationState): boolean {
  // 无论是否有历史，都清除瞬态交互状态
  clearTransientInteractionState(presentation);

  const entry = presentation.backStack.pop();
  if (!entry) {
    // 栈已空，无法恢复
    return false;
  }

  // 恢复稳定状态
  presentation.activeTool = entry.activeTool;
  presentation.activeDesignationType = entry.activeDesignationType;
  presentation.activeZoneType = entry.activeZoneType;
  presentation.activeBuildDefId = entry.activeBuildDefId;
  presentation.selectedObjectIds = new Set(entry.selectedObjectIds);

  return true;
}
