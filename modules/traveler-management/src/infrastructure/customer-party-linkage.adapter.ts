import { ContractValidationError, type ExecutionContext } from '@elhafez/contracts';
import { customerId, type CustomerManagementApplicationService } from '@elhafez/customer-management';
import { partyId, type PartyRegistryApplicationService } from '@elhafez/party-registry';
import type { TravelerLinkagePort } from '../application/traveler-management-dependencies.port.js';

export class CustomerPartyLinkageAdapter implements TravelerLinkagePort {
  constructor(
    private readonly customers: CustomerManagementApplicationService,
    private readonly parties: PartyRegistryApplicationService,
  ) {}

  async customerPartyId(context: ExecutionContext, id: string): Promise<string | null> {
    try {
      return (await this.customers.requireActiveForIntegration(context, customerId(id))).partyId;
    } catch (error) {
      if (error instanceof ContractValidationError) return null;
      throw error;
    }
  }

  async isResolvableParty(context: ExecutionContext, id: string): Promise<boolean> {
    try {
      return (await this.parties.getForIntegration(context, partyId(id))).status === 'ACTIVE';
    } catch (error) {
      if (error instanceof ContractValidationError) return false;
      throw error;
    }
  }
}
