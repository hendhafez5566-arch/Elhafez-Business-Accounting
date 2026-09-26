import type {SaasControlEvent,SaasOwnerAccount,SaasOwnerSession,SaasPayment,SaasPlan,SaasSubscription,SaasSubscriptionEvent,SaasTenant} from '../domain/saas.types.js';
export interface SaasRepository {
 countOwners():Promise<number>;findOwnerByEmail(email:string):Promise<SaasOwnerAccount|null>;findOwnerById(id:string):Promise<SaasOwnerAccount|null>;
 createOwner(owner:SaasOwnerAccount,event:SaasControlEvent):Promise<void>;recordOwnerFailure(ownerId:string,updatedAt:Date,event:SaasControlEvent):Promise<{failedAttempts:number;lockedUntil:Date|null}>;resetOwnerFailures(ownerId:string,updatedAt:Date):Promise<void>;recoverOwnerMfa(input:{ownerId:string;mfaSecretCipher:string;updatedAt:Date;event:SaasControlEvent}):Promise<number>;recoverOwnerPassword(input:{ownerId:string;passwordHash:string;updatedAt:Date;event:SaasControlEvent}):Promise<number>;
 createOwnerSession(session:SaasOwnerSession,event:SaasControlEvent):Promise<void>;findOwnerSessionByHash(tokenHash:string):Promise<SaasOwnerSession|null>;revokeOwnerSession(sessionId:string,revokedAt:Date,event:SaasControlEvent):Promise<void>;revokeAllOwnerSessions(revokedAt:Date,event:SaasControlEvent):Promise<number>;
 createPlan(plan:SaasPlan,event:SaasControlEvent):Promise<SaasPlan>;findPlan(id:string):Promise<SaasPlan|null>;listPlans():Promise<readonly SaasPlan[]>;
 findTenant(companyId:string):Promise<SaasTenant|null>;findTenantByCode(companyCode:string):Promise<SaasTenant|null>;listTenants():Promise<readonly SaasTenant[]>;findSubscription(companyId:string):Promise<SaasSubscription|null>;
 activate(input:{tenant:SaasTenant;subscription:SaasSubscription;payment:SaasPayment;event:SaasSubscriptionEvent;controlEvent:SaasControlEvent}):Promise<SaasSubscription>;
 findPaymentByIdempotencyKey(idempotencyKey:string):Promise<SaasPayment|null>;
 renew(input:{expectedVersion:number;subscription:SaasSubscription;payment:SaasPayment;event:SaasSubscriptionEvent;controlEvent:SaasControlEvent}):Promise<SaasSubscription>;
 changeStatus(input:{expectedVersion:number;subscription:SaasSubscription;event:SaasSubscriptionEvent;controlEvent:SaasControlEvent}):Promise<SaasSubscription>;
 recordControlEvent(event:SaasControlEvent):Promise<void>;
}
export const SAAS_REPOSITORY=Symbol('SAAS_REPOSITORY');
