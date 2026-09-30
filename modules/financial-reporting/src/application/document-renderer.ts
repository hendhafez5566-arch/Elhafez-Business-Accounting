import { createHash } from 'node:crypto';

export const LEGACY_DOCUMENT_CATALOG = [
  ['LEG-PRINT-001','DOC','فاتورة مبيعات'],['LEG-PRINT-002','DOC','فاتورة مورد'],['LEG-PRINT-003','DOC','إشعار دائن'],['LEG-PRINT-004','DOC','إشعار مدين'],
  ['LEG-PRINT-005','DOC','سند قبض'],['LEG-PRINT-006','DOC','سند صرف'],['LEG-PRINT-007','DOC','قيد يومية'],['LEG-PRINT-008','DOC','مستند مصروف'],
  ['LEG-PRINT-009','DOC','عرض سعر'],['LEG-PRINT-010','DOC','أمر شراء'],['LEG-PRINT-011','DOC','تحويل بين الخزن'],['LEG-PRINT-012','DOC','كشف حساب عميل'],
  ['LEG-PRINT-013','DOC','كشف حساب مورد'],['LEG-PRINT-014','DOC','كشف حساب مندوب'],['LEG-PRINT-015','DOC','كشف حساب شامل للطرف'],['LEG-PRINT-016','DOC','كشف حركة خزنة / بنك'],
  ['LEG-PRINT-017','DOC','كشف حساب أستاذ'],['LEG-PRINT-018','REPORT','قائمة الدخل'],['LEG-PRINT-019','REPORT','الميزانية العمومية'],['LEG-PRINT-020','REPORT','تقرير الضرائب'],
  ['LEG-PRINT-021','REPORT','قائمة التدفقات النقدية'],['LEG-PRINT-022','REPORT','ربحية برنامج عمرة'],['LEG-PRINT-023','REPORT','كشف توزيع الغرف'],['LEG-PRINT-024','REPORT','أعمار مديونية العملاء'],
  ['LEG-PRINT-025','REPORT','أعمار مديونية الموردين'],['LEG-PRINT-026','REPORT','ربحية الخدمات'],['LEG-PRINT-027','REPORT','تقرير العمولات'],['LEG-PRINT-028','REPORT','تحليل المصروفات'],
  ['LEG-PRINT-029','REPORT','أرباح وخسائر فروق العملة'],['LEG-PRINT-030','REPORT','التعرض للعملات الأجنبية'],['LEG-PRINT-031','REPORT','تقرير التحصيلات'],['LEG-PRINT-032','REPORT','تقرير المدفوعات'],
  ['LEG-PRINT-033','REPORT','قائمة المسافرين'],['LEG-PRINT-034','REPORT','حالات الحجوزات'],['LEG-PRINT-035','REPORT','تقرير القيود'],['LEG-PRINT-036','REPORT','دفتر الأستاذ العام'],
  ['LEG-PRINT-037','REPORT','تفاصيل الضرائب'],['LEG-PRINT-038','REPORT','المبيعات حسب العميل'],['LEG-PRINT-039','REPORT','المبيعات على المندوبين'],['LEG-PRINT-040','REPORT','تكاليف الموردين'],
  ['LEG-PRINT-041','REPORT','الحركة اليومية للخزن والبنوك'],['LEG-PRINT-042','REPORT','انتهاء الجوازات'],['LEG-PRINT-043','REPORT','حالات التأشيرات'],['LEG-PRINT-044','REPORT','إشغال برامج العمرة'],
] as const;

export type LegacyDocumentId = typeof LEGACY_DOCUMENT_CATALOG[number][0];
export interface LegalPrintIdentity { readonly legalName:string; readonly logoUrl?:string|null; readonly phone?:string|null; readonly taxRegistration?:string|null; readonly commercialRegistration?:string|null; readonly address?:string|null; }
export interface DocumentCell { readonly label:string; readonly value:string; }
export interface DocumentRow { readonly cells:readonly string[]; }
export interface RenderDocumentInput {
  readonly catalogId:LegacyDocumentId; readonly companyId:string; readonly branchId:string; readonly sourceType:string; readonly sourceId:string;
  readonly title?:string; readonly identity:LegalPrintIdentity; readonly issuedAt:string; readonly columns:readonly string[]; readonly rows:readonly DocumentRow[];
  readonly summary?:readonly DocumentCell[]; readonly approvalLines?:readonly string[];
}
export interface RenderedDocument { readonly catalogId:LegacyDocumentId; readonly fileName:string; readonly mediaType:'text/html'; readonly sha256:string; readonly html:string; }

const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const required=(value:string,field:string)=>{const normalized=value.trim();if(!normalized)throw new Error(`${field} is required`);return normalized;};
const safePart=(value:string)=>required(value,'file identity').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'document';

/** Presentation-only renderer: canonical owners must supply already-authorized, already-calculated rows. */
export function renderCanonicalDocument(input:RenderDocumentInput):RenderedDocument{
  const catalog=LEGACY_DOCUMENT_CATALOG.find(([id])=>id===input.catalogId);
  if(!catalog)throw new Error('Unknown document catalog id');
  required(input.companyId,'companyId');required(input.branchId,'branchId');required(input.sourceType,'sourceType');required(input.sourceId,'sourceId');
  if(!input.columns.length)throw new Error('columns are required');
  if(input.rows.some(row=>row.cells.length!==input.columns.length))throw new Error('Every row must match the declared columns');
  const title=escape(input.title?.trim()||catalog[2]);
  const identity=input.identity;
  const identityLines=[identity.address,identity.phone&&`هاتف: ${identity.phone}`,identity.taxRegistration&&`التسجيل الضريبي: ${identity.taxRegistration}`,identity.commercialRegistration&&`السجل التجاري: ${identity.commercialRegistration}`].filter((x):x is string=>Boolean(x)).map(x=>`<span>${escape(x)}</span>`).join('');
  const head=input.columns.map(x=>`<th>${escape(x)}</th>`).join('');
  const body=input.rows.map(row=>`<tr>${row.cells.map(x=>`<td>${escape(x)}</td>`).join('')}</tr>`).join('');
  const summary=(input.summary??[]).map(x=>`<div><dt>${escape(x.label)}</dt><dd>${escape(x.value)}</dd></div>`).join('');
  const approvals=(input.approvalLines??[]).map(x=>`<div class="signature"><span>${escape(x)}</span></div>`).join('');
  const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4;margin:14mm}body{font-family:Tahoma,Arial,sans-serif;color:#111}header{display:flex;gap:16px;align-items:center;border-bottom:2px solid #222;padding-bottom:12px}header img{max-width:92px;max-height:72px}.identity{display:grid;gap:3px}h1{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:7px;text-align:right}dl>div{display:flex;justify-content:space-between;border-bottom:1px solid #ddd}.approvals{display:flex;justify-content:space-around;margin-top:48px}.signature{min-width:150px;border-top:1px solid #222;padding-top:8px;text-align:center}</style></head><body><header>${identity.logoUrl?`<img src="${escape(identity.logoUrl)}" alt="">`:''}<div class="identity"><strong>${escape(required(identity.legalName,'identity.legalName'))}</strong>${identityLines}</div></header><h1>${title}</h1><p>تاريخ الإصدار: ${escape(required(input.issuedAt,'issuedAt'))}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${summary?`<dl>${summary}</dl>`:''}${approvals?`<section class="approvals">${approvals}</section>`:''}</body></html>`;
  const digest=createHash('sha256').update(html).digest('hex');
  return{catalogId:input.catalogId,fileName:`${input.catalogId}-${safePart(input.sourceType)}-${safePart(input.sourceId)}-${digest.slice(0,12)}.html`,mediaType:'text/html',sha256:digest,html};
}
