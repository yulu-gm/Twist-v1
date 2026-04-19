/**
 * @file build.types.ts
 * @description 建造领域的视图模型类型 — 速度按钮、工具动作、命令菜单视图模型、顶栏数据
 * @dependencies 无外部依赖 — 纯类型文件
 * @part-of ui/domains/build — 建造 UI 领域
 */

/** 速度按钮定义 — 顶栏中的速度切换按钮 */
export interface SpeedButtonDef {
  /** 速度值（0=暂停, 1=正常, 2=快速, 3=极速） */
  value: number;
  /** 按钮显示文本（如 'II'、'>'、'>>'） */
  label: string;
}

/** 工具动作定义 — 命令菜单叶子节点真正触发的工具切换 payload */
export interface ToolActionDef {
  /** 动作唯一标识（如 'select'、'mine'、'build_wall'） */
  id: string;
  /** 对应的工具类型（如 'select'、'designate'、'build'） */
  tool: string;
  /** 按钮显示标签 */
  label: string;
  /** 快捷键（命令菜单已动态分配，保留字段以兼容意图层签名） */
  hotkey: string;
  /** 指派类型（仅 designate 工具需要） */
  designationType?: string;
  /** 建筑定义 ID（仅 build 工具需要） */
  buildDefId?: string;
  /** 区域类型（仅 zone 工具需要） */
  zoneType?: string;
  /** 所属分组编号（保留以兼容旧调用，命令菜单不再使用分组渲染） */
  group: number;
}

/** 命令菜单条目类型 — 返回上一层、分支、叶子 */
export type CommandMenuEntryKind = 'back' | 'branch' | 'leaf';

/** 命令菜单条目视图模型 — 描述当前层级中一个可见方块的渲染数据 */
export interface CommandMenuEntryViewModel {
  /** 条目唯一标识（branch/leaf 节点 id 或 '__back__'） */
  id: string;
  /** 显示标签 */
  label: string;
  /** 该条目当前层级的快捷键标签（如 'Z'、'Esc'） */
  shortcut: string;
  /** 条目类型 */
  kind: CommandMenuEntryKind;
  /** 是否处于激活态：叶子=本身被选中；分支=祖先在激活叶子的路径上 */
  active: boolean;
  /** 分支条目对应的子层 id（kind='branch' 时存在） */
  branchId?: string;
  /** 叶子条目对应的工具切换 payload（kind='leaf' 时存在） */
  action?: ToolActionDef;
}

/** 命令菜单视图模型 — 当前可见层级 + 路径 */
export interface CommandMenuViewModel {
  /** 当前菜单路径（[] 表示根层） */
  path: string[];
  /** 该层级中所有可见条目 */
  entries: CommandMenuEntryViewModel[];
}

/** 顶部状态栏视图模型 — 顶栏组件的渲染数据 */
export interface TopStatusBarViewModel {
  /** 格式化的游戏时钟文本 */
  clockDisplay: string;
  /** 当前 tick 数 */
  tick: number;
  /** 当前速度值 */
  speed: number;
  /** 殖民者总数 */
  colonistCount: number;
}
