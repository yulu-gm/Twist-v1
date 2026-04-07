import { describe, expect, it } from "vitest";
import { getCommandMenuCommand } from "../../src/data/command-menu";
import {
  interactionInputShapeForCommandId,
  interactionInputShapeForModeId
} from "../../src/player/tool-input-policy";

/**
 * 与 `oh-gen-doc/交互系统.yaml` 墙（笔刷）与床（单点）并列语义一致：
 * `markerToolId` 同为 `"build"` 时，不得以粗粒度 tool 推断单一 inputShape（AP-0287）。
 */
describe("tool-input-policy", () => {
  it("build-wall and place-bed share markerToolId build but differ by command id", () => {
    const wall = getCommandMenuCommand("build-wall");
    const bed = getCommandMenuCommand("place-bed");
    expect(wall?.markerToolId).toBe("build");
    expect(bed?.markerToolId).toBe("build");
    expect(interactionInputShapeForCommandId("build-wall")).toBe("brush-stroke");
    expect(interactionInputShapeForCommandId("place-bed")).toBe("single-cell");
  });

  it("resolves inputShape by modeKey (build-wall vs build-bed), not by markerToolId", () => {
    expect(interactionInputShapeForModeId("build-wall")).toBe("brush-stroke");
    expect(interactionInputShapeForModeId("build-bed")).toBe("single-cell");
  });
});
