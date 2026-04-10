/**
 * @file build.types.ts
 * @description 建造领域的视图模型类型 — 速度按钮、工具动作、建造摘要、顶栏数据
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

/** 工具动作定义 — 底部工具栏中的每个按钮 */
export interface ToolActionDef {
  /** 动作唯一标识（如 'select'、'mine'） */
  id: string;
  /** 对应的工具类型（如 'select'、'designate'、'build'） */
  tool: string;
  /** 按钮显示标签 */
  label: string;
  /** 快捷键 */
  hotkey: string;
  /** 指派类型（仅 designate 工具需要） */
  designationType?: string;
  /** 建筑定义 ID（仅 build 工具需要） */
  buildDefId?: string;
  /** 区域类型（仅 zone 工具需要） */
  zoneType?: string;
  /** 是否为区域菜单切换按钮（点击展开/收起子菜单） */
  isZoneToggle?: boolean;
  /** 所属分组编号（用于在工具栏中分组显示） */
  group: number;
}

/** 建造模式摘要 — 当前模式的简要信息 */
export interface BuildModeSummary {
  /** 模式标题（如 "Select"、"Build: wall_wood"） */
  title: string;
  /** 当前工具类型 */
  activeTool: string;
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
