import { describe, expect, it, beforeEach } from "vitest";
import {
  commitSession,
  beginSession,
  cancelSession,
  createModeRegistry,
  getMode,
  listModes,
  registerMode,
  type InteractionMode
} from "../../src/game/interaction";
import { resetInteractionSessionIdSequence } from "../../src/game/interaction/session-manager";

describe("mode-registry", () => {
  beforeEach(() => {
    resetInteractionSessionIdSequence();
  });

  it("registers default modes and lists them", () => {
    const reg = createModeRegistry();
    const modes = listModes(reg);
    const ids = modes.map((m) => m.modeId).sort();
    expect(ids).toEqual(["build-bed", "build-wall", "haul", "lumber", "zone-create"]);
    expect(getMode(reg, "lumber")?.displayName).toBe("伐木标记");
    expect(getMode(reg, "missing")).toBeUndefined();
  });

  it("registerMode overrides an existing mode id", () => {
    const reg = createModeRegistry();
    const override: InteractionMode = {
      modeId: "lumber",
      displayName: "覆写伐木",
      inputShape: "rect-selection",
      interactionSource: { kind: "menu", menuId: "interaction-mode", itemId: "lumber" },
      explainRule: (input) => ({
        verb: "assign_tool_task:lumber",
        targetCellKeys: input.cells.map((c) => `${c.col},${c.row}`),
        targetEntityIds: [],
        sourceMode: {
          source: { kind: "menu", menuId: "interaction-mode", itemId: "lumber" },
          selectionModifier: input.modifier,
          inputShape: "rect-selection"
        }
      })
    };
    registerMode(reg, override);
    expect(getMode(reg, "lumber")?.displayName).toBe("覆写伐木");
  });
});

describe("interaction session + commit", () => {
  beforeEach(() => {
    resetInteractionSessionIdSequence();
  });

  it("beginSession throws unknown mode", () => {
    const reg = createModeRegistry();
    expect(() => beginSession(reg, "no-such", 1000)).toThrow(/unknown interaction mode/);
  });

  it("commitSession produces DomainCommand fields for zone-create", () => {
    const reg = createModeRegistry();
    const session = beginSession(reg, "zone-create", 5000);
    expect(session.state).toBe("collecting");
    expect(session.cancelled).toBe(false);

    const cmd = commitSession(
      reg,
      session,
      [
        { col: 1, row: 2 },
        { col: 3, row: 4 }
      ],
      "union",
      "fixed-cmd-1"
    );

    expect(cmd.commandId).toBe("fixed-cmd-1");
    expect(cmd.verb).toBe("zone_create");
    expect(cmd.targetCellKeys).toEqual(["1,2", "3,4"]);
    expect(cmd.targetEntityIds).toEqual([]);
    expect(cmd.sourceMode.selectionModifier).toBe("union");
    expect(cmd.sourceMode.inputShape).toBe("rect-selection");
    expect(cmd.sourceMode.source).toEqual({
      kind: "menu",
      menuId: "interaction-mode",
      itemId: "zone-create"
    });
    expect(session.state).toBe("committed");
  });

  it("build-wall uses brush-stroke inputShape in command", () => {
    const reg = createModeRegistry();
    const session = beginSession(reg, "build-wall", 0);
    const cmd = commitSession(reg, session, [{ col: 0, row: 0 }], "replace", "id-wall");
    expect(cmd.verb).toBe("build_wall_blueprint");
    expect(cmd.sourceMode.inputShape).toBe("brush-stroke");
  });

  it("build-bed commit uses single-cell inputShape (same marker family as wall, different semantics)", () => {
    const reg = createModeRegistry();
    const session = beginSession(reg, "build-bed", 0);
    const cmd = commitSession(reg, session, [{ col: 2, row: 3 }], "replace", "id-bed");
    expect(cmd.verb).toBe("place_furniture:bed");
    expect(cmd.sourceMode.inputShape).toBe("single-cell");
    expect(cmd.targetCellKeys).toEqual(["2,3"]);
    expect(session.state).toBe("committed");
  });

  it("cancelSession sets cancelled; commit throws", () => {
    const reg = createModeRegistry();
    const session = beginSession(reg, "build-bed", 0);
    cancelSession(session);
    expect(session.cancelled).toBe(true);
    expect(() => commitSession(reg, session, [{ col: 5, row: 5 }], "replace", "x")).toThrow(
      /cancelled/
    );
  });
});
