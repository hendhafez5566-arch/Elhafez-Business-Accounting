import { decryptRecord, encryptRecord, type EncryptedLocalRecord } from './encrypted-local-record.js';
import type { DraftScope } from './followup-draft-store.js';
export type OfflineOperation='BOOKING_CREATE'|'BOOKING_CONFIRM'|'BOOKING_DEPOSIT';
export interface DeviceGrant {readonly id:string;readonly companyId:string;readonly branchId:string;readonly actorId:string;readonly deviceId:string;readonly operations:readonly OfflineOperation[];readonly issuedAt:string;readonly expiresAt:string;readonly revokedAt:string|null;}
export interface QueuedCommand {readonly id:string;readonly grantId:string;readonly deviceId:string;readonly operation:OfflineOperation;readonly payload:unknown;readonly dependencies:readonly string[];readonly capturedAt:string;readonly state:'PENDING'|'ACCEPTED'|'REVIEW';readonly reason:string|null;readonly result:unknown;}
export interface CashCatalog {readonly invoices?:readonly {id:string;bookingId:string;label:string}[];readonly bookings:readonly {id:string;label:string}[];readonly treasuries:readonly {id:string;label:string}[];}
export interface CommandVault {readonly cashCatalog?:CashCatalog;readonly grant:DeviceGrant|null;readonly lastSeen:number;readonly items:readonly QueuedCommand[];}
interface RecordValue extends EncryptedLocalRecord {readonly revision:string;}
const store='vaults',database='elhafez.core-commands.v1';
function key(scope:DraftScope){if(!scope.companyId||!scope.branchId||!scope.userId)throw Error('يلزم اختيار الشركة والفرع والمستخدم.');return JSON.stringify([scope.companyId,scope.branchId,scope.userId]);}
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const q=indexedDB.open(database,1);q.onupgradeneeded=()=>q.result.createObjectStore(store,{keyPath:'id'});q.onsuccess=()=>{q.result.onversionchange=()=>q.result.close();resolve(q.result);};q.onerror=()=>reject(Error('تعذر فتح سجل الطلبات المحلي.'));q.onblocked=()=>reject(Error('أغلق التبويبات القديمة وحاول مجددًا.'));});}
async function read(id:string):Promise<RecordValue|undefined>{const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),q=tx.objectStore(store).get(id);let result:RecordValue|undefined;q.onsuccess=()=>result=q.result as RecordValue|undefined;tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(Error('تعذر قراءة السجل المحلي.'));});}finally{db.close();}}
function valid(value:unknown):value is CommandVault {
 if(!value||typeof value!=='object')return false;const x=value as Partial<CommandVault>;
 return typeof x.lastSeen==='number'&&Number.isFinite(x.lastSeen)&&Array.isArray(x.items)&&x.items.length<=500&&x.items.every(v=>v&&typeof v.id==='string'&&typeof v.grantId==='string'&&typeof v.deviceId==='string'&&['BOOKING_CREATE','BOOKING_CONFIRM','BOOKING_DEPOSIT'].includes(v.operation)&&['PENDING','ACCEPTED','REVIEW'].includes(v.state)&&Array.isArray(v.dependencies)&&typeof v.capturedAt==='string')&&(x.grant===null||!!x.grant&&typeof x.grant.id==='string'&&typeof x.grant.deviceId==='string'&&typeof x.grant.expiresAt==='string'&&typeof x.grant.issuedAt==='string'&&Array.isArray(x.grant.operations));
}
export async function loadCommandVault(scope:DraftScope,secret:string):Promise<CommandVault>{const row=await read(key(scope));if(!row)return {grant:null,lastSeen:0,items:[]};const value=await decryptRecord(row,secret);if(!valid(value))throw Error('السجل المشفر غير صالح.');return value;}
async function update(scope:DraftScope,secret:string,apply:(v:CommandVault)=>CommandVault){
 const id=key(scope),prior=await read(id);let old:CommandVault={grant:null,lastSeen:0,items:[]};
 if(prior){const value=await decryptRecord(prior,secret);if(!valid(value))throw Error('السجل المشفر غير صالح.');old=value;}
 const value=apply(old),sealed=await encryptRecord(id,secret,value),next={...sealed,revision:crypto.randomUUID()},db=await open();
 try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(store,'readwrite'),table=tx.objectStore(store),q=table.get(id);q.onsuccess=()=>{const current=q.result as RecordValue|undefined;if(current?.revision!==prior?.revision){tx.abort();return;}table.put(next);};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(Error('لم يُحفظ التغيير؛ قد تغير السجل في تبويب آخر أو امتلأ التخزين. أعد تحميله وحاول مجددًا.'));});}finally{db.close();}
 return value;
}
export async function saveDeviceGrant(scope:DraftScope,secret:string,grant:DeviceGrant){if(grant.companyId!==scope.companyId||grant.branchId!==scope.branchId||grant.actorId!==scope.userId)throw Error('تفويض يخص نطاقًا مختلفًا.');return update(scope,secret,v=>({...v,grant,lastSeen:Math.max(v.lastSeen,Date.now())}));}
export async function saveCashCatalog(scope:DraftScope,secret:string,cashCatalog:CashCatalog){return update(scope,secret,v=>({...v,cashCatalog}));}
export function assertCapture(v:CommandVault,scope:DraftScope,operation:OfflineOperation,now:number){
 const g=v.grant;if(!g||g.companyId!==scope.companyId||g.branchId!==scope.branchId||g.actorId!==scope.userId||!g.operations.includes(operation))throw Error('يلزم تفويض مسبق لهذه العملية والشركة والفرع.');
 if(now<v.lastSeen||now<Date.parse(g.issuedAt))throw Error('تراجعت ساعة الجهاز؛ يلزم الاتصال بالخادم والمراجعة.');
 if((g.revokedAt||now>=Date.parse(g.expiresAt))&&operation!=='BOOKING_DEPOSIT')throw Error('انتهى التفويض؛ لا يمكن إنشاء طلب حجز جديد.');
}
export async function enqueueCommand(scope:DraftScope,secret:string,operation:OfflineOperation,payload:unknown,dependencies:readonly string[]=[],now=Date.now()){
 return update(scope,secret,v=>{assertCapture(v,scope,operation,now);if(v.items.length>=500)throw Error('بلغ سجل الجهاز 500 طلب؛ صدّر نسخة وراجع الطلبات.');const g=v.grant!;return {...v,lastSeen:now,items:[...v.items,{id:crypto.randomUUID(),grantId:g.id,deviceId:g.deviceId,operation,payload:structuredClone(payload),dependencies:[...dependencies],capturedAt:new Date(now).toISOString(),state:'PENDING',reason:operation==='BOOKING_DEPOSIT'?'إثبات استلام مؤقت؛ لا يسدد الحساب قبل الاعتماد.':null,result:null}]};});
}
export async function recordCommandResult(scope:DraftScope,secret:string,id:string,result:{state:string;reason:string|null;result:unknown}){
 if(!['PENDING','PROCESSING','ACCEPTED','REVIEW'].includes(result.state))throw Error('رد المزامنة غير صالح؛ الطلب محفوظ.');
 return update(scope,secret,v=>({...v,items:v.items.map(item=>item.id!==id||item.state==='ACCEPTED'?item:{...item,state:result.state==='PROCESSING'?'PENDING':result.state as QueuedCommand['state'],reason:result.reason,result:result.result})}));
}
function base64(v:Uint8Array<ArrayBuffer>){return btoa(Array.from(v,x=>String.fromCharCode(x)).join(''));}
function bytes(v:string){return Uint8Array.from(atob(v),x=>x.charCodeAt(0));}
export async function exportCommandVault(scope:DraftScope,secret:string){const v=await loadCommandVault(scope,secret),r=await encryptRecord(key(scope),secret,v);return JSON.stringify({format:'elhafez-core-commands',version:1,scope,salt:base64(r.salt),iv:base64(r.iv),ciphertext:base64(new Uint8Array(r.ciphertext))});}
/** Compare only immutable request data; server receipts and local display state may evolve. */
export function commandIdentity(value:QueuedCommand):string {
 const canonical=(v:unknown):string=>{
  if(v===null||typeof v!=='object'){const encoded=JSON.stringify(v);if(encoded===undefined)throw Error('بيانات الطلب ليست JSON صالحة.');return encoded;}
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  return '{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+':'+canonical(x)).join(',')+'}';
 };
 return canonical({id:value.id,grantId:value.grantId,deviceId:value.deviceId,operation:value.operation,payload:value.payload,dependencies:value.dependencies,capturedAt:value.capturedAt});
}
export async function importCommandVault(scope:DraftScope,secret:string,text:string){
 if(new TextEncoder().encode(text).length>10*1024*1024)throw Error('النسخة أكبر من الحد المدعوم.');
 const file=JSON.parse(text) as {format:string;version:number;scope:DraftScope;salt:string;iv:string;ciphertext:string};
 if(file.format!=='elhafez-core-commands'||file.version!==1||key(file.scope)!==key(scope))throw Error('نسخة غير متوافقة أو تخص نطاقًا آخر.');
 const value=await decryptRecord({id:key(scope),salt:bytes(file.salt),iv:bytes(file.iv),ciphertext:bytes(file.ciphertext).buffer},secret);
 if(!valid(value))throw Error('النسخة المشفرة غير صالحة.');
 return update(scope,secret,old=>{const items=[...old.items];for(const item of value.items){const prior=items.find(x=>x.id===item.id);if(prior&&commandIdentity(prior)!==commandIdentity(item))throw Error('تعارض هوية في النسخة؛ لم يُستبدل الطلب الأصلي.');if(!prior)items.push({...item,state:'PENDING',result:null,reason:'نسخة مستعادة؛ يلزم التحقق من إيصال الخادم بنفس الهوية.'});}if(items.length>500)throw Error('النسخة تتجاوز سعة سجل الجهاز.');return {cashCatalog:old.cashCatalog??value.cashCatalog,grant:old.grant??value.grant,lastSeen:Math.max(old.lastSeen,value.lastSeen),items};});
}
