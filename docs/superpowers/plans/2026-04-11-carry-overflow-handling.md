# Carry Overflow Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve excess carried materials after partial blueprint delivery and resolve them only when they would block pickup-based work.

**Architecture:** Keep the behavior split in two places: delivery decides whether to keep or place excess materials, and job selection decides when carried surplus actually needs handling. Carry-resolution work should be a small, no-pickup job shape so it can run while the pawn is already carrying items.

**Tech Stack:** TypeScript, Vitest, existing AI job/toil system, scenario and unit test helpers.

---

### Task 1: Delivery Regression

**Files:**
- Modify: `src/features/ai/deliver.handler.construction.test.ts`
- Modify: `src/features/ai/toil-handlers/deliver.handler.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run the test to verify it fails**
- [ ] **Step 3: Implement minimal partial-delivery carry preservation**
- [ ] **Step 4: Run the test to verify it passes**

### Task 2: Carry-Aware Selection Regressions

**Files:**
- Create: `src/features/ai/job-selector.carrying.test.ts`
- Modify: `src/features/ai/job-selector.ts`
- Create or modify: carry-resolution job factory under `src/features/ai/jobs/`

- [ ] **Step 1: Write failing tests for unblocked-vs-blocked selection and carry-resolution fallback**
- [ ] **Step 2: Run the tests to verify they fail**
- [ ] **Step 3: Implement minimal carry-resolution candidate generation and blocked pickup filtering**
- [ ] **Step 4: Run the tests to verify they pass**

### Task 3: Focused Verification

**Files:**
- Modify if needed: `src/testing/headless/blueprint-multipawn-oversupply.scenario.test.ts`

- [ ] **Step 1: Run targeted regressions covering delivery, carrying selection, and existing blueprint hauling**
- [ ] **Step 2: Fix any regressions introduced by carry preservation**
- [ ] **Step 3: Summarize what passed and any remaining risk**
