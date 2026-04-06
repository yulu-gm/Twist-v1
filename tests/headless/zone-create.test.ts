import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { coordKey } from "../../src/game/map";
import { spawnWorldEntity } from "../../src/game/world-core";
import { createHeadlessSim } from "../../src/headless";
import { hydrateScenario } from "../../src/headless/scenario-runner";
import type { DomainCommand } from "../../src/player/s0-contract";
import { ZONE_CREATE_SCENARIO } from "../../scenarios/zone-create.scenario";

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeZoneCreateCommand(targetCellKeys: readonly string[]): DomainCommand {
  return {
    commandId: `cmd-zone-${targetCellKeys.join("-")}`,
    verb: "zone_create",
    targetCellKeys,
    targetEntityIds: [],
    sourceMode: {
      source: { kind: "toolbar", toolId: "zone_create" },
      selectionModifier: "replace",
      inputShape: "rect-selection"
    }
  };
}

describe("zone_create → WorldCore", () => {
  it("提交后生成 kind=zone、zoneKind=storage 且不写入 occupancy", () => {
    const sim = createHeadlessSim({ seed: ZONE_CREATE_SCENARIO.seed });
    hydrateScenario(sim, ZONE_CREATE_SCENARIO);

    const cells = [
      { col: 7, row: 5 },
      { col: 8, row: 5 }
    ];
    const result = sim
      .getWorldPort()
      .submit(
        makeZoneCreateCommand(cells.map((c) => coordKey(c))),
        1
      );

    expect(result.accepted).toBe(true);
    expect(result.messages.some((m) => m.includes("存储区"))).toBe(true);

    const zones = [...sim.getWorldPort().getWorld().entities.values()].filter((e) => e.kind === "zone");
    expect(zones).toHaveLength(1);
    const z = zones[0]!;
    expect(z.zoneKind).toBe("storage");
    expect(z.coveredCells?.length).toBe(2);
    expect(z.occupiedCells.length).toBe(0);
    const occ = sim.getWorldPort().getWorld().occupancy;
    for (const c of cells) {
      expect(occ.get(coordKey(c))).toBeUndefined();
    }
  });

  it("覆盖阻挡格（障碍实体同步后的 blockedCellKeys）时拒绝", () => {
    const sim = createHeadlessSim({ seed: ZONE_CREATE_SCENARIO.seed });
    hydrateScenario(sim, ZONE_CREATE_SCENARIO);

    const blockedCell = { col: 12, row: 5 };
    let world = sim.getWorldPort().getWorld();
    const obs = spawnWorldEntity(world, {
      kind: "obstacle",
      cell: blockedCell,
      occupiedCells: [blockedCell],
      label: "headless-test-stone"
    });
    expect(obs.outcome.kind).toBe("created");
    sim.getWorldPort().setWorld(obs.world);
    sim.tick(16);

    const reject = sim
      .getWorldPort()
      .submit(
        makeZoneCreateCommand([coordKey(blockedCell), coordKey({ col: 13, row: 5 })]),
        2
      );
    expect(reject.accepted).toBe(false);
    expect(reject.conflictCellKeys?.[0]).toBe(coordKey(blockedCell));
    expect(reject.messages.some((m) => m.includes("阻挡"))).toBe(true);
  });

  it("apply-domain-command 实现含 zone_create 动词分支", () => {
    const srcPath = join(__dirname, "..", "..", "src", "player", "apply-domain-command.ts");
    const src = readFileSync(srcPath, "utf8");
    expect(src).toContain('"zone_create"');
    expect(src).toContain("applyDomainCommandToWorldCore");
  });
});
