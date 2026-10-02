# PHASE 3 — LEGACY VISUAL MASTER NOTES

These notes translate the available old-system visual evidence into text that Codex can consume from the repository.

## Source availability

Available and reviewed:
- `1000063326.mp4` — approximately 12m10s, 960x540.
- `Elhafez-Tourism-Offline-main.zip` — old UI completeness source.

Referenced by the original scope contracts but not available during this handoff preparation:
- `accounting-system-compressed-full.mp4`.

Therefore do not claim pixel-perfect certification against the missing file. Use these notes plus the screen matrix and current old-UI-derived terminology.

## Global visual language observed in the video

### Overall shell

- RTL desktop application.
- Permanent dark navy sidebar on the **right**.
- Main working canvas is very light/white with soft gray page background.
- Topbar is thin and bright, visually separate from the navy sidebar.
- Sidebar has a brand/company block near the top, grouped navigation beneath it, and user/version area near the bottom.
- Active navigation row is emphasized with a compact highlight/accent; inactive items remain dark-on-navy with pale icons/text.
- Topbar uses compact square/icon controls rather than oversized buttons.
- Workspace/section title is aligned toward the right side of the page content.
- Page title often carries a small pastel icon block beside/near it.

### Main page composition

Common list-page structure visible in Customers, Suppliers, Tourism Services and similar pages:

1. page title/header area at top-right;
2. one or more compact action/filter controls near the header;
3. large white rounded content card;
4. compact toolbar inside the card with search/filter/export controls;
5. data table beneath;
6. empty state appears inside the table/card area rather than as a full-page replacement;
7. the page background remains visible around the white card.

Do not replace this with a generic dashboard unless the old page itself was a dashboard.

### Buttons

- Primary actions are compact dark/navy buttons with rounded corners.
- Secondary/ghost actions are lighter and visually smaller.
- Many pages show one primary add/action button near the title or toolbar rather than a full-width CTA.
- Action buttons inside dialogs are aligned at the bottom-right in RTL order.
- Avoid modern oversized pill buttons unless the old screen shows them.

### Cards / tiles

- White cards with modest radius and subtle border/shadow.
- Dashboard/admin tiles are simple, evenly spaced and icon-led.
- KPI cards use gentle tinted backgrounds and restrained color, not saturated gradients.
- Card density is relatively compact.

### Tables

- Tables sit inside a white card with toolbar/filter row above.
- Headers are compact and light.
- Row density is moderate/compact.
- Empty tables show a small centered empty message/action within the table region.
- CSV/export control is visible on several list pages.

### Modals / dialogs

Observed repeatedly for customer/service/accounting forms:

- Full-page dimmed overlay.
- Large centered white rounded modal.
- Close `×` control at the **top-left** of the modal.
- Title/subtitle area at the **top-right**.
- Small icon beside the modal title.
- Dense multi-row RTL form body.
- Footer actions at the bottom-right.
- Modal width is substantial on desktop, not a narrow phone-like dialog.
- Long forms use grouped sections and/or scrollable body while keeping clear footer actions.

### Forms

- RTL label-above-field pattern.
- Two-column layouts are common on desktop.
- Inputs are compact with light borders and modest radius.
- Selects and date inputs use the same field grid.
- Conditional sections appear inside the same modal rather than navigating to unrelated generic workspaces.
- Required fields use understated markers; avoid excessive visual noise.

### RTL / spacing

- Primary alignment and reading order are right-to-left.
- Labels, titles and form groups must retain RTL order.
- Sidebar remains physically on the right.
- Modal close control remains on the visual left, matching the observed old UI.

---

## First-run / setup evidence

Observed old-system setup screens:

- Blue/dark teal full-page background.
- Large centered white setup card.
- Rounded card with generous horizontal width.
- Small step/progress indicators along the upper portion of the card.
- Forms for administrator/company initialization use clean two-column RTL fields.
- Review/finalization step shows a summary before the main system opens.
- Confirmation/loading modal uses the standard centered white dialog over a dimmed background.

Phase 1 already implements setup/login; only change it if current presentation visibly diverges from this pattern.

---

## Customers visual evidence

Observed in the video:

- Right-side navy sidebar remains visible.
- Page title `العملاء` at top-right with a soft green customer icon/accent.
- Header includes compact actions, not a dashboard takeover.
- Main content is a white rounded card.
- Toolbar includes search/filter controls and CSV/export control.
- Table area uses compact columns and an in-card empty state when no records are present.
- Add customer is a compact primary action.

Observed customer modal:

- Large centered dialog over dim overlay.
- Title at top-right.
- `×` at top-left.
- Dense two-column form with date/select/text fields.
- Action buttons at bottom-right.

Old source theme mapping confirms Customers accent:
- primary: `#08785b`
- soft background: `#e8f7f0`

Do not leave Customers as a generic target card grid if it does not reproduce this list/form composition.

---

## Tourism Services visual evidence

Observed page:

- Title `الخدمات السياحية` with a soft blue service accent.
- Compact header action for adding a service.
- Search/filter toolbar inside a white card.
- Table/list presentation, not a generic analytics dashboard.
- Empty state contained inside the white card.

Observed service modal:

- Large centered white dialog.
- Dense grouped RTL form.
- Date, customer/service selectors and line/operational fields are presented inside one modal flow.
- Footer save/cancel actions at bottom-right.

Legacy source theme mapping:
- Services primary: `#537bc4`
- Services soft background: `#edf3fd`

Dynamic fields must change by service type without abandoning the modal/list visual language.

---

## Suppliers / Procurement visual evidence

Observed Suppliers page:

- Title `الموردون` with warm orange/brown accent.
- Same white-card list/table pattern as Customers.
- Compact search/filter controls.
- Add supplier as a compact primary action.

Observed supplier form:

- Large centered modal with dense two-column RTL fields.
- Standard modal chrome: top-right title, top-left close, bottom-right actions.

Legacy source theme mapping:
- Suppliers primary: `#b75b2a`
- Suppliers soft background: `#fff0e8`
- Purchase Orders use the same warm/orange family in the old navigation theme.

Do not treat a supplier Party-360 route alone as the list/form visual replacement.

---

## Accounting visual evidence

The video shows several accounting forms directly and demonstrates that the old system used independent screen/form identities rather than one generic accounting workspace.

### Receipt voucher

Observed modal resembles `سند قبض`:
- large centered dialog;
- amount/party/treasury/payment method/date/reference style fields;
- two-column RTL layout;
- bottom-right save/cancel actions;
- page shell remains visible behind dim overlay.

Old source theme mapping:
- Receipts primary: `#08785b`
- soft background: `#e8f7f0`

### Payment voucher

Observed modal resembles `سند صرف`:
- same dialog composition;
- red expense/payment visual family;
- party/amount/treasury/payment method/reference/date fields.

Old source theme mapping:
- Payments primary: `#b42318`
- soft background: `#fdeceb`

### Expenses

Old navigation theme:
- primary: `#b42318`
- soft background: `#fdeceb`

### Invoices

Old navigation theme:
- primary: `#2869a9`
- soft background: `#eaf3fd`

### Cheques

Old navigation theme:
- primary: `#7b5a2e`
- soft background: `#fff5dd`

### Journal

Old navigation theme:
- primary: `#435b78`
- soft background: `#edf1f6`

### Accounts

Old navigation theme:
- primary: `#355c8a`
- soft background: `#eaf3fd`

### Trial balance

Old navigation theme:
- primary: `#7555b7`
- soft background: `#f1ecfb`

### Cost centers

Old navigation theme:
- primary: `#2d7f78`
- soft background: `#e8f7f3`

### Treasury

Old navigation theme:
- primary: `#08785b`
- soft background: `#e8f7f0`

### Currencies

Old navigation theme:
- primary: `#b98221`
- soft background: `#fff5dd`

### Taxes

Old navigation theme:
- primary: `#7b5a2e`
- soft background: `#fff5dd`

### Periods

Old navigation theme:
- primary: `#58657a`
- soft background: `#edf1f6`

Critical implementation note:

The existing Phase 2 `AccountingLegacyRoutePage -> AccountingWorkspaceView` adapter is architecture-safe but **not enough visually**. Each legacy-visible accounting route must be allowed to have a route-specific presentation while still consuming the same target accounting clients/contracts.

---

## Administration / Settings visual evidence

Observed Administration landing:

- Title `الإدارة والإعدادات`.
- White/light page with a grid of simple square/rectangular tiles.
- Each tile has a small icon and Arabic label.
- Tiles are restrained and uniform, not a complex analytics dashboard.
- Navy right sidebar remains visible.

Observed Settings page:

- Title `الإعدادات`.
- White content card with tab-like/section controls.
- Company information form shown in a clean field grid.
- Uses the same compact inputs and light borders as other forms.

Observed Owner/management page:

- KPI cards across the top.
- Mixed success/warning/neutral soft backgrounds.
- Lists and operational sections beneath.
- Avoid excessive chart-heavy redesign if the old screen presents cards/lists instead.

Old navigation theme mappings:
- Users: `#7555b7` / `#f1ecfb`
- Owner/Work Center: `#176b57` / `#e8f7f0`
- Branches: `#2c78c7` / `#eaf3fd`
- Sessions: `#7555b7` / `#f1ecfb`
- Data Exchange: `#2d7f78` / `#e8f7f3`
- Support: `#52647a` / `#edf1f6`
- Market Readiness: `#176b57` / `#e8f7f0`
- Quick Guide: `#2869a9` / `#eaf3fd`
- Settings: `#59677a` / `#edf1f6`

---

## Reports / Control theme evidence

Old navigation theme mappings:
- Reports: `#2869a9` / `#eaf3fd`
- Approvals: `#b76b00` / `#fff4df`
- Audit: `#b42318` / `#fdeceb`
- Activity: `#52647a` / `#edf1f6`
- Work Center / Owner: `#176b57` / `#e8f7f0`

The old experience is primarily cards, lists, filters, tables and expandable work groups. Do not turn every route into an unrelated dashboard.

---

## Print presentation evidence from old UI source

The old print layer includes:
- company logo/name block;
- address/phone/tax/commercial identifiers when configured;
- document title and issue date;
- structured metadata block;
- print tables;
- total/financial status blocks;
- signature areas such as accountant/reviewer/approval;
- footer;
- amount-in-words support;
- edit-print-description UI for some documents;
- WhatsApp PDF sharing where supported.

Target global print shell already exists from Phase 1. Reuse it; do not copy old print engine logic. Route-specific print presentation should feed the shared target print shell.

---

## Legacy source file map verified from the uploaded ZIP

### Core UI
- `src/ui/actions.ts`
- `src/ui/clean-pages.ts`
- `src/ui/commercial-ux.ts`
- `src/ui/data-table.ts`
- `src/ui/delegated-actions.ts`
- `src/ui/forms-definitions.ts`
- `src/ui/forms.ts`
- `src/ui/navigation.ts`
- `src/ui/pages.ts`
- `src/ui/ui.ts`
- `src/ui/work-center.ts`

### CRM / party
- `src/crm/crm.ts`
- `src/crm/party360.ts`
- `src/crm/purchase-order-fulfillment.ts`
- `src/crm/unified-party.ts`

### Hajj / Umrah
- `src/core/umrah/actions-print.ts`
- `src/core/umrah/booking-rooms.ts`
- `src/core/umrah/contracts-inventory.ts`
- `src/core/umrah/contracts-management.ts`
- `src/core/umrah/contracts.ts`
- `src/core/umrah/data.ts`
- `src/core/umrah/forms-contracts.ts`
- `src/core/umrah/forms.ts`
- `src/core/umrah/guided.ts`
- `src/core/umrah/insights.ts`
- `src/core/umrah/integration.ts`
- `src/core/umrah/operations-execution.ts`
- `src/core/umrah/operations.ts`
- `src/core/umrah/procurement.ts`
- `src/core/umrah/program-wizard-view.ts`
- `src/core/umrah/program-wizard.ts`
- `src/core/umrah/runtime.ts`
- `src/core/umrah/ui-pages.ts`
- `src/core/umrah/ui.ts`
- `src/core/umrah/workflow.ts`

### Accounting
- `src/accounting/advanced-pages.ts`
- `src/accounting/advanced.ts`
- `src/accounting/currency-periods.ts`
- `src/accounting/engine.ts`
- `src/accounting/expense-categories.ts`
- `src/accounting/invoices.ts`
- `src/accounting/terms.ts`
- `src/accounting/transactions.ts`

### Commercial / Admin
- `src/commercial/actions.ts`
- `src/commercial/data-exchange.ts`
- `src/commercial/pages.ts`
- `src/commercial/product.ts`
- `src/commercial/vendor-owner.ts`

### Documents / reports / finance
- `src/documents/attachments-backup.ts`
- `src/documents/output-center.ts`
- `src/finance/insights.ts`
- `src/reports/printing.ts`
- `src/integrated/service-inventory.ts`

These paths are informational references extracted from the legacy ZIP. The old code itself is not present in this target repository and must not be reconstructed as a second architecture.

---

## Old UI route accent map extracted from legacy navigation

Use these as reference accents, not as an excuse to add a parallel theme system:

- Dashboard: `#c9972f` / `#fff7e6`
- CRM: `#7555b7` / `#f1ecfb`
- Quotations: `#2869a9` / `#eaf3fd`
- Purchase Orders: `#b75b2a` / `#fff0e8`
- Programs: `#b98221` / `#fff5dd`
- Bookings: `#2c78c7` / `#eaf3fd`
- Services: `#537bc4` / `#edf3fd`
- Customers: `#08785b` / `#e8f7f0`
- Suppliers: `#b75b2a` / `#fff0e8`
- Agents: `#7555b7` / `#f1ecfb`
- Expenses: `#b42318` / `#fdeceb`
- Receipts: `#08785b` / `#e8f7f0`
- Payments: `#b42318` / `#fdeceb`
- Cheques: `#7b5a2e` / `#fff5dd`
- Invoices: `#2869a9` / `#eaf3fd`
- Journal: `#435b78` / `#edf1f6`
- Documents: `#59677a` / `#edf1f6`
- Accounts: `#355c8a` / `#eaf3fd`
- Trial: `#7555b7` / `#f1ecfb`
- Cost Centers: `#2d7f78` / `#e8f7f3`
- Treasury: `#08785b` / `#e8f7f0`
- Currencies: `#b98221` / `#fff5dd`
- Taxes: `#7b5a2e` / `#fff5dd`
- Periods: `#58657a` / `#edf1f6`
- Reports: `#2869a9` / `#eaf3fd`
- Approvals: `#b76b00` / `#fff4df`
- Audit: `#b42318` / `#fdeceb`
- Activity: `#52647a` / `#edf1f6`
- Work Center: `#176b57` / `#e8f7f0`
- Users: `#7555b7` / `#f1ecfb`
- Owner: `#176b57` / `#e8f7f0`
- Branches: `#2c78c7` / `#eaf3fd`
- Sessions: `#7555b7` / `#f1ecfb`
- Data Exchange: `#2d7f78` / `#e8f7f3`
- Support: `#52647a` / `#edf1f6`
- Market Readiness: `#176b57` / `#e8f7f0`
- Quick Guide: `#2869a9` / `#eaf3fd`
- Settings: `#59677a` / `#edf1f6`

---

## Final warning to executor

The major failure mode to avoid is this:

> preserve the current target page unchanged, add an old route/label around it, write a regression test for the route, and call it migrated.

That is exactly what Phase 3 exists to correct.

Use current target APIs and owners, but rebuild the visible route-owned presentation where the old and current screens differ.