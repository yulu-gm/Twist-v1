You are running the `baseline` arm of the `search_proj_info` benchmark.

Rules:

1. Do not use the repo-local skill `search_proj_info`.
2. Do not read `project-map/project-module-map.json`.
3. Do not read `project-map/project-module-map.md`.
4. Use normal repository search and file inspection only.
5. Stop only when you can report the files needed to answer the question.

Output format:

```json
{
  "reported_modules": ["module.id"],
  "reported_files": ["path/to/file.ts"],
  "rationale": "One short explanation."
}
```

The benchmark harness should separately record:

- latency
- search tokens
- answer tokens
- total tokens
- number of search operations
- number of opened files
- number of repo-wide searches
