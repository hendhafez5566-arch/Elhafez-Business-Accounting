# ELHAFEZ SaaS Control Plane

Status: **SAAS-01 — implementation baseline**

The tenant application is never the licensing authority. Subscription truth is server-owned by `saas-control-plane`. Device time, browser state, Android code, company administrators and direct API calls cannot extend a subscription.

## Architecture and ownership

`platform-core` continues to own users, companies, branches, tenant sessions and tenant authorization. `saas-control-plane` separately owns the commercial truth: Company Codes, plans, subscriptions, payment evidence, renewal history, platform-owner identities/sessions and entitlement decisions.

The tenant-facing System Administration API cannot provision a new company or change the administrative active state. New commercial tenants are provisioned only through the Owner Control Center after a fresh platform-owner MFA check. `pc_companies.active` remains a separate emergency administrative kill switch controlled by the platform owner; using it revokes affected tenant sessions and is audited independently from subscription suspension.

## Owner security

Platform-owner identity is separate from tenant roles. A company administrator cannot grant itself owner authority.

Required production secrets:
- `SAAS_OWNER_BOOTSTRAP_TOKEN`: at least 32 random characters, used only for first-owner enrollment and removed from runtime configuration afterwards.
- `SAAS_OWNER_MFA_KEY`: exactly 32 random bytes encoded as base64url; used for AES-256-GCM encryption of TOTP secrets at rest.

Owner accounts require a password of at least 16 characters plus TOTP MFA. Passwords are scrypt-hashed with per-password random salt. Owner sessions last four hours; only their SHA-256 token hashes are stored. Sensitive commercial actions require the current TOTP again even when the owner session is valid.

Five consecutive failed owner logins trigger a durable 15-minute lock. The counter is incremented while the owner row is locked in a serializable database transaction, so concurrent failed attempts cannot race around the lockout. Security and subscription mutations are append-only audited.

First-owner bootstrap is protected twice: application state rejects bootstrap when an owner exists, and the repository takes a PostgreSQL advisory transaction lock and re-checks owner count before inserting. Concurrent bootstrap attempts therefore cannot create multiple initial platform owners.

## Tenant entry and subscription enforcement

The normal tenant entry flow is:

1. the customer supplies its non-secret Company Code plus user email/password;
2. the server resolves Company Code to company ID;
3. Platform Core authenticates the user;
4. the server verifies that the authenticated user belongs to that exact company and that the company is administratively active;
5. the server returns only active branches that this user is authorized to access, plus a default branch;
6. the server returns the tenant session together with the current subscription projection.

An expired subscription does **not** require a fake login failure. The authenticated customer can receive the expired status so the UI can show an explicit renewal-required screen, while all protected business APIs remain blocked.

Every protected tenant request must include company context and a valid tenant bearer session. The global Nest guard validates the session and company membership **before** asking the control plane for subscription state. This prevents unauthenticated or cross-company callers from probing another tenant's commercial status.

After tenant authentication, the guard asks the server-side subscription authority whether access is currently allowed. Expiration is evaluated from the server clock on every request; no scheduler is required for correctness. Expired, suspended or cancelled subscriptions retain their data but cannot execute business operations.

The only subscription-gate bypasses are narrowly defined bootstrap/login/status/recovery control routes. Route matching is exact or boundary-aware so lookalike paths cannot inherit the exemption.

## Plans and entitlements

A plan stores its billing interval, currency, exact price in integer minor units and an entitlement snapshot. Access checks can require a named entitlement server-side. A hidden menu item is never treated as an authorization boundary.

Current Owner Control Center plans may grant `*` while commercial packaging is simple. Future module-specific plans can narrow entitlements without changing the subscription architecture.

## Payments and renewal integrity

SAAS-01 initially supports owner-verified manual payments. Prices use integer minor units, never floating point. Activation and renewal verify:
- active plan;
- whole billing intervals;
- exact expected amount;
- exact currency;
- current subscription version where state changes race.

Each payment has a durable idempotency key and payload hash. In addition, `companyId + provider + payment reference` is unique. This protects against the important case where a client retries the same real-world payment with a newly generated idempotency key after an ambiguous network response. Same evidence cannot extend the subscription twice; conflicting reuse is rejected.

Activation uses a company-scoped PostgreSQL advisory lock. Renewal locks the subscription row and applies optimistic version checking inside a serializable transaction. Payment evidence, subscription state, subscription event and control audit are persisted atomically.

A future online payment provider must verify a signed server-to-server webhook before invoking renewal. Customer-supplied `payment succeeded` flags are never trusted.

## Safe rollout

Companies present before SAAS-01 are backfilled as `INTERNAL` so deployment cannot accidentally lock accepted environments. New companies with no SaaS tenant record fail closed until explicitly activated. Existing INTERNAL tenants can later be converted to paid subscriptions by the platform owner.

Company Code is an identifier, not a secret or a licence key. Knowing it alone never grants access. There is no standalone unauthenticated Company-Code resolution endpoint; resolution occurs inside the credentialed tenant-login flow to minimize metadata exposure.

## Backup / restore security invariant

PostgreSQL physical backup is intentionally **platform-wide**, not tenant-scoped. A tenant administrator cannot invoke it. Company-scoped portability remains the responsibility of Data Exchange and canonical module import/export boundaries.

The platform-wide physical recovery path is owned by `platform-operations` and exposed only through the Owner Control Center. It preserves these invariants:

- a physical backup is always labelled `PLATFORM`; the provider rejects a company ID rather than falsely claiming tenant isolation;
- the archive is PostgreSQL custom format and receives streamed SHA-256 integrity evidence;
- verification checks both checksum and `pg_restore --list`;
- restore is disabled unless explicit deployment switches permit it;
- restore requires external maintenance mode, enforced by the reverse proxy before tenant traffic reaches Nest;
- the configured restore database must be the same environment database; restoring an unrelated target through a live source process is rejected;
- a successful restore revokes all tenant sessions and all platform-owner sessions;
- maintenance remains active after restore until a newly authenticated owner verifies the environment and explicitly exits maintenance;
- physical backup controls are absent from tenant System Administration.

This separation prevents a customer from rolling SaaS commercial truth backward while still providing a complete infrastructure recovery path for the platform owner.

## Threat/control matrix

| Threat | Control |
| --- | --- |
| Change Android/browser code or device clock | Server-owned subscription state and server clock |
| Call business API directly | Global tenant session + membership + subscription gate |
| Company admin grants itself renewal power | Owner identity is outside tenant RBAC |
| Stolen tenant account probes another company | Membership validated before commercial status |
| Guess/steal Owner Control password | scrypt password hash + TOTP MFA + persistent lockout |
| Stolen owner session | Hash-only storage, four-hour expiry, fresh TOTP for sensitive actions |
| Repeat network/payment request | Durable idempotency + payload hash + unique payment evidence |
| Concurrent renewal | Row lock + serializable transaction + subscription version |
| Concurrent first-owner bootstrap | PostgreSQL advisory lock + durable owner-count check |
| Restore data to roll subscription or owner state backward | Physical restore is Owner+MFA only, maintenance-gated, platform-wide, and revokes all sessions; tenant portability has no physical restore authority |
| Tamper with frontend price or duration | Server recomputes expected plan amount/currency/interval |
| Delete history to hide renewal/suspension | Append-only payment/subscription/control events; no delete API |

## Deployment controls

Recommended public separation:
- tenant application: `app.<domain>`
- owner console: `owner.<domain>`
- API: `api.<domain>`

Application controls do not replace infrastructure security. Production still requires TLS, restrictive CORS, WAF/rate limiting, secret injection from a protected secret store, least-privilege database credentials, encrypted backups, dependency/security patching, centralized logs/alerts and infrastructure monitoring.

Never place `SAAS_OWNER_BOOTSTRAP_TOKEN`, `SAAS_OWNER_MFA_KEY`, database credentials, payment-provider signing secrets or raw owner session tokens in source control, frontend code, Android packages, logs, screenshots or customer configuration.

## Owner preview

The Owner Control Center has a source-driven, read-only preview server for visual review. It renders the real `OwnerControlApp` with explicitly labelled non-production demo data and does not call the API or require secrets.

Run:

```bash
pnpm --filter @elhafez/owner-control preview
```

Default address: `http://localhost:4177`. The preview is not an authentication bypass and must never be used as a production data source.
