# AIDOC Lookup Benchmark

- timestamp: 2026-04-06T02:51:32.227Z
- iterations: 7
- warmupIterations: 1
- minSpeedupRatio: 1.05
- pass: true

## Aggregate

| variant | medianWallMs | p95WallMs | accuracy | filesOpenedAvg | bytesReadAvg |
| --- | ---: | ---: | ---: | ---: | ---: |
| skill_query | 0.277 | 0.684 | 1 | 1.667 | 12941 |
| direct_code_read | 4.147 | 5.515 | 1 | 53.333 | 215541.667 |

- speedupRatio: 14.971

## Scenarios

| scenario | skill median ms | direct median ms | speedupRatio | pass |
| --- | ---: | ---: | ---: | --- |
| module_lookup | 0.625 | 4.147 | 6.635 | true |
| changed_files_impact_lookup | 0.277 | 5.258 | 18.982 | true |
| routed_system_lookup | 0.067 | 0.665 | 9.925 | true |
