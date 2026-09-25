import type {OwnerCompany,OwnerPlan} from './owner-client.js';

export const previewPlans:readonly OwnerPlan[]=[
 {id:'plan-business',code:'BUSINESS_MONTHLY',name:'Business Monthly',intervalMonths:1,priceMinor:1280000,currency:'EGP',entitlements:['*'],active:true,createdAt:'2026-09-01T00:00:00.000Z'},
 {id:'plan-pro',code:'PROFESSIONAL_MONTHLY',name:'Professional Monthly',intervalMonths:1,priceMinor:1850000,currency:'EGP',entitlements:['*'],active:true,createdAt:'2026-09-01T00:00:00.000Z'}
];

export const previewCompanies:readonly OwnerCompany[]=[
 {company:{id:'cmp-alnour',name:'شركة النور للسياحة',active:true,createdAt:'2026-09-03T09:00:00.000Z'},companyId:'cmp-alnour',companyCode:'ELH-NOUR-2847',mode:'SUBSCRIPTION',status:'ACTIVE',allowed:true,planId:'plan-business',currentPeriodEnd:'2026-10-25T23:59:59.000Z',gracePeriodEnd:null,entitlements:['*'],reason:null,subscriptionId:'sub-alnour',subscriptionVersion:3},
 {company:{id:'cmp-safa',name:'شركة الصفا للحج والعمرة',active:true,createdAt:'2026-09-05T09:00:00.000Z'},companyId:'cmp-safa',companyCode:'ELH-SAFA-5192',mode:'SUBSCRIPTION',status:'EXPIRED',allowed:false,planId:'plan-pro',currentPeriodEnd:'2026-09-20T23:59:59.000Z',gracePeriodEnd:null,entitlements:['*'],reason:'SUBSCRIPTION_EXPIRED',subscriptionId:'sub-safa',subscriptionVersion:2},
 {company:{id:'cmp-aman',name:'شركة الأمان للخدمات السياحية',active:false,createdAt:'2026-09-08T09:00:00.000Z'},companyId:'cmp-aman',companyCode:'ELH-AMAN-7310',mode:'SUBSCRIPTION',status:'SUSPENDED',allowed:false,planId:'plan-business',currentPeriodEnd:'2026-10-12T23:59:59.000Z',gracePeriodEnd:null,entitlements:['*'],reason:'SUBSCRIPTION_SUSPENDED',subscriptionId:'sub-aman',subscriptionVersion:4},
 {company:{id:'cmp-internal',name:'Elhafez Internal',active:true,createdAt:'2026-09-01T09:00:00.000Z'},companyId:'cmp-internal',companyCode:'ELH-INTERNAL',mode:'INTERNAL',status:'ACTIVE',allowed:true,planId:null,currentPeriodEnd:null,gracePeriodEnd:null,entitlements:['*'],reason:null,subscriptionId:null,subscriptionVersion:null}
];
