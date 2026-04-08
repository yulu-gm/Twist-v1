/**
 * @file placement-tool.ts
 * @description 建筑放置工具，管理建筑放置预览并验证格子是否可放置
 * @dependencies core/types — CellCoord 坐标类型；world/game-map — 地图数据；
 *               presentation — PlacementPreview、PresentationState
 * @part-of adapter/input — 输入处理模块
 */

import type { CellCoord } from '../../core/types';
import type { GameMap } from '../../world/game-map';
import type { PresentationState, PlacementPreview } from '../../presentation/presentation-state';

/**
 * 建筑放置工具类
 *
 * 职责：
 * 1. 根据悬停格子和选中的建筑定义更新放置预览
 * 2. 验证目标格子是否可以放置建筑（基于通行性检查）
 */
export class PlacementTool {
  /** 当前地图引用 */
  private map: GameMap;

  constructor(map: GameMap) {
    this.map = map;
  }

  /**
   * 更新放置预览状态
   *
   * @param presentation - 展示层状态，预览信息写入其 placementPreview 字段
   * @param defId - 当前选中的建筑定义 ID，为 null 时清除预览
   * @param hoveredCell - 鼠标悬停的格子坐标，为 null 时清除预览
   */
  updatePreview(
    presentation: PresentationState,
    defId: string | null,
    hoveredCell: CellCoord | null,
  ): void {
    if (!defId || !hoveredCell) {
      presentation.placementPreview = null;
      return;
    }

    const valid = this.isValidPlacement(hoveredCell);
    presentation.placementPreview = {
      defId,
      cell: hoveredCell,
      rotation: 0,
      valid,
    };
  }

  /**
   * 检查格子是否可放置建筑
   *
   * @param cell - 目标格子坐标
   * @returns true 表示该格子可通行，允许放置
   */
  isValidPlacement(cell: CellCoord): boolean {
    return this.map.spatial.isPassable(cell);
  }
}
