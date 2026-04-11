import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { blueprintOversupplyHaulScenario } from '@testing/scenarios/blueprint-oversupply-haul.scenario';

describe('blueprintOversupplyHaulScenario', () => {
  it('does not over-haul from a large source stack when a blueprint needs only part of it', async () => {
    const result = await runHeadlessScenario(blueprintOversupplyHaulScenario);

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
