import type { CellCoord } from '../../core/types';
import type { GameMap } from '../../world/game-map';
import type { PresentationState, PlacementPreview } from '../../presentation/presentation-state';

/**
 * PlacementTool — manages the building placement preview.
 * Validates whether a cell is valid for placing a building.
 */
export class PlacementTool {
  private map: GameMap;

  constructor(map: GameMap) {
    this.map = map;
  }

  /** Update the placement preview based on the hovered cell and selected building. */
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

  /** Check if a cell is valid for building placement. */
  isValidPlacement(cell: CellCoord): boolean {
    return this.map.spatial.isPassable(cell);
  }
}
