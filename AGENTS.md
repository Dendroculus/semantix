# Repository agent instructions

## Graphify navigation

This repository uses a local, code-only Graphify knowledge graph for codebase
navigation. Run Graphify commands from the repository root.

- Before broad source searches or repository-wide source browsing, use the
  existing graph to identify the relevant symbols and files:
  - `graphify query "<question>" --graph graphify-out/graph.json`
  - `graphify path "<A>" "<B>" --graph graphify-out/graph.json`
  - `graphify explain "<symbol>" --graph graphify-out/graph.json`
- Verify Graphify findings against the relevant source files before drawing
  conclusions or making changes.
- If the graph does not exist locally, create it with
  `graphify extract . --code-only`.
- After a task is complete and its changes are validated, run
  `graphify update .` when the task adds, removes, moves, or renames source-code
  files, or changes relationships between source-code symbols or modules.
- Skip graph refreshes for documentation-only, formatting-only, comment-only,
  and other changes that cannot affect code relationships.
- Keep `graphify-out/` and machine-specific Graphify hooks local. Do not commit
  generated Graphify output unless the repository explicitly adopts a tracked
  graph artifact.
