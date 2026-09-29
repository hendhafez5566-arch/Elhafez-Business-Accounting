export const REPORT_KEYS=['EXECUTIVE_OVERVIEW','FINANCIAL_STATEMENTS','AR_AGING','AP_AGING','TREASURY','TAX','PROGRAM_PROFITABILITY','CRM_SALES','SUPPLIER_PROCUREMENT','HAJJ_UMRAH','EXCEPTIONS']as const;
export type OperationalReportKey=typeof REPORT_KEYS[number];
export type SavedReportVisibility='PRIVATE'|'COMPANY';
export type ReportScheduleCadence='DAILY'|'WEEKLY'|'MONTHLY';
export type ReportDeliveryChannel='IN_APP'|'EMAIL';
export interface SavedOperationalReport{readonly id:string;readonly companyId:string;readonly ownerActorId:string;readonly name:string;readonly reportKey:OperationalReportKey;readonly filters:Readonly<Record<string,unknown>>;readonly visibility:SavedReportVisibility;readonly active:boolean;readonly createdAt:string;readonly updatedAt:string}
export interface OperationalReportSchedule{readonly id:string;readonly companyId:string;readonly savedReportId:string;readonly cadence:ReportScheduleCadence;readonly hourUtc:number;readonly weekday:number|null;readonly dayOfMonth:number|null;readonly channel:ReportDeliveryChannel;readonly recipient:string|null;readonly enabled:boolean;readonly createdBy:string;readonly createdAt:string;readonly updatedAt:string}
