import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { sleepBedOccupancyScenario } from '@testing/scenarios/sleep-bed-occupancy.scenario';

describe('sleepBedOccupancyScenario', () => {
  it('assigns two pawns to beds and lets the third sleep on the floor', async () => {
    const result = await runHeadlessScenario(sleepBedOccupancyScenario);

    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }

    if (result.status !== 'passed') {
      console.log('FINAL SNAPSHOT', JSON.stringify(result.finalSnapshot, null, 2));
    }

    expect(result.status).toBe('passed');
  });
});


