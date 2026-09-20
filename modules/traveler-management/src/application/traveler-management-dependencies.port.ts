import type { ExecutionContext } from '@elhafez/contracts';

export interface TravelerLinkagePort {
  customerPartyId(context: ExecutionContext, customerId: string): Promise<string | null>;
  isResolvableParty(context: ExecutionContext, partyId: string): Promise<boolean>;
}
