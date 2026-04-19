/**
 * @file build.selectors.ts
 * @description 建造领域的选择器 — 从 EngineSnapshot 派生顶栏数据和分层命令菜单视图模型
 * @dependencies ui/kernel/ui-types — EngineSnapshot；build.types — TopStatusBarViewModel,
 *               CommandMenuViewModel；command-menu — getVisibleCommandMenuEntries,
 *               resolveActiveCommandLeafId
 * @part-of ui/domains/build — 建造 UI 领域
 */

import type { EngineSnapshot } from '../../kernel/ui-types';
import type { CommandMenuViewModel, TopStatusBarViewModel } from './build.types';
import { getVisibleCommandMenuEntries, resolveActiveCommandLeafId } from './command-menu';

/**
 * 选择顶部状态栏视图模型
 *
 * @param snapshot - 引擎快照
 * @returns 包含时钟、tick、速度、殖民者数的顶栏数据
 */
export function selectTopStatusBar(snapshot: EngineSnapshot): TopStatusBarViewModel {
  return {
    clockDisplay: snapshot.clockDisplay,
    tick: snapshot.tick,
    speed: snapshot.speed,
    colonistCount: snapshot.colonistCount,
  };
}

/**
 * 选择当前层级的命令菜单视图模型 — 由 ToolModeBar 和键盘绑定共同消费
 *
 * 工作原理：
 * 1. 用 PresentationState 中的工具切片推断激活叶子 id；
 * 2. 用快照里的 commandMenuPath 解析当前可见层级；
 * 3. 把激活叶子和它的祖先分支标记 active，渲染时自动高亮。
 */
export function selectCommandMenuViewModel(snapshot: EngineSnapshot): CommandMenuViewModel {
  const activeLeafId = resolveActiveCommandLeafId({
    activeTool: snapshot.presentation.activeTool,
    activeDesignationType: snapshot.presentation.activeDesignationType,
    activeBuildDefId: snapshot.presentation.activeBuildDefId,
    activeZoneType: snapshot.presentation.activeZoneType,
  });

  return {
    path: snapshot.presentation.commandMenuPath,
    entries: getVisibleCommandMenuEntries(snapshot.presentation.commandMenuPath, activeLeafId),
  };
}
