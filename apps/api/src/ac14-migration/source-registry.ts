import type { MigrationIssueCode } from "@elhafez/platform-core";

export type SourceProcessingStrategy =
  | "DIRECT"
  | "TAX_CODE"
  | "BILLING_ALLOCATIONS"
  | "PREPAID_SCHEDULE"
  | "DEFERRED_REVENUE"
  | "DEFERRED_COST"
  | "ACCRUED_REVENUE"
  | "FIXED_ASSET"
  | "ASSET_DEPRECIATION"
  | "LOAN"
  | "LOAN_INSTALLMENT"
  | "PROVISION"
  | "ALLOWANCE"
  | "PAYROLL_RUN"
  | "BUDGET"
  | "PARTY_GROUP"
  | "PARTY_NETTING"
  | "BANK_RECONCILIATION"
  | "UMRAH_CONTRACT"
  | "UMRAH_RESERVATION"
  | "UMRAH_SUPPLIER_COMMITMENT";

export type SourceDisposition = "PROCESS" | "CLASSIFY";

export interface FrozenSourceRegistration {
  readonly sourceCollection: string;
  readonly stage: string;
  readonly owner: string | null;
  readonly targetKind: string | null;
  readonly importKind: string | null;
  readonly disposition: SourceDisposition;
  readonly strategy?: SourceProcessingStrategy;
  readonly issueCode?: Extract<MigrationIssueCode, "AMBIGUOUS_LEGACY_SEMANTICS" | "UNSUPPORTED_LEGACY_CONSTRUCT">;
  readonly detail?: string;
}

const process = (
  sourceCollection: string,
  stage: string,
  owner: string,
  targetKind: string,
  importKind: string,
  strategy: SourceProcessingStrategy = "DIRECT",
): FrozenSourceRegistration => ({
  sourceCollection, stage, owner, targetKind, importKind, disposition: "PROCESS", strategy,
});

const classify = (
  sourceCollection: string,
  stage: string,
  issueCode: "AMBIGUOUS_LEGACY_SEMANTICS" | "UNSUPPORTED_LEGACY_CONSTRUCT",
  detail: string,
): FrozenSourceRegistration => ({
  sourceCollection, stage, owner: null, targetKind: null, importKind: null,
  disposition: "CLASSIFY", issueCode, detail,
});

/**
 * AC-14 frozen v32.5.66 source registry.
 * sourceCollection is always the original legacy key. targetKind is crosswalk
 * semantics; importKind is only the vocabulary of the target owner's import API.
 */
export const AC14_FROZEN_SOURCE_REGISTRY: readonly FrozenSourceRegistration[] = [
  process("currencies", "currencies", "CurrencyFx", "currency", "currencies"),
  process("fxRates", "historical-fx-rates", "CurrencyFx", "fx-rate", "fxRates"),
  process("costCenters", "cost-centers", "CostBudget", "cost-center", "costCenters"),
  process("fiscalYears", "fiscal-years", "PeriodControl", "fiscal-year", "fiscalYears"),
  process("periods", "accounting-periods", "PeriodControl", "period", "periods"),
  process("accounts", "chart-of-accounts", "GeneralLedger", "account", "accounts"),
  process("journals", "general-ledger-journals", "GeneralLedger", "journal", "journals"),
  process("taxCodes", "tax-history", "Tax", "historical-tax-representation", "taxFacts", "TAX_CODE"),

  process("invoices", "billing-invoices", "Billing", "invoice", "invoices"),
  process("invoiceAdjustments", "billing-adjustments", "Billing", "adjustment", "invoiceAdjustments"),
  process("receipts", "billing-settlements", "Billing", "allocation-set", "allocations", "BILLING_ALLOCATIONS"),
  process("payments", "billing-settlements", "Billing", "allocation-set", "allocations", "BILLING_ALLOCATIONS"),

  process("treasuries", "treasuries", "Treasury", "treasury", "treasuries"),
  process("receipts", "treasury-vouchers", "Treasury", "receipt-voucher", "receipts"),
  process("payments", "treasury-vouchers", "Treasury", "payment-voucher", "payments"),
  process("transfers", "treasury-transfers", "Treasury", "transfer", "transfers"),
  process("cheques", "treasury-cheques", "Treasury", "cheque", "cheques"),
  process("cashCounts", "treasury-reconciliation", "Treasury", "cash-count", "cashCounts"),
  process("bankStatementLines", "treasury-reconciliation", "Treasury", "bank-statement-line", "bankStatementLines"),
  process("bankMatches", "treasury-reconciliation", "Treasury", "bank-match", "bankMatches"),

  process("partyGroups", "party-accounting", "PartyAccounting", "party-group", "partyGroups", "PARTY_GROUP"),
  process("partyNettings", "party-accounting", "PartyAccounting", "netting", "nettings", "PARTY_NETTING"),

  process("expenses", "expenses", "ExpenseRecognition", "expense", "expenses"),
  process("prepaidSchedules", "prepayments", "ExpenseRecognition", "prepayment", "prepayments", "PREPAID_SCHEDULE"),
  process("commissions", "commissions", "ExpenseRecognition", "commission", "commissions"),
  process("deferredRevenueSchedules", "deferred-revenue-cost", "ExpenseRecognition", "deferred-revenue", "deferredRevenue", "DEFERRED_REVENUE"),
  process("deferredCostSchedules", "deferred-revenue-cost", "ExpenseRecognition", "deferred-cost", "deferredCost", "DEFERRED_COST"),
  process("accruedRevenues", "accruals", "ExpenseRecognition", "accrual", "accruals", "ACCRUED_REVENUE"),

  process("fixedAssets", "fixed-assets", "AssetsFinancing", "asset", "assets", "FIXED_ASSET"),
  process("assetDepreciations", "fixed-assets", "AssetsFinancing", "depreciation-event", "depreciationEvents", "ASSET_DEPRECIATION"),
  process("loans", "loans", "AssetsFinancing", "loan", "loans", "LOAN"),
  process("loanSchedules", "loans", "AssetsFinancing", "loan-installment", "loanInstallments", "LOAN_INSTALLMENT"),
  process("provisions", "provisions-allowances", "AssetsFinancing", "provision", "provisions", "PROVISION"),
  process("doubtfulAllowances", "provisions-allowances", "AssetsFinancing", "allowance", "allowances", "ALLOWANCE"),
  process("payrollRuns", "payroll-accounting", "AssetsFinancing", "payroll-accounting", "payrollAccounting", "PAYROLL_RUN"),

  process("accountBudgets", "budgets", "CostBudget", "budget", "budgets", "BUDGET"),
  process("purchaseOrders", "procurement", "Procurement", "purchase-order", "purchaseOrders"),
  process("approvals", "controls-evidence", "FinancialControls", "approval", "approvals"),
  process("bankReconciliations", "controls-evidence", "FinancialControls", "bank-reconciliation", "reconciliations", "BANK_RECONCILIATION"),

  process("umrahHotelContracts", "tourism-contract-inventory", "TourismContractInventory", "hotel-contract", "tourismContracts", "UMRAH_CONTRACT"),
  process("umrahFlightBlocks", "tourism-contract-inventory", "TourismContractInventory", "flight-contract", "tourismContracts", "UMRAH_CONTRACT"),
  process("umrahTransportContracts", "tourism-contract-inventory", "TourismContractInventory", "transport-contract", "tourismContracts", "UMRAH_CONTRACT"),
  process("umrahVisaContracts", "tourism-contract-inventory", "TourismContractInventory", "visa-contract", "tourismContracts", "UMRAH_CONTRACT"),
  process("umrahServiceContracts", "tourism-contract-inventory", "TourismContractInventory", "service-contract", "tourismContracts", "UMRAH_CONTRACT"),
  process("umrahContractReservations", "tourism-contract-inventory", "TourismContractInventory", "historical-allocation", "inventoryAllocations", "UMRAH_RESERVATION"),
  process("umrahSupplierCommitments", "procurement", "Procurement", "supplier-commitment", "supplierCommitments", "UMRAH_SUPPLIER_COMMITMENT"),

  classify("programs", "tourism-finance", "AMBIGUOUS_LEGACY_SEMANTICS", "generic legacy programs cannot be restored through accounting without recreating operational state"),
  classify("bookings", "tourism-finance", "AMBIGUOUS_LEGACY_SEMANTICS", "generic legacy bookings require an explicit operational migration boundary"),
  classify("services", "tourism-finance", "AMBIGUOUS_LEGACY_SEMANTICS", "generic legacy services require an explicit operational migration boundary"),
  classify("commissionRules", "commissions", "UNSUPPORTED_LEGACY_CONSTRUCT", "legacy commission rule master data has no canonical AC-14 historical owner model"),
  classify("manualJournalDrafts", "general-ledger-journals", "UNSUPPORTED_LEGACY_CONSTRUCT", "unposted manual journal drafts are not canonical posted GL history"),
  classify("recurringJournals", "general-ledger-journals", "UNSUPPORTED_LEGACY_CONSTRUCT", "recurring journal definitions have no canonical AC-14 historical owner model"),
  classify("fxRevaluations", "historical-fx-rates", "AMBIGUOUS_LEGACY_SEMANTICS", "legacy FX revaluation runs overlap posted journal history and must not be reposted"),
  classify("supplierSettlements", "billing-settlements", "AMBIGUOUS_LEGACY_SEMANTICS", "supplier settlements contain non-cash adjustment semantics already represented independently in GL"),
  classify("customerSettlements", "billing-settlements", "AMBIGUOUS_LEGACY_SEMANTICS", "customer settlements include write-off, cancellation and allowance semantics already represented independently in GL"),
  classify("openingBalanceBatches", "general-ledger-journals", "AMBIGUOUS_LEGACY_SEMANTICS", "opening-balance batch metadata overlaps independently restored posted journals"),

  classify("umrahSeasons", "tourism-finance", "UNSUPPORTED_LEGACY_CONSTRUCT", "season master state belongs to operational tourism migration"),
  classify("umrahPrograms", "tourism-finance", "AMBIGUOUS_LEGACY_SEMANTICS", "program state must not be recreated as a financial workflow"),
  classify("umrahProgramSegments", "tourism-finance", "UNSUPPORTED_LEGACY_CONSTRUCT", "program itinerary segments have no accounting canonical owner state"),
  classify("umrahProgramCosts", "tourism-finance", "AMBIGUOUS_LEGACY_SEMANTICS", "program cost planning cannot be replayed without risking duplicate Cost or Procurement effects"),
  classify("umrahBookings", "tourism-finance", "AMBIGUOUS_LEGACY_SEMANTICS", "booking state must not be recreated during accounting migration"),
  classify("umrahTravelers", "tourism-finance", "UNSUPPORTED_LEGACY_CONSTRUCT", "traveler operational state is outside accounting canonical state"),
  classify("umrahHotelRooms", "tourism-contract-inventory", "AMBIGUOUS_LEGACY_SEMANTICS", "room assignment state may overlap contract reservations and cannot be inferred as a second capacity consumption"),
  classify("umrahVisaBatches", "tourism-contract-inventory", "AMBIGUOUS_LEGACY_SEMANTICS", "visa batch operations must not be recreated as capacity consumption"),
  classify("umrahVisaItems", "tourism-contract-inventory", "UNSUPPORTED_LEGACY_CONSTRUCT", "visa item operational state has no standalone accounting canonical representation"),
  classify("umrahTickets", "tourism-contract-inventory", "AMBIGUOUS_LEGACY_SEMANTICS", "ticket issuance state must not create a second inventory or financial effect"),
  classify("umrahBusRuns", "tourism-contract-inventory", "AMBIGUOUS_LEGACY_SEMANTICS", "bus execution state must not create a second transport capacity effect"),
  classify("umrahOperationTasks", "tourism-finance", "UNSUPPORTED_LEGACY_CONSTRUCT", "operation tasks are operational workflow state"),
  classify("umrahIncidents", "tourism-finance", "UNSUPPORTED_LEGACY_CONSTRUCT", "operation incidents are operational workflow state"),
] as const;

export const AC14_KNOWN_FROZEN_COLLECTIONS = [
  "currencies","fxRates","accounts","taxCodes","costCenters","treasuries","purchaseOrders",
  "programs","bookings","services","invoices","invoiceAdjustments","receipts","payments","cheques",
  "expenses","prepaidSchedules","commissions","commissionRules","manualJournalDrafts","recurringJournals",
  "journals","transfers","cashCounts","bankReconciliations","bankStatementLines","bankMatches",
  "fxRevaluations","supplierSettlements","customerSettlements","partyGroups","partyNettings",
  "deferredRevenueSchedules","deferredCostSchedules","accruedRevenues","fixedAssets",
  "assetDepreciations","loans","loanSchedules","provisions","doubtfulAllowances","payrollRuns",
  "accountBudgets","openingBalanceBatches","approvals","fiscalYears","periods",
  "umrahSeasons","umrahHotelContracts","umrahFlightBlocks","umrahTransportContracts",
  "umrahVisaContracts","umrahServiceContracts","umrahContractReservations","umrahPrograms","umrahProgramSegments",
  "umrahProgramCosts","umrahBookings","umrahTravelers","umrahHotelRooms","umrahVisaBatches",
  "umrahVisaItems","umrahTickets","umrahBusRuns","umrahOperationTasks","umrahIncidents",
  "umrahSupplierCommitments",
] as const;

export const registrationsForSource = (sourceCollection: string) =>
  AC14_FROZEN_SOURCE_REGISTRY.filter((entry) => entry.sourceCollection === sourceCollection);

export const processingRegistration = (stage: string, owner: string, sourceCollection: string) =>
  AC14_FROZEN_SOURCE_REGISTRY.find((entry) =>
    entry.disposition === "PROCESS" && entry.stage === stage &&
    entry.owner === owner && entry.sourceCollection === sourceCollection);

export const stageSourceCollections = (stage: string, owner: string) =>
  [...new Set(AC14_FROZEN_SOURCE_REGISTRY
    .filter((entry) => entry.disposition === "PROCESS" && entry.stage === stage && entry.owner === owner)
    .map((entry) => entry.sourceCollection))] as readonly string[];

export const registrationAppliesToRecord = (
  registration: FrozenSourceRegistration,
  record: Readonly<Record<string, unknown>>,
): boolean => registration.strategy !== "BILLING_ALLOCATIONS" ||
  (Array.isArray(record.allocations) && record.allocations.length > 0);

export interface SourceCoverageFinding {
  readonly sourceCollection: string;
  readonly state: "EMPTY" | "MAPPED" | "CLASSIFIED" | "MALFORMED" | "UNMAPPED";
  readonly issueCode?: MigrationIssueCode;
  readonly stage?: string;
  readonly detail?: string;
}

export const inspectFrozenSourceCoverage = (
  root: Readonly<Record<string, unknown>>,
  knownCollections: readonly string[] = AC14_KNOWN_FROZEN_COLLECTIONS,
  registry: readonly FrozenSourceRegistration[] = AC14_FROZEN_SOURCE_REGISTRY,
): readonly SourceCoverageFinding[] => knownCollections.map((sourceCollection) => {
  const value = root[sourceCollection];
  if (value === undefined || (Array.isArray(value) && value.length === 0))
    return { sourceCollection, state: "EMPTY" };
  const entries = registry.filter((entry) => entry.sourceCollection === sourceCollection);
  if (!Array.isArray(value)) return {
    sourceCollection, state: "MALFORMED", issueCode: "UNKNOWN_COLLECTION_SHAPE",
    stage: entries[0]?.stage ?? "source-preflight",
    detail: "known frozen source collection must be an array",
  };
  if (!entries.length) return {
    sourceCollection, state: "UNMAPPED", issueCode: "UNSUPPORTED_LEGACY_CONSTRUCT",
    stage: "source-preflight",
    detail: "known non-empty frozen source collection has no mapping or disposition",
  };
  if (entries.some((entry) => entry.disposition === "PROCESS"))
    return { sourceCollection, state: "MAPPED" };
  const classified = entries[0]!;
  return {
    sourceCollection, state: "CLASSIFIED",
    issueCode: classified.issueCode ?? "UNSUPPORTED_LEGACY_CONSTRUCT",
    stage: classified.stage, detail: classified.detail,
  };
});
