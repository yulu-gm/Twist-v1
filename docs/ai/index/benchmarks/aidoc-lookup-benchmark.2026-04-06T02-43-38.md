# AIDOC Lookup Benchmark

- timestamp: 2026-04-06T02:43:38.791Z
- iterations: 7
- warmupIterations: 1
- minSpeedupRatio: 1.05
- pass: true

## Aggregate

| variant | medianWallMs | p95WallMs | accuracy | filesOpenedAvg | bytesReadAvg |
| --- | ---: | ---: | ---: | ---: | ---: |
| skill_query | 0.684 | 1.506 | 1 | 0 | 0 |
| direct_code_read | 3.972 | 5.262 | 1 | 53.333 | 215541.667 |

- speedupRatio: 5.807

## Scenarios

| scenario | skill median ms | direct median ms | speedupRatio | pass |
| --- | ---: | ---: | ---: | --- |
| module_lookup | 0.684 | 3.972 | 5.807 | true |
| changed_files_impact_lookup | 1.319 | 5.12 | 3.882 | true |
| routed_system_lookup | 0.084 | 0.686 | 8.167 | true |
