import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDir = path.resolve(__dirname, "..");

const skillDir = path.join(rootDir, ".agent", "skills", "route-demand");
const skillFile = path.join(skillDir, "SKILL.md");
const referenceDir = path.join(skillDir, "references");
const registryFile = path.join(referenceDir, "system-registry.md");

const requiredReferenceFiles = [
  "demand-router.md",
  "system-registry.md",
  "subagent-contract.md",
  "skill-tdd.md",
];

const requiredSystems = [
  {
    key: "selection-ui",
    standard: path.join(rootDir, "docs", "ai", "system-standards", "selection-ui.md"),
  },
  {
    key: "scene-hud",
    standard: path.join(rootDir, "docs", "ai", "system-standards", "scene-hud.md"),
  },
  {
    key: "pawn-state",
    standard: path.join(rootDir, "docs", "ai", "system-standards", "pawn-state.md"),
  },
  {
    key: "task-planning",
    standard: path.join(rootDir, "docs", "ai", "system-standards", "task-planning.md"),
  },
];

function readUtf8(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

describe("route-demand documentation workflow", () => {
  it("provides a project-local route-demand skill with required references", () => {
    expect(existsSync(skillFile)).toBe(true);

    const content = readUtf8(skillFile);

    expect(content).toContain("name: route-demand");
    expect(content).toContain("新增玩法");
    expect(content).toContain("demand-router.md");
    expect(content).toContain("system-registry.md");
    expect(content).toContain("subagent-contract.md");

    for (const fileName of requiredReferenceFiles) {
      expect(existsSync(path.join(referenceDir, fileName))).toBe(true);
    }
  });

  it("registers system standards and referenced aidoc paths", () => {
    expect(existsSync(registryFile)).toBe(true);

    const registry = readUtf8(registryFile);

    for (const system of requiredSystems) {
      expect(registry).toContain(`| ${system.key} |`);
      expect(registry).toContain(`${system.key}.md`);
      expect(registry).toContain(`docs/ai/systems/${system.key}/`);
      expect(existsSync(system.standard)).toBe(true);
    }
  });

  it("documents request and integration templates for routed demands", () => {
    const requestTemplate = path.join(rootDir, "docs", "ai", "templates", "request-template.md");
    const integrationTemplate = path.join(rootDir, "docs", "ai", "templates", "integration-template.md");
    const systemAidocTemplate = path.join(rootDir, "docs", "ai", "templates", "system-aidoc-template.md");

    expect(existsSync(requestTemplate)).toBe(true);
    expect(existsSync(integrationTemplate)).toBe(true);
    expect(existsSync(systemAidocTemplate)).toBe(true);

    expect(readUtf8(requestTemplate)).toContain("route-demand");
    expect(readUtf8(integrationTemplate)).toContain("UI-first fake");
    expect(readUtf8(systemAidocTemplate)).toContain("最先失败的测试");
  });

  it("updates project entry docs to route multi-system demands through the skill", () => {
    const agentDoc = readUtf8(path.join(rootDir, "Agent.md"));
    const claudeDoc = readUtf8(path.join(rootDir, "CLAUDE.md"));

    expect(agentDoc).toContain("route-demand");
    expect(claudeDoc).toContain("route-demand");
    expect(agentDoc).toContain(".agent/skills/route-demand/SKILL.md");
    expect(claudeDoc).toContain(".agent/skills/route-demand/SKILL.md");
  });
});
