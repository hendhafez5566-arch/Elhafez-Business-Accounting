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

`ELHAFEZ_BACKUP_DIR` is a durable filesystem path writable only by the API service account and readable by Nginx for the external maintenance marker. The database host must provide compatible `pg_dump` and `pg_restore` binaries. The provider creates PostgreSQL custom-format backups, calculates a streamed SHA-256 checksum, verifies the archive with `pg_restore --list`, and refuses to represent a full physical database backup as tenant-scoped.

Physical backup and restore are platform-owner operations only. Tenant administrators use Data Exchange for company-scoped portability; they do not receive physical restore authority.

### Recovery safety contract

Restore is fail-closed and deliberately requires all of the following at the same time:

- authenticated platform-owner session;
- fresh Owner TOTP MFA;
- a previously `VERIFIED` backup;
- `ELHAFEZ_RESTORE_ENABLED=true`;
- `ELHAFEZ_ALLOW_IN_PLACE_RESTORE=true`;
- `ELHAFEZ_RESTORE_DATABASE_URL` identifying the same environment database as `DATABASE_URL`;
- active external maintenance marker at `ELHAFEZ_RESTORE_MAINTENANCE_FILE`.

The Owner Control Center creates/removes the marker through `platform-operations`. While the marker exists, the tenant Nginx host returns HTTP 503 before serving the application or forwarding any tenant API. The Owner host keeps only login and recovery operations reachable; other owner mutations are blocked by the edge.

A successful restore deliberately keeps maintenance active and then revokes all tenant sessions and all platform-owner sessions. The owner must sign in again, verify the restored environment, and explicitly exit maintenance. Maintenance is never removed automatically by the restore request.

### Required pre-go-live recovery drill

Perform the drill on a separate **non-production deployment** whose `DATABASE_URL` points to that deployment's own test/recovery database:

1. build and start the non-production deployment from the exact release-candidate commit;
2. temporarily enable both restore switches and restart the API;
3. create a backup from Owner Control Center and confirm status `VERIFIED`;
4. enter maintenance mode and confirm the tenant hostname returns HTTP 503;
5. run restore preflight;
6. execute restore into that same non-production database;
7. confirm the current Owner session has been revoked and sign in again;
8. verify schema/data and critical business smoke scenarios;
9. explicitly exit maintenance and confirm tenant access returns;
10. disable both restore switches again and restart the API.

The first recovery exercise must never target the live production database.

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
