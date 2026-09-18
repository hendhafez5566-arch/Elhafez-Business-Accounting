import { ContractValidationError, decimalAmount, type DecimalAmount } from '@elhafez/contracts';

export type FinancialAction = 'PAYMENT' | 'PAID_EXPENSE';
export type ApprovalOutcome = 'APPROVAL_NOT_REQUIRED' | 'APPROVAL_REQUIRED';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type MutationKind = 'CREATE' | 'UPDATE' | 'DELETE' | 'REVERSE';
export type ReconciliationType = 'SUBLEDGER_TO_GL' | 'TAX_TO_GL' | 'INTEGRITY' | 'CLOSE_READINESS';

export interface ApprovalPolicy { readonly id: string; readonly companyId: string; readonly action: FinancialAction; readonly threshold: DecimalAmount; readonly active: boolean; readonly forbidSelfApproval: boolean; readonly requiredAuthority: string }
export interface ApprovalRequest { readonly id: string; readonly companyId: string; readonly branchId?: string; readonly action: FinancialAction; readonly sourceType: string; readonly sourceId: string; readonly requesterActorId: string; readonly amount: DecimalAmount; readonly status: ApprovalStatus; readonly policyId: string; readonly policyThresholdSnapshot: DecimalAmount; readonly policyForbidSelfApprovalSnapshot: boolean; readonly policyRequiredAuthoritySnapshot: string; readonly requestedAt: string }
export interface ApprovalDecision { readonly id: string; readonly requestId: string; readonly companyId: string; readonly outcome: Exclude<ApprovalStatus, 'PENDING'>; readonly actorId: string; readonly reason?: string; readonly decidedAt: string }

function parts(value: DecimalAmount): [bigint, number] { const [whole, fraction = ''] = value.split('.'); return [BigInt(whole! + fraction), fraction.length]; }
export function compareDecimal(left: unknown, right: unknown): number { const l = decimalAmount(left); const r = decimalAmount(right); const [a, as] = parts(l); const [b, bs] = parts(r); const scale = Math.max(as, bs); const av = a * 10n ** BigInt(scale - as); const bv = b * 10n ** BigInt(scale - bs); return av < bv ? -1 : av > bv ? 1 : 0; }
export function subtractDecimal(left: unknown, right: unknown): DecimalAmount { const l = decimalAmount(left); const r = decimalAmount(right); const [a, as] = parts(l); const [b, bs] = parts(r); const scale = Math.max(as, bs); let coefficient = a * 10n ** BigInt(scale-as) - b * 10n ** BigInt(scale-bs); const negative = coefficient < 0n; if (negative) coefficient = -coefficient; let digits = coefficient.toString().padStart(scale + 1, '0'); if (scale) digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, ''); return decimalAmount(`${negative && digits !== '0' ? '-' : ''}${digits}`); }
export function requireText(value: string, field: string): void { if (!value?.trim()) throw new ContractValidationError(field, 'is required'); }
