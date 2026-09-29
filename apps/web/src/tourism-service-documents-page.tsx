import { EntityDocumentsPage, queryParam } from './entity-documents-page.js';

export function TourismServiceDocumentsPage(){
 const serviceId=queryParam('serviceId');
 return <EntityDocumentsPage entityId={serviceId} basePath={`/tourism/services/${encodeURIComponent(serviceId)}/files`} title="مستندات الخدمة السياحية" emptyTitle="لا توجد مستندات مرتبطة بالخدمة" description="المستندات محفوظة في Platform Core، والخدمة تحتفظ فقط بعلاقة الملف بها. الفواتير والمدفوعات تظل لدى ملاكها الماليين."/>;
}
