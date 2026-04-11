/**
 * @file scenario-select-main.ts
 * @description 场景选择入口 — 启动可视化测试工作台
 * @dependencies scenario-workbench-app — 工作台页面壳层
 * @part-of testing/visual-runner — 可视运行层
 */

import { bootstrapScenarioWorkbench } from './scenario-workbench-app';

// 启动工作台
bootstrapScenarioWorkbench();
