/**
 * @file build.schemas.ts
 * @description 建造领域的静态配置 — 速度按钮、工具动作、实用按钮的定义数据
 * @dependencies build.types — SpeedButtonDef, ToolActionDef
 * @part-of ui/domains/build — 建造 UI 领域
 */

import type { SpeedButtonDef, ToolActionDef } from './build.types';

// ── 速度按钮 ──

/** 顶栏速度切换按钮定义（暂停/正常/快速/极速） */
export const speedButtons: readonly SpeedButtonDef[] = [
  { value: 0, label: 'II' },
  { value: 1, label: '>' },
  { value: 2, label: '>>' },
  { value: 3, label: '>>>>' },
];

// ── 工具动作 ──

/**
 * 底部工具栏的所有工具动作定义
 *
 * group 字段控制分组显示：
 * - 0: 选择工具
 * - 1: 建造工具
 * - 2: 指派工具（采矿/收获/砍伐）
 * - 3: 区域工具（仓储区等）
 * - 4: 取消工具
 */
export const toolActions: readonly ToolActionDef[] = [
  { id: 'select', tool: 'select', label: 'Select', hotkey: 'Q', group: 0 },
  { id: 'build', tool: 'build', label: 'Wall', hotkey: 'B', buildDefId: 'wall_wood', group: 1 },
  { id: 'mine', tool: 'designate', label: 'Mine', hotkey: 'M', designationType: 'mine', group: 2 },
  { id: 'harvest', tool: 'designate', label: 'Harvest', hotkey: 'H', designationType: 'harvest', group: 2 },
  { id: 'cut', tool: 'designate', label: 'Cut', hotkey: 'X', designationType: 'cut', group: 2 },
  { id: 'zone', tool: 'zone', label: 'Zone', hotkey: 'Z', zoneType: 'stockpile', group: 3 },
  { id: 'stockpile', tool: 'zone', label: 'Stockpile', hotkey: '', zoneType: 'stockpile', group: 3 },
  { id: 'cancel', tool: 'cancel', label: 'Cancel', hotkey: 'C', group: 4 },
];

// ── 实用按钮 ──

/** 工具栏右侧的实用快捷按钮（仅显示提示，实际操作由键盘快捷键处理） */
export const utilityButtons = [
  { label: 'Pause', hotkey: 'SPACE' },
  { label: 'Save', hotkey: 'F6' },
  { label: 'Debug', hotkey: 'F1' },
] as const;
