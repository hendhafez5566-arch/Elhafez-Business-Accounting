import { useEffect, useMemo, useState } from 'react';
import {
  ActionBar,
  Badge,
  Button,
  DataGrid,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  Select,
  SettingsWorkspace,
  WorkspaceNavigation,
} from './ui.js';
import { hajjUmrahApi, type Program, type ProgramVersion } from './hajj-umrah-client.js';
import {
  emptyReadinessCapabilities,
  hajjUmrahReadinessApi,
  type HajjUmrahReportBundle,
  type Program360,
  type ReadinessCapabilities,
  type WorkQueueItem,
} from './hajj-umrah-readiness-client.js';

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'تعذر تحميل مساحة التشغيل.';
const queryProgramId = () => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('id') ?? '';

const programStatusLabel: Record<Program['status'], string> = {
  PREPARING: 'تحت التجهيز', BOOKABLE: 'متاح للحجز', IN_TRIP: 'في الرحلة', CLOSED: 'مغلق', CANCELLED: 'ملغي',
};
const tone = (status: string) => status === 'BOOKABLE' || status === 'READY' || status === 'ISSUED' || status === 'COMPLETED' ? 'success' as const
  : status === 'CANCELLED' || status === 'NOT_READY' || status === 'REJECTED' ? 'error' as const
    : status === 'IN_TRIP' ? 'info' as const : 'warning' as const;

function ManageLink({ href, children }: { readonly href: string; readonly children: string }) {
  return <a className="ui-button ui-button--primary" href={href}>{children}</a>;
}

const programNavigation = [
  { id: 'overview', label: 'نظرة التشغيل', description: 'الحالة والطاقة والبيع والجاهزية' },
  { id: 'itinerary', label: 'مكونات البرنامج', description: 'الخدمات والمسار الزمني' },
  { id: 'supply', label: 'التوريد والتغطية', description: 'تغطية المتطلبات والمخزون' },
  { id: 'operations', label: 'التشغيل والحجوزات', description: 'الحجوزات والعمليات المرتبطة' },
  { id: 'history', label: 'الإصدارات والتاريخ', description: 'نسخ البرنامج وسجل التعديل' },
] as const;
type ProgramSection = typeof programNavigation[number]['id'];

export function HajjUmrahProgramCommandPage() {
  const [programId] = useState(queryProgramId);
  const [program, setProgram] = useState<Program>();
  const [versions, setVersions] = useState<ProgramVersion[]>([]);
  const [projection, setProjection] = useState<Program360>();
  const [active, setActive] = useState<ProgramSection>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    if (!programId) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [programResult, versionResult, projectionResult] = await Promise.allSettled([
        hajjUmrahApi.getProgram(programId), hajjUmrahApi.versions(programId), hajjUmrahReadinessApi.program360(programId),
      ]);
      if (programResult.status === 'rejected') throw programResult.reason;
      setProgram(programResult.value);
      setVersions(versionResult.status === 'fulfilled' ? versionResult.value : []);
      setProjection(projectionResult.status === 'fulfilled' ? projectionResult.value : undefined);
    } catch (value) { setError(errorMessage(value)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, [programId]);

  if (!programId) return <EmptyState title="لم يتم تحديد برنامج">ارجع إلى برامج الحج والعمرة وافتح مركز تشغيل برنامج محدد.</EmptyState>;
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!program) return <EmptyState title="البرنامج غير متاح" />;

  const bookings = projection?.bookings ?? [];
  const openTasks = projection?.tasks.filter(row => row.status === 'OPEN').length ?? 0;
  const openIncidents = projection?.incidents.filter(row => row.status === 'OPEN').length ?? 0;
  const blockers = projection?.readiness.blockers.length ?? 0;
  const manageHref = `/hajj-umrah/program-workspace/manage?id=${encodeURIComponent(program.id)}`;

  const content = active === 'overview' ? <section className="ui-flow">
    <div className="ui-inline"><h2>{program.arabicName}</h2><Badge tone={tone(program.status)}>{programStatusLabel[program.status]}</Badge></div>
    <div className="ui-metric-grid">
      <MetricCard label="الطاقة" value={program.snapshot.capacity}/>
      <MetricCard label="الحجوزات" value={bookings.length}/>
      <MetricCard label="موانع الجاهزية" value={blockers} tone={blockers ? 'error' : 'success'}/>
      <MetricCard label="مهام مفتوحة" value={openTasks} tone={openTasks ? 'warning' : 'success'}/>
      <MetricCard label="بلاغات مفتوحة" value={openIncidents} tone={openIncidents ? 'warning' : 'success'}/>
    </div>
    <section className="ui-record-card ui-flow"><strong>نافذة البرنامج</strong><span>المغادرة: {program.snapshot.departureDate.slice(0, 10)} — العودة: {program.snapshot.returnDate.slice(0, 10)}</span><span>البيع: {program.snapshot.salesStart.slice(0, 10)} — {program.snapshot.salesClose.slice(0, 10)}</span><span>الحجز: {program.bookingOpen ? 'مفتوح' : 'مغلق'}</span></section>
  </section> : active === 'itinerary' ? <section className="ui-flow">
    <h2>مكونات البرنامج والخدمات</h2>
    {!program.snapshot.components.length ? <EmptyState title="لا توجد مكونات مسجلة" /> : <DataGrid columns={['الترتيب', 'المكوّن', 'النوع', 'المدينة / المسار', 'الفترة']}>
      {[...program.snapshot.components].sort((a,b) => a.sequence - b.sequence).map((row, index) => <tr key={`${row.sequence}-${row.title}-${index}`}><td>{row.sequence}</td><td><strong>{row.title}</strong><small className="ui-block">{row.description ?? '—'}</small></td><td>{row.type}</td><td>{row.city ?? row.route ?? '—'}</td><td>{row.start ?? '—'} — {row.end ?? '—'}</td></tr>)}
    </DataGrid>}
  </section> : active === 'supply' ? <section className="ui-flow">
    <h2>تغطية المتطلبات والتوريد</h2>
    <div className="ui-inline">{program.snapshot.requirements.map(requirement => <Badge key={requirement}>{requirement}</Badge>)}</div>
    {!projection ? <EmptyState title="بيانات التغطية غير متاحة بالصلاحية الحالية" /> : !projection.supplyCoverage.length ? <EmptyState title="لا توجد بيانات تغطية" /> : <DataGrid columns={['المتطلب', 'المكوّن', 'الحالة', 'التفاصيل']}>
      {projection.supplyCoverage.map((row, index) => <tr key={`${row.requirement}-${index}`}><td>{row.requirement}</td><td>{row.componentTitle}</td><td><Badge tone={row.status === 'ALLOCATED' || row.status === 'AVAILABLE' ? 'success' : 'error'}>{row.status}</Badge></td><td>{row.detail ?? '—'}</td></tr>)}
    </DataGrid>}
  </section> : active === 'operations' ? <section className="ui-flow">
    <h2>الحجوزات والتشغيل المرتبط</h2>
    {!projection ? <EmptyState title="مركز 360 غير متاح بالصلاحية الحالية" /> : <>
      <div className="ui-metric-grid"><MetricCard label="التسكين" value={projection.rooming.length}/><MetricCard label="التأشيرات" value={projection.visas.length}/><MetricCard label="التذاكر" value={projection.tickets.length}/><MetricCard label="رحلات النقل" value={projection.transport.length}/><MetricCard label="خدمات منفذة" value={projection.services.length}/></div>
      {!bookings.length ? <EmptyState title="لا توجد حجوزات" /> : <DataGrid columns={['الحجز', 'الحالة', 'عدد المسافرين', 'الجاهزية']}>
        {bookings.map(row => { const readiness = projection.readiness.bookingResults[row.id]; return <tr key={row.id}><td><strong>{row.code}</strong></td><td><Badge tone={tone(row.status)}>{row.status}</Badge></td><td>{row.travelerIds.length}</td><td><Badge tone={readiness?.status === 'READY' ? 'success' : 'error'}>{readiness?.status === 'READY' ? 'جاهز' : 'غير جاهز'}</Badge></td></tr>; })}
      </DataGrid>}
    </>}
  </section> : <section className="ui-flow">
    <h2>الإصدارات والتاريخ</h2>
    <div className="ui-metric-grid"><MetricCard label="الإصدار الحالي" value={program.currentVersion}/><MetricCard label="إصدارات محفوظة" value={versions.length}/></div>
    {!versions.length ? <EmptyState title="لا يوجد تاريخ إصدارات" /> : <DataGrid columns={['الإصدار', 'ساري من', 'السبب', 'المنفذ']}>
      {versions.map(row => <tr key={row.id}><td><strong>{row.version}</strong></td><td>{row.effectiveAt}</td><td>{row.reason}</td><td>{row.actorId}</td></tr>)}
    </DataGrid>}
  </section>;

  return <section className="ui-dashboard" dir="rtl" aria-label="مركز تشغيل برنامج الحج والعمرة">
    <ActionBar><Button type="button" variant="secondary" onClick={() => void reload()}>تحديث</Button><a className="ui-button ui-button--secondary" href="/hajj-umrah/readiness">مركز الجاهزية</a><ManageLink href={manageHref}>إدارة البرنامج ودورة حياته</ManageLink></ActionBar>
    <SettingsWorkspace navigation={<WorkspaceNavigation items={programNavigation} active={active} onChange={id => setActive(id as ProgramSection)} ariaLabel="أقسام مركز تشغيل البرنامج"/>} content={content}/>
  </section>;
}

const readinessNavigation = [
  { id: 'readiness', label: 'الجاهزية', description: 'الحالة العامة والموانع' },
  { id: 'queue', label: 'قائمة العمل', description: 'الأولويات والمسؤوليات' },
  { id: 'bookings', label: 'الحجوزات', description: 'جاهزية كل حجز' },
  { id: 'supply', label: 'تغطية التوريد', description: 'المتطلبات والتخصيصات' },
  { id: 'reports', label: 'التقارير', description: 'ملخص التشغيل والتقرير المجمع' },
] as const;
type ReadinessSection = typeof readinessNavigation[number]['id'];

export function HajjUmrahReadinessCommandPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programId, setProgramId] = useState('');
  const [active, setActive] = useState<ReadinessSection>('readiness');
  const [capabilities, setCapabilities] = useState<ReadinessCapabilities>(emptyReadinessCapabilities);
  const [projection, setProjection] = useState<Program360>();
  const [queue, setQueue] = useState<WorkQueueItem[]>([]);
  const [reports, setReports] = useState<HajjUmrahReportBundle>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([hajjUmrahApi.listPrograms(), hajjUmrahReadinessApi.capabilities()]).then(([nextPrograms, nextCapabilities]) => {
      if (!mounted) return;
      setPrograms(nextPrograms); setCapabilities(nextCapabilities); setProgramId(current => current || nextPrograms[0]?.id || ''); setError('');
    }).catch(value => mounted && setError(errorMessage(value))).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!programId || !capabilities.view) { setProjection(undefined); setQueue([]); setReports(undefined); return; }
    let mounted = true;
    setLoading(true);
    Promise.allSettled([
      capabilities.view360 ? hajjUmrahReadinessApi.program360(programId) : Promise.reject(new Error('360 unavailable')),
      hajjUmrahReadinessApi.workQueue(programId),
      capabilities.reports ? hajjUmrahReadinessApi.reports(programId) : Promise.reject(new Error('reports unavailable')),
    ]).then(([projectionResult, queueResult, reportResult]) => {
      if (!mounted) return;
      setProjection(projectionResult.status === 'fulfilled' ? projectionResult.value : undefined);
      setQueue(queueResult.status === 'fulfilled' ? queueResult.value : []);
      setReports(reportResult.status === 'fulfilled' ? reportResult.value : undefined);
      setError('');
    }).catch(value => mounted && setError(errorMessage(value))).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [programId, capabilities.view, capabilities.view360, capabilities.reports]);

  const selected = programs.find(row => row.id === programId);
  const blockers = projection?.readiness.blockers ?? [];
  const content = !programId ? <EmptyState title="لا توجد برامج متاحة" /> : active === 'readiness' ? <section className="ui-flow">
    <div className="ui-inline"><h2>الجاهزية الحالية</h2><Badge tone={projection?.readiness.status === 'READY' ? 'success' : 'error'}>{projection?.readiness.status === 'READY' ? 'جاهز' : 'غير جاهز'}</Badge></div>
    <div className="ui-metric-grid"><MetricCard label="الموانع" value={blockers.length} tone={blockers.length ? 'error' : 'success'}/><MetricCard label="الحجوزات" value={projection?.bookings.length ?? 0}/><MetricCard label="المسافرون" value={projection?.travelers.length ?? 0}/><MetricCard label="بلاغات مفتوحة" value={projection?.incidents.filter(row => row.status === 'OPEN').length ?? 0} tone="warning"/></div>
    {!blockers.length ? <EmptyState title="لا توجد موانع حالية">كل الأدلة المطلوبة مكتملة وفق البيانات الحالية.</EmptyState> : <DataGrid columns={['الأولوية', 'النوع', 'المشكلة', 'المسؤول']}>
      {blockers.map((row, index) => <tr key={`${row.code}-${index}`}><td><Badge tone={row.category === 'FINANCIAL' || row.category === 'CONTROL' ? 'warning' : 'error'}>{row.category}</Badge></td><td>{row.code}</td><td><strong>{row.message}</strong></td><td>{row.responsibility}</td></tr>)}
    </DataGrid>}
  </section> : active === 'queue' ? <section className="ui-flow">
    <h2>قائمة العمل التشغيلية</h2>
    {!queue.length ? <EmptyState title="قائمة العمل خالية" /> : <DataGrid columns={['الأولوية', 'النوع', 'المطلوب', 'المسؤول', 'الموعد']}>
      {queue.map(row => <tr key={row.key}><td><Badge tone={row.priority === 'CRITICAL' ? 'error' : row.priority === 'HIGH' ? 'warning' : 'info'}>{row.priority}</Badge></td><td>{row.category}</td><td><strong>{row.title}</strong><small className="ui-block">{row.detail}</small></td><td>{row.owner}</td><td>{row.dueAt ?? '—'}</td></tr>)}
    </DataGrid>}
  </section> : active === 'bookings' ? <section className="ui-flow">
    <h2>جاهزية الحجوزات</h2>
    {!projection?.bookings.length ? <EmptyState title="لا توجد حجوزات" /> : <DataGrid columns={['الحجز', 'الحالة', 'المسافرون', 'الجاهزية']}>
      {projection.bookings.map(row => { const readiness = projection.readiness.bookingResults[row.id]; return <tr key={row.id}><td><strong>{row.code}</strong></td><td><Badge tone={tone(row.status)}>{row.status}</Badge></td><td>{row.travelerIds.length}</td><td><Badge tone={readiness?.status === 'READY' ? 'success' : 'error'}>{readiness?.status === 'READY' ? 'جاهز' : 'غير جاهز'}</Badge></td></tr>; })}
    </DataGrid>}
  </section> : active === 'supply' ? <section className="ui-flow">
    <h2>تغطية التوريد</h2>
    {!projection?.supplyCoverage.length ? <EmptyState title="لا توجد بيانات تغطية" /> : <DataGrid columns={['المتطلب', 'المكوّن', 'الحالة', 'التفاصيل']}>
      {projection.supplyCoverage.map((row, index) => <tr key={`${row.requirement}-${index}`}><td>{row.requirement}</td><td>{row.componentTitle}</td><td><Badge tone={row.status === 'ALLOCATED' || row.status === 'AVAILABLE' ? 'success' : 'error'}>{row.status}</Badge></td><td>{row.detail ?? '—'}</td></tr>)}
    </DataGrid>}
  </section> : <section className="ui-flow">
    <h2>التقرير التشغيلي</h2>
    {!reports ? <EmptyState title="التقارير غير متاحة بالصلاحية الحالية" /> : <>
      <div className="ui-metric-grid"><MetricCard label="الحجوزات" value={reports.bookings.length}/><MetricCard label="المسافرون" value={reports.travelers.length}/><MetricCard label="التسكين" value={reports.rooming.length}/><MetricCard label="التأشيرات" value={reports.visas.length}/><MetricCard label="التذاكر" value={reports.tickets.length}/><MetricCard label="رحلات النقل" value={reports.transport.length}/></div>
      <section className="ui-record-card ui-flow"><strong>تم إنشاء التقرير</strong><span>{new Date(reports.generatedAt).toLocaleString('ar-EG')}</span><span>حالة الجاهزية: {reports.readiness.status === 'READY' ? 'جاهز' : 'غير جاهز'}</span></section>
    </>}
  </section>;

  if (loading && !programs.length) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return <section className="ui-dashboard" dir="rtl" aria-label="مركز جاهزية الحج والعمرة">
    <section className="ui-record-card ui-flow">
      <div className="ui-inline"><strong>البرنامج</strong>{selected ? <Badge tone={tone(selected.status)}>{programStatusLabel[selected.status]}</Badge> : null}</div>
      <Select aria-label="البرنامج" value={programId} onChange={event => setProgramId(event.target.value)}><option value="">اختر البرنامج</option>{programs.map(row => <option key={row.id} value={row.id}>{row.code} — {row.arabicName}</option>)}</Select>
      <ActionBar><Button type="button" variant="secondary" onClick={() => setProgramId(value => value)}>تحديث العرض</Button>{programId ? <a className="ui-button ui-button--secondary" href={`/hajj-umrah/program-workspace?id=${encodeURIComponent(programId)}`}>مركز البرنامج</a> : null}<ManageLink href={`/hajj-umrah/readiness/manage${programId ? `?id=${encodeURIComponent(programId)}` : ''}`}>أدوات الإغلاق والتشغيل المتقدم</ManageLink></ActionBar>
    </section>
    <SettingsWorkspace navigation={<WorkspaceNavigation items={readinessNavigation} active={active} onChange={id => setActive(id as ReadinessSection)} ariaLabel="أقسام مركز الجاهزية"/>} content={loading ? <LoadingState /> : content}/>
  </section>;
}
