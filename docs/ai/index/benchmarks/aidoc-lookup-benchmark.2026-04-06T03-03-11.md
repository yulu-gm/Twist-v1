# AIDOC Lookup Benchmark

- timestamp: 2026-04-06T03:03:11.143Z
- iterations: 3
- warmupIterations: 1
- minSpeedupRatio: 1.05
- pass: true
- skill_query.entrypoint: tools/aidoc/query-module-lookup.mjs
- direct_project_read.entrypoint: tools/aidoc/query-project-manually.mjs
- direct_project_read.excludedPathPrefixes: docs/ai/index/, docs/ai/systems/

## Aggregate

| variant | medianWallMs | p95WallMs | accuracy | filesOpenedAvg | bytesReadAvg |
| --- | ---: | ---: | ---: | ---: | ---: |
| skill_query | 38.148 | 52.082 | 1 | 1.667 | 12941 |
| direct_project_read | 41.609 | 57.108 | 0.667 | 48.667 | 174731 |

- speedupRatio: 1.091

## Scenarios

| scenario | skill median ms | direct median ms | speedupRatio | pass | faster |
| --- | ---: | ---: | ---: | --- | --- |
| module_lookup | 43.57 | 56.518 | 1.297 | true | true |
| changed_file_primary_routed_lookup | 38.148 | 41.609 | 1.091 | true | true |
| routed_system_lookup | 37.302 | 36.143 | 0.969 | true | false |
