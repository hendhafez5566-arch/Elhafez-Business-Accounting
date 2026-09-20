import assert from 'node:assert/strict';
import test from 'node:test';
import { PartyRegistryModule } from '@elhafez/party-registry';
import { AgentManagementModule } from '@elhafez/agent-management';
import { CustomerManagementModule } from '@elhafez/customer-management';
import { CrmLeadsModule } from '@elhafez/crm-leads';
import { CrmFollowupsModule } from '@elhafez/crm-followups';

test('CS-01 composition exposes the five canonical CRM Core modules', () => {
  assert.deepEqual(
    [PartyRegistryModule, AgentManagementModule, CustomerManagementModule, CrmLeadsModule, CrmFollowupsModule].map((value) => value.name),
    ['PartyRegistryModule', 'AgentManagementModule', 'CustomerManagementModule', 'CrmLeadsModule', 'CrmFollowupsModule'],
  );
});
