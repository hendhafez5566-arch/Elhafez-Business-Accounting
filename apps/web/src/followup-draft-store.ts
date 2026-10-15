/** Local presentation draft only. Scheduling remains owned by crm-followups on the server. */
export interface FollowupDraft {
 readonly leadId:string;
 readonly responsibleUserId:string;
 readonly interactionType:string;
 readonly scheduledAt:string;
 readonly nextAction:string;
}
export interface DraftScope { readonly companyId:string; readonly branchId:string; readonly userId:string; }
interface StoredDraft { readonly id:string; readonly salt:Uint8Array<ArrayBuffer>; readonly iv:Uint8Array<ArrayBuffer>; readonly ciphertext:ArrayBuffer; readonly operationId?:string; }
const databaseName='elhafez.followup-drafts.v1';
const storeName='drafts';
function scopeId(scope:DraftScope):string {
 if(!scope.companyId||!scope.branchId||!scope.userId)throw new Error('يلزم تسجيل الدخول واختيار الفرع.');
 return JSON.stringify([scope.companyId,scope.branchId,scope.userId]);
}
function openDatabase():Promise<IDBDatabase> {
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(databaseName,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(storeName,{keyPath:'id'});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(new Error('تعذر فتح التخزين المحلي.'));
  request.onblocked=()=>reject(new Error('أغلق تبويبات النظام القديمة وحاول مرة أخرى.'));
 });
}
async function readRecord(id:string):Promise<StoredDraft|undefined> {
 const db=await openDatabase();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(storeName,'readonly'),request=tx.objectStore(storeName).get(id);
  let result:StoredDraft|undefined;
  request.onsuccess=()=>{result=request.result as StoredDraft|undefined;};
  tx.oncomplete=()=>resolve(result);
  tx.onabort=()=>reject(new Error('تعذر قراءة المسودة المحلية.'));
  tx.onerror=()=>reject(new Error('تعذر قراءة المسودة المحلية.'));
 });}finally{db.close();}
}
async function writeRecord(id:string,value?:StoredDraft):Promise<void> {
 const db=await openDatabase();
 try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(storeName,'readwrite'),store=tx.objectStore(storeName);
  if(value)store.put(value);else store.delete(id);
  tx.oncomplete=()=>resolve();
  tx.onabort=()=>reject(new Error('لم تُحفظ التغييرات على الجهاز. تحقق من مساحة التخزين.'));
  tx.onerror=()=>reject(new Error('لم تُحفظ التغييرات على الجهاز. تحقق من مساحة التخزين.'));
 });}catch(error){throw new Error('لم تُحفظ التغييرات على الجهاز. تحقق من مساحة التخزين.',{cause:error});}finally{db.close();}
}
async function deriveKey(secret:string,salt:Uint8Array<ArrayBuffer>) {
 if(secret.length<12)throw new Error('استخدم عبارة حماية للمسودة من ١٢ حرفًا على الأقل.');
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function validDraft(value:unknown):value is FollowupDraft {
 if(!value||typeof value!=='object')return false;
 const item=value as Partial<FollowupDraft>;
 return typeof item.leadId==='string'&&typeof item.responsibleUserId==='string'&&typeof item.scheduledAt==='string'&&typeof item.nextAction==='string'&&typeof item.interactionType==='string'&&['CALL','WHATSAPP','MEETING','EMAIL','OTHER'].includes(item.interactionType);
}
async function encryptRecord(id:string,secret:string,value:unknown,operationId?:string):Promise<StoredDraft> {
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await deriveKey(secret,salt);
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},key,new TextEncoder().encode(JSON.stringify(value)));
 return {id,salt,iv,ciphertext,...operationId?{operationId}:{}};
}
async function decryptRecord(record:StoredDraft,secret:string):Promise<unknown> {
 const key=await deriveKey(secret,record.salt);
 try{
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv,additionalData:new TextEncoder().encode(record.id)},key,record.ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
 }catch{throw new Error('تعذر فتح المسودة. راجع عبارة الحماية؛ وقد تكون البيانات المحلية تالفة.');}
}
export async function saveFollowupDraft(scope:DraftScope,secret:string,draft:FollowupDraft):Promise<void> {
 if(!validDraft(draft))throw new Error('بيانات المسودة غير صالحة.');
 await writeRecord(scopeId(scope),await encryptRecord(scopeId(scope),secret,draft));
}
export async function loadFollowupDraft(scope:DraftScope,secret:string):Promise<FollowupDraft|null> {
 const record=await readRecord(scopeId(scope));if(!record)return null;
 const value=await decryptRecord(record,secret);
 if(!validDraft(value))throw new Error('بيانات المسودة غير صالحة.');
 return value;
}
export async function deleteFollowupDraft(scope:DraftScope):Promise<void>{await writeRecord(scopeId(scope));}

export interface FollowupPayload {
 readonly leadId:string;readonly responsibleUserId:string;readonly interactionType:string;
 readonly scheduledAt:string;readonly nextAction:string;
}
export interface FollowupSubmission {
 readonly requestId:string;readonly payload:FollowupPayload;
 readonly accepted:null|{readonly id:string;readonly status:string};
}
const submissionKey=(scope:DraftScope)=>scopeId(scope)+':schedule-request-v1';
export function followupPayload(draft:FollowupDraft):FollowupPayload {
 if(!validDraft(draft)||!draft.leadId.trim()||!draft.responsibleUserId.trim()||!draft.scheduledAt||!Number.isFinite(Date.parse(draft.scheduledAt)))throw new Error('أكمل العميل والمسؤول وموعد المتابعة قبل الإرسال.');
 return {leadId:draft.leadId.trim(),responsibleUserId:draft.responsibleUserId.trim(),interactionType:draft.interactionType,scheduledAt:new Date(draft.scheduledAt).toISOString(),nextAction:draft.nextAction.trim()};
}
function validSubmission(value:unknown):value is FollowupSubmission {
 if(!value||typeof value!=='object')return false;
 const v=value as Partial<FollowupSubmission>;
 return typeof v.requestId==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/.test(v.requestId)&&validDraft(v.payload)&&Boolean(v.payload.leadId)&&Boolean(v.payload.responsibleUserId)&&Number.isFinite(Date.parse(v.payload.scheduledAt))&&(v.accepted===null||Boolean(v.accepted&&typeof v.accepted.id==='string'&&v.accepted.id&&['SCHEDULED','COMPLETED','CANCELLED'].includes(v.accepted.status)));
}
/** One atomic slot across tabs. No await between transaction read and write. */
async function compareRecord(id:string,expected:string|null,next?:StoredDraft):Promise<boolean> {
 const db=await openDatabase();
 try{return await new Promise<boolean>((resolve,reject)=>{
  const tx=db.transaction(storeName,'readwrite'),store=tx.objectStore(storeName),request=store.get(id);
  let changed=false;
  request.onsuccess=()=>{
   const existing=request.result as StoredDraft|undefined;
   if(expected===null?existing!==undefined:existing?.operationId!==expected)return;
   if(next)store.put(next);else store.delete(id);
   changed=true;
  };
  tx.oncomplete=()=>resolve(changed);
  tx.onabort=()=>reject(new Error('لم يُحفظ طلب الإرسال على الجهاز؛ لم نؤكد الجدولة.'));
  tx.onerror=()=>reject(new Error('لم يُحفظ طلب الإرسال على الجهاز؛ لم نؤكد الجدولة.'));
 });}finally{db.close();}
}
export async function loadFollowupSubmission(scope:DraftScope,secret:string):Promise<FollowupSubmission|null> {
 const record=await readRecord(submissionKey(scope));if(!record)return null;
 const value=await decryptRecord(record,secret);
 if(!validSubmission(value)||record.operationId!==value.requestId)throw new Error('طلب الإرسال المحفوظ غير صالح.');
 return value;
}
export async function prepareFollowupSubmission(scope:DraftScope,secret:string,payload:FollowupPayload):Promise<FollowupSubmission> {
 const normalized=followupPayload(payload),key=submissionKey(scope);
 for(let attempt=0;attempt<3;attempt++){
  const current=await loadFollowupSubmission(scope,secret);
  if(current){
   if(current.accepted)throw new Error('الطلب السابق مؤكّد بالفعل. اضغط بدء متابعة جديدة أولًا.');
   if(JSON.stringify(current.payload)!==JSON.stringify(normalized))throw new Error('يوجد طلب إرسال محفوظ ببيانات مختلفة. استرجعه وراجع نتيجته قبل بدء متابعة أخرى.');
   return current;
  }
  const value:FollowupSubmission={requestId:crypto.randomUUID(),payload:normalized,accepted:null};
  if(await compareRecord(key,null,await encryptRecord(key,secret,value,value.requestId)))return value;
 }
 throw new Error('تغير طلب الإرسال في تبويب آخر. استرجع الطلب المحفوظ وحاول مرة أخرى.');
}
export async function acceptFollowupSubmission(scope:DraftScope,secret:string,value:FollowupSubmission,result:{id:string;status:string}):Promise<void> {
 const next:FollowupSubmission={...value,accepted:result},key=submissionKey(scope);
 if(!next.accepted||!validSubmission(next))throw new Error('رد الجدولة غير صالح؛ طلب الإرسال ما زال محفوظًا لإعادة المحاولة.');
 if(!await compareRecord(key,value.requestId,await encryptRecord(key,secret,next,value.requestId)))throw new Error('تغير الطلب المحفوظ في تبويب آخر. استرجع حالته قبل المتابعة.');
}
export async function clearAcceptedFollowupSubmission(scope:DraftScope,secret:string):Promise<void> {
 const current=await loadFollowupSubmission(scope,secret);if(!current)return;
 if(!current.accepted)throw new Error('لا يمكن حذف طلب لم تتأكد نتيجته. أعد المحاولة بنفس الطلب أولًا.');
 if(!await compareRecord(submissionKey(scope),current.requestId))throw new Error('تغير الطلب في تبويب آخر. استرجع حالته أولًا.');
}
