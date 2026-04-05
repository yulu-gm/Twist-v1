import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const rootDir = path.resolve(__dirname, "..");

describe("scene-hud markup", () => {
  it("provides a scene time slot in the menu bar markup", () => {
    const html = readFileSync(path.join(rootDir, "index.html"), "utf8");

    expect(html).toContain('id="scene-time"');
    expect(html).toContain('id="scene-time-value"');
    expect(html).toContain('id="scene-time-toggle"');
    expect(html).toContain('id="scene-speed-controls"');
    expect(html).toContain('id="scene-speed-1"');
    expect(html).toContain('id="scene-speed-2"');
    expect(html).toContain('id="scene-speed-3"');
    expect(html).toContain('aria-live="polite"');
  });
});
