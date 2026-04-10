/**
 * @file top-status-bar.tsx
 * @description 顶部状态栏组件 — 显示游戏时钟、速度控制、殖民者计数和 tick 数
 * @dependencies build.schemas — speedButtons；build.types — TopStatusBarViewModel
 * @part-of ui/domains/build — 建造 UI 领域
 */

import { speedButtons } from '../build.schemas';
import type { TopStatusBarViewModel } from '../build.types';

/** TopStatusBar 组件属性 */
interface TopStatusBarProps {
  /** 顶栏视图模型（由 selectTopStatusBar 选择器生成） */
  viewModel: TopStatusBarViewModel;
  /** 速度切换回调 */
  onSetSpeed: (speed: number) => void;
}

/**
 * 顶部状态栏 — 三区布局
 *
 * - 左区：游戏时钟
 * - 中区：速度切换按钮组（当前速度高亮）
 * - 右区：殖民者计数和 tick 数
 */
export function TopStatusBar({ viewModel, onSetSpeed }: TopStatusBarProps) {
  return (
    <header class="top-status-bar">
      <div class="top-status-bar__left">
        <span class="top-status-bar__clock">{viewModel.clockDisplay}</span>
      </div>
      <div class="top-status-bar__center">
        <div class="speed-group">
          {speedButtons.map(btn => (
            <button
              key={btn.value}
              class={`speed-btn ${btn.value === viewModel.speed ? 'is-active' : ''}`}
              onClick={() => onSetSpeed(btn.value)}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
      <div class="top-status-bar__right">
        <span>{viewModel.colonistCount} colonists</span>
        <span class="top-status-bar__muted">T:{viewModel.tick}</span>
      </div>
    </header>
  );
}
