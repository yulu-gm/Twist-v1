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
  /** Inspector 当前查看目标 ID（与主选中对象独立，用于同格对象切换） */
  inspectorTargetId: string | null;
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
  /** 当前区域类型（stockpile 等），仅 zone 工具有值 */
  activeZoneType: string | null;
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
 * 殖民者工作决策选项节点 — 单个工作类别在快照中的展示数据
 */
export interface ColonistWorkDecisionOptionNode {
  /** 工作类别标识 */
  kind: string;
  /** 工作类别显示名 */
  label: string;
  /** 决策状态：active / blocked / deferred */
  status: 'active' | 'blocked' | 'deferred';
  /** 可选的简短上下文 */
  detail: string | null;
  /** blocked 原因文案 */
  failureReasonText: string | null;
}

/**
 * 殖民者工作决策节点 — 最近一次选工过程的冻结快照
 */
export interface ColonistWorkDecisionNode {
  /** 快照产生时的 tick */
  evaluatedAtTick: number;
  /** 被选中的工作类别 kind */
  selectedWorkKind: string | null;
  /** 被选中的工作类别显示名 */
  selectedWorkLabel: string | null;
  /** 当前活跃 toil 的标签 */
  activeToilLabel: string | null;
  /** 当前活跃 toil 的状态 */
  activeToilState: string | null;
  /** 按优先级排序的全部工作选项 */
  options: ColonistWorkDecisionOptionNode[];
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
  /** 工作决策快照（null 表示尚未产生决策） */
  workDecision: ColonistWorkDecisionNode | null;
}

/** 建筑快照节点 — UI 展示所需的建筑序列化数据 */
export interface BuildingNode {
  /** 建筑对象唯一ID */
  id: string;
  /** 建筑显示名称 */
  label: string;
  /** 建筑定义ID */
  defId: string;
  /** 建筑所在格子坐标 */
  cell: { x: number; y: number };
  /** 建筑占地尺寸 */
  footprint: { width: number; height: number };
  /** 建筑分类（结构/家具） */
  category?: 'structure' | 'furniture';
  /** 家具使用类型 */
  usageType?: 'bed' | 'table' | 'chair' | 'storage';
  /** 床位数据（仅家具中的床类型有此字段） */
  bed?: {
    /** 床位角色 */
    role: 'public' | 'owned' | 'medical' | 'prisoner';
    /** 所有者棋子ID（null 表示无主） */
    ownerPawnId: string | null;
    /** 当前占用棋子ID（null 表示无人） */
    occupantPawnId: string | null;
    /** 是否允许自动分配 */
    autoAssignable: boolean;
  };
}

// ── 统一对象节点类型（Inspector 数据源） ──

/** 对象节点基础接口 — 所有对象共享的字段 */
export interface ObjectNodeBase {
  /** 对象唯一标识 */
  id: string;
  /** 对象类型 */
  kind: string;
  /** 对象显示名称 */
  label: string;
  /** 对象定义 ID */
  defId: string;
  /** 所在格子坐标 */
  cell: { x: number; y: number };
  /** 占地尺寸 */
  footprint: { width: number; height: number };
  /** 标签列表（可选） */
  tags?: string[];
  /** 是否已销毁 */
  destroyed?: boolean;
}

/** Pawn 对象节点 — 同时复用 ColonistNode 数据 */
export interface PawnObjectNode extends ObjectNodeBase {
  kind: 'pawn';
  /** 当前任务标签 */
  currentJobLabel: string;
  /** 需求值 */
  needs: { food: number; rest: number; joy: number; mood: number };
  /** 生命值 */
  health: { hp: number; maxHp: number };
  /** 工作决策快照 */
  workDecision: ColonistWorkDecisionNode | null;
}

/** Building 对象节点 — 同时复用 BuildingNode 数据 */
export interface BuildingObjectNode extends ObjectNodeBase {
  kind: 'building';
  /** 建筑分类 */
  category?: 'structure' | 'furniture';
  /** 家具使用类型 */
  usageType?: 'bed' | 'table' | 'chair' | 'storage';
  /** 床位数据 */
  bed?: {
    role: 'public' | 'owned' | 'medical' | 'prisoner';
    ownerPawnId: string | null;
    occupantPawnId: string | null;
    autoAssignable: boolean;
  };
}

/** Blueprint 对象节点 */
export interface BlueprintObjectNode extends ObjectNodeBase {
  kind: 'blueprint';
  /** 目标建筑定义 ID */
  targetDefId: string;
  /** 所需材料列表 */
  materialsRequired: Array<{ defId: string; count: number }>;
  /** 已运送材料列表 */
  materialsDelivered: Array<{ defId: string; count: number }>;
}

/** ConstructionSite 对象节点 */
export interface ConstructionSiteObjectNode extends ObjectNodeBase {
  kind: 'construction_site';
  /** 目标建筑定义 ID */
  targetDefId: string;
  /** 建造进度（0-1） */
  buildProgress: number;
}

/** Item 对象节点 */
export interface ItemObjectNode extends ObjectNodeBase {
  kind: 'item';
  /** 堆叠数量 */
  stackCount: number;
}

/** Plant 对象节点 */
export interface PlantObjectNode extends ObjectNodeBase {
  kind: 'plant';
  /** 生长进度（0-1） */
  growth: number;
  /** 是否可收获 */
  harvestReady: boolean;
}

/** 统一对象节点联合类型 */
export type ObjectNode =
  | PawnObjectNode
  | BuildingObjectNode
  | BlueprintObjectNode
  | ConstructionSiteObjectNode
  | ItemObjectNode
  | PlantObjectNode;

/**
 * 建造快照 — 当前工具/建造模式的只读投影
 */
export interface BuildSnapshot {
  /** 当前工具类型 */
  activeTool: string;
  /** 当前指派类型 */
  activeDesignationType: string | null;
  /** 当前区域类型 */
  activeZoneType: string | null;
  /** 最近一次使用的区域子类型（供 Z 快捷键回到上次类型） */
  lastZoneType: string;
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
  /** 地图上所有建筑的快照（key 为建筑ID） */
  buildings?: Record<string, BuildingNode>;
  /** 统一对象节点字典 — Inspector 数据源（key 为对象ID） */
  objects: Record<string, ObjectNode>;
  /** 建造模式快照 */
  build: BuildSnapshot;
  /** 反馈事件快照 */
  feedback: FeedbackSnapshot;
  /** 调试信息文本（预格式化的多行字符串） */
  debugInfo: string;
}
