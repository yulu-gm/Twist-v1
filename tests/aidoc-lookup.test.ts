import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  lookupChangedFiles,
  lookupModule,
  lookupRoutedSystem
} from "../tools/aidoc/index.mjs";

const rootDir = path.resolve(__dirname, "..");
const lookupCli = path.join(rootDir, "tools", "aidoc", "query-module-lookup.mjs");

function readUtf8(relativePath: string): string {
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

function runLookupCli(args: string[]): unknown {
  const output = execFileSync("node", [lookupCli, ...args], {
    cwd: rootDir,
    encoding: "utf8"
  });

  return JSON.parse(output);
}

describe("aidoc module lookup bridge", () => {
  it("looks up a module by alias and returns implementation and routed-system docs", () => {
    const result = lookupModule(rootDir, "grid");

    expect(result.system.key).toBe("world-grid");
    expect(result.implementationEntryFiles).toContain("src/game/map/world-grid.ts");
    expect(result.keyTestFiles).toContain("tests/domain/world-grid.test.ts");
    expect(result.sceneEntryFiles).toContain("src/scenes/GameScene.ts");
    expect(result.routedSystems).toEqual(["地图系统", "交互系统"]);
    expect(result.routedDocuments).toEqual([
      {
        routedSystem: "地图系统",
        ohGenDoc: "oh-gen-doc/地图系统.yaml",
        ohCodeDesign: "oh-code-design/地图系统.yaml",
        ohAcceptance: "oh-acceptance/地图系统.yaml"
      },
      {
        routedSystem: "交互系统",
        ohGenDoc: "oh-gen-doc/交互系统.yaml",
        ohCodeDesign: "oh-code-design/交互系统.yaml",
        ohAcceptance: "oh-acceptance/交互系统.yaml"
      }
    ]);
  });

  it("looks up a routed system and returns the oh-* document mapping", () => {
    const result = lookupRoutedSystem(rootDir, "地图系统");

    expect(result).toEqual({
      routedSystem: "地图系统",
      ohGenDoc: "oh-gen-doc/地图系统.yaml",
      ohCodeDesign: "oh-code-design/地图系统.yaml",
      ohAcceptance: "oh-acceptance/地图系统.yaml",
      codeDirectories: ["src/game/map/", "src/scenes/renderers/"]
    });
  });

  it("enriches changed-file analysis with module lookup details", () => {
    const result = lookupChangedFiles(rootDir, [
      "src/game/map/world-grid.ts",
      "src/scenes/GameScene.ts"
    ]);

    expect(result.impactedSystems).toEqual([
      "pawn-state",
      "scene-hud",
      "selection-ui",
      "task-planning",
      "time-of-day",
      "world-core",
      "world-grid"
    ]);
    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          systemKey: "world-grid",
          implementationEntryFiles: expect.arrayContaining([
            "src/game/map/world-grid.ts"
          ]),
          routedSystems: ["地图系统", "交互系统"]
        })
      ])
    );
  });

  it("exposes the lookup bridge through a JSON CLI", () => {
    const result = runLookupCli(["module", "world-grid"]) as {
      queryType: string;
      result: {
        system: { key: string };
        routedSystems: string[];
      };
    };

    expect(result.queryType).toBe("module");
    expect(result.result.system.key).toBe("world-grid");
    expect(result.result.routedSystems).toEqual(["地图系统", "交互系统"]);
  });

  it("requires the lookup skill to consult the aidoc index before source code", () => {
    const skill = readUtf8(".agent/skills/lookup-module-with-aidoc/SKILL.md");
    expect(skill).toContain("先查 aidoc 索引");
    expect(skill).toContain("只有索引不足时才读源码");
    expect(skill).toContain("不替代 route-demand");

    const cursorObeyRule = readUtf8(".cursor/skills/obey-rule/SKILL.md");
    expect(cursorObeyRule).toContain("lookup-module-with-aidoc");
    expect(cursorObeyRule).toContain("模块定位/模块阅读/归属判断/找入口文件");
  });
});
