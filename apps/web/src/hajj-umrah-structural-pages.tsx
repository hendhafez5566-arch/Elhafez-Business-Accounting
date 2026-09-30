import { useEffect, useMemo, useState } from 'react';
import {
  ActionBar,
  Badge,
  Button,
  Card,
  DataGrid,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  SplitWorkspace,
} from './ui.js';
import { hajjUmrahApi, type Program } from './hajj-umrah-client.js';
import {
  hajjUmrahOperationsApi,
  type Incident,
  type OperationTask,
  type RoomAssignment,
  type ServiceExecution,
  type TicketRecord,
  type TransportRun,
} from './hajj-umrah-operations-client.js';

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'تعذر تحميل البيانات.';

const programStatusLabel: Record<Program['status'], string> = {
  PREPARING: 'تحت التجهيز',
  BOOKABLE: 'متاح للحجز',
  IN_TRIP: 'في الرحلة',
  CLOSED: 'مغلق',
  CANCELLED: 'ملغي',
};

const programTone = (status: Program['status']) =>
  status === 'BOOKABLE' ? 'success' as const
    : status === 'IN_TRIP' ? 'info' as const
      : status === 'CANCELLED' ? 'error' as const
        : status === 'PREPARING' ? 'warning' as const
          : 'neutral' as const;

const ticketStatusLabel: Record<TicketRecord['status'], string> = {
  RESERVED: 'محجوز',
  ISSUED: 'صادر',
  REISSUED: 'معاد الإصدار',
  VOIDED: 'مبطل',
  CANCELLED: 'ملغي',
};

const transportStatusLabel: Record<TransportRun['status'], string> = {
  SCHEDULED: 'مجدول',
  DISPATCHED: 'تحرك',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغي',
};

const taskStatusLabel: Record<OperationTask['status'], string> = {
  OPEN: 'مفتوحة',
  COMPLETED: 'مكتملة',
  CANCELLED: 'ملغاة',
};

const incidentStatusLabel: Record<Incident['status'], string> = {
  OPEN: 'مفتوح',
  RESOLVED: 'تم الحل',
  CANCELLED: 'ملغي',
};

function RouteAction({ href, children }: { readonly href: string; readonly children: string }) {
  return <a className="ui-button ui-button--secondary" href={href}>{children}</a>;
}

export function HajjUmrahProgramsBoardPage() {
  const [rows, setRows] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    setLoading(true);
    try {
      setRows(await hajjUmrahApi.listPrograms());
      setError('');
    } catch (value) {
      setError(errorMessage(value));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void reload(); }, []);

  const lanes = useMemo(() => ([
    'PREPARING', 'BOOKABLE', 'IN_TRIP', 'CLOSED', 'CANCELLED',
  ] as const).map(status => ({ status, rows: rows.filter(row => row.status === status) })), [rows]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return <section className="ui-dashboard" aria-label="برامج الحج والعمرة — لوحة كانبان">
    <div className="ui-metric-grid">
      <MetricCard label="إجمالي البرامج" value={rows.length} />
      <MetricCard label="متاح للحجز" value={rows.filter(row => row.status === 'BOOKABLE').length} tone="success" />
      <MetricCard label="في الرحلة" value={rows.filter(row => row.status === 'IN_TRIP').length} tone="info" />
      <MetricCard label="تحت التجهيز" value={rows.filter(row => row.status === 'PREPARING').length} tone="warning" />
    </div>
    <ActionBar>
      <Button type="button" variant="secondary" onClick={() => void reload()}>تحديث اللوحة</Button>
      <RouteAction href="/hajj-umrah/programs/manage">إدارة وتعريف البرامج</RouteAction>
      <RouteAction href="/hajj-umrah/readiness">مركز الجاهزية</RouteAction>
    </ActionBar>
    {!rows.length ? <EmptyState title="لا توجد برامج مسجلة" /> : <div className="ui-dashboard-grid" data-workspace="hajj-umrah-kanban">
      {lanes.map(lane => <section className="ui-card ui-flow" key={lane.status} aria-label={programStatusLabel[lane.status]}>
        <div className="ui-inline"><strong>{programStatusLabel[lane.status]}</strong><Badge tone={programTone(lane.status)}>{lane.rows.length}</Badge></div>
        {!lane.rows.length ? <p className="ui-page-intro">لا توجد برامج في هذه المرحلة.</p> : lane.rows.map(program => <article className="ui-record-card ui-flow" key={program.id}>
          <div className="ui-inline"><strong>{program.code}</strong><Badge tone={programTone(program.status)}>{program.type === 'HAJJ' ? 'حج' : 'عمرة'}</Badge></div>
          <strong>{program.arabicName}</strong>
          <small>الطاقة: {program.snapshot.capacity} · الإصدار: {program.currentVersion}</small>
          <small>{program.snapshot.departureDate.slice(0, 10)} ← {program.snapshot.returnDate.slice(0, 10)}</small>
          <small>الحجز: {program.bookingOpen ? 'مفتوح' : 'مغلق'}</small>
          <a href={`/hajj-umrah/program-workspace?id=${encodeURIComponent(program.id)}`}>فتح مركز تشغيل البرنامج</a>
        </article>)}
      </section>)}
    </div>}
  </section>;
}

export function HajjUmrahRoomingMatrixPage() {
  const [rows, setRows] = useState<RoomAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    void hajjUmrahOperationsApi.listRooming().then(setRows).catch(value => setError(errorMessage(value))).finally(() => setLoading(false));
  }, []);

  const active = rows.filter(row => row.status === 'ASSIGNED');
  const groups = useMemo(() => {
    const map = new Map<string, RoomAssignment[]>();
    for (const row of active) {
      const key = row.allocationId;
      const bucket = map.get(key) ?? [];
      bucket.push(row);
      map.set(key, bucket);
    }
    return [...map.entries()];
  }, [active]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return <section className="ui-dashboard" aria-label="مصفوفة تسكين الغرف">
    <div className="ui-metric-grid">
      <MetricCard label="إجمالي التسكينات" value={rows.length} />
      <MetricCard label="تسكين نشط" value={active.length} tone="success" />
      <MetricCard label="تخصيصات فندقية" value={groups.length} />
      <MetricCard label="غير نشط" value={rows.length - active.length} />
    </div>
    <ActionBar><RouteAction href="/hajj-umrah/rooming/manage">إدارة التسكين والنقل والتبديل</RouteAction></ActionBar>
    {!groups.length ? <EmptyState title="لا توجد تسكينات نشطة" /> : <div className="ui-dashboard-grid" data-workspace="rooming-allocation-matrix">
      {groups.map(([allocationId, assignments]) => <section className="ui-card ui-flow" key={allocationId}>
        <div className="ui-inline"><strong>تخصيص الفندق</strong><Badge tone="info">{allocationId}</Badge></div>
        <DataGrid columns={['الغرفة', 'الحجز', 'المسافر', 'الفترة']}>
          {assignments.map(row => <tr key={row.id}>
            <td><strong>{row.roomLabel ?? row.roomKey}</strong></td>
            <td>{row.bookingId}</td>
            <td>{row.travelerId}</td>
            <td>{row.startDate.slice(0, 10)} — {row.endDate.slice(0, 10)}</td>
          </tr>)}
        </DataGrid>
      </section>)}
    </div>}
  </section>;
}

export function HajjUmrahTicketingCenterPage() {
  const [rows, setRows] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function reload() {
    setLoading(true);
    try { setRows(await hajjUmrahOperationsApi.listTickets()); setError(''); }
    catch (value) { setError(errorMessage(value)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const pending = rows.filter(row => row.status === 'RESERVED');
  const issued = rows.filter(row => row.status === 'ISSUED' || row.status === 'REISSUED');
  const closed = rows.filter(row => row.status === 'VOIDED' || row.status === 'CANCELLED');
  return <section className="ui-dashboard" aria-label="مركز التذاكر والطيران">
    <div className="ui-metric-grid">
      <MetricCard label="إجمالي التذاكر" value={rows.length} />
      <MetricCard label="في انتظار الإصدار" value={pending.length} tone="warning" />
      <MetricCard label="صادر" value={issued.length} tone="success" />
      <MetricCard label="ملغي / مبطل" value={closed.length} tone={closed.length ? 'warning' : 'neutral'} />
    </div>
    <ActionBar><Button type="button" variant="secondary" onClick={() => void reload()}>تحديث</Button><RouteAction href="/hajj-umrah/ticketing/manage">إدارة الحجز والإصدار</RouteAction></ActionBar>
    <SplitWorkspace
      left={<section className="ui-flow"><h2>قائمة الإصدار</h2>{!pending.length ? <EmptyState title="لا توجد تذاكر معلقة" /> : <DataGrid columns={['الحجز', 'المسافر', 'PNR', 'الحالة']}>{pending.map(row => <tr key={row.id}><td>{row.bookingId}</td><td>{row.travelerId}</td><td>{row.pnr}</td><td><Badge tone="warning">{ticketStatusLabel[row.status]}</Badge></td></tr>)}</DataGrid>}</section>}
      right={<section className="ui-flow"><h2>التذاكر الصادرة والمغلقة</h2>{!issued.length && !closed.length ? <EmptyState title="لا توجد حركة إصدار" /> : <DataGrid columns={['رقم التذكرة', 'PNR', 'المسافر', 'الحالة']}>{[...issued, ...closed].map(row => <tr key={row.id}><td><strong>{row.ticketNumber ?? '—'}</strong></td><td>{row.pnr}</td><td>{row.travelerId}</td><td><Badge tone={row.status === 'ISSUED' || row.status === 'REISSUED' ? 'success' : 'neutral'}>{ticketStatusLabel[row.status]}</Badge></td></tr>)}</DataGrid>}</section>}
    />
  </section>;
}

export function HajjUmrahTransportFleetPage() {
  const [rows, setRows] = useState<TransportRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function reload() {
    setLoading(true);
    try { setRows(await hajjUmrahOperationsApi.listRuns()); setError(''); }
    catch (value) { setError(errorMessage(value)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const scheduled = rows.filter(row => row.status === 'SCHEDULED');
  const dispatched = rows.filter(row => row.status === 'DISPATCHED');
  const completed = rows.filter(row => row.status === 'COMPLETED');
  return <section className="ui-dashboard" aria-label="إدارة أسطول النقل والتفويج">
    <div className="ui-metric-grid">
      <MetricCard label="إجمالي الرحلات" value={rows.length} />
      <MetricCard label="مجدولة" value={scheduled.length} />
      <MetricCard label="تحركت" value={dispatched.length} tone="info" />
      <MetricCard label="مكتملة" value={completed.length} tone="success" />
    </div>
    <ActionBar><Button type="button" variant="secondary" onClick={() => void reload()}>تحديث الحركة</Button><RouteAction href="/hajj-umrah/transport/manage">إدارة الرحلات وكشوف التفويج</RouteAction></ActionBar>
    <SplitWorkspace
      left={<section className="ui-flow"><h2>نشط الآن</h2>{![...scheduled, ...dispatched].length ? <EmptyState title="لا توجد رحلات نشطة" /> : [...scheduled, ...dispatched].map(run => <article className="ui-record-card ui-flow" key={run.id}><div className="ui-inline"><strong>{run.code}</strong><Badge tone={run.status === 'DISPATCHED' ? 'info' : 'warning'}>{transportStatusLabel[run.status]}</Badge></div><span>{run.route}</span><small>{new Date(run.startsAt).toLocaleString('ar-EG')}</small><small>مركبة: {run.vehicleReference ?? 'غير محددة'} · سائق: {run.driverReference ?? 'غير محدد'}</small></article>)}</section>}
      right={<section className="ui-flow"><h2>السجل المكتمل</h2>{!completed.length ? <EmptyState title="لا توجد رحلات مكتملة" /> : completed.map(run => <article className="ui-record-card ui-flow" key={run.id}><div className="ui-inline"><strong>{run.code}</strong><Badge tone="success">مكتمل</Badge></div><span>{run.route}</span><small>{new Date(run.startsAt).toLocaleString('ar-EG')} — {new Date(run.endsAt).toLocaleString('ar-EG')}</small></article>)}</section>}
    />
  </section>;
}

export function HajjUmrahTripOperationsCommandPage() {
  const [tasks, setTasks] = useState<OperationTask[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [services, setServices] = useState<ServiceExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    setLoading(true);
    try {
      const [nextTasks, nextIncidents, nextServices] = await Promise.all([
        hajjUmrahOperationsApi.listTasks(),
        hajjUmrahOperationsApi.listIncidents(),
        hajjUmrahOperationsApi.listServices(),
      ]);
      setTasks(nextTasks); setIncidents(nextIncidents); setServices(nextServices); setError('');
    } catch (value) { setError(errorMessage(value)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const openTasks = tasks.filter(row => row.status === 'OPEN');
  const openIncidents = incidents.filter(row => row.status === 'OPEN');
  const critical = openIncidents.filter(row => row.severity === 'CRITICAL');
  const timeline = [
    ...openIncidents.map(row => ({ key: `incident-${row.id}`, kind: 'incident' as const, at: row.createdAt, row })),
    ...openTasks.map(row => ({ key: `task-${row.id}`, kind: 'task' as const, at: row.dueAt, row })),
  ].sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());

  return <section className="ui-dashboard" aria-label="غرفة العمليات الميدانية">
    <div className="ui-metric-grid">
      <MetricCard label="مهام مفتوحة" value={openTasks.length} tone={openTasks.length ? 'warning' : 'success'} />
      <MetricCard label="بلاغات مفتوحة" value={openIncidents.length} tone={openIncidents.length ? 'warning' : 'success'} />
      <MetricCard label="حالات حرجة" value={critical.length} tone={critical.length ? 'error' : 'neutral'} />
      <MetricCard label="خدمات منفذة" value={services.length} tone="success" />
    </div>
    <ActionBar><Button type="button" variant="secondary" onClick={() => void reload()}>تحديث الآن</Button><RouteAction href="/hajj-umrah/trip-operations/manage">إدارة المهام والبلاغات والخدمات</RouteAction></ActionBar>
    <SplitWorkspace
      left={<section className="ui-flow"><div className="ui-inline"><h2>الحالة الميدانية</h2>{critical.length ? <Badge tone="error">طارئ {critical.length}</Badge> : <Badge tone="success">لا توجد حالات حرجة</Badge>}</div>{!timeline.length ? <EmptyState title="لا توجد عناصر تشغيل مفتوحة" /> : timeline.map(item => item.kind === 'incident' ? <article className="ui-record-card ui-flow" key={item.key}><div className="ui-inline"><Badge tone={item.row.severity === 'CRITICAL' ? 'error' : item.row.severity === 'HIGH' ? 'warning' : 'info'}>{item.row.severity}</Badge><strong>{item.row.summary}</strong></div><small>البرنامج: {item.row.programId}</small><small>الحالة: {incidentStatusLabel[item.row.status]}</small></article> : <article className="ui-record-card ui-flow" key={item.key}><div className="ui-inline"><Badge tone="warning">مهمة</Badge><strong>{item.row.title}</strong></div><small>البرنامج: {item.row.programId}</small><small>الاستحقاق: {new Date(item.row.dueAt).toLocaleString('ar-EG')}</small><small>الحالة: {taskStatusLabel[item.row.status]}</small></article>)}</section>}
      right={<section className="ui-flow"><h2>ملخص التنفيذ</h2><Card title="آخر الخدمات المنفذة">{!services.length ? <EmptyState title="لا توجد خدمات منفذة" /> : <DataGrid columns={['الخدمة', 'الحجز', 'الوقت']}>{services.slice(0, 8).map(row => <tr key={row.id}><td><strong>{row.category}</strong></td><td>{row.bookingId}</td><td>{new Date(row.executedAt).toLocaleString('ar-EG')}</td></tr>)}</DataGrid>}</Card><Card title="التوجيه السريع"><p>التشغيل الكتابي يظل في شاشة المعاملات الوحيدة، بينما هذه الغرفة تعرض الحالة الحية من نفس مصادر الحقيقة.</p><ActionBar><RouteAction href="/hajj-umrah/transport">النقل والتفويج</RouteAction><RouteAction href="/hajj-umrah/rooming">التسكين</RouteAction><RouteAction href="/hajj-umrah/ticketing">التذاكر</RouteAction></ActionBar></Card></section>}
    />
  </section>;
}
