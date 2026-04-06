import { describe, expect, it } from "vitest";
import {
  COMMAND_MENU_CATEGORIES,
  COMMAND_MENU_HOTKEY_COMMAND_IDS,
  commandIdForHotkeyIndex,
  getCommandMenuCommand
} from "../../src/data/command-menu";
import { VILLAGER_TOOL_KEY_CODES } from "../../src/data/villager-tools";
import {
  activeCommandInteractionSemantics,
  createCommandMenuState,
  selectCommandMenuCommand,
  setCommandMenuCategory,
  toggleCommandMenuOpen,
  visibleCommandsForCommandMenuState
} from "../../src/ui/menu-model";

describe("command-menu model", () => {
  it("wires current live commands into explicit categories", () => {
    expect(COMMAND_MENU_CATEGORIES.map((category) => category.id)).toEqual([
      "orders",
      "structures",
      "furniture"
    ]);
    expect(COMMAND_MENU_CATEGORIES[0]!.commands.map((command) => command.id)).toEqual([
      "mine",
      "demolish",
      "mow",
      "lumber",
      "farm",
      "haul",
      "patrol",
      "idle"
    ]);
    expect(COMMAND_MENU_CATEGORIES[1]!.commands.map((command) => command.id)).toEqual([
      "build-wall",
      "storage-zone"
    ]);
    expect(COMMAND_MENU_CATEGORIES[2]!.commands.map((command) => command.id)).toEqual([
      "place-bed"
    ]);
  });

  it("keeps the active command when the menu is opened and closed", () => {
    const initial = createCommandMenuState();
    const selected = selectCommandMenuCommand(initial, "haul");
    const opened = toggleCommandMenuOpen(selected);
    const closed = toggleCommandMenuOpen(opened);

    expect(initial.activeCommandId).not.toBe("haul");
    expect(selected.activeCommandId).toBe("haul");
    expect(opened.isOpen).toBe(true);
    expect(opened.activeCommandId).toBe("haul");
    expect(closed.isOpen).toBe(false);
    expect(closed.activeCommandId).toBe("haul");
  });

  it("switches visible commands without changing the active command", () => {
    const initial = createCommandMenuState({ activeCommandId: "mine" });
    const switched = setCommandMenuCategory(initial, "furniture");

    expect(visibleCommandsForCommandMenuState(initial).map((command) => command.id)).toEqual([
      "mine",
      "demolish",
      "mow",
      "lumber",
      "farm",
      "haul",
      "patrol",
      "idle"
    ]);
    expect(visibleCommandsForCommandMenuState(switched).map((command) => command.id)).toEqual([
      "place-bed"
    ]);
    expect(switched.activeCategoryId).toBe("furniture");
    expect(switched.activeCommandId).toBe("mine");
  });

  it("derives interaction semantics for structure and furniture commands", () => {
    expect(activeCommandInteractionSemantics(selectCommandMenuCommand(createCommandMenuState(), "build-wall"))).toEqual(
      expect.objectContaining({
        inputShape: "brush-stroke",
        markerToolId: "build",
        hotkeyLabel: "T",
        modeKey: "build-wall"
      })
    );
    expect(
      activeCommandInteractionSemantics(selectCommandMenuCommand(createCommandMenuState(), "place-bed"))
    ).toEqual(
      expect.objectContaining({
        inputShape: "single-cell",
        markerToolId: "build",
        hotkeyLabel: "",
        modeKey: "build-bed"
      })
    );
  });

  it("looks up a command by id", () => {
    expect(getCommandMenuCommand("haul")?.categoryId).toBe("orders");
  });

  it("keeps Q–P hotkeys aligned with command-menu slot count", () => {
    expect(COMMAND_MENU_HOTKEY_COMMAND_IDS.length).toBe(VILLAGER_TOOL_KEY_CODES.length);
    expect(commandIdForHotkeyIndex(0)).toBe("mine");
    expect(commandIdForHotkeyIndex(4)).toBe("build-wall");
    expect(commandIdForHotkeyIndex(8)).toBe("idle");
    expect(commandIdForHotkeyIndex(9)).toBe("storage-zone");
  });
});
