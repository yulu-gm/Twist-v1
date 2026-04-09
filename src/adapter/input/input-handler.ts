/**
 * @file input-handler.ts
 * @description 输入处理器，处理鼠标点击/拖拽、键盘快捷键，以及放置/指派预览更新
 * @dependencies phaser — 输入系统；world/world — 命令队列；world/game-map — 地图数据；
 *               core/types — CellCoord、ObjectKind、DesignationType、SimSpeed；
 *               presentation — ToolType、OverlayType、PresentationState
 * @part-of adapter/input — 输入处理模块
 */

import Phaser from 'phaser';
import { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { CellCoord, ObjectKind, DesignationType, SimSpeed } from '../../core/types';
import { PresentationState, ToolType, OverlayType } from '../../presentation/presentation-state';
import type { Designation } from '../../features/designation/designation.types';

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
 * 2. 监听键盘快捷键 — 切换工具、速度控制、覆盖层切换、存档/读档
 * 3. 每帧更新悬停格子、放置预览和指派预览
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

    this.setupInputs();
  }

  /** 注册所有输入事件监听器 */
  private setupInputs(): void {
    // ── 鼠标拖拽状态机 ──

    // pointerdown：记录起点
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      const cell = this.pointerToCell(pointer);
      if (!cell) return;
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
        const endCell = this.pointerToCell(pointer);
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

    // ── 键盘快捷键 ──
    if (this.scene.input.keyboard) {
      const kb = this.scene.input.keyboard;

      // ── 速度控制 ──
      kb.on('keydown-SPACE', () => {
        this.world.commandQueue.push({
          type: 'set_speed',
          payload: { speed: this.world.speed === SimSpeed.Paused ? SimSpeed.Normal : SimSpeed.Paused },
        });
      });
      kb.on('keydown-ONE', () => {
        this.world.commandQueue.push({ type: 'set_speed', payload: { speed: SimSpeed.Normal } });
      });
      kb.on('keydown-TWO', () => {
        this.world.commandQueue.push({ type: 'set_speed', payload: { speed: SimSpeed.Fast } });
      });
      kb.on('keydown-THREE', () => {
        this.world.commandQueue.push({ type: 'set_speed', payload: { speed: SimSpeed.UltraFast } });
      });

      // ── 工具快捷键 ──
      kb.on('keydown-ESC', () => {
        this.switchTool(ToolType.Select);
        this.presentation.placementPreview = null;
        this.presentation.selectedObjectIds.clear();
      });
      kb.on('keydown-Q', () => {
        this.switchTool(ToolType.Select);
      });
      kb.on('keydown-B', () => {
        this.switchTool(ToolType.Build);
        this.presentation.activeBuildDefId = 'wall_wood';
        this.presentation.selectedObjectIds.clear();
      });
      kb.on('keydown-M', () => {
        this.switchTool(ToolType.Designate);
        this.presentation.activeDesignationType = DesignationType.Mine;
        this.presentation.selectedObjectIds.clear();
      });
      kb.on('keydown-H', () => {
        this.switchTool(ToolType.Designate);
        this.presentation.activeDesignationType = DesignationType.Harvest;
        this.presentation.selectedObjectIds.clear();
      });
      kb.on('keydown-X', () => {
        this.switchTool(ToolType.Designate);
        this.presentation.activeDesignationType = DesignationType.Cut;
        this.presentation.selectedObjectIds.clear();
      });
      kb.on('keydown-C', () => {
        this.switchTool(ToolType.Cancel);
        this.presentation.selectedObjectIds.clear();
      });

      // 调试面板切换：F1
      kb.on('keydown-F1', () => {
        this.presentation.showDebugPanel = !this.presentation.showDebugPanel;
      });

      // 覆盖层切换：F2 区域、F3 房间、F4 温度、F5 寻路
      kb.on('keydown-F2', () => {
        this.presentation.activeOverlay =
          this.presentation.activeOverlay === OverlayType.Zones ? OverlayType.None : OverlayType.Zones;
      });
      kb.on('keydown-F3', () => {
        this.presentation.activeOverlay =
          this.presentation.activeOverlay === OverlayType.Rooms ? OverlayType.None : OverlayType.Rooms;
      });
      kb.on('keydown-F4', () => {
        this.presentation.activeOverlay =
          this.presentation.activeOverlay === OverlayType.Temperature ? OverlayType.None : OverlayType.Temperature;
      });
      kb.on('keydown-F5', (event: KeyboardEvent) => {
        event.preventDefault();
        this.presentation.activeOverlay =
          this.presentation.activeOverlay === OverlayType.Pathfinding ? OverlayType.None : OverlayType.Pathfinding;
      });

      // 存档/读档：F6 保存、F7 加载
      kb.on('keydown-F6', () => {
        this.world.commandQueue.push({ type: 'save_game', payload: {} });
      });
      kb.on('keydown-F7', () => {
        this.world.commandQueue.push({ type: 'load_game', payload: {} });
      });

      // 网格线切换：F8
      kb.on('keydown-F8', (event: KeyboardEvent) => {
        event.preventDefault();
        this.presentation.showGrid = !this.presentation.showGrid;
      });
    }
  }

  // ── 工具切换 ──

  /** 切换工具并重置子类型 */
  private switchTool(tool: ToolType): void {
    this.presentation.activeTool = tool;
    if (tool !== ToolType.Designate) {
      this.presentation.activeDesignationType = null;
    }
    if (tool !== ToolType.Build) {
      this.presentation.activeBuildDefId = null;
    }
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
      case ToolType.Cancel:
        this.handleCancel(cell);
        break;
    }
  }

  private handleSelect(cell: CellCoord): void {
    this.presentation.selectedObjectIds.clear();
    const objectIds = this.map.spatial.getAt(cell);
    for (const id of objectIds) {
      this.presentation.selectedObjectIds.add(id);
    }
  }

  private handleBuild(cell: CellCoord): void {
    if (!this.presentation.activeBuildDefId) return;
    this.world.commandQueue.push({
      type: 'place_blueprint',
      payload: { defId: this.presentation.activeBuildDefId, cell, rotation: 0 },
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
    const minX = Math.max(0, Math.min(startCell.x, endCell.x));
    const maxX = Math.min(this.map.width - 1, Math.max(startCell.x, endCell.x));
    const minY = Math.max(0, Math.min(startCell.y, endCell.y));
    const maxY = Math.min(this.map.height - 1, Math.max(startCell.y, endCell.y));

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
      case ToolType.Cancel:
        this.dragCancel(minX, minY, clampedMaxX, clampedMaxY);
        break;
    }
  }

  /** 框选：矩形内所有对象加入选中集 */
  private dragSelect(minX: number, minY: number, maxX: number, maxY: number): void {
    this.presentation.selectedObjectIds.clear();
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const objIds = this.map.spatial.getAt({ x, y });
        for (const id of objIds) {
          this.presentation.selectedObjectIds.add(id);
        }
      }
    }
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
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        this.handleCancel({ x, y });
      }
    }
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

  // ── 每帧更新 ──

  /**
   * 每帧更新 — 刷新悬停格子、放置预览和指派预览
   */
  update(): void {
    const pointer = this.scene.input.activePointer;
    this.presentation.hoveredCell = this.pointerToCell(pointer);

    // 更新放置预览
    if (this.presentation.activeTool === ToolType.Build && this.presentation.activeBuildDefId && this.presentation.hoveredCell) {
      const cell = this.presentation.hoveredCell;
      const isPassable = this.map.spatial.isPassable(cell);
      this.presentation.placementPreview = {
        defId: this.presentation.activeBuildDefId,
        cell,
        rotation: 0,
        valid: isPassable,
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
  }

  // ── 公开 API ──

  setSelectedBuilding(defId: string): void {
    this.switchTool(ToolType.Build);
    this.presentation.activeBuildDefId = defId;
  }

  setDesignationType(type: DesignationType): void {
    this.switchTool(ToolType.Designate);
    this.presentation.activeDesignationType = type;
  }
}
