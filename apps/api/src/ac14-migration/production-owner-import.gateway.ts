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
    this.boundary(unit.owner).validate(this.command(unit));
  }
  importUnit(unit: HistoricalImportUnit) {
    return this.boundary(unit.owner).importHistorical(this.command(unit));
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
        collection: record.collection,
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
  private command(unit: HistoricalImportUnit) {
    return {
      runId: unit.runId,
      collection: unit.collection,
      sourceId: unit.sourceId,
      sourcePayloadHash: unit.sourcePayloadHash,
      companyId: unit.targetCompanyId,
      ...(unit.targetBranchId ? { branchId: unit.targetBranchId } : {}),
      payload: unit.payload,
    };
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
    if (unit.collection === "journals") {
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
    if (unit.collection === "invoices") {
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
    if (["receipts", "payments", "vouchers"].includes(unit.collection)) {
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
    if (["taxSnapshots", "taxFacts"].includes(unit.collection)) {
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
