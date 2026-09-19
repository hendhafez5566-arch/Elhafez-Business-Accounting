/**
 * BLOCKER-7: Real Adapter Integration Tests
 * 
 * These tests use actual public application services/adapters from provider modules
 * to detect real integration/API semantic mismatches hidden by fake ports.
 * 
 * Production code must not introduce private cross-module access.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { companyId, decimalAmount, sourceReference } from '@elhafez/contracts';
import { TourismFinanceOrchestrationApplicationService } from './application/tourism-finance-orchestration.application-service.js';
import { InMemoryTourismFinanceRepository } from './infrastructure/in-memory-tourism-finance.repository.js';
import { BillingSubledgersApplicationService } from '@elhafez/billing-subledgers';
import { InMemoryBillingRepository } from '@elhafez/billing-subledgers/dist/infrastructure/in-memory-billing.repository.js';
import { CostBudgetAccountingApplicationService } from '@elhafez/cost-budget-accounting';
import { InMemoryCostCenterRepository } from '@elhafez/cost-budget-accounting/dist/infrastructure/in-memory-cost-center.repository.js';
import { ProcurementFinanceApplicationService } from '@elhafez/procurement-finance';
import { InMemoryProcurementRepository } from '@elhafez/procurement-finance/dist/infrastructure/in-memory-procurement.repository.js';

import type { BillingPort, TreasuryPort, CommissionPort, CostPort, InventoryPort, ProcurementPort, ControlsPort } from './application/ports.js';

const company = companyId('company-integration');
const booking = sourceReference('TOURISM_BOOKING', 'booking-int-1');
const program = sourceReference('TOURISM_PROGRAM', 'program-int-1');

/**
 * BLOCKER-7 Integration Test: AC-12 -> Billing invoice creation/posting
 * Tests the real Billing public API for invoice creation semantics
 */
test('integration: AC-12 creates invoice through real Billing service', async () => {
  const billingRepo = new InMemoryBillingRepository();
  const billingService = new BillingSubledgersApplicationService(billingRepo);
  
  const billingAdapter: BillingPort = {
    async createBookingInvoice(input) {
      const invoice = await billingService.createDraft({
        id: input.id,
        companyId: input.companyId,
        type: 'CUSTOMER_INVOICE',
        partyId: input.partyId,
        number: input.number,
        postingDate: input.postingDate,
        dueDate: input.dueDate,
        currency: input.currency,
        controlAccountId: input.receivableAccountId,
        lines: [{
          id: `${input.id}-line`,
          amount: input.amount,
          accountId: input.revenueAccountId,
        }],
        sourceType: 'TOURISM_FINANCIAL_WORKFLOW',
        sourceId: input.sourceId,
      });
      await billingService.postInvoice(input.companyId, invoice.id);
      return { id: invoice.id };
    },
    async cancellationEvidence(companyId, invoiceId) {
      return billingService.getCancellationEvidence(companyId, invoiceId);
    },
    async cancelInvoice(companyId, id, postingDate, number) {
      const result = await billingService.cancelInvoice(companyId, id, postingDate, number);
      return { id: result.id };
    },
  };

  // TODO: Implement Treasury, Commission, Cost, Inventory, Procurement, Controls adapters
  const stubTreasury: TreasuryPort = {
    async postDeposit(input) { return { id: input.id }; },
    async reverseDeposit(_company, id) { return { id }; },
  };
  const stubCommission: CommissionPort = {
    async create(input) { return { id: input.id }; },
    async evidence() { return { hasPostedPaymentHistory: false, reversible: true }; },
    async reverse(_company, id) { return { id }; },
  };
  
  const costRepo = new InMemoryCostCenterRepository();
  const costService = new CostBudgetAccountingApplicationService(costRepo);
  await costService.create({
    id: 'cc-int-1',
    companyId: company,
    code: 'CC-INT-1',
    name: 'Integration Test Cost Center',
    status: 'ACTIVE',
  });
  const costAdapter: CostPort = {
    async ensureProgram(companyId, program, costCenterId) {
      return costService.ensureProgramCostCenter(companyId, program, costCenterId);
    },
    async resolveProgram(companyId, program) {
      const association = await costService.resolveProgramCostCenter(companyId, program);
      return { costCenterId: association.id };
    },
    async actualize(input) {
      return costService.recordTourismServiceActualization(input);
    },
  };

  const stubInventory: InventoryPort = {
    async allocate(input, _key) { return { allocationId: input.allocationId }; },
    async blockers() { return []; },
    async release(_company, id) { return { success: true, id }; },
  };

  const procurementRepo = new InMemoryProcurementRepository();
  const procurementService = new ProcurementFinanceApplicationService(procurementRepo, billingService);
  const procurementAdapter: ProcurementPort = {
    async blockers(companyId, reference) {
      return procurementService.getCancellationBlockers(companyId, reference);
    },
    async cleanupForProgramCancellation(companyId, reference) {
      return procurementService.cleanupForProgramCancellation(companyId, reference);
    },
  };

  const stubControls: ControlsPort = {
    async authorizeDiscount() { /* Approved by default in test */ },
    async approvalResolved() { return true; },
  };

  const repo = new InMemoryTourismFinanceRepository();
  const orchestrationService = new TourismFinanceOrchestrationApplicationService(
    repo,
    billingAdapter,
    stubTreasury,
    stubCommission,
    costAdapter,
    stubInventory,
    procurementAdapter,
    stubControls,
  );

  // Configure financial setup
  await orchestrationService.configureFinancialSetup({
    id: 'setup-hotel-int',
    companyId: company,
    category: 'HOTEL',
    receivableAccountId: 'ar',
    customerAdvanceAccountId: 'advance',
    revenueAccountId: 'revenue',
    costAccountId: 'cost',
    active: true,
  });

  // Confirm booking - tests real Billing invoice creation
  const result = await orchestrationService.confirmBooking({
    companyId: company,
    branchId: 'branch-1',
    commandKey: 'confirm-int-1',
    booking,
    program,
    programState: 'OPEN',
    programStateEvidence: 'program-version-1',
    category: 'HOTEL',
    costCenterId: 'cc-int-1',
    customerPartyId: 'customer-1',
    currency: 'EGP',
    grossAmount: decimalAmount('150'),
    discountAmount: decimalAmount('0'),
    postingDate: '2026-09-19',
    dueDate: '2026-09-30',
    invoiceNumber: 'INV-INT-1',
    inventory: {
      allocationId: 'allocation-int-1',
      contractId: 'contract-1',
      resourceType: 'HOTEL',
      resourceId: 'room-1',
      serviceDate: '2026-10-01',
      quantity: decimalAmount('2'),
    },
  });

  assert.ok(result, 'booking confirmation should succeed');
  const bookingRef = result as { id?: string; invoiceId?: string };
  assert.ok(bookingRef.invoiceId, 'should have created invoice through real Billing service');

  // Verify invoice exists in Billing
  const invoice = await billingService.getOpenPosition(company, bookingRef.invoiceId!);
  assert.equal(invoice.status, 'POSTED', 'invoice should be POSTED');
  assert.equal(invoice.outstanding, '150', 'invoice outstanding should match gross amount');
});

/**
 * TODO: Additional integration tests required for BLOCKER-7:
 * 
 * 1. AC-12 -> Treasury -> Billing deposit/allocation
 *    - Test recordBookingDeposit using real Treasury service
 *    - Verify Treasury creates voucher and calls Billing allocation
 *    - Verify Billing allocation updates invoice outstanding
 * 
 * 2. Treasury reversal -> Billing cancellation evidence
 *    - Test settleBookingCancellation using real Treasury reversal
 *    - Verify Billing cancellation evidence reflects reversal
 * 
 * 3. AC-12 -> ECR commission evidence/reversal
 *    - Test commission creation through real ECR service
 *    - Verify commission payment history blocks cancellation
 *    - Test commission reversal flow
 * 
 * 4. AC-12 -> Procurement cleanup
 *    - Test cleanupForProgramCancellation using real Procurement service
 *    - Verify AUTO DRAFT PO disposal logic
 *    - Verify MANUAL PO cancellation logic
 *    - Verify commitment cleanup with linked POs
 * 
 * 5. AC-12 -> Financial Controls BOOKING_DISCOUNT
 *    - Test authorizeDiscount using real Controls service
 *    - Verify approval required for discount amount
 *    - Verify threshold enforcement
 * 
 * 6. AC-12 -> Tourism Contract Inventory allocation/release
 *    - Test inventory allocation using real Inventory service
 *    - Verify hotel date-level capacity enforcement
 *    - Verify aggregate flight block consumption
 *    - Test inventory release and idempotency
 * 
 * 7. Cross-module cancellation workflow
 *    - Test full cancellation flow with all real adapters
 *    - Verify blocker detection from each provider
 *    - Test settlement requirement propagation
 * 
 * 8. Program cancellation aggregate workflow
 *    - Test cancelProgram with multiple bookings
 *    - Verify Procurement cleanup executes correctly
 *    - Verify all child bookings cancel through real services
 * 
 * Implementation notes:
 * - Use real in-memory repositories from each module
 * - Import public application services only (no private access)
 * - Test API contracts, not implementation details
 * - Verify cross-module data flow and state transitions
 * - Ensure idempotency and concurrency safety
 */
