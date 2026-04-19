/**
 * @file command-menu.ts
 * @description 分层命令菜单纯函数 — 定义菜单树、按当前路径解析可见层级、动态分配字母快捷键、推断激活叶子
 * @dependencies build.types — ToolActionDef, CommandMenuEntryViewModel
 * @part-of ui/domains/build — 建造 UI 领域
 */

import type { CommandMenuEntryViewModel, ToolActionDef } from './build.types';

/** 命令菜单根/分支共用的节点结构 */
interface CommandMenuNode {
  /** 节点标识（叶子=工具动作 id；分支=进入子层时压入路径的 id） */
  id: string;
  /** 显示标签 */
  label: string;
  /** 节点类型 */
  kind: 'branch' | 'leaf';
  /** 叶子节点对应的工具切换 payload */
  action?: ToolActionDef;
  /** 分支节点的子节点列表 */
  children?: CommandMenuNode[];
}

/** 当前工具状态切片 — 用于推断激活叶子 id */
export interface ActiveToolState {
  activeTool: string;
  activeDesignationType: string | null;
  activeBuildDefId: string | null;
  activeZoneType: string | null;
}

/** 当前层级条目可分配的快捷键序列（按位置依次分配） */
export const COMMAND_SHORTCUT_KEYS = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'] as const;

/** 命令菜单根节点定义 */
const ROOT_COMMAND_MENU: CommandMenuNode[] = [
  {
    id: 'select',
    label: '选择',
    kind: 'leaf',
    action: { id: 'select', tool: 'select', label: '选择', hotkey: '', group: 0 },
  },
  {
    id: 'build',
    label: '建造',
    kind: 'branch',
    children: [
      {
        id: 'structure',
        label: '结构',
        kind: 'branch',
        children: [
          {
            id: 'build_wall',
            label: '墙',
            kind: 'leaf',
            action: { id: 'build_wall', tool: 'build', label: '墙', hotkey: '', buildDefId: 'wall_wood', group: 1 },
          },
        ],
      },
      {
        id: 'furniture',
        label: '家具',
        kind: 'branch',
        children: [
          {
            id: 'build_bed',
            label: '床',
            kind: 'leaf',
            action: { id: 'build_bed', tool: 'build', label: '床', hotkey: '', buildDefId: 'bed_wood', group: 1 },
          },
          {
            id: 'build_warehouse',
            label: '仓库',
            kind: 'leaf',
            action: { id: 'build_warehouse', tool: 'build', label: '仓库', hotkey: '', buildDefId: 'warehouse_shed', group: 1 },
          },
        ],
      },
    ],
  },
  {
    id: 'designate',
    label: '指令',
    kind: 'branch',
    children: [
      {
        id: 'mine',
        label: '采矿',
        kind: 'leaf',
        action: { id: 'mine', tool: 'designate', label: '采矿', hotkey: '', designationType: 'mine', group: 2 },
      },
      {
        id: 'harvest',
        label: '收获',
        kind: 'leaf',
        action: { id: 'harvest', tool: 'designate', label: '收获', hotkey: '', designationType: 'harvest', group: 2 },
      },
      {
        id: 'cut',
        label: '砍伐',
        kind: 'leaf',
        action: { id: 'cut', tool: 'designate', label: '砍伐', hotkey: '', designationType: 'cut', group: 2 },
      },
    ],
  },
  {
    id: 'zone',
    label: '区域',
    kind: 'branch',
    children: [
      {
        id: 'zone_growing',
        label: '种植区',
        kind: 'leaf',
        action: { id: 'zone_growing', tool: 'zone', label: '种植区', hotkey: '', zoneType: 'growing', group: 3 },
      },
    ],
  },
  {
    id: 'cancel',
    label: '取消',
    kind: 'leaf',
    action: { id: 'cancel', tool: 'cancel', label: '取消', hotkey: '', group: 4 },
  },
];

/** 沿菜单路径下钻得到当前层级的节点列表，未命中时回退根层 */
function resolveLevel(path: readonly string[]): CommandMenuNode[] {
  let level = ROOT_COMMAND_MENU;
  for (const segment of path) {
    const next = level.find((node) => node.id === segment && node.kind === 'branch');
    if (!next || !next.children) return ROOT_COMMAND_MENU;
    level = next.children;
  }
  return level;
}

/** 找到包含给定叶子 id 的所有祖先分支 id（用于祖先高亮） */
function findActiveAncestorBranchIds(activeLeafId: string): string[] {
  const result: string[] = [];

  function walk(nodes: CommandMenuNode[], trail: string[]): boolean {
    for (const node of nodes) {
      if (node.kind === 'leaf') {
        if (node.id === activeLeafId) {
          result.push(...trail);
          return true;
        }
        continue;
      }
      if (node.children && walk(node.children, [...trail, node.id])) {
        return true;
      }
    }
    return false;
  }

  walk(ROOT_COMMAND_MENU, []);
  return result;
}

/**
 * 根据当前 PresentationState 工具切片推断激活的命令菜单叶子 id
 *
 * 用于祖先高亮：知道当前激活的是哪个叶子，菜单层级里就能标记它的所有祖先分支为 active。
 */
export function resolveActiveCommandLeafId(state: ActiveToolState): string {
  if (state.activeTool === 'build') {
    return state.activeBuildDefId === 'bed_wood' ? 'build_bed' : 'build_wall';
  }
  if (state.activeTool === 'designate') {
    return state.activeDesignationType ?? 'mine';
  }
  if (state.activeTool === 'zone') {
    return 'zone_growing';
  }
  return state.activeTool;
}

/**
 * 解析当前路径下的可见菜单条目
 *
 * - 根层：直接返回 [选择, 建造, 指令, 区域, 取消]，按位置分配 Z/X/C/V/B/N/M。
 * - 子层：在该层条目前面追加 { id: '__back__', label: '返回', shortcut: 'Esc', kind: 'back' }。
 * - 激活态：叶子按 id 命中；分支按祖先链命中（祖先高亮）。
 */
export function getVisibleCommandMenuEntries(
  path: readonly string[],
  activeLeafId: string,
): CommandMenuEntryViewModel[] {
  const level = resolveLevel(path);
  const activeBranchSet = new Set(findActiveAncestorBranchIds(activeLeafId));
  const mapped: CommandMenuEntryViewModel[] = level.map((node, index) => ({
    id: node.id,
    label: node.label,
    shortcut: COMMAND_SHORTCUT_KEYS[index] ?? '',
    kind: node.kind,
    active: node.kind === 'leaf' ? node.id === activeLeafId : activeBranchSet.has(node.id),
    branchId: node.kind === 'branch' ? node.id : undefined,
    action: node.action,
  }));

  if (path.length === 0) return mapped;
  const backEntry: CommandMenuEntryViewModel = {
    id: '__back__',
    label: '返回',
    shortcut: 'Esc',
    kind: 'back',
    active: false,
  };
  return [backEntry, ...mapped];
}
