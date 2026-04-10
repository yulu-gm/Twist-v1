/**
 * @file colonist.types.ts
 * @description 殖民者领域的视图模型类型 — 定义列表行、需求条、检查器的数据结构
 * @dependencies 无外部依赖 — 纯类型文件
 * @part-of ui/domains/colonist — 殖民者 UI 领域
 */

/**
 * 殖民者列表行 — 殖民者面板左侧列表中每一行的视图数据
 */
export interface ColonistRosterRow {
  /** 殖民者 ID */
  id: string;
  /** 殖民者名称 */
  name: string;
  /** 当前任务定义 ID */
  currentJob: string;
  /** 当前任务的显示标签 */
  currentJobLabel: string;
  /** 心情值（0-100） */
  mood: number;
  /** 是否被选中（高亮显示） */
  isSelected: boolean;
}

/**
 * 需求条视图模型 — 检查器中单条需求的渲染数据
 */
export interface NeedViewModel {
  /** 需求标识（如 'food'、'rest'） */
  key: string;
  /** 显示标签（如 'Food'、'Rest'） */
  label: string;
  /** 当前值（0-100） */
  value: number;
  /** 进度条颜色（CSS 颜色值） */
  color: string;
}

/**
 * 殖民者检查器视图模型 — 选中单个殖民者时的详情面板数据
 */
export interface ColonistInspectorViewModel {
  /** 殖民者 ID */
  id: string;
  /** 殖民者名称 */
  name: string;
  /** 当前格子坐标 */
  cell: { x: number; y: number };
  /** 所属阵营 ID */
  factionId: string;
  /** 当前任务显示标签 */
  jobLabel: string;
  /** 生命值 */
  health: { hp: number; maxHp: number };
  /** 需求条列表 */
  needs: NeedViewModel[];
}
