/**
 * @file input-handler.ts
 * @description 输入处理器 — 鼠标点击/拖拽状态机、工具操作执行、放置/指派预览更新
 * @dependencies phaser — 输入系统；world/world — 命令队列；world/game-map — 地图数据；
 *               core/types — CellCoord、ObjectKind、DesignationType、ZoneType；
 *               presentation — ToolType、PresentationState
 * @part-of adapter/input — 输入处理模块
 */

import Phaser from 'phaser';
import { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { CellCoord, ObjectKind, DesignationType, ZoneType, cellKey } from '../../core/types';
import { PresentationState, ToolType, clearTransientInteractionState, popBackNavigation, applyObjectSelection } from '../../presentation/presentation-state';
import type { Designation } from '../../features/designation/designation.types';
import { analyzeZoneCellPlacement } from '../../features/zone/zone.analysis';
import { analyzeBuildingPlacement } from '../../features/construction/construction.placement';
import { setupKeyboardBindings } from './keyboard-bindings';

/** 地图格子像素大小 */
const TILE_SIZE = 32;

/** 拖拽检测阈值（像素） */
const DRAG_THRESHOLD = 6;

/** 框选最大范围（单边格数，防止性能问题） */
const MAX_DRAG_SIZE = 50;

/**
 * 输入处理器类
 *
 * 职责：
 * 1. 监听鼠标点击/拖拽 — 根据当前工具模式执行单击或批量操作
 * 2. 每帧更新悬停格子、放置预览和指派预览
 *
 * 键盘快捷键绑定见 keyboard-bindings.ts
 */
export class InputHandler {
  // ── 引用 ──
  private scene: Phaser.Scene;
  private world: World;
  private map: GameMap;
  private presentation: PresentationState;

  // ── 拖拽状态 ──
  private dragState: {
    startScreenPos: { x: number; y: number };
    startCell: CellCoord;
    active: boolean;
  } | null = null;

  constructor(
    scene: Phaser.Scene,
    world: World,
    map: GameMap,
    presentation: PresentationState,
  ) {
    this.scene = scene;
    this.world = world;
    this.map = map;
    this.presentation = presentation;

    this.setupMouseInputs();
    setupKeyboardBindings(scene, world, presentation);
  }

  /** 注册鼠标输入事件 */
  private setupMouseInputs(): void {
    // 拦截浏览器右键菜单
    this.bindContextMenuPrevention();

    // pointerdown：记录起点（左键）或执行返回动作（右键）
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // 右键：执行返回动作
      if (pointer.rightButtonDown()) {
        this.handleBackAction();
        return;
      }
      if (!pointer.leftButtonDown()) return;
      const cell = this.pointerToCell(pointer);
      if (!cell) return;
      this.presentation.dragRect = null;
      this.presentation.zonePreview = null;
      this.dragState = {
        startScreenPos: { x: pointer.x, y: pointer.y },
        startCell: cell,
        active: false,
      };
    });

    // pointermove：超阈值后激活拖拽
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragState || !pointer.leftButtonDown()) return;
      if (this.dragState.active) {
        // 已在拖拽中：更新 dragRect
        const cell = this.pointerToCell(pointer);
        if (cell) {
          this.presentation.dragRect = {
            startCell: this.dragState.startCell,
            endCell: cell,
          };
        }
        return;
      }
      // 检测阈值
      const dx = pointer.x - this.dragState.startScreenPos.x;
      const dy = pointer.y - this.dragState.startScreenPos.y;
      if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
        this.dragState.active = true;
        const cell = this.pointerToCell(pointer);
        if (cell) {
          this.presentation.dragRect = {
            startCell: this.dragState.startCell,
            endCell: cell,
          };
        }
      }
    });

    // pointerup：执行拖拽操作或单击
    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragState) return;

      if (this.dragState.active) {
        // 拖拽结束 → 执行批量操作
        const endCell = this.pointerToCell(pointer) ?? this.presentation.dragRect?.endCell;
        if (endCell) {
          this.executeDragAction(this.dragState.startCell, endCell);
        }
        this.presentation.dragRect = null;
      } else {
        // 单击 → 执行单格操作
        const cell = this.pointerToCell(pointer);
        if (cell) {
          this.handleClick(cell);
        }
      }
      this.dragState = null;
    });
  }

  // ── 坐标转换 ──

  private pointerToCell(pointer: Phaser.Input.Pointer): CellCoord | null {
    const cam = this.scene.cameras.main;
    const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
    const x = Math.floor(worldPoint.x / TILE_SIZE);
    const y = Math.floor(worldPoint.y / TILE_SIZE);
    if (x < 0 || x >= this.map.width || y < 0 || y >= this.map.height) return null;
    return { x, y };
  }

  /**
   * 拦截 Phaser canvas 上的浏览器右键菜单
   * 仅对游戏画布生效，不影响调试面板或浏览器原生交互
   */
  private bindContextMenuPrevention(): void {
    const canvas = this.scene.game?.canvas;
    if (canvas) {
      canvas.addEventListener('contextmenu', (event: Event) => {
        event.preventDefault();
      });
    }
  }

  /**
   * 右键返回动作 — 按返回栈逐层回退交互状态
   *
   * 执行顺序：
   * 1. 如果正在拖拽，则取消当前拖拽（不弹栈）
   * 2. 如果没有拖拽，清理临时预览后弹出返回栈顶层
   */
  private handleBackAction(): void {
    // 优先取消进行中的拖拽
    if (this.dragState) {
      this.dragState = null;
      clearTransientInteractionState(this.presentation);
      return;
    }

    // 清理临时预览并恢复上一层稳定状态
    popBackNavigation(this.presentation);
  }

  // ── 单击处理 ──

  /** 单击分发 — 根据当前工具执行对应操作 */
  private handleClick(cell: CellCoord): void {
    switch (this.presentation.activeTool) {
      case ToolType.Select:
        this.handleSelect(cell);
        break;
      case ToolType.Build:
        this.handleBuild(cell);
        break;
      case ToolType.Designate:
        this.handleDesignate(cell);
        break;
      case ToolType.Zone:
        this.handleZone(cell);
        break;
      case ToolType.Cancel:
        this.handleCancel(cell);
        break;
    }
  }

  private handleSelect(cell: CellCoord): void {
    const objectIds = Array.from(this.map.spatial.getAt(cell));
    applyObjectSelection(this.presentation, objectIds);
  }

  private handleBuild(cell: CellCoord): void {
    if (!this.presentation.activeBuildDefId) return;
    this.world.commandQueue.push({
      type: 'place_blueprint',
      payload: { defId: this.presentation.activeBuildDefId, cell, rotation: 0 },
    });
  }

  private handleZone(cell: CellCoord): void {
    const zoneType = this.presentation.activeZoneType ?? ZoneType.Stockpile;
    const analysis = this.analyzeZonePlacement([cell], zoneType);
    if (analysis.validCellCount === 0) return;

    this.world.commandQueue.push({
      type: 'zone_set_cells',
      payload: {
        mapId: this.map.id,
        zoneType,
        cells: analysis.validCells,
      },
    });
  }

  private handleDesignate(cell: CellCoord): void {
    switch (this.presentation.activeDesignationType!) {
      case DesignationType.Mine:
        this.world.commandQueue.push({
          type: 'designate_mine',
          payload: { cell },
        });
        break;
      case DesignationType.Harvest: {
        const objIds = this.map.spatial.getAt(cell);
        for (const id of objIds) {
          const obj = this.map.objects.get(id);
          if (obj && obj.kind === ObjectKind.Plant) {
            this.world.commandQueue.push({
              type: 'designate_harvest',
              payload: { targetId: id },
            });
          }
        }
        break;
      }
      case DesignationType.Cut: {
        const objIds = this.map.spatial.getAt(cell);
        for (const id of objIds) {
          const obj = this.map.objects.get(id);
          if (obj && obj.kind === ObjectKind.Plant && obj.tags.has('tree')) {
            this.world.commandQueue.push({
              type: 'designate_cut',
              payload: { targetId: id },
            });
          }
        }
        break;
      }
    }
  }

  /** 取消格子上的指派/蓝图/工地 */
  private handleCancel(cell: CellCoord): void {
    this.removeCellsFromZones([cell]);

    const objIds = this.map.spatial.getAt(cell);
    for (const id of objIds) {
      const obj = this.map.objects.get(id);
      if (!obj) continue;

      if (obj.kind === ObjectKind.Designation) {
        this.world.commandQueue.push({
          type: 'cancel_designation',
          payload: { designationId: id },
        });
      } else if (obj.kind === ObjectKind.Blueprint || obj.kind === ObjectKind.ConstructionSite) {
        this.world.commandQueue.push({
          type: 'cancel_construction',
          payload: { targetId: id },
        });
      }
    }
  }

  // ── 拖拽批量操作 ──

  /**
   * 执行拖拽区域的批量操作
   * 按当前工具遍历矩形内所有格子，对每格执行对应操作
   */
  private executeDragAction(startCell: CellCoord, endCell: CellCoord): void {
    const { minX, minY, maxX, maxY } = this.getClampedBounds(startCell, endCell);

    // 截断过大区域
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const clampedMaxX = minX + Math.min(w, MAX_DRAG_SIZE) - 1;
    const clampedMaxY = minY + Math.min(h, MAX_DRAG_SIZE) - 1;

    switch (this.presentation.activeTool) {
      case ToolType.Select:
        this.dragSelect(minX, minY, clampedMaxX, clampedMaxY);
        break;
      case ToolType.Build:
        this.dragBuild(minX, minY, clampedMaxX, clampedMaxY);
        break;
      case ToolType.Designate:
        this.dragDesignate(minX, minY, clampedMaxX, clampedMaxY);
        break;
      case ToolType.Zone:
        this.dragZoneCreate(minX, minY, clampedMaxX, clampedMaxY);
        break;
      case ToolType.Cancel:
        this.dragCancel(minX, minY, clampedMaxX, clampedMaxY);
        break;
    }
  }

  /** 框选：矩形内所有对象加入选中集 */
  private dragSelect(minX: number, minY: number, maxX: number, maxY: number): void {
    const allIds: string[] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const objIds = this.map.spatial.getAt({ x, y });
        for (const id of objIds) {
          allIds.push(id);
        }
      }
    }
    applyObjectSelection(this.presentation, allIds);
  }

  /** 框建：矩形内每个可放置格子批量放蓝图（仅 1x1） */
  private dragBuild(minX: number, minY: number, maxX: number, maxY: number): void {
    if (!this.presentation.activeBuildDefId) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cell = { x, y };
        if (this.map.spatial.isPassable(cell)) {
          this.world.commandQueue.push({
            type: 'place_blueprint',
            payload: { defId: this.presentation.activeBuildDefId, cell, rotation: 0 },
          });
        }
      }
    }
  }

  /** 框选指派：按指派类型批量下发 */
  private dragDesignate(minX: number, minY: number, maxX: number, maxY: number): void {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cell = { x, y };

        switch (this.presentation.activeDesignationType!) {
          case DesignationType.Mine: {
            const terrainDefId = this.map.terrain.get(x, y);
            const terrainDef = this.world.defs.terrains.get(terrainDefId);
            if (terrainDef?.mineable) {
              // 检查是否已有同类 designation 避免重复
              if (!this.hasDuplicateDesignation(cell, DesignationType.Mine)) {
                this.world.commandQueue.push({
                  type: 'designate_mine',
                  payload: { cell },
                });
              }
            }
            break;
          }
          case DesignationType.Harvest: {
            const objIds = this.map.spatial.getAt(cell);
            for (const id of objIds) {
              const obj = this.map.objects.get(id);
              if (obj && obj.kind === ObjectKind.Plant) {
                this.world.commandQueue.push({
                  type: 'designate_harvest',
                  payload: { targetId: id },
                });
              }
            }
            break;
          }
          case DesignationType.Cut: {
            const objIds = this.map.spatial.getAt(cell);
            for (const id of objIds) {
              const obj = this.map.objects.get(id);
              if (obj && obj.kind === ObjectKind.Plant && obj.tags.has('tree')) {
                this.world.commandQueue.push({
                  type: 'designate_cut',
                  payload: { targetId: id },
                });
              }
            }
            break;
          }
        }
      }
    }
  }

  /** 框选取消：矩形内所有可取消对象批量取消 */
  private dragCancel(minX: number, minY: number, maxX: number, maxY: number): void {
    const cells = this.getRectCells(minX, minY, maxX, maxY);
    this.removeCellsFromZones(cells);

    for (const cell of cells) {
      const objIds = this.map.spatial.getAt(cell);
      for (const id of objIds) {
        const obj = this.map.objects.get(id);
        if (!obj) continue;

        if (obj.kind === ObjectKind.Designation) {
          this.world.commandQueue.push({
            type: 'cancel_designation',
            payload: { designationId: id },
          });
        } else if (obj.kind === ObjectKind.Blueprint || obj.kind === ObjectKind.ConstructionSite) {
          this.world.commandQueue.push({
            type: 'cancel_construction',
            payload: { targetId: id },
          });
        }
      }
    }
  }

  /** 框选区域：仅提交未被其他区域占用的格子 */
  private dragZoneCreate(minX: number, minY: number, maxX: number, maxY: number): void {
    const zoneType = this.presentation.activeZoneType ?? ZoneType.Stockpile;
    const analysis = this.analyzeZonePlacement(this.getRectCells(minX, minY, maxX, maxY), zoneType);
    if (analysis.validCellCount === 0) return;

    this.world.commandQueue.push({
      type: 'zone_set_cells',
      payload: {
        mapId: this.map.id,
        zoneType,
        cells: analysis.validCells,
      },
    });
  }

  /** 检查格子上是否已有同类 designation（防重复） */
  private hasDuplicateDesignation(cell: CellCoord, type: DesignationType): boolean {
    const objIds = this.map.spatial.getAt(cell);
    for (const id of objIds) {
      const obj = this.map.objects.get(id);
      if (obj && obj.kind === ObjectKind.Designation) {
        const desig = obj as Designation;
        if (desig.designationType === type) {
          return true;
        }
      }
    }
    return false;
  }

  /** 当前格子是否已经被某个区域占用 */
  private isCellInAnyZone(cell: CellCoord): boolean {
    return !!this.map.zones.getZoneAt(cellKey(cell));
  }

  /** 复用 zone 领域规则分析当前区域创建意图 */
  private analyzeZonePlacement(cells: CellCoord[], zoneType: ZoneType) {
    return analyzeZoneCellPlacement(this.map, zoneType, cells);
  }

  /** 收集矩形范围内的所有格子 */
  private getRectCells(minX: number, minY: number, maxX: number, maxY: number): CellCoord[] {
    const cells: CellCoord[] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        cells.push({ x, y });
      }
    }
    return cells;
  }

  /** 计算拖拽矩形边界并裁剪到地图内 */
  private getClampedBounds(startCell: CellCoord, endCell: CellCoord): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    return {
      minX: Math.max(0, Math.min(startCell.x, endCell.x)),
      maxX: Math.min(this.map.width - 1, Math.max(startCell.x, endCell.x)),
      minY: Math.max(0, Math.min(startCell.y, endCell.y)),
      maxY: Math.min(this.map.height - 1, Math.max(startCell.y, endCell.y)),
    };
  }

  /** 从若干格子中擦除区域格子 */
  private removeCellsFromZones(cells: CellCoord[]): void {
    const zoneCells = Array.from(new Set(
      cells
        .filter((cell) => this.isCellInAnyZone(cell))
        .map((cell) => cellKey(cell)),
    )).map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });

    if (zoneCells.length > 0) {
      this.world.commandQueue.push({
        type: 'zone_remove_cells',
        payload: {
          mapId: this.map.id,
          cells: zoneCells,
        },
      });
    }
  }

  /** 更新区域预览态 */
  private updateZonePreview(): void {
    if (this.presentation.activeTool !== ToolType.Zone && this.presentation.activeTool !== ToolType.Cancel) {
      this.presentation.zonePreview = null;
      return;
    }

    const dragRect = this.presentation.dragRect;
    const zoneType = this.presentation.activeTool === ToolType.Zone
      ? (this.presentation.activeZoneType ?? ZoneType.Stockpile)
      : null;

    let cells: CellCoord[] = [];
    if (dragRect) {
      const { minX, minY, maxX, maxY } = this.getClampedBounds(dragRect.startCell, dragRect.endCell);
      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      const clampedMaxX = minX + Math.min(w, MAX_DRAG_SIZE) - 1;
      const clampedMaxY = minY + Math.min(h, MAX_DRAG_SIZE) - 1;
      cells = this.getRectCells(minX, minY, clampedMaxX, clampedMaxY);
    } else if (this.presentation.hoveredCell) {
      cells = [this.presentation.hoveredCell];
    } else {
      this.presentation.zonePreview = null;
      return;
    }

    const zonePlacement = zoneType ? this.analyzeZonePlacement(cells, zoneType) : null;
    const validCells = this.presentation.activeTool === ToolType.Zone
      ? (zonePlacement?.validCells ?? [])
      : cells.filter((cell) => this.isCellInAnyZone(cell));
    const invalidCells = this.presentation.activeTool === ToolType.Zone
      ? (zonePlacement?.invalidCells ?? [])
      : cells.filter((cell) => !this.isCellInAnyZone(cell));

    this.presentation.zonePreview = {
      mode: this.presentation.activeTool === ToolType.Zone ? 'create' : 'erase',
      zoneType,
      cells,
      validCells,
      invalidCells,
      valid: validCells.length > 0,
    };
  }

  // ── 每帧更新 ──

  /**
   * 每帧更新 — 刷新悬停格子、放置预览和指派预览
   */
  update(): void {
    const pointer = this.scene.input.activePointer;
    this.presentation.hoveredCell = this.pointerToCell(pointer);

    // 更新放置预览（使用共享 placement 判定，包含 footprint 边界检查和占地冲突检查）
    if (this.presentation.activeTool === ToolType.Build && this.presentation.activeBuildDefId && this.presentation.hoveredCell) {
      const cell = this.presentation.hoveredCell;
      const footprint = this.world.defs.buildings.get(this.presentation.activeBuildDefId)?.size ?? { width: 1, height: 1 };
      // 检查 footprint 是否在地图边界内
      const inBounds = (
        cell.x >= 0
        && cell.y >= 0
        && cell.x + footprint.width - 1 < this.map.width
        && cell.y + footprint.height - 1 < this.map.height
      );
      // 使用共享 placement 判定检查占地冲突
      const placement = inBounds
        ? analyzeBuildingPlacement(this.map, cell, footprint)
        : { blocked: true };

      this.presentation.placementPreview = {
        defId: this.presentation.activeBuildDefId,
        cell,
        footprint,
        rotation: 0,
        valid: inBounds && !placement.blocked,
      };
    } else {
      this.presentation.placementPreview = null;
    }

    // 更新指派预览
    if (this.presentation.activeTool === ToolType.Designate && this.presentation.hoveredCell) {
      const cell = this.presentation.hoveredCell;
      let valid = false;

      switch (this.presentation.activeDesignationType!) {
        case DesignationType.Mine: {
          const terrainDefId = this.map.terrain.get(cell.x, cell.y);
          const terrainDef = this.world.defs.terrains.get(terrainDefId);
          valid = !!terrainDef?.mineable;
          break;
        }
        case DesignationType.Cut: {
          const objIds = this.map.spatial.getAt(cell);
          for (const id of objIds) {
            const obj = this.map.objects.get(id);
            if (obj && obj.kind === ObjectKind.Plant && obj.tags.has('tree')) {
              valid = true;
              break;
            }
          }
          break;
        }
        case DesignationType.Harvest: {
          const objIds = this.map.spatial.getAt(cell);
          for (const id of objIds) {
            const obj = this.map.objects.get(id);
            if (obj && obj.kind === ObjectKind.Plant) {
              valid = true;
              break;
            }
          }
          break;
        }
      }

      this.presentation.designationPreview = {
        cell,
        designationType: this.presentation.activeDesignationType!,
        valid,
      };
    } else {
      this.presentation.designationPreview = null;
    }

    this.updateZonePreview();
  }
}
