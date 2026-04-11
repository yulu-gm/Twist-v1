import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { blueprintSelfOccupancyPromoteScenario } from '@testing/scenarios/blueprint-self-occupancy-promote.scenario';

describe('blueprintSelfOccupancyPromoteScenario', () => {
  it('shows whether self-occupancy blocks blueprint promotion after final delivery', async () => {
    const result = await runHeadlessScenario(blueprintSelfOccupancyPromoteScenario);

    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }

    if (result.status !== 'passed') {
      console.log('FINAL SNAPSHOT', JSON.stringify(result.finalSnapshot, null, 2));
    }

    expect(result.status).toBe('passed');
    expect(result.finalSnapshot.buildings.some(b => b.defId === 'wall_wood')).toBe(true);
  });
});
