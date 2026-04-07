import { describe, expect, it } from "vitest";

import { chooseGoalDecision } from "../src/game/goal-driven-planning";

import { createDefaultPawnStates } from "../src/game/pawn-state";

import { createSeededEntityRegistry } from "../src/game/entity-system";

import { DEFAULT_WORLD_GRID } from "../src/game/world-grid";

import { WorkRegistry } from "../src/game/work-system";



describe("chooseGoalDecision (entity need targets)", () => {

  const workRegistry = new WorkRegistry();

  it("eat targetId is an edible ground material entity id", () => {

    const registry = createSeededEntityRegistry();

    const pawns = createDefaultPawnStates(DEFAULT_WORLD_GRID.defaultSpawnPoints);

    const hungry = {

      ...pawns[0]!,

      needs: { hunger: 80, rest: 10, recreation: 10 }

    };

    const berry = registry.listMaterialsOnGround().find((m) => m.materialKind === "浆果");

    expect(berry).toBeDefined();



    const d = chooseGoalDecision({

      grid: DEFAULT_WORLD_GRID,

      pawn: hungry,

      entityRegistry: registry,

      workRegistry,

      claimableWorks: [],

      pawnCarriesMaterial: false

    });

    expect(d.goal).toBe("eat");

    expect(d.targetId).toBe(berry!.id);

    expect(registry.getEntity(d.targetId!)?.kind).toBe("material");

  });



  it("sleep picks nearest rest building by Manhattan (seed-bed-1 vs seed-bed-2)", () => {

    const registry = createSeededEntityRegistry();

    const tired = {

      ...createDefaultPawnStates(DEFAULT_WORLD_GRID.defaultSpawnPoints)[0]!,

      needs: { hunger: 10, rest: 85, recreation: 10 }

    };



    const d = chooseGoalDecision({

      grid: DEFAULT_WORLD_GRID,

      pawn: tired,

      entityRegistry: registry,

      workRegistry: new WorkRegistry(),

      claimableWorks: [],

      pawnCarriesMaterial: false

    });

    expect(d.goal).toBe("sleep");

    expect(d.targetId).toBe("seed-bed-1");

  });



  it("recreate picks nearest recreation building (seed-rec-1 vs seed-rec-2)", () => {

    const registry = createSeededEntityRegistry();

    const bored = {

      ...createDefaultPawnStates(DEFAULT_WORLD_GRID.defaultSpawnPoints)[0]!,

      needs: { hunger: 10, rest: 10, recreation: 88 }

    };



    const d = chooseGoalDecision({

      grid: DEFAULT_WORLD_GRID,

      pawn: bored,

      entityRegistry: registry,

      workRegistry,

      claimableWorks: [],

      pawnCarriesMaterial: false

    });

    expect(d.goal).toBe("recreate");

    expect(d.targetId).toBe("seed-rec-1");

  });



  it("sleep target is building entity id, not legacy placeholder strings", () => {

    const registry = createSeededEntityRegistry();

    const tired = {

      ...createDefaultPawnStates(DEFAULT_WORLD_GRID.defaultSpawnPoints)[0]!,

      needs: { hunger: 10, rest: 85, recreation: 10 }

    };

    const d = chooseGoalDecision({

      grid: DEFAULT_WORLD_GRID,

      pawn: tired,

      entityRegistry: registry,

      workRegistry,

      claimableWorks: [],

      pawnCarriesMaterial: false

    });

    expect(d.goal).toBe("sleep");

    expect(d.targetId).toBe("seed-bed-1");

    expect(registry.getEntity(d.targetId!)?.kind).toBe("building");

    expect(d.targetId).not.toBe("bed-1");

    expect(d.targetId).not.toBe("bed-2");

  });

});

