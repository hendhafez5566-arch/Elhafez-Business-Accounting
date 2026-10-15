/** Local presentation draft only. Scheduling remains owned by crm-followups on the server. */
export interface FollowupDraft {
 readonly leadId:string;
 readonly responsibleUserId:string;
 readonly interactionType:string;
 readonly scheduledAt:string;
 readonly nextAction:string;
}
export interface DraftScope { readonly companyId:string; readonly branchId:string; readonly userId:string; }
interface StoredDraft { readonly id:string; readonly salt:Uint8Array<ArrayBuffer>; readonly iv:Uint8Array<ArrayBuffer>; readonly ciphertext:ArrayBuffer; }
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
export async function saveFollowupDraft(scope:DraftScope,secret:string,draft:FollowupDraft):Promise<void> {
 if(!validDraft(draft))throw new Error('بيانات المسودة غير صالحة.');
 const id=scopeId(scope),salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await deriveKey(secret,salt);
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},key,new TextEncoder().encode(JSON.stringify(draft)));
 await writeRecord(id,{id,salt,iv,ciphertext});
}
export async function loadFollowupDraft(scope:DraftScope,secret:string):Promise<FollowupDraft|null> {
 const id=scopeId(scope),record=await readRecord(id);
 if(!record)return null;
 const key=await deriveKey(secret,record.salt);
 let value:unknown;
 try{
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv,additionalData:new TextEncoder().encode(id)},key,record.ciphertext);
  value=JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
 }catch{throw new Error('تعذر فتح المسودة. راجع عبارة الحماية؛ وقد تكون البيانات المحلية تالفة.');}
 if(!validDraft(value))throw new Error('بيانات المسودة غير صالحة.');
 return value;
}
export async function deleteFollowupDraft(scope:DraftScope):Promise<void>{await writeRecord(scopeId(scope));}
