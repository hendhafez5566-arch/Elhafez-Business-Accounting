// Isolated feasibility experiment. Never imported by the ERP or used for real money.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const bytes = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const base64 = value => btoa(String.fromCharCode(...new Uint8Array(value)));
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), b => b.toString(16).padStart(2, '0')).join('');
const database = await new Promise((resolve, reject) => {
  const request = globalThis.indexedDB.open('elhafez-offline-PROOF-only', 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore('operations', { keyPath: 'id' });
    request.result.createObjectStore('settings');
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
async function transaction(storeName, mode, work, abort = false) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, mode);
    let result;
    const request = work(tx.objectStore(storeName));
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => resolve(result);
    const failure = () => reject(abort ? new Error('Injected local storage failure') : tx.error || request.error || new Error('Local save aborted'));
    tx.onabort = failure;
    tx.onerror = failure;
    if (abort) tx.abort();
  });
}
const store = (name, value, key, abort = false) => transaction(name, 'readwrite', s => key === undefined ? s.put(value) : s.put(value, key), abort);
const get = (name, key) => transaction(name, 'readonly', s => s.get(key));
let key;
let current;
let rejectNextSave = false;
const scopeId = scope => JSON.stringify([scope.companyId, scope.branchId, scope.userId, scope.deviceId]);
async function unlock(scope, passphrase) {
  key = undefined;
  current = { ...scope };
  const name = scopeId(scope);
  let salt = await get('settings', name);
  if (!salt) { salt = crypto.getRandomValues(new Uint8Array(16)); await store('settings', salt, name); }
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  key = await crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations:150000, hash:'SHA-256' }, material, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
  return true;
}
function authorized() {
  if (!key || !current) throw new Error('Locked');
  if (Date.now() >= current.expiresAt) throw new Error('Offline authorization expired');
}
async function save(operation) {
  authorized();
  const abortSave = rejectNextSave;
  rejectNextSave = false;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const scope = scopeId(current);
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM', iv, additionalData:encoder.encode(scope + operation.id)}, key, encoder.encode(JSON.stringify(operation)));
  await store('operations', {id:operation.id, scope, iv:base64(iv), ciphertext:base64(ciphertext)}, undefined, abortSave);
}
async function read(record) {
  authorized();
  if (record.scope !== scopeId(current)) throw new Error('Scope mismatch');
  const clear = await crypto.subtle.decrypt({name:'AES-GCM', iv:bytes(record.iv), additionalData:encoder.encode(record.scope + record.id)}, key, bytes(record.ciphertext));
  return JSON.parse(decoder.decode(clear));
}
async function list() {
  authorized();
  const records = await transaction('operations', 'readonly', s => s.getAll());
  return Promise.all(records.filter(r => r.scope === scopeId(current)).map(read));
}
async function queue(input) {
  authorized();
  const existing = await get('operations', input.id);
  if (existing) throw new Error('Operation ID already saved; use its existing immutable request');
  const request = {id:input.id, companyId:current.companyId, branchId:current.branchId, userId:current.userId, deviceId:current.deviceId, kind:input.kind || 'NOTE', recordId:input.recordId || input.id, expectedVersion:input.expectedVersion || 0, text:input.text || '', attachment:input.attachment || null};
  if (request.attachment) request.attachmentHash = await hash(request.attachment);
  const operation = {id:request.id, request, state:'PENDING', attempts:0, outcome:null};
  await save(operation);
  return operation;
}
async function flush() {
  authorized();
  for (const operation of await list()) {
    if (operation.state !== 'PENDING') continue;
    operation.attempts++;
    await save(operation);
    try {
      const response = await fetch('/api/proof/operations', {method:'POST', headers:{'content-type':'application/json','x-proof-actor':current.userId}, body:JSON.stringify(operation.request)});
      const result = await response.json();
      operation.outcome = result;
      operation.state = response.ok ? 'SYNCED' : response.status >= 500 ? 'PENDING' : 'REVIEW';
    } catch { operation.outcome = {reason:'NETWORK_RETRY'}; }
    // A lost local acknowledgement leaves the persisted immutable request retryable.
    await save(operation);
  }
  return list();
}
async function rawRecords() { return transaction('operations', 'readonly', s => s.getAll()); }
async function corrupt(id) { const record = await get('operations', id); record.ciphertext = (record.ciphertext[0] === 'A' ? 'B' : 'A') + record.ciphertext.slice(1); await store('operations', record); }
globalThis.proof = {unlock, queue, flush, list, rawRecords, corrupt, failNextSave(){rejectNextSave=true;}, close(){key=undefined;database.close();}};
globalThis.document.querySelector('#status').textContent = 'التجربة جاهزة — بيانات اختبار فقط';
