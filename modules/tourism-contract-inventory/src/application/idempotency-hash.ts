import { createHash } from 'node:crypto';

function canonical(value:unknown):string {
 if(value===null||typeof value!=='object') return JSON.stringify(value);
 if(Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
 return `{${Object.entries(value as Record<string,unknown>).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}
export function idempotencyHash(value:unknown):string { return createHash('sha256').update(canonical(value)).digest('hex'); }
