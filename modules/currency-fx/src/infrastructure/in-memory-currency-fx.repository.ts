import type { CompanyId, CurrencyCode } from '@elhafez/contracts';
import type { CurrencyFxRepository } from '../application/currency-fx.repository.js'; import type { CurrencyConfiguration, FxRate } from '../domain/fx.js';
export class InMemoryCurrencyFxRepository implements CurrencyFxRepository {
  private currencies = new Map<string,CurrencyConfiguration>(); private rates: FxRate[]=[];
  async saveCurrency(v: CurrencyConfiguration): Promise<void> { const key=`${v.companyId}:${v.code}`; const old=this.currencies.get(key); if(old?.isBase && !v.isBase) throw new Error('base currency cannot be changed'); if(v.isBase && [...this.currencies.values()].some(x=>x.companyId===v.companyId&&x.isBase&&x.code!==v.code)) throw new Error('company already has a base currency'); this.currencies.set(key,v); }
  async findCurrency(c: CompanyId, code: CurrencyCode): Promise<CurrencyConfiguration|undefined>{return this.currencies.get(`${c}:${code}`);}
  async saveRate(v: FxRate):Promise<void>{const duplicate=this.rates.find(x=>x.companyId===v.companyId&&x.fromCurrency===v.fromCurrency&&x.toCurrency===v.toCurrency&&x.effectiveAt===v.effectiveAt);if(duplicate){if(duplicate.rate!==v.rate||duplicate.source!==v.source)throw new Error('conflicting FX rate');return;}this.rates.push(v);}
  async findRate(c:CompanyId,from:CurrencyCode,to:CurrencyCode,at:string):Promise<FxRate|undefined>{return this.rates.filter(x=>x.companyId===c&&x.fromCurrency===from&&x.toCurrency===to&&x.effectiveAt<=at).sort((a,b)=>b.effectiveAt.localeCompare(a.effectiveAt))[0];}
}
