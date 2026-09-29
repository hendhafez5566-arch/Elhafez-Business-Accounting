# Procurement + Tourism Literal Workflow Audit

This audit is evidence for `PROCUREMENT-TOURISM-LEGACY-PARITY-EXECUTION.md`. OLD remains functional/UI/UX reference only; no legacy implementation code is transferred.

## Tourism program readiness evidence from OLD

Reviewed `hendhafez5566-arch/Elhafez-Tourism-Offline/src/core/umrah/workflow.ts` literally.

The legacy workflow treated package requirements as configurable capabilities rather than one monolithic program form. The relevant requirement families were hotel, flight, transport, visa, meal, visit, guide, Rawda, insurance, health, camp and permit. Hajj defaulted camp/permit on; older records were normalized non-destructively.

Program operational metadata also included an operations manager, group leader, guide contacts and a customer cancellation policy. These are parity requirements to map against NEW canonical program/operations owners before any schema change.

### Readiness and guarded sales opening

OLD blocked or warned program opening when required package components were incomplete. Literal checks included:

- required service segment exists;
- outbound and return flight coverage aligns with program dates;
- hotel nights equal the program duration;
- hotel bed capacity covers program capacity;
- flight seats cover program capacity;
- transport capacity covers program capacity;
- a treasury/account exists for the program currency;
- financial setup is complete.

These are workflow semantics, not instructions to recreate OLD persistence. In NEW they must be implemented only where missing, using `tourism-programs`, `tourism-contract-inventory`, Billing/Treasury and finance orchestration public APIs/read models.

### Operational task/readiness model

OLD generated operational checkpoints around contracts, pricing, visa, tickets, rooming, transport, permits, camps, health, finance and final manifest. Completion could be derived from canonical operational evidence (for example issued visa, traveler flight readiness, room assignment, transport assignment and financial readiness) and reverted if the underlying readiness ceased to be true.

This is important parity behavior: NEW should expose equivalent readiness/exception visibility without copying OLD task storage or creating a competing workflow owner.

### Traveler readiness

The legacy readiness score considered identity/name and passport validity plus only those package capabilities configured as required. Conditional checks included visa, ticket, hotel rooming, transport, permit, camp and health clearance.

NEW mapping must continue to use `traveler-management` for traveler/passport truth and dedicated tourism owners for booking/itinerary/allocation evidence. No traveler snapshot or duplicate passport truth should be introduced in program UI state.

### Procurement / finance boundary evidence

OLD bundled service setup could associate a supplier and cost/procurement policy, but the NEW implementation must not reproduce that coupling. Supplier selection belongs to Supplier Management identities, contract/allotment capacity to `tourism-contract-inventory`, supplier commitment/procurement to canonical procurement owners, and payable/payment/accounting truth to Billing/Treasury/Accounting.

## Decisions for the NEW audit

1. Treat configurable program requirements and readiness blockers as parity requirements; first inventory existing NEW behavior before adding anything.
2. Treat operations team/cancellation-policy fields as candidate program metadata only after verifying canonical ownership and existing fields.
3. Treat capacity/date readiness as cross-owner composition. Do not direct-read another module's database.
4. Treat treasury and financial setup checks as finance-owner reads/orchestration, never program-owned financial truth.
5. Do not reproduce automatic mutable task storage if NEW already has an operations/readiness owner; compose existing evidence instead.
6. Preserve guarded lifecycle transitions. Do not make hard deletion a substitute for closing/cancelling programs or bookings.

## Remaining literal extraction

Still review the focused OLD `forms.ts`, `ui-pages.ts`, `operations.ts`, supplier/party browser smoke and Umrah workflow smoke sections that are not yet represented in the execution checkpoint. Then compare each page/action/state against NEW before implementing missing behavior.
