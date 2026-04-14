import { describe, expect, it } from 'vitest';
import { scenarioRegistry } from '../scenario-registry';

describe('visual scenario registry', () => {
  it('exposes the sleep bed occupancy scenario to the visual selector', () => {
    const scenario = scenarioRegistry.find((entry) => entry.id === 'sleep-bed-occupancy');

    expect(scenario).toBeDefined();
    expect(scenario?.title).toBe('三人两床的睡眠占床');
    expect(scenario?.report?.focus).toContain('床位');
  });

  it('exposes the adjacent-build bed scenario to the visual selector', () => {
    const scenario = scenarioRegistry.find((entry) => entry.id === 'bed-blueprint-room-adjacent-build');

    expect(scenario).toBeDefined();
    expect(scenario?.title).toBe('单出口房间内床位应邻格建造');
    expect(scenario?.report?.focus).toContain('邻格');
  });
});
