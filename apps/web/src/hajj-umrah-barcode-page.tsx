import{Badge,Card,EmptyState,MetricCard}from'./ui.js';

export function UmrahBarcodePage(){
 return <section dir="rtl" className="ui-dashboard" aria-label="باركود العمرة">
  <div className="ui-metric-grid"><MetricCard label="حالة الوحدة" value="قيد التجهيز" tone="warning"/><MetricCard label="التكامل التشغيلي" value="غير مفعّل"/><MetricCard label="البيانات الحالية" value="0"/></div>
  <Card title="باركود العمرة المصري"><p>المساحة مهيأة داخل نفس تصميم النظام ومرتبطة بقسم الحج والعمرة، لكن الوظائف التشغيلية نفسها لم يبدأ تنفيذها بعد.</p><Badge tone="warning">وظائف التشغيل غير مفعّلة</Badge></Card>
  <Card title="مساحة العمل"><EmptyState title="لا توجد عمليات باركود متاحة حاليًا">عند بدء التنفيذ الوظيفي ستظهر هنا عمليات الإصدار والمتابعة والربط دون إنشاء واجهة منفصلة عن تصميم النظام.</EmptyState></Card>
 </section>;
}
