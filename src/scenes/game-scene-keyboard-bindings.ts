import Phaser from "phaser";
import type { TimeSpeed } from "../game/time";
import type { HudManager } from "../ui/hud-manager";
import { commandIdForHotkeyIndex, type CommandMenuCommandId } from "../data/command-menu";
import { VILLAGER_TOOL_KEY_CODES } from "../data/villager-tools";

export class GameSceneKeyboardBindings {
  private toolKeyObjects: Phaser.Input.Keyboard.Key[] = [];
  private timeControlKeyObjects: Phaser.Input.Keyboard.Key[] = [];
  private escKeyObject: Phaser.Input.Keyboard.Key | null = null;
  private timeControlAbort: AbortController | null = null;

  public setupTimeControls(
    scene: Phaser.Scene,
    hud: HudManager,
    onTogglePause: () => void,
    onSetSpeed: (s: TimeSpeed) => void,
    onPause: () => void
  ): void {
    this.teardownTimeControls(hud);
    this.timeControlAbort = hud.setupTimeControls({
      onTogglePause,
      onSetSpeed
    });

    if (scene.input.keyboard) {
      const bindings: ReadonlyArray<readonly [number, () => void]> = [
        [Phaser.Input.Keyboard.KeyCodes.SPACE, onTogglePause],
        [Phaser.Input.Keyboard.KeyCodes.BACKTICK, onPause],
        [Phaser.Input.Keyboard.KeyCodes.ONE, () => onSetSpeed(1)],
        [Phaser.Input.Keyboard.KeyCodes.TWO, () => onSetSpeed(2)],
        [Phaser.Input.Keyboard.KeyCodes.THREE, () => onSetSpeed(3)]
      ];
      for (const [code, handler] of bindings) {
        const key = scene.input.keyboard.addKey(code);
        key.on("down", handler);
        this.timeControlKeyObjects.push(key);
      }
    }
  }

  public teardownTimeControls(_hud: HudManager): void {
    this.timeControlAbort?.abort();
    this.timeControlAbort = null;
    for (const key of this.timeControlKeyObjects) key.destroy();
    this.timeControlKeyObjects = [];
  }

  public setupCommandMenuHotkeys(
    scene: Phaser.Scene,
    onSelectCommand: (commandId: CommandMenuCommandId) => void
  ): void {
    if (!scene.input.keyboard) return;
    for (let i = 0; i < VILLAGER_TOOL_KEY_CODES.length; i++) {
      const code = VILLAGER_TOOL_KEY_CODES[i]!;
      const key = scene.input.keyboard.addKey(code);
      key.on("down", () => {
        const id = commandIdForHotkeyIndex(i);
        if (id) onSelectCommand(id);
      });
      this.toolKeyObjects.push(key);
    }
  }

  public teardownCommandMenuHotkeys(): void {
    for (const k of this.toolKeyObjects) k.destroy();
    this.toolKeyObjects = [];
  }

  public setupEsc(scene: Phaser.Scene, onEsc: () => void): void {
    if (!scene.input.keyboard) return;
    this.teardownEsc();
    const key = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    key.on("down", onEsc);
    this.escKeyObject = key;
  }

  public teardownEsc(): void {
    this.escKeyObject?.destroy();
    this.escKeyObject = null;
  }

  public teardownAll(hud: HudManager): void {
    this.teardownTimeControls(hud);
    this.teardownCommandMenuHotkeys();
    this.teardownEsc();
  }
}
