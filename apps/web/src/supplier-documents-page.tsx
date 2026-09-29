import { EntityDocumentsPage, queryParam } from './entity-documents-page.js';

export function SupplierDocumentsPage(){
 const supplierId=queryParam('supplierId');
 return <EntityDocumentsPage entityId={supplierId} basePath={`/suppliers/${encodeURIComponent(supplierId)}/files`} title="مستندات المورد" emptyTitle="لا توجد مستندات مرتبطة بالمورد" description="المستند نفسه مملوك لـ Platform Core، وSupplier Management يستخدم فقط علاقة الملف بالمورد دون تخزين نسخة ثانية."/>;
}
