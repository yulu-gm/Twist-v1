/**
 * @file presentation-state.ts
 * @description 展示层状态定义，存储 UI 相关的瞬态数据（选中、悬停、预览、覆盖层等）
 * @dependencies core/types — ObjectId、CellCoord、DefId、Rotation、DesignationType
 * @part-of presentation — 展示层，连接游戏逻辑与 UI 渲染
 */

import { ObjectId, CellCoord, DefId, Rotation, DesignationType } from '../core/types';

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
export interface DesignationPreview {
  /** 目标格子 */
  cell: CellCoord;
  /** 指派类型（采矿/收获/砍伐） */
  designationType: DesignationType;
  /** 是否为合法指派目标 */
  valid: boolean;
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
  /** 当前选中的建筑定义 ID（用于 UI 高亮） */
  activeBuildDefId: DefId | null;
  /** 是否显示调试面板 */
  showDebugPanel: boolean;
  /** 是否显示网格线 */
  showGrid: boolean;
  /** 拖拽选框（null 表示未在拖拽） */
  dragRect: { startCell: CellCoord; endCell: CellCoord } | null;
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
  if (tool !== ToolType.Build) {
    presentation.activeBuildDefId = null;
  }
  if (tool !== ToolType.Select) {
    presentation.selectedObjectIds.clear();
  }
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
    activeBuildDefId: null,
    showDebugPanel: false,
    showGrid: false,
    dragRect: null,
  };
}
