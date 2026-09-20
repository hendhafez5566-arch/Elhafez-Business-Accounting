# CS-01 — CRM Core

Status: **CS-01 implemented — pending manager review**

CS-01 implements only the five canonical CRM Core owners. Quotations, Customer 360, dashboards, WhatsApp sending, legacy migration, traveler-management, and CS-02/CS-03 remain out of scope.

## Ownership

| Module | Scope | Owned tables | Public ownership |
| --- | --- | --- | --- |
| `party-registry` | Company | `pr_parties`, `pr_party_roles` | Person/organization identity, normalized contact evidence, Party roles, duplicate resolution |
| `agent-management` | Company | `am_agents`, `am_agent_references`, `am_number_counters` | Agent commercial profile, stable number, lifecycle, default commercial commission terms, retention references |
| `customer-management` | Company | `cm_customers`, `cm_customer_references`, `cm_number_counters` | Customer profile/role, stable number, lifecycle, assigned Agent, commercial notes, retention references |
| `crm-leads` | Company + branch | `cl_leads`, `cl_lead_history`, `cl_number_counters` | Lead/opportunity pipeline, loss/reopen history, Customer conversion, opaque quotation reference |
| `crm-followups` | Company + branch | `cf_followups`, `cf_followup_history` | Scheduled CRM work, interaction evidence, due/overdue, completion, cancellation, rescheduling and corrections |

## Public boundaries and dependency DAG

Cross-module calls use only package-root public application services. Production composition adapters translate those public services into module-owned ports. No CRM repository accesses another module's table or repository.

The compile-time direction is acyclic: `platform-core → party-registry → agent-management → customer-management → crm-leads → crm-followups`. `crm-leads` also reads the earlier Agent public boundary. `packages/contracts` remains independent of business modules.

Customer and Agent safe-delete retention is owner-held: consumers register and release opaque references through public commands. Active masters cannot hard-delete. Suspended referenced masters still cannot hard-delete. Owner-local foreign keys protect registered references against deletion races without reverse imports or direct cross-table reads.

## Commands and queries

Party Registry exposes create/update/get/list, company-scoped duplicate resolution, resolve-or-create, and Party role linking. Customer and Agent expose create/update/list/get, suspend/reactivate, safe hard-delete, active-master validation, and opaque retention-reference registration. Agent defaults are commercial terms only.

CRM Leads exposes create/update/list/get/history, explicit CONTACTED and QUALIFIED transitions, `markQuoted(leadId, externalQuotationReference)` for the future CS-02 boundary, lose with mandatory reason, reopen, and idempotent Lead→Customer conversion. No quotation model or quotation screen is implemented.

CRM Follow-ups exposes schedule, due, overdue, list-for-lead, reschedule, complete with outcome and optional next task, cancel, history, and audited completion void/correction. Completed interactions remain persisted historical evidence.

## Lifecycle and duplicate rules

Lead lifecycle is `NEW → CONTACTED → QUALIFIED → QUOTED → WON`, or explicit `LOST` from an open state. LOST requires a reason. Reopen restores the recorded pre-loss state and appends history. A WON lead is not silently reopened.

Party duplicate matching is company-scoped. National/tax identities are normalized strong identifiers protected by company-scoped unique constraints. A single strong match is confident; phone+email converging on one candidate is confident; partial or conflicting contact candidates require review. Contact fields are indexed but are not globally unique.

Lead conversion asks Customer Management to resolve/create from the Lead snapshot. Existing active customers are reused, existing Parties can gain the Customer profile, ambiguous candidates return review-required, suspended customer matches require review, and successful replay returns the already converted Customer ID.

## Authorization and scope

Every CRM application entry point uses Platform Core public authorization/branch-access capabilities. Customers and Agents remain company-wide but are operated from an authorized company/branch context. Leads and Follow-ups are persisted and queried with both company and branch. CRM permission names are exposed by each public module boundary for role configuration; existing Platform Core authorization is not modified or weakened.

## Concurrency and persistence

Stable Agent/Customer numbers use atomic company counters; Lead numbers use atomic company+branch counters. Uniqueness constraints protect stable numbers and Party strong identities. Resolve-or-create catches uniqueness races and re-resolves canonical matches. Lead conversion stores its resulting Customer ID and is replay-safe. Reference registrations use unique source keys.

The migration `20260920200000_cs01_crm_core` is additive and forward-only. No accepted historical migration is edited.

## Financial separation

CRM Core does not own credit limits, receivables, invoices, advances, receipts, settlement truth, or financial commission claims. Agent commission fields are commercial defaults only. Existing Accounting & Finance owners remain unchanged.
