import {useMemo,useState} from 'react';
import {Badge,Button,Card,DataGrid,EmptyState,Input,Select} from './ui.js';
import {documentCatalog,type DocumentCatalogKind,type DocumentOwner} from './document-catalog.js';

const ownerLabel:Record<DocumentOwner,string>={ACCOUNTING:'المحاسبة والمالية',CRM:'العملاء والمبيعات',PROCUREMENT:'المشتريات والموردون',HAJJ_UMRAH:'الحج والعمرة',TOURISM:'السياحة والخدمات',REPORTING:'مركز التقارير'};

export function DocumentCenterPage(){
 const[q,setQ]=useState(''),[kind,setKind]=useState<'ALL'|DocumentCatalogKind>('ALL'),[owner,setOwner]=useState<'ALL'|DocumentOwner>('ALL');
 const rows=useMemo(()=>documentCatalog.filter(item=>(kind==='ALL'||item.kind===kind)&&(owner==='ALL'||item.owner===owner)&&(!q.trim()||`${item.name} ${item.legacyId} ${item.description}`.toLowerCase().includes(q.trim().toLowerCase()))),[q,kind,owner]);
 return <section dir="rtl" aria-label="مركز المستندات والتقارير" className="ui-page-stack">
  <Card title="مركز المستندات والتقارير"><p>كتالوج موحد يغطي المستندات والتقارير الموروثة. كل بند يفتح الـOwner الحقيقي للبيانات؛ لا توجد حسابات مالية أو نسخ بيانات مكررة داخل هذا المركز.</p><div className="ui-inline"><Input aria-label="بحث المستندات والتقارير" value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث باسم المستند أو التقرير"/><Select aria-label="نوع المخرج" value={kind} onChange={e=>setKind(e.target.value as 'ALL'|DocumentCatalogKind)}><option value="ALL">الكل</option><option value="DOCUMENT">مستندات</option><option value="REPORT">تقارير</option></Select><Select aria-label="مالك البيانات" value={owner} onChange={e=>setOwner(e.target.value as 'ALL'|DocumentOwner)}><option value="ALL">كل الأقسام</option>{Object.entries(ownerLabel).map(([id,label])=><option key={id} value={id}>{label}</option>)}</Select></div></Card>
  <Card title={`الكتالوج — ${rows.length} من ${documentCatalog.length}`}>{!rows.length?<EmptyState title="لا توجد نتائج"/>:<DataGrid columns={['المخرج','النوع','المصدر المعتمد','الوصف','الإجراء']}>{rows.map(item=><tr key={item.legacyId}><td><strong>{item.name}</strong><br/><small>{item.legacyId}</small></td><td><Badge tone={item.kind==='DOCUMENT'?'info':'neutral'}>{item.kind==='DOCUMENT'?'مستند':'تقرير'}</Badge></td><td>{ownerLabel[item.owner]}</td><td>{item.description}</td><td><Button type="button" onClick={()=>{window.location.href=item.path}}>فتح المصدر</Button></td></tr>)}</DataGrid>}</Card>
  <Card title="قاعدة التنفيذ"><p>الطباعة وPDF والمشاركة تُبنى فوق هذا الكتالوج وهوية الشركة المركزية، بينما الأرقام والحالات تظل دائمًا مملوكة للوحدات الأصلية مثل General Ledger وBilling وTreasury وCRM وHajj/Umrah.</p></Card>
 </section>;
}
