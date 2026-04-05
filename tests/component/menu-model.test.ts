import { describe, expect, it } from "vitest";
import {
  createMenuState,
  selectMenuItem,
  toggleMenuVisibility,
  type MenuItem
} from "../../src/ui/menu-model";

const sampleItems: readonly MenuItem[] = [
  {
    id: "a",
    label: "第一项",
    enabled: true,
    action: { kind: "villager-tool", toolId: "mine" }
  },
  {
    id: "b",
    label: "第二项",
    enabled: false,
    action: { kind: "interaction-mode", modeKey: "build" }
  }
];

describe("menu-model", () => {
  it("createMenuState 选中首项且默认不可见", () => {
    const s = createMenuState(sampleItems);
    expect(s.items).toBe(sampleItems);
    expect(s.selectedId).toBe("a");
    expect(s.visible).toBe(false);
  });

  it("createMenuState 空列表 selectedId 为 null", () => {
    const s = createMenuState([]);
    expect(s.selectedId).toBeNull();
  });

  it("selectMenuItem 不可变更新选中项", () => {
    const s0 = createMenuState(sampleItems);
    const s1 = selectMenuItem(s0, "b");
    expect(s0.selectedId).toBe("a");
    expect(s1.selectedId).toBe("b");
    expect(s1.items).toBe(s0.items);
    expect(s1.visible).toBe(s0.visible);
  });

  it("selectMenuItem 未知 id 保持原状态引用语义（浅拷贝 state）", () => {
    const s0 = createMenuState(sampleItems);
    const s1 = selectMenuItem(s0, "nope");
    expect(s1.selectedId).toBe(s0.selectedId);
    expect(s1).not.toBe(s0);
  });

  it("toggleMenuVisibility 切换可见性", () => {
    const s0 = createMenuState(sampleItems);
    const s1 = toggleMenuVisibility(s0);
    const s2 = toggleMenuVisibility(s1);
    expect(s0.visible).toBe(false);
    expect(s1.visible).toBe(true);
    expect(s2.visible).toBe(false);
  });
});
