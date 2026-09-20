import { stageSourceCollections } from "./source-registry.js";

/**
 * Stable AC-14 execution order. The collection column is SOURCE discovery
 * only and is derived exclusively from the frozen v32.5.66 registry.
 */
const sources = (stage: string, owner: string) =>
  stageSourceCollections(stage, owner);

export const AC14_STAGES = [
  ["source-preflight", null, []],
  ["currencies", "CurrencyFx", sources("currencies", "CurrencyFx")],
  ["historical-fx-rates", "CurrencyFx", sources("historical-fx-rates", "CurrencyFx")],
  ["cost-centers", "CostBudget", sources("cost-centers", "CostBudget")],
  ["fiscal-years", "PeriodControl", sources("fiscal-years", "PeriodControl")],
  ["accounting-periods", "PeriodControl", sources("accounting-periods", "PeriodControl")],
  ["chart-of-accounts", "GeneralLedger", sources("chart-of-accounts", "GeneralLedger")],
  ["general-ledger-journals", "GeneralLedger", sources("general-ledger-journals", "GeneralLedger")],
  ["tax-history", "Tax", sources("tax-history", "Tax")],
  ["billing-invoices", "Billing", sources("billing-invoices", "Billing")],
  ["billing-adjustments", "Billing", sources("billing-adjustments", "Billing")],
  ["billing-settlements", "Billing", sources("billing-settlements", "Billing")],
  ["treasuries", "Treasury", sources("treasuries", "Treasury")],
  ["treasury-vouchers", "Treasury", sources("treasury-vouchers", "Treasury")],
  ["treasury-transfers", "Treasury", sources("treasury-transfers", "Treasury")],
  ["treasury-cheques", "Treasury", sources("treasury-cheques", "Treasury")],
  ["treasury-reconciliation", "Treasury", sources("treasury-reconciliation", "Treasury")],
  ["party-accounting", "PartyAccounting", sources("party-accounting", "PartyAccounting")],
  ["expenses", "ExpenseRecognition", sources("expenses", "ExpenseRecognition")],
  ["prepayments", "ExpenseRecognition", sources("prepayments", "ExpenseRecognition")],
  ["commissions", "ExpenseRecognition", sources("commissions", "ExpenseRecognition")],
  ["deferred-revenue-cost", "ExpenseRecognition", sources("deferred-revenue-cost", "ExpenseRecognition")],
  ["accruals", "ExpenseRecognition", sources("accruals", "ExpenseRecognition")],
  ["fixed-assets", "AssetsFinancing", sources("fixed-assets", "AssetsFinancing")],
  ["loans", "AssetsFinancing", sources("loans", "AssetsFinancing")],
  ["provisions-allowances", "AssetsFinancing", sources("provisions-allowances", "AssetsFinancing")],
  ["payroll-accounting", "AssetsFinancing", sources("payroll-accounting", "AssetsFinancing")],
  ["budgets", "CostBudget", sources("budgets", "CostBudget")],
  ["procurement", "Procurement", sources("procurement", "Procurement")],
  ["controls-evidence", "FinancialControls", sources("controls-evidence", "FinancialControls")],
  ["tourism-contract-inventory", "TourismContractInventory", sources("tourism-contract-inventory", "TourismContractInventory")],
  ["tourism-finance", "TourismFinance", sources("tourism-finance", "TourismFinance")],
  ["reporting-rebuild", "FinancialReporting", []],
  ["equivalence", null, []],
  ["golden-scenarios", null, []],
  ["cutover-readiness", null, []],
] as const;

export type Ac14Stage = (typeof AC14_STAGES)[number];
