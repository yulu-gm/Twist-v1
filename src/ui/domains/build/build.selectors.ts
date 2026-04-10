/**
 * @file build.selectors.ts
 * @description 建造领域的选择器 — 从 EngineSnapshot 派生顶栏、建造摘要和当前工具 ID
 * @dependencies ui/kernel/ui-types — EngineSnapshot；build.types — BuildModeSummary,
 *               TopStatusBarViewModel；build.schemas — toolActions
 * @part-of ui/domains/build — 建造 UI 领域
 */

import type { EngineSnapshot } from '../../kernel/ui-types';
import type { BuildModeSummary, TopStatusBarViewModel } from './build.types';
import { toolActions } from './build.schemas';

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
 * 选择建造模式摘要 — 当前工具模式的标题和类型
 *
 * @param snapshot - 引擎快照
 * @returns 建造模式摘要
 */
export function selectBuildModeSummary(snapshot: EngineSnapshot): BuildModeSummary {
  return {
    title: snapshot.build.activeModeLabel,
    activeTool: snapshot.build.activeTool,
  };
}

/**
 * 选择当前激活的工具动作 ID — 用于高亮工具栏按钮
 *
 * @param snapshot - 引擎快照
 * @returns 匹配的工具动作 ID（如 'select'、'mine'、'stockpile'），无匹配时默认 'select'
 *
 * 匹配逻辑：遍历 toolActions，比较 tool、designationType 和 zoneType，
 * designate/zone 类工具需同时匹配子类型才算命中
 */
export function selectActiveToolId(snapshot: EngineSnapshot): string {
  const tool = snapshot.presentation.activeTool;
  const desType = snapshot.presentation.activeDesignationType;
  const zoneType = snapshot.presentation.activeZoneType;

  // 遍历工具动作定义，找到与当前状态匹配的动作
  for (const action of toolActions) {
    if (action.tool === tool) {
      // 区域菜单切换按钮不参与 ID 匹配
      if (action.isZoneToggle) continue;
      if (action.designationType) {
        if (action.designationType === desType) return action.id;
      } else if (action.zoneType) {
        if (action.zoneType === zoneType) return action.id;
      } else {
        return action.id;
      }
    }
  }
  return 'select';
}
