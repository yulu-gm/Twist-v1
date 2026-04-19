/**
 * @file command-menu.test.ts
 * @description 分层命令菜单纯函数测试 — 覆盖根/子层、返回项、动态快捷键、祖先高亮、激活叶子解析
 * @part-of ui/domains/build — 建造 UI 领域
 */

import { describe, expect, it } from 'vitest';
import {
  COMMAND_SHORTCUT_KEYS,
  getVisibleCommandMenuEntries,
  resolveActiveCommandLeafId,
} from './command-menu';

describe('command-menu', () => {
  it('exposes the canonical Z/X/C/V/B/N/M shortcut sequence', () => {
    expect([...COMMAND_SHORTCUT_KEYS]).toEqual(['Z', 'X', 'C', 'V', 'B', 'N', 'M']);
  });

  it('returns root entries with dynamic shortcuts', () => {
    const entries = getVisibleCommandMenuEntries([], 'select');
    expect(entries.map((entry) => `${entry.shortcut}:${entry.label}`)).toEqual([
      'Z:选择',
      'X:建造',
      'C:指令',
      'V:区域',
      'B:取消',
    ]);
  });

  it('marks the active leaf at the current root level', () => {
    const entries = getVisibleCommandMenuEntries([], 'select');
    expect(entries.find((entry) => entry.id === 'select')?.active).toBe(true);
    expect(entries.find((entry) => entry.id === 'cancel')?.active).toBe(false);
  });

  it('prepends 返回 on non-root levels and lists branch children with shortcuts', () => {
    const entries = getVisibleCommandMenuEntries(['build'], 'build_wall');
    expect(entries[0]).toMatchObject({ id: '__back__', label: '返回', shortcut: 'Esc', kind: 'back' });
    expect(entries[1]).toMatchObject({ label: '结构', shortcut: 'Z', kind: 'branch' });
    expect(entries[2]).toMatchObject({ label: '家具', shortcut: 'X', kind: 'branch' });
  });

  it('resolves root highlight to 建造 when wall is the active leaf', () => {
    const entries = getVisibleCommandMenuEntries([], 'build_wall');
    expect(entries.find((entry) => entry.label === '建造')?.active).toBe(true);
    expect(entries.find((entry) => entry.label === '区域')?.active).toBe(false);
  });

  it('marks the active branch on the matching parent at non-root levels', () => {
    const entries = getVisibleCommandMenuEntries(['build'], 'build_bed');
    expect(entries.find((entry) => entry.label === '家具')?.active).toBe(true);
    expect(entries.find((entry) => entry.label === '结构')?.active).toBe(false);
  });

  it('returns leaf entries at the deepest level marked active when current leaf matches', () => {
    const entries = getVisibleCommandMenuEntries(['build', 'furniture'], 'build_bed');
    expect(entries.map((entry) => entry.label)).toEqual(['返回', '床']);
    expect(entries[1].active).toBe(true);
  });

  it('resolves designate and zone leaves from tool state', () => {
    expect(
      resolveActiveCommandLeafId({
        activeTool: 'designate',
        activeDesignationType: 'mine',
        activeBuildDefId: null,
        activeZoneType: null,
      }),
    ).toBe('mine');

    expect(
      resolveActiveCommandLeafId({
        activeTool: 'zone',
        activeDesignationType: null,
        activeBuildDefId: null,
        activeZoneType: 'growing',
      }),
    ).toBe('zone_growing');

    expect(
      resolveActiveCommandLeafId({
        activeTool: 'build',
        activeDesignationType: null,
        activeBuildDefId: 'bed_wood',
        activeZoneType: null,
      }),
    ).toBe('build_bed');

    expect(
      resolveActiveCommandLeafId({
        activeTool: 'select',
        activeDesignationType: null,
        activeBuildDefId: null,
        activeZoneType: null,
      }),
    ).toBe('select');
  });
});
