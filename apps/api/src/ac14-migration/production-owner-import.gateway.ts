import { Inject, Injectable } from '@nestjs/common';
import { companyId } from '@elhafez/contracts';
import { HistoricalImportApplicationService as CurrencyFxHistorical } from '@elhafez/currency-fx';
import { HistoricalImportApplicationService as CostHistorical } from '@elhafez/cost-budget-accounting';
import { HistoricalImportApplicationService as PeriodHistorical } from '@elhafez/period-control';
import { HistoricalImportApplicationService as GlHistorical } from '@elhafez/general-ledger';
import { HistoricalImportApplicationService as TaxHistorical } from '@elhafez/tax';
import { HistoricalImportApplicationService as BillingHistorical } from '@elhafez/billing-subledgers';
import { HistoricalImportApplicationService as TreasuryHistorical } from '@elhafez/treasury-settlement';
import { HistoricalImportApplicationService as PartyHistorical } from '@elhafez/party-accounting';
import { HistoricalImportApplicationService as EcrHistorical } from '@elhafez/expense-commission-recognition';
import { HistoricalImportApplicationService as AssetsHistorical } from '@elhafez/assets-financing';
import { HistoricalImportApplicationService as ProcurementHistorical } from '@elhafez/procurement-finance';
import { HistoricalImportApplicationService as ControlsHistorical } from '@elhafez/financial-controls';
import { HistoricalImportApplicationService as InventoryHistorical } from '@elhafez/tourism-contract-inventory';
import { HistoricalImportApplicationService as TourismHistorical } from '@elhafez/tourism-finance-orchestration';
import { FinancialReportingApplicationService } from '@elhafez/financial-reporting';
import type { MigrationConfig } from '@elhafez/platform-core';
import type { Ac14OwnerImportGateway, HistoricalImportUnit, OwnerEquivalence } from './owner-import.gateway.js';

type OwnerBoundary = Pick<CurrencyFxHistorical, 'validate' | 'importHistorical' | 'equivalence'>;

/** Production composition adapter. Every write is delegated to the named owner's public historical API. */
@Injectable()
export class ProductionAc14OwnerImportGateway implements Ac14OwnerImportGateway {
  private readonly boundaries: ReadonlyMap<string, OwnerBoundary>;
  constructor(
    @Inject(CurrencyFxHistorical) currencyFx: CurrencyFxHistorical, @Inject(CostHistorical) cost: CostHistorical, @Inject(PeriodHistorical) period: PeriodHistorical,
    @Inject(GlHistorical) gl: GlHistorical, @Inject(TaxHistorical) tax: TaxHistorical, @Inject(BillingHistorical) billing: BillingHistorical,
    @Inject(TreasuryHistorical) treasury: TreasuryHistorical, @Inject(PartyHistorical) party: PartyHistorical, @Inject(EcrHistorical) ecr: EcrHistorical,
    @Inject(AssetsHistorical) assets: AssetsHistorical, @Inject(ProcurementHistorical) procurement: ProcurementHistorical, @Inject(ControlsHistorical) controls: ControlsHistorical,
    @Inject(InventoryHistorical) inventory: InventoryHistorical, @Inject(TourismHistorical) tourism: TourismHistorical,
    @Inject(FinancialReportingApplicationService) private readonly reporting: FinancialReportingApplicationService,
  ) {
    this.boundaries = new Map<string, OwnerBoundary>([
      ['CurrencyFx', currencyFx], ['CostBudget', cost], ['PeriodControl', period],
      ['GeneralLedger', gl], ['Tax', tax], ['Billing', billing], ['Treasury', treasury],
      ['PartyAccounting', party], ['ExpenseRecognition', ecr], ['AssetsFinancing', assets],
      ['Procurement', procurement], ['FinancialControls', controls],
      ['TourismContractInventory', inventory], ['TourismFinance', tourism],
    ]);
  }
  validateUnit(unit: HistoricalImportUnit): void { this.boundary(unit.owner).validate(this.command(unit)); }
  importUnit(unit: HistoricalImportUnit) { return this.boundary(unit.owner).importHistorical(this.command(unit)); }
  ownerEquivalence(owner: string, runId: string, companyId: string): Promise<OwnerEquivalence> { return this.boundary(owner).equivalence(runId, companyId); }
  async rebuildReporting(_runId: string, config: MigrationConfig) {
    const result = await this.reporting.rebuild(companyId(config.targetCompanyId), []);
    return { evidenceCount: String(result.evidenceCount) };
  }
  ownerNames(): readonly string[] { return [...this.boundaries.keys()].sort(); }
  private boundary(owner: string): OwnerBoundary { const result = this.boundaries.get(owner); if (!result) throw new Error(`unsupported historical owner ${owner}`); return result; }
  private command(unit: HistoricalImportUnit) { return { runId: unit.runId, collection: unit.collection, sourceId: unit.sourceId, sourcePayloadHash: unit.sourcePayloadHash, companyId: unit.targetCompanyId, ...(unit.targetBranchId ? { branchId: unit.targetBranchId } : {}), payload: unit.payload }; }
}
