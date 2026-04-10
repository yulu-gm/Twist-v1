/**
 * @file scenario-registry.ts
 * @description 场景注册表 — 集中管理所有可运行的业务场景
 * @part-of testing — 测试系统
 */

import { woodcuttingScenario } from './scenarios/woodcutting.scenario';
import { stockpileHaulScenario } from './scenarios/stockpile-haul.scenario';
import { eatingScenario } from './scenarios/eating.scenario';
import { blueprintConstructionScenario } from './scenarios/blueprint-construction.scenario';
import type { ScenarioDefinition } from './scenario-dsl/scenario.types';

/** 所有已注册的业务场景 */
export const scenarioRegistry: readonly ScenarioDefinition[] = [
  woodcuttingScenario,
  stockpileHaulScenario,
  eatingScenario,
  blueprintConstructionScenario,
] as const;
