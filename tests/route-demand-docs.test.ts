import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDir = path.resolve(__dirname, "..");

const skillDir = path.join(rootDir, ".agent", "skills", "route-demand");
const skillFile = path.join(skillDir, "SKILL.md");
const referenceDir = path.join(skillDir, "references");
const demandRouterFile = path.join(referenceDir, "demand-router.md");
const registryFile = path.join(referenceDir, "system-registry.md");
const planningReadmeFile = path.join(rootDir, "working-plan", "route-demand", "README.md");

const requiredReferenceFiles = [
  "demand-router.md",
  "system-registry.md",
  "subagent-contract.md",
  "skill-tdd.md",
];

const routedSystems = [
  "UI系统",
  "交互系统",
  "地图系统",
  "实体系统",
  "工作系统",
  "建筑系统",
  "时间系统",
  "行为系统",
  "需求系统",
];

const legacySystems = [
  "time-of-day",
  "world-core",
  "world-grid",
  "selection-ui",
  "scene-hud",
  "pawn-state",
  "task-planning",
];

function readUtf8(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

const requiredOrder = "oh-gen-doc -> oh-code-design -> oh-acceptance";

describe("route-demand oh-doc workflow", () => {
  it("provides a project-local route-demand skill with the new oh-doc workflow references", () => {
    expect(existsSync(skillFile)).toBe(true);

    const content = readUtf8(skillFile);

    expect(content).toContain("name: route-demand");
    expect(content).toContain("oh-gen-doc");
    expect(content).toContain("oh-code-design");
    expect(content).toContain("oh-acceptance");
    expect(content).toContain(requiredOrder);
    expect(content).toContain("working-plan/route-demand/");
    expect(content).not.toContain("docs/ai/system-standards");

    for (const systemName of routedSystems) {
      expect(content).toContain(systemName);
    }

    for (const legacySystem of legacySystems) {
      expect(content).not.toContain(`| ${legacySystem} |`);
    }

    for (const fileName of requiredReferenceFiles) {
      expect(existsSync(path.join(referenceDir, fileName))).toBe(true);
    }
  });

  it("registers all nine top-level systems against oh-gen-doc, oh-code-design, and oh-acceptance", () => {
    expect(existsSync(registryFile)).toBe(true);

    const registry = readUtf8(registryFile);

    expect(registry).toContain("| system | oh-gen-doc | oh-code-design | oh-acceptance |");

    for (const systemName of routedSystems) {
      expect(registry).toContain(`| ${systemName} |`);
      expect(registry).toContain(`oh-gen-doc/${systemName}.yaml`);
      expect(registry).toContain(`oh-code-design/${systemName}.yaml`);
      expect(registry).toContain(`oh-acceptance/${systemName}.yaml`);
      expect(existsSync(path.join(rootDir, "oh-gen-doc", `${systemName}.yaml`))).toBe(true);
      expect(existsSync(path.join(rootDir, "oh-code-design", `${systemName}.yaml`))).toBe(true);
      expect(existsSync(path.join(rootDir, "oh-acceptance", `${systemName}.yaml`))).toBe(true);
    }

    for (const legacySystem of legacySystems) {
      expect(registry).not.toContain(`| ${legacySystem} |`);
    }
  });

  it("documents routing examples that keep wall-blueprint flow in the new subsystem split", () => {
    const demandRouter = readUtf8(demandRouterFile);

    expect(demandRouter).toContain("墙体蓝图绘制");
    expect(demandRouter).toContain("交互系统");
    expect(demandRouter).toContain("地图系统");
    expect(demandRouter).toContain("建筑系统");
    expect(demandRouter).toContain("工作系统");
    expect(demandRouter).toContain("实体系统");
    expect(demandRouter).toContain("UI系统");
  });

  it("documents routing examples that keep night-rest recovery in the new subsystem split", () => {
    const demandRouter = readUtf8(demandRouterFile);

    expect(demandRouter).toContain("夜晚休息与精力恢复");
    expect(demandRouter).toContain("时间系统");
    expect(demandRouter).toContain("行为系统");
    expect(demandRouter).toContain("需求系统");
    expect(demandRouter).toContain("实体系统");
    expect(demandRouter).toContain("UI系统");
  });

  it("updates project workflow docs to route multi-system work through the oh-doc chain", () => {
    const agentDoc = readUtf8(path.join(rootDir, "Agent.md"));
    const claudeDoc = readUtf8(path.join(rootDir, "CLAUDE.md"));
    const taskWorkflowDoc = readUtf8(path.join(rootDir, ".agent", "task-workflow.md"));
    const docRulesDoc = readUtf8(path.join(rootDir, ".agent", "doc-rules.md"));
    const registryDoc = readUtf8(registryFile);
    const tddDoc = readUtf8(path.join(referenceDir, "skill-tdd.md"));

    for (const content of [taskWorkflowDoc, registryDoc, tddDoc]) {
      expect(content).toContain("route-demand");
      expect(content).toContain(requiredOrder);
    }

    for (const content of [agentDoc, claudeDoc, docRulesDoc]) {
      expect(content).toContain("route-demand");
      expect(content).toContain("oh-gen-doc");
      expect(content).toContain("oh-code-design");
      expect(content).toContain("oh-acceptance");
    }
  });

  it("documents lookup-module-with-aidoc as the preferred module lookup entrypoint", () => {
    const agentDoc = readUtf8(path.join(rootDir, "Agent.md"));
    const claudeDoc = readUtf8(path.join(rootDir, "CLAUDE.md"));
    const taskWorkflowDoc = readUtf8(path.join(rootDir, ".agent", "task-workflow.md"));
    const contributingDoc = readUtf8(path.join(rootDir, "docs", "human", "contributing.md"));
    const requestsReadme = readUtf8(path.join(rootDir, "docs", "ai", "requests", "README.md"));

    for (const content of [taskWorkflowDoc, contributingDoc]) {
      expect(content).toContain("lookup-module-with-aidoc");
      expect(content).toContain("模块定位");
      expect(content).toContain("模块阅读");
    }

    for (const content of [agentDoc, claudeDoc]) {
      expect(content).toContain("lookup-module-with-aidoc");
    }

    expect(taskWorkflowDoc).toContain("route-demand");
    expect(taskWorkflowDoc).toContain("push-with-aidoc");
    expect(requestsReadme).toContain("working-plan/route-demand/<yyyy-mm-dd>-<topic>.md");
    expect(requestsReadme).toContain("历史参考");
  });

  it("marks docs/ai index as legacy for route-demand instead of the source of truth", () => {
    const systemIndex = readUtf8(path.join(rootDir, "docs", "ai", "index", "system-index.json"));

    expect(systemIndex).toContain("\"routeDemandRole\": \"legacy-reference-only\"");
    expect(systemIndex).toContain("\"routeDemandSourceOfTruth\": false");
  });

  it("documents the required planning entrypoint for route-demand outputs", () => {
    expect(existsSync(planningReadmeFile)).toBe(true);

    const planningReadme = readUtf8(planningReadmeFile);

    expect(planningReadme).toContain("route-demand 主控路由单");
    expect(planningReadme).toContain("working-plan/route-demand/<yyyy-mm-dd>-<topic>.md");
    expect(planningReadme).toContain("影响系统矩阵");
    expect(planningReadme).toContain("文档更新顺序");
    expect(planningReadme).toContain("进入实现前检查项");
  });
});
