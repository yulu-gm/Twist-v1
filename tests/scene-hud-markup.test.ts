/**
 * @vitest-environment happy-dom
 *
 * 本文件为 HUD 结构与绑定点、建造子菜单 DOM、以及 `HudManager` 直驱面板的局部回归。
 * 不承担 UI-001~UI-004 主验收；场景级玩家可见断言见 `tests/headless/ui-*.test.ts`。
 * refactor-test：映射见 `working-plan/refactor-test-execution-matrix.md`（UI 模块「旧测试处理」列）。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createDefaultPawnStates } from "../src/game/pawn-state";
import type { WorkItemSnapshot } from "../src/game/work/work-types";
import { HudManager } from "../src/ui/hud-manager";

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
    expect(html).toContain('id="top-left-hud-stack"');
    expect(html).toContain('id="scene-debug-toggle"');
    expect(html).toContain('id="scene-debug-panel"');
    expect(html).toContain('id="scene-debug-filter"');
    expect(html).toContain('id="scene-debug-log-list"');
    expect(html).toContain('id="scene-debug-detail"');
    expect(html).toContain('id="villager-tool-bar"');
    expect(html).toContain('aria-label="三层命令菜单"');
    expect(html).toContain('aria-live="polite"');
  });
});

describe("debug panel hud", () => {
  it("opens, filters, and shows selected debug log details", () => {
    document.body.innerHTML = `
      <div id="scene-hud"><button id="scene-debug-toggle" type="button"></button></div>
      <aside id="scene-debug-panel" hidden>
        <button id="scene-debug-clear" type="button"></button>
        <button id="scene-debug-pause" type="button"></button>
        <input id="scene-debug-filter" />
        <div id="scene-debug-count"></div>
        <div id="scene-debug-log-list"></div>
        <pre id="scene-debug-detail"></pre>
      </aside>
    `;
    const hud = new HudManager();
    let filterValue = "";
    let selectedId: string | null = null;
    let open = false;
    let paused = false;
    let cleared = false;
    const allEntries = [
      {
        id: "entry-1",
        tick: 12,
        text: "[tick 12] Alex goal-planner -> eat / move",
        searchText: "alex eat move goal-planner",
        detailText: "detail one"
      },
      {
        id: "entry-2",
        tick: 13,
        text: "[tick 13] Bo work-released work-2",
        searchText: "bo work-released work-2",
        detailText: "detail two"
      }
    ];

    const sync = () =>
      hud.syncDebugPanel({
        open,
        paused,
        filter: filterValue,
        selectedEntryId: selectedId,
        entries: allEntries.filter((entry) =>
          filterValue.trim() === ""
            ? true
            : entry.searchText.toLowerCase().includes(filterValue.trim().toLowerCase())
        )
      });

    hud.setupDebugPanel({
      onToggleOpen: () => {
        open = !open;
        sync();
      },
      onTogglePause: () => {
        paused = !paused;
        sync();
      },
      onClear: () => {
        cleared = true;
      },
      onFilterChange: (next) => {
        filterValue = next;
        sync();
      },
      onSelectEntry: (entryId) => {
        selectedId = entryId;
        sync();
      }
    });

    sync();
    (document.getElementById("scene-debug-toggle") as HTMLButtonElement).click();
    expect((document.getElementById("scene-debug-panel") as HTMLElement).hidden).toBe(false);

    const filterInput = document.getElementById("scene-debug-filter") as HTMLInputElement;
    filterInput.value = "released";
    filterInput.dispatchEvent(new Event("input"));

    const rows = Array.from(document.querySelectorAll(".scene-debug-log-entry"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("work-released");

    rows[0]?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(document.getElementById("scene-debug-detail")?.textContent).toContain("detail two");

    (document.getElementById("scene-debug-pause") as HTMLButtonElement).click();
    expect(paused).toBe(true);

    (document.getElementById("scene-debug-clear") as HTMLButtonElement).click();
    expect(cleared).toBe(true);
  });
});

describe("三层命令菜单", () => {
  it("renders the new command menu anchors and swaps command lists by category", () => {
    document.body.innerHTML = `<div id="villager-tool-bar"></div>`;
    const hud = new HudManager();
    hud.setupCommandMenu(() => undefined, "mine");

    expect(document.getElementById("villager-command-primary")).not.toBeNull();
    expect(document.getElementById("villager-command-categories")).not.toBeNull();
    expect(document.getElementById("villager-command-list")).not.toBeNull();
    expect(document.querySelector(".build-tool-submenu")).toBeNull();

    const categoryButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("#villager-command-categories button")
    );
    expect(categoryButtons).toHaveLength(3);
    expect(categoryButtons.map((button) => button.textContent)).toContain("结构");
    expect(categoryButtons.map((button) => button.textContent)).toContain("家具");

    (categoryButtons.find((button) => button.textContent === "结构") as HTMLButtonElement).click();

    const commandLabels = Array.from(
      document.querySelectorAll<HTMLButtonElement>("#villager-command-list .command-item-button")
    ).map((button) => button.querySelector(".command-item-label")?.textContent);
    expect(commandLabels).toEqual(["木墙", "储存区"]);
  });

  it("keeps the clicked command highlighted after switching categories", () => {
    document.body.innerHTML = `<div id="villager-tool-bar"></div>`;
    const hud = new HudManager();
    hud.setupCommandMenu(() => undefined, "mine");

    const furnitureCategory = Array.from(
      document.querySelectorAll<HTMLButtonElement>("#villager-command-categories button")
    ).find((button) => button.textContent === "家具");
    expect(furnitureCategory).toBeDefined();
    furnitureCategory!.click();

    const bedButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>("#villager-command-list .command-item-button")
    ).find((button) => button.dataset.commandId === "place-bed");
    expect(bedButton).toBeDefined();
    bedButton!.click();

    const selected = document.querySelector("#villager-command-list .command-item-button.selected");
    expect(selected?.dataset.commandId).toBe("place-bed");
    expect(document.getElementById("villager-command-primary")?.textContent).toContain("木床");
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
