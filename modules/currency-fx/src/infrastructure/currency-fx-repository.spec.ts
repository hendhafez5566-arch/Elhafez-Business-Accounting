import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { companyId, currencyCode, decimalAmount } from '@elhafez/contracts';
import type { CurrencyConfiguration, FxRate } from '../domain/fx.js';
import { InMemoryCurrencyFxRepository } from './in-memory-currency-fx.repository.js';
import { PrismaCurrencyFxRepository } from './prisma-currency-fx.repository.js';

const company = companyId('company-1'), EGP = currencyCode('EGP'), USD = currencyCode('USD');
function prismaRepository(): PrismaCurrencyFxRepository {
  type StoredRate = Omit<FxRate, 'effectiveAt' | 'rate'> & { effectiveAt: Date; rate: { toString(): string } };
  const currencies: CurrencyConfiguration[] = [], rates: StoredRate[] = [];
  const fxCurrency = {
    findUnique: async ({ where }: { where: { companyId_code: { companyId: string; code: string } } }) => currencies.find((x) => x.companyId === where.companyId_code.companyId && x.code === where.companyId_code.code),
    findFirst: async ({ where }: { where: { companyId: string; isBase: boolean; code: { not: string } } }) => currencies.find((x) => x.companyId === where.companyId && x.isBase === where.isBase && x.code !== where.code.not),
    upsert: async ({ create, update }: { create: CurrencyConfiguration; update: Partial<CurrencyConfiguration> }) => { const index=currencies.findIndex((x)=>x.companyId===create.companyId&&x.code===create.code); if(index<0)currencies.push(create);else currencies[index]={...currencies[index]!,...update}; },
  };
  const fxRate = {
    findUnique: async ({ where }: { where: { id?: string; companyId_fromCurrency_toCurrency_effectiveAt?: { companyId: string; fromCurrency: string; toCurrency: string; effectiveAt: Date } } }) => where.id ? rates.find((x)=>x.id===where.id) : rates.find((x)=>{const k=where.companyId_fromCurrency_toCurrency_effectiveAt!;return x.companyId===k.companyId&&x.fromCurrency===k.fromCurrency&&x.toCurrency===k.toCurrency&&x.effectiveAt.valueOf()===k.effectiveAt.valueOf();}),
    create: async ({ data }: { data: FxRate & { effectiveAt: Date; rate: string } }) => { rates.push({...data,rate:{toString:()=>data.rate}}); },
  };
  return new PrismaCurrencyFxRepository({ fxCurrency, fxRate } as unknown as PrismaClient);
}

for (const [name, make] of [['in-memory',()=>new InMemoryCurrencyFxRepository()],['prisma',prismaRepository]] as const) {
  test(`${name} adapter has idempotent rate publication and deterministic conflicts`, async()=>{const repository=make();const rate:FxRate={id:'rate-1',companyId:company,fromCurrency:USD,toCurrency:EGP,effectiveAt:'2026-09-18T00:00:00.000Z',rate:decimalAmount('50'),source:'BANK'};await repository.saveRate(rate);await repository.saveRate(rate);await assert.rejects(repository.saveRate({...rate,rate:decimalAmount('51')}),/conflicting FX rate/);});
  test(`${name} adapter protects company base currency`,async()=>{const repository=make();await repository.saveCurrency({companyId:company,code:EGP,precision:2,isBase:true,status:'ACTIVE'});await assert.rejects(repository.saveCurrency({companyId:company,code:USD,precision:2,isBase:true,status:'ACTIVE'}),/already has a base/);await assert.rejects(repository.saveCurrency({companyId:company,code:EGP,precision:2,isBase:false,status:'ACTIVE'}),/cannot be changed/);});
}
