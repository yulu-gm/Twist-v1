---
name: search_proj_info
description: Use this skill when you need to locate Twist-v1 modules, files, or code paths quickly. It reads the generated project module map first, narrows the relevant layer or feature, and only then performs focused searches instead of broad repo-wide scanning.
---

# Search Project Info

Use this skill to answer repository-navigation questions with low search cost.

## Primary workflow

1. Read `project-map/project-module-map.json` first.
2. If the user needs a human-readable overview, also read `project-map/project-module-map.md`.
3. Identify the target domain before searching:
   - startup / registration / main loop
   - core runtime
   - world or map container
   - defs
   - a specific `features/*` module
   - adapter input / render / UI
   - presentation state
   - architecture or flow docs under `plan/`
4. Return the recommended modules and key files first, with a short reason for each.
5. Only if the map is insufficient, run focused `rg` within the suggested files or directories instead of searching the whole repo.

## Default routing

- Startup / boot / system registration:
  `src/main.ts`, `src/adapter/main-scene.ts`, `src/core/tick-runner.ts`
- World / GameMap / pathGrid / reservations / rooms:
  `src/world/*`
- Static defs:
  `src/defs/*`, `src/world/def-database.ts`
- Pawn / AI / jobs / toils:
  `src/features/pawn/*`, `src/features/ai/*`
- Construction / designation / zone / room:
  `src/features/construction/*`, `src/features/designation/*`, `src/features/zone/*`, `src/features/room/*`
- Render / UI / input:
  `src/adapter/render/*`, `src/adapter/ui/*`, `src/adapter/input/*`
- Presentation bridge:
  `src/presentation/presentation-state.ts`
- Architecture and flow explanations:
  `plan/opus architecture.md`, `plan/业务场景解释.md`

## Search discipline

- Prefer the JSON map as the primary source of truth for navigation.
- Use the Markdown map when a readable overview is more useful than raw index data.
- Explain why you are pointing to a module or file; do not return a bare list.
- If a query spans multiple modules, group the answer by module and show the handoff path between them.
- If the map seems stale or missing the target module, say so explicitly and recommend regenerating it with `npm run generate:module-map`.

## Focused search patterns

- For feature questions, search inside one feature directory first.
- For flow questions, pair one `plan/` doc with the concrete code entrypoints named in the map.
- For schema questions, inspect `*.types.ts` or `world/def-database.ts` before reading systems.
- For behavior questions, inspect `*.commands.ts`, `*.system.ts`, `job-selector.ts`, `toil-executor.ts`, or specific toil handlers before widening the search.
