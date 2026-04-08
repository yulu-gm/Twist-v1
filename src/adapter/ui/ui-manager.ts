/**
 * @file ui-manager.ts
 * @description UI 管理器，统一管理所有 HUD 元素（顶栏、工具栏、选择面板、调试面板）
 *              并处理放置/指派预览的渲染。使用双摄像机架构：UI 摄像机固定不动，
 *              主摄像机负责世界渲染。
 * @dependencies phaser — UI 渲染；world/world — 读取世界状态；world/game-map — 地图数据；
 *               core/types — ObjectKind、SimSpeed；core/clock — 时钟格式化；
 *               presentation — 工具类型、展示状态
 * @part-of adapter/ui — UI 组件模块
 */

import Phaser from 'phaser';
import { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { ObjectKind, SimSpeed } from '../../core/types';
import { getClockDisplay } from '../../core/clock';
import { PresentationState, ToolType } from '../../presentation/presentation-state';

/** UI 层渲染深度 */
const UI_DEPTH = 100;
/** 面板背景色 */
const PANEL_BG = 0x1a1a2e;
/** 面板背景透明度 */
const PANEL_ALPHA = 0.9;
/** 文本颜色 */
const TEXT_COLOR = '#e0e0e0';
/** 字体大小 */
const FONT_SIZE = '14px';

/**
 * UI 管理器类 — 管理所有固定位置的 HUD 元素
 *
 * 职责：
 * 1. 创建独立的 UI 摄像机（zoom=1，不随主摄像机缩放/平移）
 * 2. 管理顶栏（时钟/速度/tick/棋子数）
 * 3. 管理底部工具栏（快捷键提示）
 * 4. 管理选择面板（选中对象详情）
 * 5. 管理调试面板（悬停信息/对象统计）
 * 6. 渲染建筑放置预览和指派预览（世界空间）
 */
export class UIManager {
  // ── 引用 ──
  /** Phaser 场景引用 */
  private scene: Phaser.Scene;
  /** 游戏世界状态 */
  private world: World;
  /** 当前地图 */
  private map: GameMap;
  /** 展示层状态 */
  private presentation: PresentationState;
  /** 专用 UI 摄像机 — 固定 zoom=1 且不滚动 */
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;

  /** 所有 UI 游戏对象 — 主摄像机忽略这些，UI 摄像机渲染它们 */
  private uiObjects: Phaser.GameObjects.GameObject[] = [];

  // ── 顶栏元素 ──
  /** 顶栏背景 */
  private topBarBg!: Phaser.GameObjects.Rectangle;
  /** 时钟显示文本 */
  private clockText!: Phaser.GameObjects.Text;
  /** 速度显示文本 */
  private speedText!: Phaser.GameObjects.Text;
  /** tick 计数文本 */
  private tickText!: Phaser.GameObjects.Text;
  /** 棋子数量文本 */
  private pawnCountText!: Phaser.GameObjects.Text;

  // ── 底部工具栏元素 ──
  /** 工具栏背景 */
  private toolbarBg!: Phaser.GameObjects.Rectangle;
  /** 快捷键标签文本列表 */
  private toolTexts: Phaser.GameObjects.Text[] = [];

  // ── 选择面板元素 ──
  /** 选择面板背景 */
  private selectionBg!: Phaser.GameObjects.Rectangle;
  /** 选择面板信息文本 */
  private selectionText!: Phaser.GameObjects.Text;

  // ── 调试面板元素 ──
  /** 调试面板背景 */
  private debugBg!: Phaser.GameObjects.Rectangle;
  /** 调试面板信息文本 */
  private debugText!: Phaser.GameObjects.Text;

  // ── 世界空间预览（由主摄像机渲染） ──
  /** 建筑放置预览矩形 */
  private previewRect: Phaser.GameObjects.Rectangle | null = null;
  /** 指派预览矩形 */
  private designationRect: Phaser.GameObjects.Rectangle | null = null;

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

    // 创建专用 UI 摄像机 — 固定缩放和位置，透明背景
    this.uiCamera = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height);
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setZoom(1);
    this.uiCamera.setBackgroundColor('rgba(0,0,0,0)');
    this.uiCamera.transparent = true;

    this.createTopBar();
    this.createToolbar();
    this.createSelectionPanel();
    this.createDebugPanel();

    // 主摄像机：忽略所有 UI 对象（使缩放不影响 UI）
    scene.cameras.main.ignore(this.uiObjects);

    // 当显示列表变化时（新增世界对象），重新应用过滤器
    scene.events.on('update', () => this.syncWorldObjectFilters());

    // 窗口大小改变时调整 UI 摄像机视口
    scene.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.uiCamera.setViewport(0, 0, gameSize.width, gameSize.height);
    });
  }

  /** 使世界对象（非 UI）对 UI 摄像机不可见 */
  private syncWorldObjectFilters(): void {
    const uiSet = new Set(this.uiObjects);
    for (const obj of this.scene.children.list) {
      if (!uiSet.has(obj)) {
        this.uiCamera.ignore(obj);
      }
    }
  }

  /** 将游戏对象标记为 UI 元素并追踪 */
  private trackUI<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.uiObjects.push(obj);
    return obj;
  }

  /** 创建顶栏 UI 元素（时钟、速度、tick、棋子数） */
  private createTopBar(): void {
    const w = this.scene.scale.width;
    this.topBarBg = this.trackUI(
      this.scene.add.rectangle(w / 2, 15, w, 30, PANEL_BG, PANEL_ALPHA).setDepth(UI_DEPTH)
    );
    this.clockText = this.trackUI(
      this.scene.add.text(10, 5, '', { fontSize: FONT_SIZE, color: TEXT_COLOR }).setDepth(UI_DEPTH + 1)
    );
    this.speedText = this.trackUI(
      this.scene.add.text(300, 5, '', { fontSize: FONT_SIZE, color: TEXT_COLOR }).setDepth(UI_DEPTH + 1)
    );
    this.tickText = this.trackUI(
      this.scene.add.text(450, 5, '', { fontSize: FONT_SIZE, color: TEXT_COLOR }).setDepth(UI_DEPTH + 1)
    );
    this.pawnCountText = this.trackUI(
      this.scene.add.text(600, 5, '', { fontSize: FONT_SIZE, color: TEXT_COLOR }).setDepth(UI_DEPTH + 1)
    );
  }

  /** 创建底部工具栏 UI 元素（快捷键提示标签） */
  private createToolbar(): void {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    this.toolbarBg = this.trackUI(
      this.scene.add.rectangle(w / 2, h - 20, w, 40, PANEL_BG, PANEL_ALPHA).setDepth(UI_DEPTH)
    );

    const tools = [
      '[ESC] Select',
      '[B] Build Wall',
      '[M] Mine',
      '[H] Harvest',
      '[X] Cut Tree',
      '[SPACE] Pause',
      '[1-3] Speed',
      '[F1] Debug',
    ];

    tools.forEach((label, i) => {
      const text = this.trackUI(
        this.scene.add.text(10 + i * 130, h - 30, label, {
          fontSize: '12px',
          color: TEXT_COLOR,
        }).setDepth(UI_DEPTH + 1)
      );
      this.toolTexts.push(text);
    });
  }

  /** 创建选择面板 UI 元素（初始隐藏） */
  private createSelectionPanel(): void {
    const h = this.scene.scale.height;
    this.selectionBg = this.trackUI(
      this.scene.add.rectangle(140, h - 140, 260, 180, PANEL_BG, PANEL_ALPHA)
        .setDepth(UI_DEPTH).setVisible(false)
    );
    this.selectionText = this.trackUI(
      this.scene.add.text(20, h - 225, '', {
        fontSize: FONT_SIZE,
        color: TEXT_COLOR,
        wordWrap: { width: 240 },
      }).setDepth(UI_DEPTH + 1).setVisible(false)
    );
  }

  /** 创建调试面板 UI 元素（初始隐藏） */
  private createDebugPanel(): void {
    const w = this.scene.scale.width;
    this.debugBg = this.trackUI(
      this.scene.add.rectangle(w - 160, 130, 300, 230, PANEL_BG, PANEL_ALPHA)
        .setDepth(UI_DEPTH).setVisible(false)
    );
    this.debugText = this.trackUI(
      this.scene.add.text(w - 300, 25, '', {
        fontSize: '12px',
        color: TEXT_COLOR,
        lineSpacing: 4,
      }).setDepth(UI_DEPTH + 1).setVisible(false)
    );
  }

  /**
   * 每帧更新 — 重新定位所有 UI 元素并刷新内容
   *
   * 操作：
   * 1. 根据当前窗口大小重新定位顶栏、工具栏、选择面板、调试面板
   * 2. 更新顶栏文本（时钟/速度/tick/棋子数）
   * 3. 更新选择面板（选中对象详情或隐藏）
   * 4. 更新调试面板（悬停格子信息或隐藏）
   * 5. 更新建筑放置预览和指派预览（世界空间）
   */
  update(): void {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    // ── 重新定位顶栏 ──
    this.topBarBg.setPosition(w / 2, 15).setSize(w, 30);

    // ── 重新定位底部工具栏 ──
    this.toolbarBg.setPosition(w / 2, h - 20).setSize(w, 40);
    this.toolTexts.forEach((text, i) => {
      text.setPosition(10 + i * 130, h - 30);
    });

    // ── 重新定位选择面板 ──
    this.selectionBg.setPosition(140, h - 140);
    this.selectionText.setPosition(20, h - 225);

    // ── 重新定位调试面板 ──
    this.debugBg.setPosition(w - 160, 130);
    this.debugText.setPosition(w - 300, 25);

    // ── 更新顶栏内容 ──
    const speedLabels = ['Paused', '1x', '2x', '3x'];
    this.clockText.setText(getClockDisplay(this.world.clock));
    this.speedText.setText(`Speed: ${speedLabels[this.world.speed]}`);
    this.tickText.setText(`Tick: ${this.world.tick}`);

    const pawnCount = this.map.objects.allOfKind(ObjectKind.Pawn).length;
    this.pawnCountText.setText(`Pawns: ${pawnCount}`);

    // 选择面板 — 有选中对象时显示详情
    if (this.presentation.selectedObjectIds.size > 0) {
      this.selectionBg.setVisible(true);
      this.selectionText.setVisible(true);
      let info = '';
      for (const id of this.presentation.selectedObjectIds) {
        const obj = this.map.objects.get(id);
        if (!obj) continue;
        info += `[${obj.kind}] ${obj.id}\n`;
        info += `  Def: ${obj.defId}\n`;
        info += `  Cell: (${obj.cell.x}, ${obj.cell.y})\n`;
        if (obj.kind === ObjectKind.Pawn) {
          const pawn = obj as any;
          info += `  Name: ${pawn.name}\n`;
          if (pawn.ai?.currentJob) {
            info += `  Job: ${pawn.ai.currentJob.defId}\n`;
          } else {
            info += `  Job: idle\n`;
          }
          info += `  Food: ${Math.floor(pawn.needs?.food ?? 0)}\n`;
        }
      }
      this.selectionText.setText(info);
    } else {
      this.selectionBg.setVisible(false);
      this.selectionText.setVisible(false);
    }

    // 调试面板 — F1 切换显示
    if (this.presentation.showDebugPanel) {
      this.debugBg.setVisible(true);
      this.debugText.setVisible(true);
      const hovered = this.presentation.hoveredCell;
      let dbg = `--- Debug ---\n`;
      dbg += `Tool: ${this.presentation.activeTool}\n`;
      if (hovered) {
        dbg += `Hover: (${hovered.x}, ${hovered.y})\n`;
        const terrain = this.map.terrain.get(hovered.x, hovered.y);
        dbg += `Terrain: ${terrain}\n`;
        const objs = this.map.spatial.getAt(hovered);
        dbg += `Objects: ${objs.length}\n`;
        for (const id of objs) {
          const o = this.map.objects.get(id);
          if (o) dbg += `  ${o.kind}: ${o.id}\n`;
        }
        dbg += `Passable: ${this.map.spatial.isPassable(hovered)}\n`;
      }
      dbg += `Total objects: ${this.map.objects.size}\n`;
      const reservations = this.map.reservations.getAll();
      dbg += `Reservations: ${reservations.length}\n`;
      this.debugText.setText(dbg);
    } else {
      this.debugBg.setVisible(false);
      this.debugText.setVisible(false);
    }

    // 建筑放置预览（世界空间 — 由主摄像机渲染）
    if (this.presentation.placementPreview) {
      const pp = this.presentation.placementPreview;
      if (!this.previewRect) {
        this.previewRect = this.scene.add.rectangle(0, 0, 32, 32, 0x66aaff, 0.5)
          .setDepth(50).setStrokeStyle(2, pp.valid ? 0x00ff00 : 0xff0000);
      }
      this.previewRect.setPosition(pp.cell.x * 32 + 16, pp.cell.y * 32 + 16);
      this.previewRect.setStrokeStyle(2, pp.valid ? 0x00ff00 : 0xff0000);
      this.previewRect.setVisible(true);
    } else if (this.previewRect) {
      this.previewRect.setVisible(false);
    }

    // 指派预览（世界空间 — 由主摄像机渲染）
    if (this.presentation.designationPreview) {
      const dp = this.presentation.designationPreview;
      if (!this.designationRect) {
        this.designationRect = this.scene.add.rectangle(0, 0, 32, 32, 0x000000, 0.3)
          .setDepth(50);
      }
      const fillColor = dp.valid ? 0xffaa00 : 0xff0000;
      const strokeColor = dp.valid ? 0xffcc44 : 0xff4444;
      this.designationRect.setFillStyle(fillColor, 0.35);
      this.designationRect.setStrokeStyle(2, strokeColor);
      this.designationRect.setPosition(dp.cell.x * 32 + 16, dp.cell.y * 32 + 16);
      this.designationRect.setVisible(true);
    } else if (this.designationRect) {
      this.designationRect.setVisible(false);
    }
  }
}
