import assert from 'node:assert/strict';
import test from 'node:test';
import { PartyRegistryModule } from '@elhafez/party-registry';
import { AgentManagementModule } from '@elhafez/agent-management/nest';
import { CustomerManagementModule } from '@elhafez/customer-management/nest';
import { CrmLeadsModule } from '@elhafez/crm-leads/nest';
import { CrmFollowupsModule } from '@elhafez/crm-followups/nest';

test('CS-01 composition exposes the five canonical CRM Core modules', () => {
  assert.deepEqual(
    [PartyRegistryModule, AgentManagementModule, CustomerManagementModule, CrmLeadsModule, CrmFollowupsModule].map((value) => value.name),
    ['PartyRegistryModule', 'AgentManagementModule', 'CustomerManagementModule', 'CrmLeadsModule', 'CrmFollowupsModule'],
  );
});
