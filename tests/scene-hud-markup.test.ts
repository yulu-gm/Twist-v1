/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { VILLAGER_TOOLS, type VillagerBuildSubId } from "../src/data/villager-tools";
import { createDefaultPawnStates } from "../src/game/pawn-state";
import type { WorkItemSnapshot } from "../src/game/work/work-types";
import { HudManager } from "../src/ui/hud-manager";
import { activeBuildToolState } from "../src/ui/menu-model";

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
    expect(html).toContain('id="scene-variant"');
    expect(html).toContain('id="player-channel-hint"');
    expect(html).toContain('id="player-channel-mode"');
    expect(html).toContain('id="player-channel-result"');
    expect(html).toContain('id="yaml-scenario-panel"');
    expect(html).toContain('id="yaml-scenario-select"');
    expect(html).toContain('id="yaml-scenario-desc"');
    expect(html).toContain('id="yaml-scenario-manual"');
    expect(html).toContain('id="yaml-scenario-manual-steps"');
    expect(html).toContain('id="yaml-scenario-manual-outcomes"');
    expect(html).toContain('aria-live="polite"');
  });
});

describe("层级建造菜单", () => {
  it('选中建造后展开子菜单容器，含「木墙」「木床」', () => {
    document.body.innerHTML = `<div id="villager-tool-bar"></div>`;
    const hud = new HudManager();
    const buildIdx = VILLAGER_TOOLS.findIndex((t) => t.id === "build");
    expect(buildIdx).toBeGreaterThanOrEqual(0);

    let selectedIdx = 0;
    let buildSub: VillagerBuildSubId | null = null;
    hud.setupToolBar(
      (i) => {
        selectedIdx = i;
        buildSub = null;
        hud.syncToolBarSelection(selectedIdx, buildSub);
      },
      0,
      {
        onSelectSub: (s) => {
          buildSub = s;
          hud.syncToolBarSelection(selectedIdx, buildSub);
        },
        initialSub: null
      }
    );

    const slots = Array.from(document.querySelectorAll(".tool-slot"));
    (slots[buildIdx] as HTMLButtonElement).click();

    const sub = document.querySelector(".build-tool-submenu");
    expect(sub).not.toBeNull();
    expect((sub as HTMLElement).hidden).toBe(false);
    const labels = Array.from(sub!.querySelectorAll(".build-tool-submenu-item")).map((b) => b.textContent);
    expect(labels).toContain("木墙");
    expect(labels).toContain("木床");
  });

  it('选中「木墙」后 activeBuildToolState 为 brush-stroke + build_wall_blueprint', () => {
    document.body.innerHTML = `<div id="villager-tool-bar"></div>`;
    const hud = new HudManager();
    const buildIdx = VILLAGER_TOOLS.findIndex((t) => t.id === "build");
    let selectedIdx = 0;
    let buildSub: VillagerBuildSubId | null = null;
    hud.setupToolBar(
      (i) => {
        selectedIdx = i;
        buildSub = null;
        hud.syncToolBarSelection(selectedIdx, buildSub);
      },
      0,
      {
        onSelectSub: (s) => {
          buildSub = s;
          hud.syncToolBarSelection(selectedIdx, buildSub);
        },
        initialSub: null
      }
    );
    const slots = Array.from(document.querySelectorAll(".tool-slot"));
    (slots[buildIdx] as HTMLButtonElement).click();
    const wallBtn = document.querySelector('[data-build-sub-id="wall"]');
    expect(wallBtn).not.toBeNull();
    (wallBtn as HTMLButtonElement).click();

    const activeToolState = activeBuildToolState(buildSub);
    expect(activeToolState?.inputShape).toBe("brush-stroke");
    expect(activeToolState?.verb).toBe("build_wall_blueprint");
  });

  it('选中「木床」后 activeBuildToolState 为 single-cell + place_furniture:bed', () => {
    document.body.innerHTML = `<div id="villager-tool-bar"></div>`;
    const hud = new HudManager();
    const buildIdx = VILLAGER_TOOLS.findIndex((t) => t.id === "build");
    let selectedIdx = 0;
    let buildSub: VillagerBuildSubId | null = null;
    hud.setupToolBar(
      (i) => {
        selectedIdx = i;
        buildSub = null;
        hud.syncToolBarSelection(selectedIdx, buildSub);
      },
      0,
      {
        onSelectSub: (s) => {
          buildSub = s;
          hud.syncToolBarSelection(selectedIdx, buildSub);
        },
        initialSub: null
      }
    );
    const slots = Array.from(document.querySelectorAll(".tool-slot"));
    (slots[buildIdx] as HTMLButtonElement).click();
    const bedBtn = document.querySelector('[data-build-sub-id="bed"]');
    expect(bedBtn).not.toBeNull();
    (bedBtn as HTMLButtonElement).click();

    const activeToolState = activeBuildToolState(buildSub);
    expect(activeToolState?.inputShape).toBe("single-cell");
    expect(activeToolState?.verb).toBe("place_furniture:bed");
  });
});

describe("行为标签同步", () => {
  function samplePawn() {
    return createDefaultPawnStates([{ col: 0, row: 0 }], ["标记测试"])[0]!;
  }

  function workSnapshot(partial: Pick<WorkItemSnapshot, "id" | "kind"> & Partial<WorkItemSnapshot>): WorkItemSnapshot {
    return {
      anchorCell: { col: 0, row: 0 },
      status: "claimed",
      failureCount: 0,
      ...partial
    };
  }

  it("activeWorkItemId 为 chop-tree 工单时显示 伐木中", () => {
    document.body.innerHTML = `<aside id="pawn-detail-panel"></aside>`;
    const hud = new HudManager();
    const pawn = { ...samplePawn(), activeWorkItemId: "w-chop" };
    const workItems = new Map<string, WorkItemSnapshot>([
      ["w-chop", workSnapshot({ id: "w-chop", kind: "chop-tree" })]
    ]);
    hud.syncPawnDetail(pawn, workItems);
    const el = document.querySelector(".pawn-detail-behavior");
    expect(el?.textContent).toContain("伐木中");
  });

  it("activeWorkItemId 为 haul-to-zone 工单时显示 搬运物资", () => {
    document.body.innerHTML = `<aside id="pawn-detail-panel"></aside>`;
    const hud = new HudManager();
    const pawn = { ...samplePawn(), activeWorkItemId: "w-haul" };
    const workItems = new Map<string, WorkItemSnapshot>([
      ["w-haul", workSnapshot({ id: "w-haul", kind: "haul-to-zone" })]
    ]);
    hud.syncPawnDetail(pawn, workItems);
    const el = document.querySelector(".pawn-detail-behavior");
    expect(el?.textContent).toContain("搬运物资");
  });

  it("无工单且 currentGoal 为 eat 时显示 进食中", () => {
    document.body.innerHTML = `<aside id="pawn-detail-panel"></aside>`;
    const hud = new HudManager();
    const pawn = {
      ...samplePawn(),
      activeWorkItemId: undefined,
      currentGoal: { kind: "eat" as const, reason: "test" }
    };
    hud.syncPawnDetail(pawn, new Map());
    const el = document.querySelector(".pawn-detail-behavior");
    expect(el?.textContent).toContain("进食中");
  });

  it("无工单且 currentGoal 为 wander 时显示 空闲", () => {
    document.body.innerHTML = `<aside id="pawn-detail-panel"></aside>`;
    const hud = new HudManager();
    const pawn = {
      ...samplePawn(),
      activeWorkItemId: undefined,
      currentGoal: { kind: "wander" as const, reason: "test" }
    };
    hud.syncPawnDetail(pawn, undefined);
    const el = document.querySelector(".pawn-detail-behavior");
    expect(el?.textContent).toContain("空闲");
  });
});
