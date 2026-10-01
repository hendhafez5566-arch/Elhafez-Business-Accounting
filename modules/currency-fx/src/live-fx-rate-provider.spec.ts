import assert from 'node:assert/strict';
import test from 'node:test';
import { currencyCode } from '@elhafez/contracts';
import { ExchangeRateApiLiveFxProvider } from './infrastructure/exchange-rate-api-live-fx.provider.js';

test('live FX adapter parses provider data and reuses the short-lived feed cache',async()=>{
 let calls=0;
 const provider=new ExchangeRateApiLiveFxProvider(async()=>{calls+=1;return{ok:true,status:200,json:async()=>({result:'success',time_last_update_unix:1790830800,rates:{EGP:13.25,USD:0.266}})}} as never,()=>1790834400000,60*60*1000);
 const first=await provider.quote(currencyCode('SAR'),currencyCode('EGP'));
 const second=await provider.quote(currencyCode('SAR'),currencyCode('USD'));
 assert.equal(first.rate,'13.25');
 assert.equal(first.source,'LIVE:EXCHANGE_RATE_API');
 assert.equal(second.rate,'0.266');
 assert.equal(calls,1);
});

test('live FX adapter rejects unavailable or malformed provider responses',async()=>{
 const unavailable=new ExchangeRateApiLiveFxProvider(async()=>{throw new Error('offline')},()=>0);
 await assert.rejects(unavailable.quote(currencyCode('SAR'),currencyCode('EGP')),/unavailable/);
 const invalid=new ExchangeRateApiLiveFxProvider(async()=>({ok:true,status:200,json:async()=>({result:'error'})}) as never,()=>0);
 await assert.rejects(invalid.quote(currencyCode('SAR'),currencyCode('EGP')),/rejected/);
});
