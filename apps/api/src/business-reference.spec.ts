import assert from 'node:assert/strict';
import test from 'node:test';
import {PROGRAM_PERMISSIONS} from '@elhafez/hajj-umrah-programs';
import {PLATFORM_CORE_PERMISSIONS, type PlatformCoreApplicationService} from '@elhafez/platform-core';
import type {CostBudgetAccountingApplicationService} from '@elhafez/cost-budget-accounting';
import type {TourismInventoryReferenceQuery} from '@elhafez/tourism-contract-inventory/nest';
import {BusinessReferenceController} from './business-reference.controller.js';

test('business references require company, branch and owner read permission before querying canonical data', async () => {
  const calls:string[]=[];
  let permitted=false;
  const platform={
    async currentCompanyUser(token:string,company:string){calls.push(`user:${token}:${company}`);return{id:'operator-1'};},
    async requireBranchAccess(_actor:string,_company:string,branch:string){calls.push(`branch:${branch}`);},
    async authorize(_actor:string,_company:string,permission:string){calls.push(`permission:${permission}`);if(!permitted)throw new Error('forbidden');},
  } as unknown as PlatformCoreApplicationService;
  const cost={async list(company:string){calls.push(`cost:${company}`);return[];}} as unknown as CostBudgetAccountingApplicationService;
  const tourism={
    async contracts(company:string){calls.push(`contracts:${company}`);return[];},
    async allocations(company:string){calls.push(`allocations:${company}`);return[];},
  } as unknown as TourismInventoryReferenceQuery;
  const controller=new BusinessReferenceController(platform,cost,tourism);
  await assert.rejects(controller.contracts(undefined,'company-1','branch-1'));
  assert.equal(calls.length,0);
  await assert.rejects(controller.contracts('Bearer token','company-1','branch-1'),/forbidden/);
  assert.equal(calls.join('|'),['user:token:company-1','branch:branch-1',`permission:${PROGRAM_PERMISSIONS.view}`].join('|'));
  permitted=true;
  await controller.allocations('Bearer token','company-1','branch-1');
  await controller.costCenters('Bearer token','company-1','branch-1');
  assert.ok(calls.includes('allocations:company-1'));
  assert.ok(calls.includes('cost:company-1'));
  assert.ok(calls.includes(`permission:${PLATFORM_CORE_PERMISSIONS.accountingFinanceRead}`));
});
