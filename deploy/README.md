# ELHAFEZ production delivery

This directory defines the production delivery boundary for the accepted modular monolith. It does not change business ownership.

## Build

Use the exact repository lockfile and generated Prisma client:

```bash
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm verify
pnpm build
```

The browser artifacts are:
- tenant application: `apps/web/dist`
- Owner Control Center: `apps/owner/dist`

The API production entry is intentionally `pnpm --filter @elhafez/api start:prod`. The repository's workspace packages export TypeScript source, and Nest runtime composition requires decorator metadata. The registered Node TypeScript hook uses the TypeScript compiler with the API's canonical `experimentalDecorators` and `emitDecoratorMetadata` settings; it is the supported runtime rather than an accidental `tsx` development path.

## Runtime

1. Copy the repository to `/opt/elhafez` and the static artifacts to `/srv/elhafez/web` and `/srv/elhafez/owner`.
2. Store production environment values in `/etc/elhafez/production.env`; do not commit credentials.
3. Render `deploy/nginx/elhafez.conf.template` with the tenant host, owner host and TLS certificate paths, then install it inside the Nginx `http` context.
4. Install `deploy/systemd/elhafez-api.service.template` as the API service after checking local paths.
5. Keep `ELHAFEZ_CORS_ORIGINS` empty for the same-origin reverse-proxy deployment. Add explicit HTTPS origins only when a real cross-origin client requires browser CORS.

The edge terminates TLS, applies HSTS, CSP and other browser headers, caps request size and rate-limits `/api/`. The Nest API independently applies non-browser security headers and the global runtime request-safety pipe. This separation avoids duplicated or contradictory edge behavior.

## PostgreSQL backup and recovery

`ELHAFEZ_BACKUP_DIR` must be a durable filesystem path writable only by the API service account. The database host must provide compatible `pg_dump` and `pg_restore` binaries. The production provider creates PostgreSQL custom-format backups, calculates a streamed SHA-256 checksum, verifies it before marking the backup verified, and refuses to label a physical full-database backup as tenant-scoped.

Backup and restore are controlled only from the Owner Control Center and require an authenticated platform-owner session plus MFA for sensitive operations.

Before public go-live, perform one recovery drill on a non-production database:

1. create a backup from Owner Control Center;
2. verify the backup and confirm status `VERIFIED`;
3. run restore preflight;
4. restore into the designated non-production recovery environment;
5. verify schema/data smoke scenarios;
6. confirm active sessions were revoked after restore.

Do not use the first recovery exercise against the live database.

## Final release evidence

A release candidate is not a go-live baseline until all of these are recorded against one immutable commit:
- fresh PostgreSQL migration chain PASS;
- `pnpm verify` PASS;
- `pnpm build` PASS;
- tenant and Owner static artifacts return HTTP 200 through TLS;
- API health/business smoke checks pass through the reverse proxy;
- backup create/verify/preflight/recovery drill PASS;
- final CI run PASS;
- human UAT PASS.

Only then may the commit be recorded as `SYSTEM CLOSED / GO-LIVE BASELINE`.
