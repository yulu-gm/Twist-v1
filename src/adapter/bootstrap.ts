/**
 * @file bootstrap.ts
 * @description Phaser 游戏引擎的启动入口，创建并返回 Phaser.Game 实例
 * @dependencies phaser — 渲染引擎；world/world — 游戏世界状态；main-scene — 主场景
 * @part-of adapter — 适配器层，连接游戏逻辑与 Phaser 渲染
 */

import Phaser from 'phaser';
import { World } from '../world/world';
import { MainScene } from './main-scene';
import type { EngineSnapshotBridge } from '../ui/kernel/ui-bridge';
import type { UiPorts } from '../ui/kernel/ui-ports';

/**
 * 创建并启动 Phaser 游戏实例
 *
 * @param world - 已初始化的游戏世界对象
 * @param uiBridge - Preact UI 快照桥接（可选）
 * @param uiPorts - Preact UI 端口（可选）
 * @returns 创建好的 Phaser.Game 实例
 *
 * 配置项：
 * - 自动选择渲染器（WebGL 或 Canvas）
 * - 窗口大小自适应缩放
 * - 像素风格渲染（pixelArt + roundPixels）
 * - 使用 MainScene 作为唯一场景
 */
export function bootstrapPhaser(
  world: World,
  uiBridge?: EngineSnapshotBridge,
  uiPorts?: UiPorts,
): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1a1a2e',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: new MainScene(world, uiBridge),
    pixelArt: true,
    roundPixels: true,
  };

  return new Phaser.Game(config);
}
