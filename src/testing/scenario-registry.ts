/**
 * @file scenario-registry.ts
 * @description 场景注册表 — 集中管理所有可运行的业务场景。
 *              从基础正向链路到复杂中断恢复，由浅入深便于回归套件从轻到重定位问题。
 * @part-of testing — 测试系统
 */

import { woodcuttingScenario } from './scenarios/woodcutting.scenario';
import { stockpileHaulScenario } from './scenarios/stockpile-haul.scenario';
import { eatingScenario } from './scenarios/eating.scenario';
import { blueprintConstructionScenario } from './scenarios/blueprint-construction.scenario';
import { zoneStockpileLifecycleScenario } from './scenarios/zone-stockpile-lifecycle.scenario';
import { quantityHaulStackChainScenario } from './scenarios/quantity-haul-stack-chain.scenario';
import { sleepBedOccupancyScenario } from './scenarios/sleep-bed-occupancy.scenario';
import { bedBlueprintSleepScenario } from './scenarios/bed-blueprint-sleep.scenario';
import { blueprintOversupplyHaulScenario } from './scenarios/blueprint-oversupply-haul.scenario';
import { blueprintMultiPawnOversupplyScenario } from './scenarios/blueprint-multipawn-oversupply.scenario';
import { todSleepRhythmScenario } from './scenarios/tod-sleep-rhythm.scenario';
import { workOrderMapPriorityScenario } from './scenarios/work-order-map-priority.scenario';
import type { ScenarioDefinition } from './scenario-dsl/scenario.types';

/** 所有已注册的业务场景 */
export const scenarioRegistry: readonly ScenarioDefinition[] = [
  woodcuttingScenario,
  stockpileHaulScenario,
  eatingScenario,
  blueprintConstructionScenario,
  zoneStockpileLifecycleScenario,
  quantityHaulStackChainScenario,
  sleepBedOccupancyScenario,
  bedBlueprintSleepScenario,
  blueprintOversupplyHaulScenario,
  blueprintMultiPawnOversupplyScenario,
  todSleepRhythmScenario,
  workOrderMapPriorityScenario,
] as const;
