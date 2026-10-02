# Phase 02 — Batch B Recovery

Base for Phase 2: `52d1af320bf369572802800497d83cbba6791910`.

## Hajj / Umrah

Recovered the legacy-visible operating dashboard over the accepted Hajj/Umrah program and operations contracts. The four guided entry actions route to the existing canonical program, booking and readiness owners; no second program/booking CRUD implementation was created.

Canonical owners retained:
- seasons / programs / program workspace: `hajj-umrah-pages.tsx`
- bookings / rooming / visas: `hajj-umrah-operations-primary-pages.tsx`
- ticketing / transport / trip operations: `hajj-umrah-operations-secondary-pages.tsx`
- readiness / program 360 / booking 360 / safe closure: `hajj-umrah-readiness-page.tsx`
- contract/inventory integration: existing target contract inventory owner

Donor history inspected: UI-09, UI-13, UI-14, UI-15, UI-16. UI-13..16 are preferred because they preserve canonical owners in place and remove the old hidden `/manage` pattern.

## Accounting / Finance

PR #105 (`feat/accounting-legacy-parity`) is already merged in the ancestry and remains the financial contract source. The current accepted `AccountingWorkspaceView` is reused by a route adapter so legacy-visible finance entry routes open the correct canonical section without duplicating GL, Billing, Treasury, FX, Tax, Period, Asset or Budget logic.

Recovered entry routes cover invoices, receipts, payments, expenses, settlements, accruals, cheques, treasury, currencies, taxes, periods, journal, accounts, trial balance, cost centers, assets, loans and budgets.

## BLOCKED-BY-BACKEND

1. **Hajj/Umrah settings parity** — the current target Hajj/Umrah client/contracts expose no settings owner for legacy fields such as hold hours, warning hours, passport validity months, default margin, financial-clearance requirement and maximum due. No localStorage or fake settings persistence was added. Required contract: canonical Hajj/Umrah operating-settings read/update API with permission ownership.
2. **Full legacy Program Wizard commercial/supply step** — target `ProgramInput` owns program identity, dates, capacity, currency, prices, requirements and components, but does not own the legacy supplier-contract/cost/margin commitments as writable program fields. Those values must remain with canonical supply/procurement/accounting owners. No duplicate financial/supply state was embedded into Program UI.
3. **Legacy invoice Draft -> Post lifecycle** — the current canonical accounting client exposes invoice creation/cancellation through the accepted Billing owner but does not expose a UI-safe draft/post contract equivalent to the old lifecycle. No fake draft state was created in the route adapter.

These blockers do not weaken the existing target operations; they identify only legacy-visible behavior that cannot be persisted faithfully through a current canonical contract.
