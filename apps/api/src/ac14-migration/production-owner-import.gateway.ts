import { Inject, Injectable } from "@nestjs/common";
import {
  branchId,
  companyId,
  currencyCode,
  decimalAmount,
  sourceReference,
} from "@elhafez/contracts";
import { HistoricalImportApplicationService as CurrencyFxHistorical } from "@elhafez/currency-fx";
import { HistoricalImportApplicationService as CostHistorical } from "@elhafez/cost-budget-accounting";
import { HistoricalImportApplicationService as PeriodHistorical } from "@elhafez/period-control";
import { HistoricalImportApplicationService as GlHistorical } from "@elhafez/general-ledger";
import { HistoricalImportApplicationService as TaxHistorical } from "@elhafez/tax";
import { HistoricalImportApplicationService as BillingHistorical } from "@elhafez/billing-subledgers";
import { HistoricalImportApplicationService as TreasuryHistorical } from "@elhafez/treasury-settlement";
import { HistoricalImportApplicationService as PartyHistorical } from "@elhafez/party-accounting";
import { HistoricalImportApplicationService as EcrHistorical } from "@elhafez/expense-commission-recognition";
import { HistoricalImportApplicationService as AssetsHistorical } from "@elhafez/assets-financing";
import { HistoricalImportApplicationService as ProcurementHistorical } from "@elhafez/procurement-finance";
import { HistoricalImportApplicationService as ControlsHistorical } from "@elhafez/financial-controls";
import { HistoricalImportApplicationService as InventoryHistorical } from "@elhafez/tourism-contract-inventory";
import { HistoricalImportApplicationService as TourismHistorical } from "@elhafez/tourism-finance-orchestration";
import {
  FinancialReportingApplicationService,
  type AccountClass,
  type PositionKind,
  type ReportingEvidence,
} from "@elhafez/financial-reporting";
import type { MigrationConfig } from "@elhafez/platform-core";
import type {
  Ac14OwnerImportGateway,
  HistoricalImportUnit,
} from "./owner-import.gateway.js";

type CanonicalRecord = {
  collection: string;
  sourceId: string;
  companyId: string;
  branchId?: string;
  payload: Readonly<Record<string, unknown>>;
};
type OwnerBoundary = Pick<
  CurrencyFxHistorical,
  "validate" | "importHistorical" | "equivalence"
> & {
  canonicalRecords?: (
    runId: string,
    companyId: string,
  ) => Promise<readonly CanonicalRecord[]>;
};

/** Production composition adapter. Every write is delegated to the named owner's public historical API. */
@Injectable()
export class ProductionAc14OwnerImportGateway implements Ac14OwnerImportGateway {
  private readonly boundaries: ReadonlyMap<string, OwnerBoundary>;
  constructor(
    @Inject(CurrencyFxHistorical) currencyFx: CurrencyFxHistorical,
    @Inject(CostHistorical) cost: CostHistorical,
    @Inject(PeriodHistorical) period: PeriodHistorical,
    @Inject(GlHistorical) gl: GlHistorical,
    @Inject(TaxHistorical) tax: TaxHistorical,
    @Inject(BillingHistorical) billing: BillingHistorical,
    @Inject(TreasuryHistorical) treasury: TreasuryHistorical,
    @Inject(PartyHistorical) party: PartyHistorical,
    @Inject(EcrHistorical) ecr: EcrHistorical,
    @Inject(AssetsHistorical) assets: AssetsHistorical,
    @Inject(ProcurementHistorical) procurement: ProcurementHistorical,
    @Inject(ControlsHistorical) controls: ControlsHistorical,
    @Inject(InventoryHistorical) inventory: InventoryHistorical,
    @Inject(TourismHistorical) tourism: TourismHistorical,
    @Inject(FinancialReportingApplicationService)
    private readonly reporting: FinancialReportingApplicationService,
  ) {
    this.boundaries = new Map<string, OwnerBoundary>([
      ["CurrencyFx", currencyFx],
      ["CostBudget", cost],
      ["PeriodControl", period],
      ["GeneralLedger", gl],
      ["Tax", tax],
      ["Billing", billing],
      ["Treasury", treasury],
      ["PartyAccounting", party],
      ["ExpenseRecognition", ecr],
      ["AssetsFinancing", assets],
      ["Procurement", procurement],
      ["FinancialControls", controls],
      ["TourismContractInventory", inventory],
      ["TourismFinance", tourism],
    ]);
  }
  validateUnit(unit: HistoricalImportUnit): void {
    const boundary = this.boundary(unit.owner);
    for (const command of this.commands(unit)) boundary.validate(command);
  }
  async importUnit(unit: HistoricalImportUnit) {
    const boundary = this.boundary(unit.owner);
    const commands = this.commands(unit);
    let imported = false;
    let targetId = unit.sourceId;
    for (const command of commands) {
      const result = await boundary.importHistorical(command);
      imported ||= result.status === "IMPORTED";
      targetId = result.targetId;
    }
    return {
      status: imported ? "IMPORTED" : "CONVERGED",
      targetKind: unit.targetKind,
      targetId:
        commands.length > 1
          ? `${unit.sourceId}:${unit.targetKind}`
          : targetId,
    } as const;
  }
  async ownerEquivalence(
    owner: string,
    runId: string,
    companyId: string,
  ): Promise<Readonly<Record<string, string>>> {
    return { ...(await this.boundary(owner).equivalence(runId, companyId)) };
  }
  async rebuildReporting(runId: string, config: MigrationConfig) {
    // Re-read durable canonical owner state through each owner's public historical
    // read boundary. This remains correct after a process restart and never treats
    // provenance rows as accounting truth.
    const records = (
      await Promise.all(
        [...this.boundaries.values()].map(
          (boundary) =>
            boundary.canonicalRecords?.(runId, config.targetCompanyId) ??
            Promise.resolve([]),
        ),
      )
    ).flat();
    const evidence = records.flatMap((record) =>
      this.reportingEvidence({
        runId,
        stage: "reporting-rebuild",
        owner: "canonical-owner",
        sourceCollection: record.collection,
        importKind: record.collection,
        targetKind: record.collection,
        processingStrategy: "DIRECT",
        sourceId: record.sourceId,
        sourcePayloadHash: "",
        targetCompanyId: record.companyId,
        ...(record.branchId ? { targetBranchId: record.branchId } : {}),
        payload: record.payload,
      }),
    );
    const result = await this.reporting.rebuild(
      companyId(config.targetCompanyId),
      evidence,
    );
    return { evidenceCount: String(result.evidenceCount) };
  }
  ownerNames(): readonly string[] {
    return [...this.boundaries.keys()].sort();
  }
  private boundary(owner: string): OwnerBoundary {
    const result = this.boundaries.get(owner);
    if (!result) throw new Error(`unsupported historical owner ${owner}`);
    return result;
  }
  private commands(unit: HistoricalImportUnit) {
    const base = {
      runId: unit.runId,
      sourcePayloadHash: unit.sourcePayloadHash,
      companyId: unit.targetCompanyId,
      ...(unit.targetBranchId ? { branchId: unit.targetBranchId } : {}),
    };
    if (unit.processingStrategy === "BILLING_ALLOCATIONS") {
      const allocations = Array.isArray(unit.payload.allocations)
        ? unit.payload.allocations.filter(record)
        : [];
      return allocations.map((allocation, index) => {
        const sourceId = `${unit.sourceId}:allocation:${index + 1}`;
        const amount = decimalText(
          allocation.invoiceAmount ?? allocation.amount ?? allocation.appliedAmount,
        );
        return {
          ...base,
          collection: unit.importKind,
          sourceId,
          payload: {
            partyKind: text(unit.payload.partyKind ?? unit.payload.partyType, "OTHER"),
            partyId: text(unit.payload.partyId, "historical"),
            invoiceId: optionalText(allocation.invoiceId),
            amount,
            appliedAmount: amount,
            advanceAmount: "0",
            sourceType: `HISTORICAL_${unit.sourceCollection.toUpperCase()}_ALLOCATION`,
            sourceId,
            settlementId: unit.sourceId,
            settlementSequence: index + 1,
            carryingBaseAmount: decimalText(allocation.paymentBase),
            settlementBaseAmount: decimalText(
              allocation.settlementBaseAmount ?? allocation.paymentBase,
            ),
            realizedFx: decimalText(allocation.realizedFx),
            restrictionSourceType: "LEGACY_SOURCE",
            restrictionSourceId: unit.sourceId,
          },
        };
      });
    }
    return [
      {
        ...base,
        collection: unit.importKind,
        sourceId: unit.sourceId,
        payload: adaptLegacyPayload(unit),
      },
    ];
  }
  private reportingEvidence(unit: HistoricalImportUnit): ReportingEvidence[] {
    const p = unit.payload,
      base = {
        companyId: companyId(unit.targetCompanyId),
        ...(unit.targetBranchId
          ? { branchId: branchId(unit.targetBranchId) }
          : {}),
        occurredAt: date(p.createdAt ?? p.postingDate ?? p.date),
        postingDate: date(p.postingDate ?? p.date ?? p.createdAt).slice(0, 10),
        currency: currencyCode(text(p.currency, "USD")),
      };
    if (unit.sourceCollection === "journals") {
      const lines = Array.isArray(p.lines) ? p.lines : [];
      return lines.flatMap((raw, index) => {
        if (!record(raw)) return [];
        const debit = money(raw.debit),
          credit = money(raw.credit),
          amount = debit !== "0" ? debit : `-${credit}`;
        return [
          {
            ...base,
            evidenceId: `gl:${unit.sourceId}:${index + 1}`,
            kind: "GL_LINE",
            source: sourceReference("JOURNAL", unit.sourceId),
            authoritativeReference: sourceReference(
              "JOURNAL_LINE",
              text(raw.id, `${unit.sourceId}:line:${index + 1}`),
            ),
            amount: decimalAmount(amount),
            accountId: text(raw.accountId),
            accountClass: text(
              raw.accountClass ?? raw.classification,
              "ASSET",
            ) as AccountClass,
            ...(typeof p.reversalSourceId === "string"
              ? { reversesEvidenceId: `gl:${p.reversalSourceId}:${index + 1}` }
              : {}),
          },
        ];
      });
    }
    if (unit.sourceCollection === "invoices") {
      const side = text(p.side ?? p.kind, "CUSTOMER").toUpperCase();
      return [
        {
          ...base,
          evidenceId: `billing:${unit.sourceId}`,
          kind: "BILLING_POSITION",
          source: sourceReference("INVOICE", unit.sourceId),
          authoritativeReference: sourceReference("INVOICE", unit.sourceId),
          amount: decimalAmount(money(p.openAmount ?? p.amount)),
          openAmount: decimalAmount(money(p.openAmount ?? p.amount)),
          partyId: text(p.partyId ?? p.customerId ?? p.supplierId),
          positionKind: (side.includes("SUPPLIER")
            ? "PAYABLE"
            : "RECEIVABLE") as PositionKind,
          ...(typeof p.dueDate === "string"
            ? { dueDate: p.dueDate.slice(0, 10) }
            : {}),
        },
      ];
    }
    if (["receipts", "payments", "vouchers"].includes(unit.sourceCollection)) {
      return [
        {
          ...base,
          evidenceId: `treasury:${unit.sourceId}`,
          kind: "TREASURY_ACTIVITY",
          source: sourceReference("TREASURY_VOUCHER", unit.sourceId),
          authoritativeReference: sourceReference(
            "TREASURY_VOUCHER",
            unit.sourceId,
          ),
          amount: decimalAmount(money(p.amount)),
          voucherId: unit.sourceId,
        },
      ];
    }
    if (["taxSnapshots", "taxFacts"].includes(unit.sourceCollection)) {
      return [
        {
          ...base,
          evidenceId: `tax:${unit.sourceId}`,
          kind: "TAX_FACT",
          source: sourceReference("TAX_SNAPSHOT", unit.sourceId),
          authoritativeReference: sourceReference(
            "TAX_SNAPSHOT",
            unit.sourceId,
          ),
          amount: decimalAmount(money(p.taxAmount ?? p.amount)),
          taxCode: text(p.code, "HISTORICAL"),
          taxSnapshotReference: sourceReference("TAX_SNAPSHOT", unit.sourceId),
        },
      ];
    }
    return [];
  }
}

const decimalText = (value: unknown, fallback = "0"): string => {
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value)) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};
const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;
const moneyKeys = new Set([
  "amount","debit","credit","rate","taxAmount","taxableAmount","baseAmount",
  "sourceAmount","openAmount","principal","outstandingPrincipal","interest",
  "cost","salvage","depreciated","gross","deductions","net","total","available",
  "used","quantity","contractedQuantity","allocatedQuantity","availableQuantity",
  "totalSeats","consumedSeats","availableSeats","capacityUnits","consumedUnits",
  "quotaTotal","quotaConsumed","quotaRemaining","paidPrincipal","paidInterest",
]);
const normalizeLegacyNumbers = (value: unknown, key = ""): unknown => {
  if (typeof value === "number" && moneyKeys.has(key)) return decimalText(value);
  if (Array.isArray(value))
    return value.map((item) => normalizeLegacyNumbers(item));
  if (record(value))
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, normalizeLegacyNumbers(v, k)]),
    );
  return value;
};
const sumNumericObject = (value: unknown): string => {
  if (!record(value)) return "0";
  return Object.values(value)
    .map((v) => Number(decimalText(v)))
    .filter(Number.isFinite)
    .reduce((sum, v) => sum + v, 0)
    .toString();
};
const reservationQuantity = (payload: Readonly<Record<string, unknown>>): string => {
  const allocation = record(payload.allocation) ? payload.allocation : {};
  const direct = allocation.quantity ?? allocation.units ?? allocation.seats ??
    allocation.visas ?? allocation.pax ?? payload.quantity;
  if (direct !== undefined) return decimalText(direct);
  return sumNumericObject(allocation.rooms);
};
const legacyContractType = (collection: string): string =>
  collection === "umrahHotelContracts" ? "HOTEL"
    : collection === "umrahFlightBlocks" ? "FLIGHT"
      : collection === "umrahTransportContracts" ? "TRANSPORT"
        : collection === "umrahVisaContracts" ? "VISA"
          : "HISTORICAL";
const dateText = (value: unknown, fallback = "1970-01-01"): string =>
  typeof value === "string" && value ? value : fallback;
const monthRange = (year: unknown, month: unknown) => {
  const y = typeof year === "number" && Number.isInteger(year) ? year : 1970;
  const m = typeof month === "number" && Number.isInteger(month) ? month : 0;
  if (m >= 1 && m <= 12) {
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return { start, end };
  }
  return { start: `${y}-01-01`, end: `${y}-12-31` };
};
const adaptLegacyPayload = (unit: HistoricalImportUnit): Readonly<Record<string, unknown>> => {
  const p = normalizeLegacyNumbers(unit.payload) as Readonly<Record<string, unknown>>;
  switch (unit.processingStrategy) {
    case "TAX_CODE":
      return {
        code: text(p.id, unit.sourceId),
        policyId: "legacy-tax-code",
        effectiveAt: dateText(p.effectiveAt ?? p.date),
        rate: decimalText(p.rate),
        taxableAmount: "0",
        taxAmount: "0",
        inputAccountId: text(p.inputAccount ?? p.inputAccountId, "historical"),
        outputAccountId: text(p.outputAccount ?? p.outputAccountId, "historical"),
        amount: "0",
      };
    case "PREPAID_SCHEDULE":
      return {
        ...p,
        form: "PREPAYMENT",
        sourceType: "PREPAID_SCHEDULE",
        sourceId: unit.sourceId,
        currency: text(p.currency, "USD"),
        amount: decimalText(p.amount),
        baseAmount: decimalText(p.amount),
        status: text(p.status, "POSTED").toUpperCase(),
        prepaidAccountId: text(p.prepaidAccountId, "1300"),
        expenseAccountId: text(p.expenseAccountId, "historical"),
        legacyExpenseId: p.expenseId,
        legacyServiceDate: p.date,
      };
    case "DEFERRED_REVENUE":
    case "DEFERRED_COST":
      return {
        ...p,
        kind: unit.processingStrategy === "DEFERRED_REVENUE" ? "REVENUE" : "COST",
        sourceType: unit.processingStrategy,
        sourceId: unit.sourceId,
        sourceInvoiceId: optionalText(p.invoiceId ?? p.sourceInvoiceId),
        sourceAmount: decimalText(p.total ?? p.sourceAmount ?? p.amount),
        baseAmount: decimalText(p.total ?? p.baseAmount ?? p.amount),
        deferredAccountId: unit.processingStrategy === "DEFERRED_REVENUE" ? "2700" : "1300",
        recognitionAccountId: "historical",
        amount: decimalText(p.total ?? p.amount),
      };
    case "ACCRUED_REVENUE":
      return {
        ...p,
        sourceType: "ACCRUED_REVENUE",
        sourceId: unit.sourceId,
        serviceDate: dateText(p.serviceDate ?? p.date),
        amount: decimalText(p.amount),
        journalId: text(p.journalId, "historical"),
        accruedRevenueAccountId: text(p.accruedRevenueAccountId, "1250"),
        revenueAccountId: text(p.revenueAccountId, "historical"),
      };
    case "FIXED_ASSET":
      return {
        ...p,
        code: text(p.code ?? p.no, unit.sourceId),
        acquisitionValue: decimalText(p.acquisitionValue ?? p.cost ?? p.amount),
        baseValue: decimalText(p.baseValue ?? p.cost ?? p.amount),
        acquisitionDate: dateText(p.acquisitionDate ?? p.date),
        capitalizationDate: dateText(p.capitalizationDate ?? p.date),
        inServiceDate: dateText(p.inServiceDate ?? p.date),
        residualValue: decimalText(p.residualValue ?? p.salvage),
        usefulLifeMonths: typeof p.usefulLifeMonths === "number" ? p.usefulLifeMonths :
          typeof p.lifeMonths === "number" ? p.lifeMonths : 1,
        assetAccountId: text(p.assetAccountId, "historical"),
        capitalizationOffsetAccountId: text(p.capitalizationOffsetAccountId ?? p.fundingAccountId, "historical"),
        accumulatedDepreciationAccountId: text(p.accumulatedDepreciationAccountId ?? p.accumAccountId, "historical"),
        depreciationExpenseAccountId: text(p.depreciationExpenseAccountId ?? p.depreciationAccountId, "historical"),
        accumulatedDepreciation: decimalText(p.accumulatedDepreciation ?? p.depreciated),
        amount: decimalText(p.cost ?? p.amount),
      };
    case "ASSET_DEPRECIATION": {
      const postingDate = dateText(p.postingDate ?? p.date);
      const dt = new Date(postingDate);
      const period = Number.isNaN(dt.valueOf()) ? 1 : dt.getUTCFullYear() * 12 + dt.getUTCMonth() + 1;
      return {
        ...p,
        postingDate,
        period: typeof p.period === "number" ? p.period : period,
        amount: decimalText(p.amount),
      };
    }
    case "LOAN":
      return {
        ...p,
        lenderId: text(p.lenderId ?? p.lender, "historical"),
        reference: text(p.reference ?? p.no, unit.sourceId),
        principal: decimalText(p.principal ?? p.amount),
        outstandingPrincipal: decimalText(
          p.outstandingPrincipal ??
            (Number(decimalText(p.principal)) - Number(decimalText(p.paidPrincipal))),
        ),
        baseCurrency: text(p.baseCurrency ?? p.currency, "USD"),
        baseAmount: decimalText(p.baseAmount ?? p.principal ?? p.amount),
        liabilityAccountId: text(p.liabilityAccountId, "2500"),
        interestExpenseAccountId: text(p.interestExpenseAccountId, "5800"),
        fundingTreasuryId: text(p.fundingTreasuryId ?? p.treasuryId, "historical"),
        amount: decimalText(p.principal ?? p.amount),
      };
    case "LOAN_INSTALLMENT":
      return {
        ...p,
        sequence: typeof p.sequence === "number" ? p.sequence :
          typeof p.no === "number" ? p.no : 1,
        dueDate: dateText(p.dueDate ?? p.date),
        principal: decimalText(p.principal ?? p.amount),
        interest: decimalText(p.interest),
        amount: decimalText(p.principal ?? p.amount),
      };
    case "PROVISION":
      return {
        ...p,
        provisionAccountId: text(p.provisionAccountId, "2600"),
        expenseAccountId: text(p.expenseAccountId, "5900"),
        releaseAccountId: text(p.releaseAccountId, "historical"),
        available: decimalText(
          p.available ??
            (Number(decimalText(p.amount)) - Number(decimalText(p.used))),
        ),
        amount: decimalText(p.amount),
      };
    case "ALLOWANCE":
      return {
        ...p,
        sourceReference: text(p.sourceReference ?? p.no, unit.sourceId),
        allowanceAccountId: text(p.allowanceAccountId, "1290"),
        expenseAccountId: text(p.expenseAccountId, "5710"),
        releaseAccountId: text(p.releaseAccountId, "historical"),
        amount: decimalText(p.amount),
        used: decimalText(p.used),
        available: decimalText(
          p.available ??
            (Number(decimalText(p.amount)) - Number(decimalText(p.used))),
        ),
      };
    case "PAYROLL_RUN":
      return {
        ...p,
        sourceId: unit.sourceId,
        payrollPeriod: text(p.payrollPeriod ?? p.period, "HISTORICAL"),
        postingDate: dateText(p.postingDate ?? p.date),
        expenseTotal: decimalText(p.expenseTotal ?? p.gross ?? p.amount),
        expenseAccountId: text(p.expenseAccountId, "5240"),
        amount: decimalText(p.gross ?? p.amount),
      };
    case "BUDGET": {
      const range = monthRange(p.year, p.month);
      return {
        ...p,
        costCenterId: text(p.costCenterId, "historical"),
        periodStart: dateText(p.periodStart, range.start),
        periodEnd: dateText(p.periodEnd, range.end),
        currency: text(p.currency, "USD"),
        amount: decimalText(p.amount),
      };
    }
    case "PARTY_GROUP": {
      const roles = record(p.roles) ? p.roles : {};
      const members = Object.entries(roles).flatMap(([role, partyId], index) =>
        typeof partyId === "string" && partyId
          ? [{ id: `${unit.sourceId}:member:${index + 1}`, role: role.toUpperCase(), partyId }]
          : [],
      );
      return { ...p, members };
    }
    case "PARTY_NETTING": {
      const allocations = Array.isArray(p.invoiceAllocations)
        ? p.invoiceAllocations.filter(record)
        : [];
      const customer = allocations.find((x) => text(x.partyType).toLowerCase() === "customer");
      const supplier = allocations.find((x) => text(x.partyType).toLowerCase() === "supplier");
      return {
        ...p,
        groupId: text(p.groupId ?? p.partyGroupId),
        customerInvoiceId: text(p.customerInvoiceId ?? customer?.invoiceId, "historical"),
        supplierInvoiceId: text(p.supplierInvoiceId ?? supplier?.invoiceId, "historical"),
        postingDate: dateText(p.postingDate ?? p.date),
        number: text(p.number ?? p.no, unit.sourceId),
        requesterActorId: text(p.requesterActorId ?? p.createdBy, "historical"),
        amount: decimalText(p.amount),
      };
    }
    case "BANK_RECONCILIATION":
      return {
        ...p,
        type: text(p.type, "BANK"),
        correlationId: text(p.correlationId ?? p.no, unit.sourceId),
        fingerprint: text(p.fingerprint, unit.sourcePayloadHash),
        clean: p.clean !== false && p.status !== "unreconciled",
        runAt: dateText(p.runAt ?? p.date ?? p.createdAt),
        amount: "0",
      };
    case "UMRAH_CONTRACT": {
      const from = dateText(p.effectiveFrom ?? p.from ?? p.date ?? p.createdAt);
      const to = dateText(p.effectiveTo ?? p.to ?? p.endDate, from);
      return {
        ...p,
        type: legacyContractType(unit.sourceCollection),
        status: p.active === false ? "INACTIVE" : text(p.status, "ACTIVE").toUpperCase(),
        supplierId: optionalText(p.supplierId),
        effectiveFrom: from,
        effectiveTo: to,
        versionId: `${unit.sourceId}:v1`,
        versionNumber: 1,
        terms: p,
        sourceReference: {
          sourceCollection: unit.sourceCollection,
          sourceId: unit.sourceId,
        },
        amount: "0",
      };
    }
    case "UMRAH_RESERVATION":
      return {
        ...p,
        contractId: text(p.contractId),
        contractVersionId: text(p.contractVersionId, `${text(p.contractId)}:v1`),
        resourceType: text(p.resourceType ?? p.kind, "HISTORICAL").toUpperCase(),
        resourceId: text(p.resourceId, unit.sourceId),
        program: { id: text(p.programId), source: "v32.5.66" },
        serviceDate: dateText(p.serviceDate ?? p.from ?? p.date ?? p.createdAt),
        periodEnd: optionalText(p.periodEnd ?? p.to),
        quantity: reservationQuantity(p),
        status: p.active === false ? "RELEASED" : "ACTIVE",
        sourceReference: {
          sourceCollection: unit.sourceCollection,
          sourceId: unit.sourceId,
        },
        amount: reservationQuantity(p),
      };
    case "UMRAH_SUPPLIER_COMMITMENT":
      return {
        ...p,
        supplierId: text(p.supplierId),
        sourceType: "UMRAH_LEGACY",
        sourceId: text(p.sourceId, unit.sourceId),
        effectiveDate: dateText(p.effectiveDate ?? p.date ?? p.createdAt),
        createdAt: dateText(p.createdAt ?? p.date),
        amount: "0",
      };
    default:
      return p;
  }
};

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, fallback = "") =>
  typeof v === "string" && v ? v : fallback;
const money = (v: unknown) =>
  typeof v === "string" && /^-?\d+(?:\.\d+)?$/.test(v) ? v : "0";
const date = (v: unknown) => {
  const value = typeof v === "string" && v ? v : "1970-01-01";
  return value.length === 10
    ? `${value}T00:00:00.000Z`
    : new Date(value).toISOString();
};
