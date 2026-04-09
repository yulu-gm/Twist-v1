You are running the `treatment` arm of the `search_proj_info` benchmark.

Rules:

1. Follow the repo-local skill `search_proj_info`.
2. Read `project-map/project-module-map.json` first.
3. If needed, also read `project-map/project-module-map.md`.
4. Use the map to narrow modules and files before doing any code search.
5. Only widen search if the map is insufficient.
6. Stop only when you can report the files needed to answer the question.

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
