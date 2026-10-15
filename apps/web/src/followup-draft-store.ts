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
const headStore='submissionHeads';
interface SubmissionHead {readonly id:string;readonly requestId:string|null;readonly revision:string;}
function scopeId(scope:DraftScope):string {
 if(!scope.companyId||!scope.branchId||!scope.userId)throw new Error('يلزم تسجيل الدخول واختيار الفرع.');
 return JSON.stringify([scope.companyId,scope.branchId,scope.userId]);
}
function openDatabase():Promise<IDBDatabase> {
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(databaseName,2);
  request.onupgradeneeded=()=>{for(const name of [storeName,headStore])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id'});};
  request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
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
 readonly requestId:string;readonly payload:FollowupPayload;readonly savedAt?:string;
 readonly accepted:null|{readonly id:string;readonly status:string};
}
const legacySubmissionKey=(scope:DraftScope)=>scopeId(scope)+':schedule-request-v1';
const queuePrefix=(scope:DraftScope)=>scopeId(scope)+':schedule-queue-v2:';
function submissionKey(scope:DraftScope,requestId:string){if(!/^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/.test(requestId))throw new Error('هوية طلب الإرسال غير صالحة.');return queuePrefix(scope)+requestId;}
export function followupPayload(draft:FollowupDraft):FollowupPayload {
 if(!validDraft(draft)||!draft.leadId.trim()||!draft.responsibleUserId.trim()||!draft.scheduledAt||!Number.isFinite(Date.parse(draft.scheduledAt)))throw new Error('أكمل العميل والمسؤول وموعد المتابعة قبل الإرسال.');
 return {leadId:draft.leadId.trim(),responsibleUserId:draft.responsibleUserId.trim(),interactionType:draft.interactionType,scheduledAt:new Date(draft.scheduledAt).toISOString(),nextAction:draft.nextAction.trim()};
}
function validSubmission(value:unknown):value is FollowupSubmission {
 if(!value||typeof value!=='object')return false;
 const v=value as Partial<FollowupSubmission>;
 return (v.savedAt===undefined||typeof v.savedAt==='string'&&Number.isFinite(Date.parse(v.savedAt)))&&typeof v.requestId==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/.test(v.requestId)&&validDraft(v.payload)&&Boolean(v.payload.leadId)&&Boolean(v.payload.responsibleUserId)&&Number.isFinite(Date.parse(v.payload.scheduledAt))&&(v.accepted===null||Boolean(v.accepted&&typeof v.accepted.id==='string'&&v.accepted.id&&['SCHEDULED','COMPLETED','CANCELLED'].includes(v.accepted.status)));
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
async function readHead(scope:DraftScope):Promise<SubmissionHead|undefined>{
 const db=await openDatabase();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(headStore,'readonly'),q=tx.objectStore(headStore).get(scopeId(scope));let value:SubmissionHead|undefined;
  q.onsuccess=()=>{value=q.result as SubmissionHead|undefined;};tx.oncomplete=()=>resolve(value);
  tx.onabort=()=>reject(new Error('تعذر قراءة اختيار القائمة.'));tx.onerror=()=>reject(new Error('تعذر قراءة اختيار القائمة.'));
 });}finally{db.close();}
}
async function queueRecords(scope:DraftScope,firstOnly=false):Promise<StoredDraft[]>{
 const db=await openDatabase(),prefix=queuePrefix(scope);
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(storeName,'readonly'),q=tx.objectStore(storeName).getAll(IDBKeyRange.bound(prefix,prefix+'\uffff'),firstOnly?1:undefined);let values:StoredDraft[]=[];
  q.onsuccess=()=>{values=q.result as StoredDraft[];};tx.oncomplete=()=>resolve(values);
  tx.onabort=()=>reject(new Error('تعذر قراءة قائمة الإرسال.'));tx.onerror=()=>reject(new Error('تعذر قراءة قائمة الإرسال.'));
 });}finally{db.close();}
}
async function decodeSubmission(record:StoredDraft,secret:string):Promise<FollowupSubmission>{
 const value=await decryptRecord(record,secret);
 if(!validSubmission(value)||record.operationId!==value.requestId)throw new Error('طلب الإرسال المحفوظ غير صالح.');
 return value;
}
/** Atomically migrate the old encrypted slot without dropping its identity or payload. */
async function migrateLegacySubmission(scope:DraftScope,secret:string):Promise<void>{
 const oldKey=legacySubmissionKey(scope),old=await readRecord(oldKey);if(!old)return;
 const original=await decodeSubmission(old,secret),value={...original,savedAt:original.savedAt??new Date().toISOString()};
 const record=await encryptRecord(submissionKey(scope,value.requestId),secret,value,value.requestId),db=await openDatabase();
 try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction([storeName,headStore],'readwrite'),store=tx.objectStore(storeName),heads=tx.objectStore(headStore),q=store.get(oldKey);
  q.onsuccess=()=>{
   const current=q.result as StoredDraft|undefined;if(!current)return;
   if(current.operationId!==value.requestId){tx.abort();return;}
   const target=store.get(record.id);target.onsuccess=()=>{
    if(target.result){tx.abort();return;}
    store.put(record);store.delete(oldKey);
    const head=heads.get(scopeId(scope));head.onsuccess=()=>{if(!head.result)heads.put({id:scopeId(scope),requestId:value.requestId,revision:crypto.randomUUID()});};
   };
  };
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(new Error('لم يتم ترحيل الطلب القديم؛ احتفظنا بالبيانات الأصلية.'));
  tx.onerror=()=>reject(new Error('لم يتم ترحيل الطلب القديم؛ احتفظنا بالبيانات الأصلية.'));
 });}finally{db.close();}
}
async function validateQueueSecret(scope:DraftScope,secret:string):Promise<void>{
 const first=(await queueRecords(scope,true))[0];if(first)await decodeSubmission(first,secret);
 // Derivation still validates the minimum length on the first empty queue write.
}
async function changeHead(scope:DraftScope,expected:string|null,nextRequestId:string|null,record?:StoredDraft):Promise<boolean>{
 const db=await openDatabase();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction([storeName,headStore],'readwrite'),heads=tx.objectStore(headStore),q=heads.get(scopeId(scope));let changed=false;
  q.onsuccess=()=>{
   const current=q.result as SubmissionHead|undefined;if((current?.revision??null)!==expected)return;
   if(record)tx.objectStore(storeName).add(record);
   heads.put({id:scopeId(scope),requestId:nextRequestId,revision:crypto.randomUUID()});changed=true;
  };
  tx.oncomplete=()=>resolve(changed);tx.onabort=()=>reject(new Error('لم يُحفظ طلب الإرسال على الجهاز؛ الطلبات السابقة محفوظة.'));
  tx.onerror=()=>reject(new Error('لم يُحفظ طلب الإرسال على الجهاز؛ الطلبات السابقة محفوظة.'));
 });}finally{db.close();}
}
export async function listFollowupSubmissions(scope:DraftScope,secret:string):Promise<FollowupSubmission[]>{
 await migrateLegacySubmission(scope,secret);
 const rows=await queueRecords(scope),values=await Promise.all(rows.map(record=>decodeSubmission(record,secret)));
 return values.sort((a,b)=>(a.savedAt??'').localeCompare(b.savedAt??'')||a.requestId.localeCompare(b.requestId));
}
export async function loadFollowupSubmission(scope:DraftScope,secret:string,requestId?:string):Promise<FollowupSubmission|null>{
 await migrateLegacySubmission(scope,secret);
 const id=requestId??(await readHead(scope))?.requestId;if(!id)return null;
 const record=await readRecord(submissionKey(scope,id));if(!record)throw new Error('الطلب المختار غير موجود. استرجع القائمة وراجع الاختيار.');
 return decodeSubmission(record,secret);
}
export async function prepareFollowupSubmission(scope:DraftScope,secret:string,payload:FollowupPayload,selectedId?:string):Promise<FollowupSubmission>{
 const normalized=followupPayload(payload);await migrateLegacySubmission(scope,secret);
 const head=await readHead(scope),id=selectedId??head?.requestId;
 const check=(current:FollowupSubmission)=>{
  if(current.accepted)throw new Error('الطلب السابق مؤكّد بالفعل. اضغط بدء متابعة جديدة أولًا.');
  if(JSON.stringify(current.payload)!==JSON.stringify(normalized))throw new Error('يوجد طلب إرسال محفوظ ببيانات مختلفة. استرجعه أو ابدأ متابعة أخرى مع الاحتفاظ به.');
  return current;
 };
 if(id){const current=await loadFollowupSubmission(scope,secret,id);if(!current)throw new Error('الطلب المختار غير موجود.');return check(current);}
 await validateQueueSecret(scope,secret);
 const value:FollowupSubmission={requestId:crypto.randomUUID(),payload:normalized,accepted:null,savedAt:new Date().toISOString()};
 const record=await encryptRecord(submissionKey(scope,value.requestId),secret,value,value.requestId);
 if(await changeHead(scope,head?.revision??null,value.requestId,record))return value;
 const currentHead=await readHead(scope);
 if(!currentHead?.requestId)throw new Error('تغير اختيار القائمة في تبويب آخر. استرجع القائمة قبل المحاولة.');
 const current=await loadFollowupSubmission(scope,secret,currentHead.requestId);if(!current)throw new Error('تغير اختيار القائمة.');return check(current);
}
export async function acceptFollowupSubmission(scope:DraftScope,secret:string,value:FollowupSubmission,result:{id:string;status:string}):Promise<void>{
 const next:FollowupSubmission={...value,accepted:result},key=submissionKey(scope,value.requestId);
 if(!next.accepted||!validSubmission(next))throw new Error('رد الجدولة غير صالح؛ طلب الإرسال ما زال محفوظًا لإعادة المحاولة.');
 if(!await compareRecord(key,value.requestId,await encryptRecord(key,secret,next,value.requestId)))throw new Error('تغير الطلب المحفوظ في تبويب آخر. استرجع حالته قبل المتابعة.');
}
/** Release selection only. Accepted rows remain visible in local history. */
export async function clearAcceptedFollowupSubmission(scope:DraftScope,secret:string,requestId?:string):Promise<void>{
 const current=await loadFollowupSubmission(scope,secret,requestId);if(!current)return;
 if(!current.accepted)throw new Error('لا يمكن حذف طلب لم تتأكد نتيجته. أعد المحاولة أو ابدأ متابعة أخرى مع الاحتفاظ به.');
 const head=await readHead(scope);
 if(head?.requestId===current.requestId&&!await changeHead(scope,head.revision,null))throw new Error('تغير اختيار القائمة في تبويب آخر.');
}
/** Explicit new intent; never modifies or deletes any prior pending/accepted row. */
export async function beginAnotherFollowupSubmission(scope:DraftScope,secret:string):Promise<void>{
 if(secret.length<12)throw new Error('استخدم عبارة حماية للمسودة من ١٢ حرفًا على الأقل.');
 await migrateLegacySubmission(scope,secret);await validateQueueSecret(scope,secret);
 const head=await readHead(scope);
 if(!await changeHead(scope,head?.revision??null,null))throw new Error('تغير اختيار القائمة في تبويب آخر. استرجع القائمة وحاول مرة أخرى.');
}

/** Minimal presentation references, never an offline authorization grant or customer record. */
export interface FollowupLeadReference {
 readonly id:string;readonly number:string;readonly displayName:string;
 readonly status:'NEW'|'CONTACTED'|'QUALIFIED'|'QUOTED'|'WON'|'LOST';
}
export interface FollowupUserReference {readonly id:string;readonly displayName:string;}
export interface FollowupReferences {
 readonly capturedAt:string;
 readonly leads:readonly FollowupLeadReference[];
 readonly users:readonly FollowupUserReference[];
}
const referencesKey=(scope:DraftScope)=>scopeId(scope)+':references-v1';
function validReferences(value:unknown):value is FollowupReferences {
 if(!value||typeof value!=='object')return false;
 const item=value as Partial<FollowupReferences>;
 const text=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=2048;
 if(typeof item.capturedAt!=='string'||!Number.isFinite(Date.parse(item.capturedAt))||!Array.isArray(item.leads)||!Array.isArray(item.users))return false;
 if(!item.leads.every(v=>v&&text(v.id)&&text(v.number)&&text(v.displayName)&&['NEW','CONTACTED','QUALIFIED','QUOTED','WON','LOST'].includes(v.status)))return false;
 if(!item.users.every(v=>v&&text(v.id)&&text(v.displayName)))return false;
 return new Set(item.leads.map(v=>v.id)).size===item.leads.length&&new Set(item.users.map(v=>v.id)).size===item.users.length;
}
export async function loadFollowupReferences(scope:DraftScope,secret:string):Promise<FollowupReferences|null> {
 const record=await readRecord(referencesKey(scope));if(!record)return null;
 const value=await decryptRecord(record,secret);
 if(!validReferences(value))throw new Error('قوائم الاختيار المحفوظة غير صالحة.');
 return value;
}
export async function saveFollowupReferences(scope:DraftScope,secret:string,value:FollowupReferences):Promise<void> {
 if(!validReferences(value))throw new Error('قوائم الاختيار غير صالحة.');
 // Check the existing key before replacing this independent snapshot.
 await loadFollowupReferences(scope,secret);
 // Explicit mapping prevents accidentally persisting full lead/contact/API objects.
 const snapshot:FollowupReferences={capturedAt:value.capturedAt,leads:value.leads.map(v=>({id:v.id,number:v.number,displayName:v.displayName,status:v.status})),users:value.users.map(v=>({id:v.id,displayName:v.displayName}))};
 await writeRecord(referencesKey(scope),await encryptRecord(referencesKey(scope),secret,snapshot));
}
export async function deleteFollowupReferences(scope:DraftScope):Promise<void>{await writeRecord(referencesKey(scope));}

export const FOLLOWUP_BACKUP_MAX_BYTES=5*1024*1024;
const backupKey=(scope:DraftScope)=>scopeId(scope)+':queue-backup-v1';
const backupFormat='elhafez-followup-queue';
const backupLimit=500;
function base64(bytes:Uint8Array<ArrayBuffer>):string{return btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''));}
function decodeBase64(value:unknown,length?:number):Uint8Array<ArrayBuffer>{
 if(typeof value!=='string'||value.length>FOLLOWUP_BACKUP_MAX_BYTES||value.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new Error('ملف النسخة الاحتياطية غير صالح.');
 const bytes=Uint8Array.from(atob(value),char=>char.charCodeAt(0));
 if(length!==undefined?bytes.length!==length:bytes.length<16)throw new Error('ملف النسخة الاحتياطية غير صالح.');
 return bytes;
}
/** Export scheduling intents only, not a device/company backup or an authorization token. */
export async function createFollowupQueueBackup(scope:DraftScope,secret:string):Promise<string>{
 await migrateLegacySubmission(scope,secret);
 const records=await queueRecords(scope);
 if(records.length>backupLimit)throw new Error('هذه النسخة تدعم حتى ٥٠٠ طلب؛ لم تُحذف أي بيانات.');
 const submissions=await Promise.all(records.map(record=>decodeSubmission(record,secret)));
 const sealed=await encryptRecord(backupKey(scope),secret,{createdAt:new Date().toISOString(),submissions});
 const text=JSON.stringify({format:backupFormat,version:1,scope:{companyId:scope.companyId,branchId:scope.branchId,userId:scope.userId},salt:base64(sealed.salt),iv:base64(sealed.iv),ciphertext:base64(new Uint8Array(sealed.ciphertext))});
 if(new TextEncoder().encode(text).length>FOLLOWUP_BACKUP_MAX_BYTES)throw new Error('حجم النسخة أكبر من الحد المدعوم؛ لم تُحذف أي بيانات.');
 return text;
}
function sameStoredRecord(a:StoredDraft|undefined,b:StoredDraft|undefined):boolean{
 if(!a||!b)return a===b;
 const same=(left:Uint8Array<ArrayBuffer>,right:Uint8Array<ArrayBuffer>)=>left.length===right.length&&left.every((byte,i)=>byte===right[i]);
 return a.id===b.id&&a.operationId===b.operationId&&same(a.salt,b.salt)&&same(a.iv,b.iv)&&same(new Uint8Array(a.ciphertext),new Uint8Array(b.ciphertext));
}
/** Add missing identities atomically; existing requests and selection are never overwritten. */
export async function restoreFollowupQueueBackup(scope:DraftScope,secret:string,text:string):Promise<{added:number;retained:number}>{
 if(new TextEncoder().encode(text).length>FOLLOWUP_BACKUP_MAX_BYTES)throw new Error('ملف النسخة أكبر من ٥ ميجابايت.');
 let raw:unknown;try{raw=JSON.parse(text) as unknown;}catch{throw new Error('ملف النسخة الاحتياطية غير صالح.');}
 if(!raw||typeof raw!=='object')throw new Error('ملف النسخة الاحتياطية غير صالح.');
 const file=raw as {format?:unknown;version?:unknown;scope?:Partial<DraftScope>;salt?:unknown;iv?:unknown;ciphertext?:unknown};
 if(file.format!==backupFormat||file.version!==1)throw new Error('نوع أو إصدار النسخة الاحتياطية غير مدعوم.');
 if(!file.scope||file.scope.companyId!==scope.companyId||file.scope.branchId!==scope.branchId||file.scope.userId!==scope.userId)throw new Error('هذه النسخة تخص مستخدمًا أو شركة أو فرعًا آخر.');
 const value=await decryptRecord({id:backupKey(scope),salt:decodeBase64(file.salt,16),iv:decodeBase64(file.iv,12),ciphertext:decodeBase64(file.ciphertext).buffer},secret);
 if(!value||typeof value!=='object')throw new Error('بيانات النسخة الاحتياطية غير صالحة.');
 const archive=value as {createdAt?:unknown;submissions?:unknown};
 if(typeof archive.createdAt!=='string'||!Number.isFinite(Date.parse(archive.createdAt))||!Array.isArray(archive.submissions)||archive.submissions.length>backupLimit||!archive.submissions.every(validSubmission))throw new Error('بيانات النسخة الاحتياطية غير صالحة.');
 const values:FollowupSubmission[]=archive.submissions;
 if(new Set(values.map(v=>v.requestId)).size!==values.length)throw new Error('النسخة تحتوي هويات طلبات مكررة.');
 await migrateLegacySubmission(scope,secret);
 const existing=await queueRecords(scope),old=new Map(existing.map(row=>[row.operationId,row]));
 const decoded=await Promise.all(existing.map(row=>decodeSubmission(row,secret))),prior=new Map(decoded.map(v=>[v.requestId,v]));
 for(const v of values){const current=prior.get(v.requestId);if(current&&JSON.stringify(current.payload)!==JSON.stringify(v.payload))throw new Error('تعارض بيانات لنفس هوية الطلب؛ لم نستبدل أي طلب.');}
 const missing=values.filter(v=>!prior.has(v.requestId));
 const next=new Map(await Promise.all(missing.map(async v=>[v.requestId,await encryptRecord(submissionKey(scope,v.requestId),secret,v,v.requestId)] as const)));
 const db=await openDatabase();
 try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(storeName,'readwrite'),store=tx.objectStore(storeName);
  for(const value of values){
   const q=store.get(submissionKey(scope,value.requestId));q.onsuccess=()=>{
    if(!sameStoredRecord(q.result as StoredDraft|undefined,old.get(value.requestId))){tx.abort();return;}
    const record=next.get(value.requestId);if(record)store.add(record);
   };
  }
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(new Error('لم يتم الاسترجاع؛ قد تغيرت القائمة في تبويب آخر. الطلبات الأصلية محفوظة، حاول مجددًا.'));
  tx.onerror=()=>reject(new Error('لم يتم الاسترجاع؛ الطلبات الأصلية محفوظة.'));
 });}finally{db.close();}
 return {added:missing.length,retained:values.length-missing.length};
}
