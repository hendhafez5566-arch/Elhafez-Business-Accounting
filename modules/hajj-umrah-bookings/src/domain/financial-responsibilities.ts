import { ContractValidationError } from '@elhafez/contracts';
export interface FinancialResponsibility {readonly travelerId:string;readonly financialCustomerId:string;readonly amount:string;}
const scale=10n**18n;
function units(value:string):bigint {
 if(!/^\d+(?:\.\d{1,18})?$/.test(value))throw new ContractValidationError('financialResponsibilities','non-negative decimal with at most 18 fractional digits required');
 const [whole,fraction='']=value.split('.');return BigInt(whole!)*scale+BigInt(fraction.padEnd(18,'0'));
}
function amount(value:bigint){const fraction=(value%scale).toString().padStart(18,'0').replace(/0+$/,'');return String(value/scale)+(fraction?'.'+fraction:'');}
/** An explicit charge can be shared by multiple debtors; every traveler must be covered. */
export function normalizeFinancialResponsibilities(input:readonly FinancialResponsibility[],travelerIds:readonly string[],gross:string,discount:string):readonly FinancialResponsibility[]{
 if(!Array.isArray(input)||!input.length||input.length>500)throw new ContractValidationError('financialResponsibilities','1..500 explicit responsibilities required');
 const seen=new Set<string>(),covered=new Set<string>();let total=0n;
 const rows=input.map(row=>{if(!row||typeof row.travelerId!=='string'||typeof row.financialCustomerId!=='string'||!row.financialCustomerId.trim()||!travelerIds.includes(row.travelerId))throw new ContractValidationError('financialResponsibilities','active booking traveler and financial customer required');const identity=JSON.stringify([row.travelerId,row.financialCustomerId.trim()]);if(seen.has(identity))throw new ContractValidationError('financialResponsibilities','duplicate traveler and debtor');seen.add(identity);covered.add(row.travelerId);const value=units(row.amount);if(value<=0n)throw new ContractValidationError('financialResponsibilities','each assigned charge must be positive');total+=value;return{travelerId:row.travelerId,financialCustomerId:row.financialCustomerId.trim(),amount:amount(value)};});
 if(covered.size!==new Set(travelerIds).size)throw new ContractValidationError('financialResponsibilities','every booking traveler needs an explicit charge');
 const net=units(gross)-units(discount);if(net<0n||total!==net)throw new ContractValidationError('financialResponsibilities','assigned charges must exactly equal the net booking price');
 return rows.sort((a,b)=>a.travelerId.localeCompare(b.travelerId)||a.financialCustomerId.localeCompare(b.financialCustomerId));
}
