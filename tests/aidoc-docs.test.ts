import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  analyzeChangedFiles,
  buildManagedCommitMessage,
  parseManagedCommitMessage,
  readSystemIndex
} from "../tools/aidoc/index.mjs";

const rootDir = path.resolve(__dirname, "..");
const indexDir = path.join(rootDir, "docs", "ai", "index");
const indexReadme = path.join(indexDir, "README.md");
const systemIndexFile = path.join(indexDir, "system-index.json");
const registryFile = path.join(
  rootDir,
  ".agent",
  "skills",
  "route-demand",
  "references",
  "system-registry.md"
);

const pushSkillDir = path.join(rootDir, ".agent", "skills", "push-with-aidoc");
const pushSkillFile = path.join(pushSkillDir, "SKILL.md");

function readUtf8(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function registrySystemKeys(): string[] {
  return readUtf8(registryFile)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\|\s*[a-z0-9-]+\s*\|/.test(line))
    .map((line) => line.split("|")[1]!.trim())
    .filter((value) => value !== "system" && value !== "---");
}

describe("aidoc index and push workflow", () => {
  it("provides aidoc index entrypoints and structured system metadata", () => {
    expect(existsSync(indexReadme)).toBe(true);
    expect(existsSync(systemIndexFile)).toBe(true);

    const readme = readUtf8(indexReadme);
    expect(readme).toContain("aidoc");
    expect(readme).toContain("system-index.json");
    expect(readme).toContain("关键源码文件");

    const systemIndex = readSystemIndex(rootDir);
    expect(systemIndex.systems.length).toBeGreaterThanOrEqual(6);
    expect(systemIndex.systems.some((system: { key: string }) => system.key === "time-of-day")).toBe(
      true
    );

    for (const system of systemIndex.systems) {
      expect(system.key.length).toBeGreaterThan(0);
      expect(existsSync(path.join(rootDir, system.standardDoc))).toBe(true);
      expect(existsSync(path.join(rootDir, system.aidocDir))).toBe(true);
      expect(existsSync(path.join(rootDir, system.systemReadme))).toBe(true);

      for (const sourceFile of system.sourceFiles) {
        expect(existsSync(path.join(rootDir, sourceFile))).toBe(true);
      }
      for (const testFile of system.testFiles) {
        expect(existsSync(path.join(rootDir, testFile))).toBe(true);
      }
      for (const sceneFile of system.sceneEntryFiles) {
        expect(existsSync(path.join(rootDir, sceneFile))).toBe(true);
      }
      for (const integrationFile of system.integrationFiles) {
        expect(existsSync(path.join(rootDir, integrationFile))).toBe(true);
      }
      for (const aidocFile of system.latestAidocs) {
        expect(existsSync(path.join(rootDir, aidocFile))).toBe(true);
      }
    }
  });

  it("keeps the system index aligned with the route-demand registry", () => {
    const registryKeys = registrySystemKeys();
    const indexKeys = readSystemIndex(rootDir).systems.map(
      (system: { key: string }) => system.key
    );

    expect(indexKeys.sort()).toEqual(registryKeys.sort());
  });

  it("upgrades each system readme into a system-specific lookup page", () => {
    const systemIndex = readSystemIndex(rootDir);

    for (const system of systemIndex.systems) {
      const readme = readUtf8(path.join(rootDir, system.systemReadme));
      expect(readme).toContain("系统职责摘要");
      expect(readme).toContain("标准文档");
      expect(readme).toContain("当前关键实现文件");
      expect(readme).toContain("当前关键测试文件");
      expect(readme).toContain("当前接入场景文件");
      expect(readme).toContain("最新/历史 aidoc");
      expect(readme).toContain("何时必须回填");
    }
  });

  it("provides a project-local push-with-aidoc skill and documents the workflow entrypoints", () => {
    expect(existsSync(pushSkillFile)).toBe(true);

    const skill = readUtf8(pushSkillFile);
    expect(skill).toContain("name: push-with-aidoc");
    expect(skill).toContain("docs/ai/index/system-index.json");
    expect(skill).toContain("[aidoc-sync]");
    expect(skill).toContain("AIDOC-Managed: true");

    const entryDocs = [
      path.join(rootDir, "TWIST.md"),
      path.join(rootDir, ".agent", "task-workflow.md"),
      path.join(rootDir, ".agent", "doc-rules.md"),
      path.join(rootDir, "docs", "human", "contributing.md")
    ];

    for (const file of entryDocs) {
      const content = readUtf8(file);
      expect(content).toContain("push-with-aidoc");
    }
  });

  it("maps changed files to impacted systems and related document follow-ups", () => {
    const result = analyzeChangedFiles(rootDir, [
      "src/game/world-grid.ts",
      "src/scenes/GameScene.ts"
    ]);

    expect(result.impactedSystems).toEqual([
      "pawn-state",
      "scene-hud",
      "selection-ui",
      "task-planning",
      "time-of-day",
      "world-grid"
    ]);
    expect(result.docPathsToReview).toContain("docs/ai/systems/world-grid/README.md");
    expect(result.docPathsToReview).toContain("docs/ai/systems/pawn-state/README.md");
    expect(result.docPathsToReview).toContain("docs/ai/systems/time-of-day/README.md");
    expect(result.docPathsToReview).toContain("docs/ai/integration/2026-04-05-default-grid-wandering-pawns.md");
    expect(result.requiresSystemAidocReview).toBe(true);
  });

  it("does not require system aidoc updates for docs-only human-facing changes", () => {
    const result = analyzeChangedFiles(rootDir, ["docs/human/contributing.md"]);

    expect(result.impactedSystems).toEqual([]);
    expect(result.requiresSystemAidocReview).toBe(false);
    expect(result.docPathsToReview).toEqual([]);
  });

  it("builds and parses the managed commit format used by push-with-aidoc", () => {
    const message = buildManagedCommitMessage({
      summary: "sync world-grid and pawn-state aidoc",
      systems: ["pawn-state", "world-grid"],
      updatedDocs: [
        "docs/ai/index/README.md",
        "docs/ai/systems/world-grid/README.md"
      ]
    });

    expect(message).toContain("[aidoc-sync] sync world-grid and pawn-state aidoc");
    expect(message).toContain("AIDOC-Managed: true");
    expect(message).toContain("AIDOC-Systems: pawn-state,world-grid");
    expect(message).toContain("AIDOC-Index: docs/ai/index/system-index.json");
    expect(message).toContain(
      "AIDOC-Updated: docs/ai/index/README.md,docs/ai/systems/world-grid/README.md"
    );
    expect(message).toContain("AIDOC-Source: push-with-aidoc");

    expect(parseManagedCommitMessage(message)).toEqual({
      summary: "sync world-grid and pawn-state aidoc",
      systems: ["pawn-state", "world-grid"],
      updatedDocs: [
        "docs/ai/index/README.md",
        "docs/ai/systems/world-grid/README.md"
      ],
      managed: true,
      source: "push-with-aidoc"
    });
  });
});
