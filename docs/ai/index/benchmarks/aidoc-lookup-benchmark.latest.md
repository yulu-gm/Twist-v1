# AIDOC Lookup Benchmark

- timestamp: 2026-04-06T03:04:43.173Z
- iterations: 7
- warmupIterations: 1
- minSpeedupRatio: 1.05
- pass: true
- skill_query.entrypoint: tools/aidoc/query-module-lookup.mjs
- direct_project_read.entrypoint: tools/aidoc/query-project-manually.mjs
- direct_project_read.excludedPathPrefixes: docs/ai/index/, docs/ai/systems/
- aggregate.speedupRatio: Geometric mean of per-scenario median speedup ratios so each scenario category is weighted evenly.

## Aggregate

| variant | medianWallMs | p95WallMs | accuracy | filesOpenedAvg | bytesReadAvg |
| --- | ---: | ---: | ---: | ---: | ---: |
| skill_query | 36.611 | 45.346 | 1 | 1.667 | 12941 |
| direct_project_read | 37.641 | 71.157 | 1 | 48.667 | 174731 |

- speedupRatio: 1.136

## Scenarios

| scenario | skill median ms | direct median ms | speedupRatio | pass | faster |
| --- | ---: | ---: | ---: | --- | --- |
| module_lookup | 44.427 | 63.542 | 1.43 | true | true |
| changed_file_primary_routed_lookup | 36.421 | 35.925 | 0.986 | true | false |
| routed_system_lookup | 36.189 | 37.607 | 1.039 | true | false |
