/**
 * @file input-handler.ts
 * @description 输入处理器，处理鼠标点击、键盘快捷键，以及放置/指派预览更新
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

/** 地图格子像素大小 */
const TILE_SIZE = 32;

/**
 * 输入处理器类
 *
 * 职责：
 * 1. 监听鼠标点击 — 根据当前工具模式执行选择/建造/指派
 * 2. 监听键盘快捷键 — 切换工具、速度控制、覆盖层切换、存档/读档
 * 3. 每帧更新悬停格子、放置预览和指派预览
 */
export class InputHandler {
  // ── 引用 ──
  /** Phaser 场景引用 */
  private scene: Phaser.Scene;
  /** 游戏世界（用于推送命令） */
  private world: World;
  /** 当前地图 */
  private map: GameMap;
  /** 展示层状态（工具模式、预览等） */
  private presentation: PresentationState;

  // ── 工具状态 ──
  /** 当前选中的建筑定义 ID */
  private selectedBuildingDefId: string | null = null;
  /** 当前指派类型（采矿/收获/砍伐） */
  private designationType: DesignationType = DesignationType.Mine;

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

  /** 注册所有输入事件监听器（鼠标点击 + 键盘快捷键） */
  private setupInputs(): void {
    // 左键点击处理
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;

      const cell = this.pointerToCell(pointer);
      if (!cell) return;

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
      }
    });

    // 键盘快捷键
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
        this.presentation.activeTool = ToolType.Select;
        this.presentation.placementPreview = null;
        this.presentation.selectedObjectIds.clear();
        this.selectedBuildingDefId = null;
      });
      kb.on('keydown-B', () => {
        this.presentation.activeTool = ToolType.Build;
        this.selectedBuildingDefId = 'wall_wood';
        this.presentation.selectedObjectIds.clear();
      });
      kb.on('keydown-M', () => {
        this.presentation.activeTool = ToolType.Designate;
        this.designationType = DesignationType.Mine;
        this.presentation.selectedObjectIds.clear();
      });
      kb.on('keydown-H', () => {
        this.presentation.activeTool = ToolType.Designate;
        this.designationType = DesignationType.Harvest;
        this.presentation.selectedObjectIds.clear();
      });
      kb.on('keydown-X', () => {
        this.presentation.activeTool = ToolType.Designate;
        this.designationType = DesignationType.Cut;
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
        event.preventDefault(); // prevent browser refresh
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
    }
  }

  /**
   * 将屏幕指针坐标转换为地图格子坐标
   *
   * @param pointer - Phaser 指针对象
   * @returns 格子坐标，超出地图范围时返回 null
   */
  private pointerToCell(pointer: Phaser.Input.Pointer): CellCoord | null {
    const cam = this.scene.cameras.main;
    const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
    const x = Math.floor(worldPoint.x / TILE_SIZE);
    const y = Math.floor(worldPoint.y / TILE_SIZE);

    if (x < 0 || x >= this.map.width || y < 0 || y >= this.map.height) return null;
    return { x, y };
  }

  /**
   * 处理选择操作 — 清除旧选择，选中目标格子上的所有对象
   *
   * @param cell - 点击的格子坐标
   */
  private handleSelect(cell: CellCoord): void {
    this.presentation.selectedObjectIds.clear();
    const objectIds = this.map.spatial.getAt(cell);
    for (const id of objectIds) {
      this.presentation.selectedObjectIds.add(id);
    }
  }

  /**
   * 处理建造操作 — 在目标格子放置建筑蓝图
   *
   * @param cell - 点击的格子坐标
   */
  private handleBuild(cell: CellCoord): void {
    if (!this.selectedBuildingDefId) return;
    this.world.commandQueue.push({
      type: 'place_blueprint',
      payload: { defId: this.selectedBuildingDefId, cell, rotation: 0 },
    });
  }

  /**
   * 处理指派操作 — 根据指派类型对格子上的对象发出相应命令
   *
   * @param cell - 点击的格子坐标
   */
  private handleDesignate(cell: CellCoord): void {
    switch (this.designationType) {
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

  /**
   * 每帧更新 — 刷新悬停格子、放置预览和指派预览
   *
   * 操作：
   * 1. 将鼠标位置转换为格子坐标并记录到展示状态
   * 2. 如果当前为建造模式，更新放置预览（含通行性验证）
   * 3. 如果当前为指派模式，更新指派预览（含有效性验证）
   */
  update(): void {
    // 更新悬停格子
    const pointer = this.scene.input.activePointer;
    this.presentation.hoveredCell = this.pointerToCell(pointer);

    // 更新放置预览
    if (this.presentation.activeTool === ToolType.Build && this.selectedBuildingDefId && this.presentation.hoveredCell) {
      const cell = this.presentation.hoveredCell;
      const isPassable = this.map.spatial.isPassable(cell);
      this.presentation.placementPreview = {
        defId: this.selectedBuildingDefId,
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

      switch (this.designationType) {
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
        designationType: this.designationType,
        valid,
      };
    } else {
      this.presentation.designationPreview = null;
    }
  }

  /**
   * 设置当前选中的建筑定义并切换到建造工具
   *
   * @param defId - 建筑定义 ID
   */
  setSelectedBuilding(defId: string): void {
    this.selectedBuildingDefId = defId;
    this.presentation.activeTool = ToolType.Build;
  }

  /**
   * 设置当前指派类型并切换到指派工具
   *
   * @param type - 指派类型（采矿/收获/砍伐）
   */
  setDesignationType(type: DesignationType): void {
    this.designationType = type;
    this.presentation.activeTool = ToolType.Designate;
  }
}
