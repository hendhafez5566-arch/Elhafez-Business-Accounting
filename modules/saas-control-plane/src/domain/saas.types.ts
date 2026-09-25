export type TenantMode='INTERNAL'|'SUBSCRIPTION';
export type SubscriptionStatus='ACTIVE'|'PAST_DUE'|'SUSPENDED'|'CANCELLED';
export type EffectiveSubscriptionStatus=SubscriptionStatus|'EXPIRED'|'SUBSCRIPTION_REQUIRED';

export class SaasError extends Error {
  constructor(public readonly code:string,message:string){super(message);this.name='SaasError';}
}
export interface SaasTenant {companyId:string;companyCode:string;mode:TenantMode;createdAt:Date;updatedAt:Date}
export interface SaasPlan {id:string;code:string;name:string;intervalMonths:number;priceMinor:number;currency:string;entitlements:readonly string[];active:boolean;createdAt:Date}
export interface SaasSubscription {id:string;companyId:string;planId:string;status:SubscriptionStatus;currentPeriodStart:Date;currentPeriodEnd:Date;gracePeriodEnd:Date|null;entitlements:readonly string[];version:number;createdAt:Date;updatedAt:Date}
export interface SaasPayment {id:string;companyId:string;subscriptionId:string;provider:'MANUAL'|'PAYMENT_PROVIDER';reference:string;amountMinor:number;currency:string;idempotencyKey:string;payloadHash:string;paidAt:Date;createdAt:Date}
export interface SaasOwnerAccount {id:string;email:string;passwordHash:string;mfaSecretCipher:string;status:'ACTIVE'|'DISABLED';failedAttempts:number;lockedUntil:Date|null;createdAt:Date;updatedAt:Date}
export interface SaasOwnerSession {id:string;ownerId:string;tokenHash:string;authenticatedAt:Date;expiresAt:Date;revokedAt:Date|null;createdAt:Date}
export interface SaasSubscriptionEvent {id:string;companyId:string;subscriptionId:string;kind:'ACTIVATED'|'RENEWED'|'SUSPENDED'|'RESUMED'|'CANCELLED';fromStatus:string|null;toStatus:string;ownerId:string;paymentId:string|null;periodStart:Date;periodEnd:Date;metadata:Record<string,unknown>;occurredAt:Date}
export interface SaasControlEvent {id:string;ownerId:string|null;action:string;targetType:string;targetId:string|null;companyId:string|null;metadata:Record<string,unknown>;occurredAt:Date}
export interface TenantAccessProjection {companyId:string;companyCode:string|null;mode:TenantMode|null;status:EffectiveSubscriptionStatus;allowed:boolean;planId:string|null;currentPeriodEnd:Date|null;gracePeriodEnd:Date|null;entitlements:readonly string[];reason:string|null}
export interface OwnerTenantProjection extends TenantAccessProjection {subscriptionId:string|null;subscriptionVersion:number|null}
