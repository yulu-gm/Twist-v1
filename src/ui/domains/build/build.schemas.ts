/**
 * @file build.schemas.ts
 * @description 建造领域的静态配置 — 仅保留顶栏速度按钮的静态定义；工具菜单由 command-menu 独立维护
 * @dependencies build.types — SpeedButtonDef
 * @part-of ui/domains/build — 建造 UI 领域
 */

import type { SpeedButtonDef } from './build.types';

// ── 速度按钮 ──

/** 顶栏速度切换按钮定义（暂停/正常/快速/极速） */
export const speedButtons: readonly SpeedButtonDef[] = [
  { value: 0, label: 'II' },
  { value: 1, label: '>' },
  { value: 2, label: '>>' },
  { value: 3, label: '>>>>' },
];
