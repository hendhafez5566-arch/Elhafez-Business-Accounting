export interface EncryptedLocalRecord { readonly id:string; readonly salt:Uint8Array<ArrayBuffer>; readonly iv:Uint8Array<ArrayBuffer>; readonly ciphertext:ArrayBuffer; readonly operationId?:string; }
type StoredDraft=EncryptedLocalRecord;
async function deriveKey(secret:string,salt:Uint8Array<ArrayBuffer>) {
 if(secret.length<12)throw new Error('استخدم عبارة حماية للمسودة من ١٢ حرفًا على الأقل.');
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptRecord(id:string,secret:string,value:unknown,operationId?:string):Promise<StoredDraft> {
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await deriveKey(secret,salt);
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},key,new TextEncoder().encode(JSON.stringify(value)));
 return {id,salt,iv,ciphertext,...operationId?{operationId}:{}};
}
export async function decryptRecord(record:StoredDraft,secret:string):Promise<unknown> {
 const key=await deriveKey(secret,record.salt);
 try{
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv,additionalData:new TextEncoder().encode(record.id)},key,record.ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
 }catch{throw new Error('تعذر فتح المسودة. راجع عبارة الحماية؛ وقد تكون البيانات المحلية تالفة.');}
}
