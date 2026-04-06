import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { getRuntimeLogSession } from "./runtime-log/runtime-log-session";

const runtimeLogSession = getRuntimeLogSession();

runtimeLogSession.log({
  category: "Runtime.Session",
  verbosity: "Display",
  message: "runtime session started",
  detail: {
    source: "main.ts"
  },
  searchTextParts: ["main.ts", "startup"]
});

for (const eventName of ["beforeunload", "pagehide"] as const) {
  window.addEventListener(eventName, () => {
    void runtimeLogSession.flush();
  });
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 1280,
  height: 720,
  backgroundColor: "#171411",
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});

export default game;
