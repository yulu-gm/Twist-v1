import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { bedBlueprintSleepScenario } from '@testing/scenarios/bed-blueprint-sleep.scenario';

describe('bedBlueprintSleepScenario', () => {
  it('builds a bed from blueprint and lets a tired pawn use it', async () => {
    const result = await runHeadlessScenario(bedBlueprintSleepScenario);

    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }

    if (result.status !== 'passed') {
      console.log('FINAL SNAPSHOT', JSON.stringify(result.finalSnapshot, null, 2));
    }

    expect(result.status).toBe('passed');
    expect(result.finalSnapshot.buildings.some(b => b.defId === 'bed_wood')).toBe(true);
  });
});
