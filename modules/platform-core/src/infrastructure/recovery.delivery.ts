import { PlatformError } from '../domain/platform.types.js';
import type { RecoveryDeliveryPort } from '../application/platform-core.application-service.js';

/**
 * Production recovery delivery adapter.
 * Token lifecycle remains owned by platform-core; this adapter only transports
 * the short-lived raw token to a trusted HTTPS delivery service.
 */
export class HttpRecoveryDelivery implements RecoveryDeliveryPort {
  constructor(
    private readonly endpoint:string,
    private readonly bearerToken:string,
    private readonly fetcher:typeof fetch=globalThis.fetch,
  ){
    const url=new URL(endpoint);
    if(url.protocol!=='https:')throw new PlatformError('CONFIGURATION_ERROR','recovery delivery URL must use HTTPS');
    if(!bearerToken.trim())throw new PlatformError('CONFIGURATION_ERROR','recovery delivery token is required');
  }

  async deliver(input:{recipient:string;token:string;expiresAt:Date}):Promise<void>{
    let response:Response;
    try{
      response=await this.fetcher(this.endpoint,{
        method:'POST',
        headers:{'content-type':'application/json','authorization':`Bearer ${this.bearerToken}`},
        body:JSON.stringify({recipient:input.recipient,token:input.token,expiresAt:input.expiresAt.toISOString()}),
        signal:AbortSignal.timeout(10_000),
      });
    }catch(error){
      void error;
      throw new PlatformError('DELIVERY_FAILED','recovery delivery request failed');
    }
    if(!response.ok)throw new PlatformError('DELIVERY_FAILED','recovery delivery provider rejected the request',{status:response.status});
  }
}

export class UnavailableRecoveryDelivery implements RecoveryDeliveryPort {
  async deliver():Promise<never>{throw new PlatformError('DELIVERY_UNAVAILABLE','recovery delivery provider is unavailable')}
}

/**
 * Production cannot boot with a silently non-functional password-recovery path.
 * Non-production keeps a fail-closed adapter so tests/dev do not require external I/O.
 */
export function recoveryDeliveryFromEnvironment():RecoveryDeliveryPort{
  const endpoint=process.env.ELHAFEZ_RECOVERY_DELIVERY_URL?.trim();
  const token=process.env.ELHAFEZ_RECOVERY_DELIVERY_TOKEN?.trim();
  if(endpoint&&token)return new HttpRecoveryDelivery(endpoint,token);
  if(process.env.NODE_ENV==='production')throw new PlatformError('CONFIGURATION_ERROR','production recovery delivery requires ELHAFEZ_RECOVERY_DELIVERY_URL and ELHAFEZ_RECOVERY_DELIVERY_TOKEN');
  return new UnavailableRecoveryDelivery();
}
