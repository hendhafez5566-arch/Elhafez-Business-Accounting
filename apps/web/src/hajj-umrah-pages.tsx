import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DataGrid,
  EmptyState,
  FormField,
  Input,
  Select,
  Tabs,
  Textarea,
} from './ui.js';

type ProgramStatus = 'PREPARING' | 'BOOKABLE' | 'IN_TRIP' | 'CLOSED' | 'CANCELLED';
type SeasonStatus = 'ACTIVE' | 'CLOSED' | 'CANCELLED';
type Permission =
  | 'hajj_umrah.seasons.manage'
  | 'hajj_umrah.seasons.lifecycle'
  | 'hajj_umrah.programs.create'
  | 'hajj_umrah.programs.edit'
  | 'hajj_umrah.programs.amend'
  | 'hajj_umrah.programs.availability'
  | 'hajj_umrah.programs.lifecycle';

const lifecycleLabels: Record<ProgramStatus, string> = {
  PREPARING: 'تحت التجهيز',
  BOOKABLE: 'متاح للحجز',
  IN_TRIP: 'الرحلة جارية',
  CLOSED: 'منتهي',
  CANCELLED: 'ملغي',
};
const lifecycleTone = (status: ProgramStatus) =>
  status === 'BOOKABLE'
    ? 'success'
    : status === 'CANCELLED'
      ? 'error'
      : status === 'CLOSED'
        ? 'neutral'
        : status === 'IN_TRIP'
          ? 'info'
          : 'warning';

const defaultPermissions: readonly Permission[] = [
  'hajj_umrah.seasons.manage',
  'hajj_umrah.seasons.lifecycle',
  'hajj_umrah.programs.create',
  'hajj_umrah.programs.edit',
  'hajj_umrah.programs.amend',
  'hajj_umrah.programs.availability',
  'hajj_umrah.programs.lifecycle',
];

function permissionSet(permissions?: readonly Permission[]) {
  return new Set(permissions ?? defaultPermissions);
}

export function SeasonsPage({ permissions }: { readonly permissions?: readonly Permission[] } = {}) {
  const allowed = permissionSet(permissions);
  const [rows, setRows] = useState<Array<{ id: string; code: string; name: string; start: string; end: string; status: SeasonStatus }>>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  function addSeason() {
    if (!code.trim() || !name.trim() || !start || !end) return;
    setRows((old) => [...old, { id: crypto.randomUUID(), code: code.trim(), name: name.trim(), start, end, status: 'ACTIVE' }]);
    setCode(''); setName(''); setStart(''); setEnd('');
  }

  return <section aria-label="المواسم">
    {allowed.has('hajj_umrah.seasons.manage') && <Card title="إضافة موسم">
      <FormField label="كود الموسم" required><Input value={code} onChange={(event) => setCode(event.target.value)} /></FormField>
      <FormField label="اسم الموسم" required><Input value={name} onChange={(event) => setName(event.target.value)} /></FormField>
      <FormField label="بداية التشغيل" required><Input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></FormField>
      <FormField label="نهاية التشغيل" required><Input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></FormField>
      <Button type="button" onClick={addSeason}>حفظ الموسم</Button>
    </Card>}
    <Card title="المواسم">
      {!rows.length ? <EmptyState title="لا توجد مواسم مسجلة" /> : <DataGrid columns={['الكود', 'الموسم', 'فترة التشغيل', 'الحالة', 'إجراءات']}>
        {rows.map((row) => <tr key={row.id}>
          <td>{row.code}</td><td>{row.name}</td><td>{row.start} — {row.end}</td>
          <td><Badge tone={row.status === 'ACTIVE' ? 'success' : row.status === 'CANCELLED' ? 'error' : 'neutral'}>{row.status === 'ACTIVE' ? 'نشط' : row.status === 'CLOSED' ? 'مغلق' : 'ملغي'}</Badge></td>
          <td>{allowed.has('hajj_umrah.seasons.lifecycle') && row.status === 'ACTIVE' && <Button type="button" onClick={() => setRows((items) => items.map((item) => item.id === row.id ? { ...item, status: 'CLOSED' } : item))}>إغلاق</Button>}</td>
        </tr>)}
      </DataGrid>}
    </Card>
  </section>;
}

export function ProgramsPage({ permissions }: { readonly permissions?: readonly Permission[] } = {}) {
  const allowed = permissionSet(permissions);
  const [type, setType] = useState<'HAJJ' | 'UMRAH'>('UMRAH');
  const [query, setQuery] = useState('');
  const rows = useMemo(() => [
    { id: 'demo-1', code: 'UM-01', name: 'برنامج عمرة نموذجي', type: 'UMRAH', season: 'موسم العمرة', status: 'PREPARING' as ProgramStatus, bookingOpen: false },
  ].filter((row) => row.name.includes(query) || row.code.includes(query)), [query]);

  return <section aria-label="برامج الحج والعمرة">
    <Card title="برامج الحج والعمرة">
      <Input aria-label="بحث البرامج" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث بالاسم أو الكود" />
      <Select aria-label="نوع البرنامج" value={type} onChange={(event) => setType(event.target.value as 'HAJJ' | 'UMRAH')}>
        <option value="UMRAH">عمرة</option><option value="HAJJ">حج</option>
      </Select>
      {allowed.has('hajj_umrah.programs.create') && <Button type="button">إنشاء برنامج {type === 'HAJJ' ? 'حج' : 'عمرة'}</Button>}
    </Card>
    <Card title="قائمة البرامج">
      <DataGrid columns={['الكود', 'البرنامج', 'النوع', 'الموسم', 'دورة البرنامج', 'توفر البيع', '']}>
        {rows.map((row) => <tr key={row.id}>
          <td>{row.code}</td><td>{row.name}</td><td>{row.type === 'HAJJ' ? 'حج' : 'عمرة'}</td><td>{row.season}</td>
          <td><Badge tone={lifecycleTone(row.status)}>{lifecycleLabels[row.status]}</Badge></td>
          <td><Badge tone={row.bookingOpen ? 'success' : 'warning'}>{row.bookingOpen ? 'الحجز متاح' : 'الحجز مغلق'}</Badge></td>
          <td><a href="/hajj-umrah/program-workspace">فتح مساحة العمل</a></td>
        </tr>)}
      </DataGrid>
    </Card>
  </section>;
}

const workspaceTabs = [
  { id: 'basic', label: 'البيانات الأساسية' },
  { id: 'dates', label: 'التواريخ والسعة' },
  { id: 'prices', label: 'الأسعار' },
  { id: 'supply', label: 'المتطلبات والمكونات' },
  { id: 'readiness', label: 'مؤشرات التجهيز' },
] as const;

export function ProgramWorkspacePage({ permissions }: { readonly permissions?: readonly Permission[] } = {}) {
  const allowed = permissionSet(permissions);
  const [tab, setTab] = useState('basic');
  const [status, setStatus] = useState<ProgramStatus>('PREPARING');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [capacity, setCapacity] = useState('45');
  const [notes, setNotes] = useState('');

  return <section aria-label="مساحة عمل البرنامج">
    <Card title="برنامج عمرة — UM-01">
      <p><Badge tone={lifecycleTone(status)}>{lifecycleLabels[status]}</Badge> <Badge tone={bookingOpen ? 'success' : 'warning'}>{bookingOpen ? 'الحجز متاح' : 'الحجز مغلق'}</Badge></p>
      <p>الموسم: موسم العمرة · الإصدار الحالي: 1</p>
      {allowed.has('hajj_umrah.programs.availability') && status === 'BOOKABLE' && <Button type="button" onClick={() => setBookingOpen((value) => !value)}>{bookingOpen ? 'إغلاق الحجز' : 'فتح الحجز'}</Button>}
      {allowed.has('hajj_umrah.programs.lifecycle') && status === 'PREPARING' && <Button type="button" onClick={() => setStatus('BOOKABLE')}>اعتماد الجاهزية وإتاحة البرنامج</Button>}
      {allowed.has('hajj_umrah.programs.lifecycle') && status === 'BOOKABLE' && <Button type="button" onClick={() => { setStatus('IN_TRIP'); setBookingOpen(false); }}>تسجيل المغادرة</Button>}
      {allowed.has('hajj_umrah.programs.lifecycle') && status === 'IN_TRIP' && <Button type="button" onClick={() => setStatus('CLOSED')}>تسجيل العودة وإنهاء البرنامج</Button>}
    </Card>
    <Tabs tabs={workspaceTabs} active={tab} onChange={setTab} />
    {tab === 'basic' && <Card title="البيانات الأساسية والموسم">
      <p>النوع: عمرة · الاسم العربي: برنامج عمرة نموذجي · الاسم الإنجليزي: Umrah Program</p>
      <p>الموسم: موسم العمرة · مسؤول العمليات: — · قائد المجموعة: — · المرشد: — · التواصل: —</p>
      <FormField label="ملاحظات"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></FormField>
      {(allowed.has('hajj_umrah.programs.edit') || allowed.has('hajj_umrah.programs.amend')) && <Button type="button">حفظ التغييرات</Button>}
    </Card>}
    {tab === 'dates' && <Card title="التواريخ والسعة">
      <p>السفر: 01/10/2026 · العودة: 10/10/2026 · البيع: 01/08/2026 — 25/09/2026</p>
      <FormField label="السعة"><Input inputMode="numeric" value={capacity} onChange={(event) => setCapacity(event.target.value)} /></FormField>
      <p>مدة الحجز المؤقت: 15 دقيقة</p>
    </Card>}
    {tab === 'prices' && <Card title="الأسعار والسياسة">
      <DataGrid columns={['الفئة', 'السعر', 'العملة']}><tr><td>ثنائي</td><td>35000</td><td>EGP</td></tr><tr><td>ثلاثي</td><td>31000</td><td>EGP</td></tr></DataGrid>
      <p>سياسة الحد الأدنى للعربون: حسب البرنامج · سياسة الإلغاء: حسب النسخة المعتمدة.</p>
    </Card>}
    {tab === 'supply' && <Card title="المتطلبات ومكونات الباقة">
      <DataGrid columns={['المتطلب', 'المكون', 'دليل التعاقد', 'الحالة']}>
        <tr><td>HOTEL</td><td>فندق مكة</td><td>hotel-allotment-1</td><td><Badge tone="success">متحقق</Badge></td></tr>
        <tr><td>FLIGHT</td><td>رحلة الذهاب</td><td>flight-block-1</td><td><Badge tone="success">متحقق</Badge></td></tr>
        <tr><td>TRANSPORT</td><td>نقل المجموعة</td><td>transport-1</td><td><Badge tone="success">متحقق</Badge></td></tr>
      </DataGrid>
    </Card>}
    {tab === 'readiness' && <Card title="مؤشرات التجهيز">
      <p>الموسم: <Badge tone="success">جاهز</Badge> · الأسعار: <Badge tone="success">جاهزة</Badge> · التوريد المتعاقد عليه: <Badge tone="success">متحقق</Badge></p>
      <p>دورة البرنامج الحالية: {lifecycleLabels[status]} · توفر البيع: {bookingOpen ? 'الحجز متاح' : 'الحجز مغلق'} · الإصدار الحالي: 1</p>
    </Card>}
  </section>;
}

export const hajjUmrahLifecycleLabels = lifecycleLabels;
