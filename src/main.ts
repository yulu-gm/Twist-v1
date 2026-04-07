import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { getRuntimeLogSession } from "./runtime-log/runtime-log-session";

const PHASER_PARENT_ID = "app";

function showDevBootstrapOverlay(title: string, body: string): void {
  const root = document.createElement("div");
  root.setAttribute("role", "alert");
  root.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;background:rgba(23,20,17,0.96);color:#f5f1e8;font:14px/1.5 system-ui,sans-serif;";
  const panel = document.createElement("div");
  panel.style.cssText =
    "max-width:560px;border:1px solid #c94c4c;border-radius:10px;padding:16px 20px;background:#241818;white-space:pre-wrap;word-break:break-word;";
  const h = document.createElement("strong");
  h.textContent = title;
  panel.appendChild(h);
  const p = document.createElement("p");
  p.style.margin = "10px 0 0";
  p.textContent = body;
  panel.appendChild(p);
  root.appendChild(panel);
  document.body.appendChild(root);
}

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

const phaserParent = document.getElementById(PHASER_PARENT_ID);
if (!phaserParent) {
  const summary = `Phaser parent #${PHASER_PARENT_ID} not found.`;
  const hint =
    'Check index.html: there must be a <div id="app"></div> (or matching id) before the main script.';
  console.error("[Twist bootstrap]", summary, hint);
  if (import.meta.env.DEV) {
    showDevBootstrapOverlay(summary, hint);
  }
  throw new Error(summary);
}

let game: Phaser.Game;
try {
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: PHASER_PARENT_ID,
    width: 1280,
    height: 720,
    backgroundColor: "#171411",
    scene: [GameScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  });
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[Twist bootstrap] Phaser.Game initialization failed.", err);
  if (import.meta.env.DEV) {
    showDevBootstrapOverlay(
      "Phaser.Game failed to start.",
      `${message}\n\nCheck the browser console and verify the HTML shell / Phaser parent.`
    );
  }
  throw err;
}

export default game;
