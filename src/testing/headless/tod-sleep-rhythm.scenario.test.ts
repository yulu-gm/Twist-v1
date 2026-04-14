import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { todSleepRhythmScenario } from '@testing/scenarios/tod-sleep-rhythm.scenario';

describe('todSleepRhythmScenario', () => {
  it('keeps normal pawns asleep earlier while delayed sleepers stay awake longer and beds clean up', async () => {
    const result = await runHeadlessScenario(todSleepRhythmScenario);

    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }

    expect(result.status).toBe('passed');
  });
});
