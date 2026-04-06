# AIDOC Lookup Benchmark

- timestamp: 2026-04-06T03:03:22.990Z
- iterations: 7
- warmupIterations: 1
- minSpeedupRatio: 1.05
- pass: false
- skill_query.entrypoint: tools/aidoc/query-module-lookup.mjs
- direct_project_read.entrypoint: tools/aidoc/query-project-manually.mjs
- direct_project_read.excludedPathPrefixes: docs/ai/index/, docs/ai/systems/

## Aggregate

| variant | medianWallMs | p95WallMs | accuracy | filesOpenedAvg | bytesReadAvg |
| --- | ---: | ---: | ---: | ---: | ---: |
| skill_query | 43.416 | 72.756 | 1 | 1.667 | 12941 |
| direct_project_read | 37.981 | 63.626 | 0.667 | 48.667 | 174731 |

- speedupRatio: 0.875

## Scenarios

| scenario | skill median ms | direct median ms | speedupRatio | pass | faster |
| --- | ---: | ---: | ---: | --- | --- |
| module_lookup | 44.184 | 169.81 | 3.843 | true | true |
| changed_file_primary_routed_lookup | 55.378 | 45.952 | 0.83 | true | false |
| routed_system_lookup | 39.05 | 37.392 | 0.958 | true | false |
