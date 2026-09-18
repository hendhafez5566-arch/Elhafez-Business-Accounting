# Testing Standard

Every module must include unit tests for domain and application behaviour, repository/integration tests for its own persistence boundary, and contract tests for its public API/events. Cross-module workflows are tested through public contracts or events only.

Required local quality gate:

```bash
pnpm verify
```

CI runs installation, typecheck, lint, architecture checks, and tests on every push and pull request.
