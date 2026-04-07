import Phaser from 'phaser';
import { World } from '../world/world';
import { MainScene } from './main-scene';

export function bootstrapPhaser(world: World): Phaser.Game {
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
    scene: new MainScene(world),
    pixelArt: true,
    roundPixels: true,
  };

  return new Phaser.Game(config);
}
