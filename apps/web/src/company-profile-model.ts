import type {AdministrationClient,AdministrationContext} from './system-administration-client.js';

export const CONFIG_FIELD_KEYS=['address','phone','email','locale','timezone','dateFormat','retention.days'] as const;
export type ConfigFieldKey=(typeof CONFIG_FIELD_KEYS)[number];

export interface CompanyProfileForm{name:string;address:string;phone:string;email:string;locale:string;timezone:string;dateFormat:string;retentionDays:string}
export const emptyCompanyProfileForm:CompanyProfileForm={name:'',address:'',phone:'',email:'',locale:'',timezone:'',dateFormat:'',retentionDays:''};

const FORM_FIELD_BY_KEY:Record<ConfigFieldKey,keyof CompanyProfileForm>={address:'address',phone:'phone',email:'email',locale:'locale',timezone:'timezone',dateFormat:'dateFormat','retention.days':'retentionDays'};
const CLEARABLE_KEYS:ReadonlySet<ConfigFieldKey>=new Set<ConfigFieldKey>(['address','phone','email']);

export interface Option{value:string;label:string}
export const LOCALE_OPTIONS:readonly Option[]=[{value:'ar',label:'العربية'},{value:'en',label:'English'}];
export const TIMEZONE_OPTIONS:readonly Option[]=[
 {value:'Africa/Cairo',label:'القاهرة'},{value:'Asia/Riyadh',label:'الرياض'},{value:'Asia/Dubai',label:'دبي'},{value:'Asia/Kuwait',label:'الكويت'},
 {value:'Asia/Qatar',label:'الدوحة'},{value:'Asia/Amman',label:'عمّان'},{value:'Europe/Istanbul',label:'إسطنبول'},{value:'UTC',label:'التوقيت العالمي (UTC)'}
];
export const DATE_FORMAT_OPTIONS:readonly Option[]=[
 {value:'DD/MM/YYYY',label:'يوم/شهر/سنة — 31/12/2026'},{value:'YYYY-MM-DD',label:'سنة-شهر-يوم — 2026-12-31'},{value:'MM/DD/YYYY',label:'شهر/يوم/سنة — 12/31/2026'}
];

export function withCurrentOption(options:readonly Option[],current:string):readonly Option[]{return current&&!options.some(option=>option.value===current)?[...options,{value:current,label:current}]:options;}
function record(value:unknown):Record<string,unknown>{return typeof value==='object'&&value!==null?value as Record<string,unknown>:{};}
export function scalar(value:unknown):string{if(typeof value==='string')return value;if(typeof value==='number'&&Number.isFinite(value))return String(value);return '';}

export async function loadCompanyProfile(client:Pick<AdministrationClient,'read'>,context:AdministrationContext):Promise<CompanyProfileForm>{
 const [company,...configs]=await Promise.allSettled([client.read(`companies/${encodeURIComponent(context.companyId)}`,context),...CONFIG_FIELD_KEYS.map(key=>client.read(`configuration/${key}`,context))]);
 const form:CompanyProfileForm={...emptyCompanyProfileForm};
 if(company&&company.status==='fulfilled')form.name=scalar(record(company.value).name);
 CONFIG_FIELD_KEYS.forEach((key,index)=>{const result=configs[index];if(result&&result.status==='fulfilled')form[FORM_FIELD_BY_KEY[key]]=scalar(record(result.value).value);});
 return form;
}

export type ValidationResult={ok:true}|{ok:false;errors:string[]};
export function validateCompanyProfile(form:CompanyProfileForm,initial:CompanyProfileForm=emptyCompanyProfileForm):ValidationResult{
 const errors:string[]=[];const name=form.name.trim();
 if(name!==initial.name.trim()&&(name.length<2||name.length>200))errors.push('اسم الشركة يجب ألا يكون فارغًا ولا يتجاوز 200 حرف.');
 const email=form.email.trim();if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))errors.push('البريد الإلكتروني غير صحيح.');
 const phone=form.phone.trim();if(phone&&!/^\+?[\d\u0660-\u0669\s\-()]{5,20}$/.test(phone))errors.push('رقم الهاتف غير صحيح.');
 const retention=form.retentionDays.trim();if(retention&&(!/^\d+$/.test(retention)||!Number.isSafeInteger(Number(retention))||Number(retention)<1))errors.push('مدة الاحتفاظ يجب أن تكون عددًا صحيحًا من الأيام لا يقل عن 1.');
 return errors.length?{ok:false,errors}:{ok:true};
}

export function changedConfigEntries(form:CompanyProfileForm,initial:CompanyProfileForm):Array<readonly [ConfigFieldKey,string|number]>{
 const entries:Array<readonly [ConfigFieldKey,string|number]>=[];
 for(const key of CONFIG_FIELD_KEYS){const field=FORM_FIELD_BY_KEY[key],next=form[field].trim(),previous=initial[field].trim();if(next===previous)continue;if(next===''&&!CLEARABLE_KEYS.has(key))continue;entries.push([key,key==='retention.days'?Number(next):next]);}
 return entries;
}

export class CompanyProfileValidationError extends Error{readonly errors:readonly string[];constructor(errors:readonly string[]){super(errors.join(' | '));this.name='CompanyProfileValidationError';this.errors=errors;}}

export async function saveCompanyProfile(client:Pick<AdministrationClient,'action'|'patch'>,context:AdministrationContext,form:CompanyProfileForm,initial:CompanyProfileForm):Promise<{saved:string[]}>{
 const check=validateCompanyProfile(form,initial);if(!check.ok)throw new CompanyProfileValidationError(check.errors);const saved:string[]=[];
 if(form.name.trim()!==initial.name.trim()){await client.patch(`companies/${encodeURIComponent(context.companyId)}`,context,{name:form.name.trim()});saved.push('name');}
 for(const [key,value] of changedConfigEntries(form,initial)){await client.action(`configuration/${key}`,context,{value});saved.push(key);}
 return {saved};
}

export type StatusKind='AVAILABLE'|'UNAVAILABLE'|'CONFIGURATION_REQUIRED'|'INFO';
export interface StatusRow{key:string;label:string;kind:StatusKind;text:string}
const STATUS_TEXT={AVAILABLE:'متاح',UNAVAILABLE:'غير متاح',CONFIGURATION_REQUIRED:'يتطلب إعدادًا'} as const;
function codeRow(key:string,label:string,value:unknown):StatusRow|null{if(typeof value!=='string'||!value)return null;if(value==='AVAILABLE'||value==='UNAVAILABLE'||value==='CONFIGURATION_REQUIRED')return{key,label,kind:value,text:STATUS_TEXT[value]};return{key,label,kind:'INFO',text:value};}
export function operationsStatusRows(diagnostics:unknown,retentionDays:string):StatusRow[]{
 const source=record(diagnostics),rows:StatusRow[]=[];const push=(row:StatusRow|null)=>{if(row)rows.push(row);};
 push(codeRow('database','قاعدة البيانات',source.database));push(codeRow('backupProvider','موفر النسخ الاحتياطي',source.backupProvider));
 if(typeof source.restoreReady==='boolean')rows.push(source.restoreReady?{key:'restoreReady',label:'جاهزية الاستعادة',kind:'AVAILABLE',text:'جاهزة تقنيًا — التنفيذ من مركز تحكم المالك فقط'}:{key:'restoreReady',label:'جاهزية الاستعادة',kind:'UNAVAILABLE',text:'غير جاهزة'});
 if(typeof source.maintenance==='boolean')rows.push({key:'maintenance',label:'وضع الصيانة',kind:'INFO',text:source.maintenance?'مفعّل':'غير مفعّل'});
 push(codeRow('schemaCompatibility','توافق المخطط',source.schemaCompatibility));if(typeof source.runtimeVersion==='string'&&source.runtimeVersion)rows.push({key:'runtimeVersion',label:'إصدار التشغيل',kind:'INFO',text:source.runtimeVersion});
 const retention=retentionDays.trim();rows.push(retention?{key:'retention',label:'مدة الاحتفاظ بالبيانات',kind:'AVAILABLE',text:`${retention} يومًا`}:{key:'retention',label:'مدة الاحتفاظ بالبيانات',kind:'CONFIGURATION_REQUIRED',text:STATUS_TEXT.CONFIGURATION_REQUIRED});return rows;
}
