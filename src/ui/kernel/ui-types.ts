/**
 * @file ui-types.ts
 * @description Preact UI 系统的核心类型定义，包括引擎快照、UI 状态和各领域数据结构
 * @dependencies 无外部依赖 — 纯类型文件
 * @part-of ui/kernel — UI 内核层
 */

// ── UI 本地状态类型 ──

/** 主面板标识 — 控制左侧面板显示哪个领域 */
export type MainPanel = 'colonists' | 'build' | 'feedback';

/** 检查器标签页标识 — 控制殖民者详情面板的子页面 */
export type InspectorTab = 'overview' | 'needs' | 'job';

/**
 * UI 本地状态 — 纯 UI 层持有的状态，不影响游戏逻辑
 *
 * 由 uiReducer 管理，通过 dispatch(UiAction) 修改
 */
export interface UiState {
  /** 当前激活的主面板 */
  activePanel: MainPanel;
  /** 检查器当前标签页 */
  inspectorTab: InspectorTab;
  /** 殖民者列表排序方式 */
  colonistSort: 'name' | 'mood' | 'job';
  /** 殖民者搜索关键词 */
  colonistSearch: string;
  /** 建筑面板搜索关键词 */
  buildSearch: string;
  /** 通知中心是否展开 */
  notificationCenterOpen: boolean;
  /** 固定选中的殖民者 ID（不随点击改变） */
  pinnedColonistId: string | null;
}

// ── 引擎快照子结构 ──

/**
 * 展示层快照 — 从 PresentationState 提取的只读数据
 *
 * 包含工具状态、悬停信息、选中列表等 UI 展示相关数据
 */
export interface PresentationSnapshot {
  /** 当前激活的工具类型（select/build/designate 等） */
  activeTool: string;
  /** 当前指派类型（mine/harvest/cut 等），仅 designate 工具有值 */
  activeDesignationType: string | null;
  /** 当前建筑定义 ID，仅 build 工具有值 */
  activeBuildDefId: string | null;
  /** 鼠标悬停的格子坐标 */
  hoveredCell: { x: number; y: number } | null;
  /** 当前选中的对象 ID 列表 */
  selectedIds: string[];
  /** 调试面板是否可见 */
  showDebugPanel: boolean;
  /** 网格线是否可见 */
  showGrid: boolean;
}

/**
 * 选择快照 — 当前选中状态的只读投影
 */
export interface SelectionSnapshot {
  /** 主选中对象 ID（单选时有值） */
  primaryId: string | null;
  /** 所有选中对象 ID */
  selectedIds: string[];
}

/**
 * 殖民者节点 — 单个殖民者在快照中的完整数据
 *
 * 从 Pawn 游戏对象中提取的纯数据，用于 UI 渲染
 */
export interface ColonistNode {
  /** 对象唯一标识 */
  id: string;
  /** 殖民者名称 */
  name: string;
  /** 当前所在格子坐标 */
  cell: { x: number; y: number };
  /** 所属阵营 ID */
  factionId: string;
  /** 当前任务定义 ID（如 'idle'、'job_haul' 等） */
  currentJob: string;
  /** 当前任务的显示标签（格式化后的可读文本） */
  currentJobLabel: string;
  /** 需求值（0-100） */
  needs: { food: number; rest: number; joy: number; mood: number };
  /** 生命值 */
  health: { hp: number; maxHp: number };
}

/**
 * 建造快照 — 当前工具/建造模式的只读投影
 */
export interface BuildSnapshot {
  /** 当前工具类型 */
  activeTool: string;
  /** 当前指派类型 */
  activeDesignationType: string | null;
  /** 当前建筑定义 ID */
  activeBuildDefId: string | null;
  /** 当前模式的显示标签（如 "Select"、"Build: wall_wood"） */
  activeModeLabel: string;
}

/**
 * 反馈快照 — 近期游戏事件的只读缓冲
 *
 * 由 main.ts 中的 eventBus.onAny 持续填充，保留最近 40 条
 */
export interface FeedbackSnapshot {
  /** 近期事件列表（最新在前） */
  recentEvents: Array<{ type: string; tick: number; summary: string }>;
}

// ── 引擎快照根结构 ──

/**
 * 引擎快照 — 每帧从游戏状态提取的完整只读数据包
 *
 * 这是 Phaser 游戏世界与 Preact UI 之间的唯一数据通道。
 * UI 组件只能通过此快照读取游戏状态，不能直接访问 World/GameMap 对象。
 */
export interface EngineSnapshot {
  /** 当前 tick 数 */
  tick: number;
  /** 当前游戏速度（0=暂停, 1=正常, 2=快速, 3=极速） */
  speed: number;
  /** 格式化的游戏时钟显示文本（如 "Day 3, 14:00"） */
  clockDisplay: string;
  /** 殖民者总数 */
  colonistCount: number;
  /** 展示层快照 */
  presentation: PresentationSnapshot;
  /** 选择状态快照 */
  selection: SelectionSnapshot;
  /** 所有殖民者数据（以 ID 为键） */
  colonists: Record<string, ColonistNode>;
  /** 建造模式快照 */
  build: BuildSnapshot;
  /** 反馈事件快照 */
  feedback: FeedbackSnapshot;
  /** 调试信息文本（预格式化的多行字符串） */
  debugInfo: string;
}
