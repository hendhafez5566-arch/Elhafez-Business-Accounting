# ELHAFEZ Architecture Constitution

Status: **CANONICAL / FAIL-CLOSED**

This document describes the machine-enforced engineering constitution of the ELHAFEZ Business Platform. Human instructions are not the protection boundary: repository gates are.

## Enforcement chain

Every candidate change must pass:

1. Change Safety.
2. Engineering Integrity.
3. Prisma generation.
4. Lint.
5. Typecheck.
6. Architecture ownership/DAG checks.
7. Automated tests.

A failure in any required gate blocks acceptance. Quality commands may not use hidden-success fallbacks or continue-on-error.

## Anti-patching rules

New source changes are rejected when they introduce TypeScript suppression, ESLint suppression, unsafe `as any`, production `as never`, focused/skipped tests, `--no-verify`, hidden `|| true` success fallbacks, or CI `continue-on-error: true`.

A test may use `@ts-expect-error` only as an intentional compile-time negative test and only when the directive contains an explicit reason.

## Ownership and dependency rules

The existing architecture checker remains the machine authority for unique table ownership, public module boundaries, domain isolation, direct Prisma ownership, kernel independence, and acyclic module dependencies.

Business truth must remain with its canonical owner. Composition/API/UI code may orchestrate owners but must not create a second source of truth.

## Migration integrity

Accepted migration history is immutable. The single pre-Go-Live SAAS-01 repair is pinned by the exact Git blob before and after the repair. The lock itself is introduced once so the same exception cannot be reused to edit accepted history later.

## Test evidence

Behavioral source changes must carry changed automated test evidence in the change manifest. This does not replace semantic review, but prevents source-only delivery without executable evidence.

## Protection boundary

Governance, architecture tools, CI, package verification scripts, module manifests, TypeScript/lint configuration, and migrations are protected paths. Changing them requires an explicit protected-path declaration and reason, and the resulting repository must still pass this constitution.

No software rule can prevent a repository administrator from deliberately replacing every protection mechanism. These controls are designed to make accidental, local, or undeclared architectural violations fail closed before merge/deployment.
