import { describe, expect, it } from 'vitest';
import { scenarioRegistry } from '../scenario-registry';

describe('visual scenario registry', () => {
  it('exposes the sleep bed occupancy scenario to the visual selector', () => {
    const scenario = scenarioRegistry.find((entry) => entry.id === 'sleep-bed-occupancy');

    expect(scenario).toBeDefined();
    expect(scenario?.title).toBe('三人两床的睡眠占床');
    expect(scenario?.report?.focus).toContain('床位');
  });
});
