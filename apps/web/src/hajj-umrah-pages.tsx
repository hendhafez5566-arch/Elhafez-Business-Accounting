import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DataGrid,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Select,
  Tabs,
  Textarea,
  Toast,
} from './ui.js';
import {
  emptyCapabilities,
  hajjUmrahApi,
  type HajjUmrahApi,
  type HajjUmrahCapabilities,
  type Program,
  type ProgramComponent,
  type ProgramInput,
  type ProgramStatus,
  type ProgramVersion,
  type Requirement,
  type Season,
  type SeasonInput,
} from './hajj-umrah-client.js';

const lifecycleLabels: Record<ProgramStatus, string> = {
  PREPARING: 'تحت التجهيز',
  BOOKABLE: 'متاح للحجز',
  IN_TRIP: 'الرحلة جارية',
  CLOSED: 'منتهي',
  CANCELLED: 'ملغي',
};
const lifecycleTone = (status: ProgramStatus): 'neutral' | 'success' | 'error' | 'warning' | 'info' =>
  status === 'BOOKABLE'
    ? 'success'
    : status === 'CANCELLED'
      ? 'error'
      : status === 'CLOSED'
        ? 'neutral'
        : status === 'IN_TRIP'
          ? 'info'
          : 'warning';

const seasonTone = (status: Season['status']): 'neutral' | 'success' | 'error' =>
  status === 'ACTIVE' ? 'success' : status === 'CANCELLED' ? 'error' : 'neutral';

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'تعذر تنفيذ العملية.';

export async function loadSeasons(api: HajjUmrahApi) {
  return api.listSeasons();
}
export async function createSeasonAndReload(api: HajjUmrahApi, input: SeasonInput) {
  await api.createSeason(input);
  return api.listSeasons();
}
export async function loadPrograms(api: HajjUmrahApi) {
  return api.listPrograms();
}
export async function createProgramAndReload(api: HajjUmrahApi, input: ProgramInput) {
  await api.createProgram(input);
  return api.listPrograms();
}
export type ProgramAction = 'open' | 'booking-open' | 'booking-close' | 'departure' | 'return';
export async function applyProgramAction(api: HajjUmrahApi, id: string, action: ProgramAction) {
  if (action === 'open') return api.openProgram(id);
  if (action === 'booking-open') return api.setBookingAvailability(id, true);
  if (action === 'booking-close') return api.setBookingAvailability(id, false);
  if (action === 'departure') return api.recordDeparture(id);
  return api.recordReturn(id);
}

function emptySeasonInput(): SeasonInput {
  return {
    code: '',
    arabicName: '',
    operatingStart: '',
    operatingEnd: '',
    salesStart: '',
    salesEnd: '',
  };
}

function seasonToInput(season: Season): SeasonInput {
  return {
    code: season.code,
    arabicName: season.arabicName,
    ...(season.englishName ? { englishName: season.englishName } : {}),
    ...(season.hijriLabel ? { hijriLabel: season.hijriLabel } : {}),
    operatingStart: season.operatingStart.slice(0, 10),
    operatingEnd: season.operatingEnd.slice(0, 10),
    salesStart: season.salesStart.slice(0, 10),
    salesEnd: season.salesEnd.slice(0, 10),
    ...(season.notes ? { notes: season.notes } : {}),
  };
}

export function SeasonsView({
  rows,
  capabilities,
  loading = false,
  error = '',
  onEdit,
  onClose,
  onCancel,
}: {
  readonly rows: readonly Season[];
  readonly capabilities: HajjUmrahCapabilities;
  readonly loading?: boolean;
  readonly error?: string;
  readonly onEdit?: (id: string) => void;
  readonly onClose?: (id: string) => void;
  readonly onCancel?: (id: string) => void;
}) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!rows.length) return <EmptyState title="لا توجد مواسم مسجلة" />;
  return <DataGrid columns={['الكود', 'الموسم', 'التشغيل', 'البيع', 'الحالة', 'الإصدار', 'إجراءات']}>
    {rows.map((row) => <tr key={row.id}>
      <td>{row.code}</td>
      <td>{row.arabicName}</td>
      <td>{row.operatingStart.slice(0, 10)} — {row.operatingEnd.slice(0, 10)}</td>
      <td>{row.salesStart.slice(0, 10)} — {row.salesEnd.slice(0, 10)}</td>
      <td><Badge tone={seasonTone(row.status)}>{row.status === 'ACTIVE' ? 'نشط' : row.status === 'CLOSED' ? 'مغلق' : 'ملغي'}</Badge></td>
      <td>{row.version}</td>
      <td>
        {capabilities.seasonManage && row.status === 'ACTIVE' && onEdit && <Button type="button" onClick={() => onEdit(row.id)}>تعديل</Button>}
        {capabilities.seasonLifecycle && row.status === 'ACTIVE' && onClose && <Button type="button" onClick={() => onClose(row.id)}>إغلاق</Button>}
        {capabilities.seasonLifecycle && row.status === 'ACTIVE' && onCancel && <Button type="button" onClick={() => onCancel(row.id)}>إلغاء</Button>}
      </td>
    </tr>)}
  </DataGrid>;
}

export function SeasonsPage({ api = hajjUmrahApi }: { readonly api?: HajjUmrahApi } = {}) {
  const [rows, setRows] = useState<Season[]>([]);
  const [capabilities, setCapabilities] = useState<HajjUmrahCapabilities>(emptyCapabilities);
  const [form, setForm] = useState<SeasonInput>(emptySeasonInput());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function reload() {
    setLoading(true);
    try {
      const [nextRows, nextCapabilities] = await Promise.all([loadSeasons(api), api.capabilities()]);
      setRows(nextRows); setCapabilities(nextCapabilities); setError('');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void reload(); }, [api]);

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      if (editingId) await api.updateSeason(editingId, form);
      else await api.createSeason(form);
      setNotice(editingId ? 'تم تحديث الموسم.' : 'تم إنشاء الموسم.');
      setEditingId(null); setForm(emptySeasonInput());
      await reload();
    } catch (error) { setNotice(errorMessage(error)); }
  }

  async function beginEdit(id: string) {
    try {
      const season = await api.getSeason(id);
      setEditingId(id); setForm(seasonToInput(season)); setNotice('');
    } catch (error) { setNotice(errorMessage(error)); }
  }
  async function closeSeason(id: string) {
    try { await api.closeSeason(id); setNotice('تم إغلاق الموسم.'); await reload(); }
    catch (error) { setNotice(errorMessage(error)); }
  }
  async function cancelSeason() {
    if (!cancelId || !cancelReason.trim()) return;
    try {
      await api.cancelSeason(cancelId, cancelReason);
      setCancelId(null); setCancelReason(''); setNotice('تم إلغاء الموسم.'); await reload();
    } catch (error) { setNotice(errorMessage(error)); }
  }

  return <section aria-label="المواسم">
    {capabilities.seasonManage && <Card title={editingId ? 'تعديل الموسم' : 'إضافة موسم'}>
      <form onSubmit={save}>
        <FormField label="كود الموسم" required><Input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></FormField>
        <FormField label="الاسم العربي" required><Input required value={form.arabicName} onChange={(event) => setForm({ ...form, arabicName: event.target.value })} /></FormField>
        <FormField label="الاسم الإنجليزي"><Input value={form.englishName ?? ''} onChange={(event) => setForm({ ...form, englishName: event.target.value })} /></FormField>
        <FormField label="التسمية الهجرية"><Input value={form.hijriLabel ?? ''} onChange={(event) => setForm({ ...form, hijriLabel: event.target.value })} /></FormField>
        <FormField label="بداية التشغيل" required><Input required type="date" value={form.operatingStart} onChange={(event) => setForm({ ...form, operatingStart: event.target.value })} /></FormField>
        <FormField label="نهاية التشغيل" required><Input required type="date" value={form.operatingEnd} onChange={(event) => setForm({ ...form, operatingEnd: event.target.value })} /></FormField>
        <FormField label="بداية البيع" required><Input required type="date" value={form.salesStart} onChange={(event) => setForm({ ...form, salesStart: event.target.value })} /></FormField>
        <FormField label="نهاية البيع" required><Input required type="date" value={form.salesEnd} onChange={(event) => setForm({ ...form, salesEnd: event.target.value })} /></FormField>
        <FormField label="ملاحظات"><Textarea value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></FormField>
        <Button type="submit">{editingId ? 'حفظ التعديل' : 'حفظ الموسم'}</Button>
        {editingId && <Button type="button" onClick={() => { setEditingId(null); setForm(emptySeasonInput()); }}>إلغاء التعديل</Button>}
      </form>
    </Card>}
    <Card title="المواسم">
      <SeasonsView rows={rows} capabilities={capabilities} loading={loading} error={error} onEdit={(id) => void beginEdit(id)} onClose={(id) => void closeSeason(id)} onCancel={setCancelId} />
    </Card>
    {notice && <Toast>{notice}</Toast>}
    <Dialog open={Boolean(cancelId)} title="إلغاء الموسم" onClose={() => { setCancelId(null); setCancelReason(''); }}>
      <FormField label="سبب الإلغاء" required><Textarea required value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></FormField>
      <Button type="button" disabled={!cancelReason.trim()} onClick={() => void cancelSeason()}>تأكيد الإلغاء</Button>
    </Dialog>
  </section>;
}

function emptyProgramInput(type: Program['type'] = 'UMRAH'): ProgramInput {
  return {
    code: '',
    type,
    seasonId: '',
    arabicName: '',
    departureDate: '',
    returnDate: '',
    salesStart: '',
    salesClose: '',
    capacity: '',
    currency: 'EGP',
    prices: {},
  };
}

function programToInput(program: Program): ProgramInput {
  return {
    code: program.code,
    type: program.type,
    seasonId: program.seasonId,
    arabicName: program.arabicName,
    ...(program.englishName ? { englishName: program.englishName } : {}),
    ...(program.groupNumber ? { groupNumber: program.groupNumber } : {}),
    ...(program.groupDescription ? { groupDescription: program.groupDescription } : {}),
    departureDate: program.snapshot.departureDate.slice(0, 10),
    returnDate: program.snapshot.returnDate.slice(0, 10),
    salesStart: program.snapshot.salesStart.slice(0, 10),
    salesClose: program.snapshot.salesClose.slice(0, 10),
    capacity: program.snapshot.capacity,
    currency: program.snapshot.currency,
    prices: program.snapshot.prices,
    requirements: program.snapshot.requirements,
    components: program.snapshot.components,
    temporaryHoldMinutes: program.temporaryHoldMinutes,
    ...(program.minimumDepositPolicy ? { minimumDepositPolicy: program.minimumDepositPolicy } : {}),
    ...(program.snapshot.cancellationPolicy ? { cancellationPolicy: program.snapshot.cancellationPolicy } : {}),
    ...(program.notes ? { notes: program.notes } : {}),
    ...(program.operationsManager ? { operationsManager: program.operationsManager } : {}),
    ...(program.groupLeader ? { groupLeader: program.groupLeader } : {}),
    ...(program.guide ? { guide: program.guide } : {}),
    ...(program.contact ? { contact: program.contact } : {}),
  };
}

export function ProgramsView({
  rows,
  capabilities,
  loading = false,
  error = '',
}: {
  readonly rows: readonly Program[];
  readonly capabilities: HajjUmrahCapabilities;
  readonly loading?: boolean;
  readonly error?: string;
}) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!rows.length) return <EmptyState title="لا توجد برامج مسجلة" />;
  return <DataGrid columns={['الكود', 'البرنامج', 'النوع', 'الموسم', 'دورة البرنامج', 'توفر البيع', 'الإصدار', '']}>
    {rows.map((row) => <tr key={row.id}>
      <td>{row.code}</td><td>{row.arabicName}</td><td>{row.type === 'HAJJ' ? 'حج' : 'عمرة'}</td><td>{row.seasonId}</td>
      <td><Badge tone={lifecycleTone(row.status)}>{lifecycleLabels[row.status]}</Badge></td>
      <td><Badge tone={row.bookingOpen ? 'success' : 'warning'}>{row.bookingOpen ? 'الحجز متاح' : 'الحجز مغلق'}</Badge></td>
      <td>{row.currentVersion}</td>
      <td><a href={`/hajj-umrah/program-workspace?id=${encodeURIComponent(row.id)}`}>فتح مساحة العمل</a></td>
    </tr>)}
  </DataGrid>;
}

function ProgramForm({
  value,
  onChange,
  submitLabel,
  onSubmit,
}: {
  readonly value: ProgramInput;
  readonly onChange: (value: ProgramInput) => void;
  readonly submitLabel: string;
  readonly onSubmit: (event: FormEvent) => void;
}) {
  const [requirements, setRequirements] = useState((value.requirements ?? []).join(','));
  const [components, setComponents] = useState(JSON.stringify(value.components ?? [], null, 2));
  useEffect(() => {
    setRequirements((value.requirements ?? []).join(','));
    setComponents(JSON.stringify(value.components ?? [], null, 2));
  }, [value]);

  function syncStructured(nextRequirements = requirements, nextComponents = components) {
    let parsedComponents: ProgramComponent[] = [];
    try { parsedComponents = JSON.parse(nextComponents) as ProgramComponent[]; } catch { parsedComponents = value.components ?? []; }
    const parsedRequirements = nextRequirements.split(',').map((item) => item.trim()).filter(Boolean) as Requirement[];
    onChange({
      ...value,
      ...(parsedRequirements.length ? { requirements: parsedRequirements } : {}),
      components: parsedComponents,
    });
  }

  return <form onSubmit={onSubmit}>
    <FormField label="الكود" required><Input required value={value.code} onChange={(event) => onChange({ ...value, code: event.target.value })} /></FormField>
    <FormField label="النوع" required><Select value={value.type} onChange={(event) => onChange({ ...value, type: event.target.value as Program['type'] })}><option value="UMRAH">عمرة</option><option value="HAJJ">حج</option></Select></FormField>
    <FormField label="معرّف الموسم" required><Input required value={value.seasonId} onChange={(event) => onChange({ ...value, seasonId: event.target.value })} /></FormField>
    <FormField label="الاسم العربي" required><Input required value={value.arabicName} onChange={(event) => onChange({ ...value, arabicName: event.target.value })} /></FormField>
    <FormField label="الاسم الإنجليزي"><Input value={value.englishName ?? ''} onChange={(event) => onChange({ ...value, englishName: event.target.value })} /></FormField>
    <FormField label="تاريخ السفر" required><Input required type="date" value={value.departureDate} onChange={(event) => onChange({ ...value, departureDate: event.target.value })} /></FormField>
    <FormField label="تاريخ العودة" required><Input required type="date" value={value.returnDate} onChange={(event) => onChange({ ...value, returnDate: event.target.value })} /></FormField>
    <FormField label="بداية البيع" required><Input required type="date" value={value.salesStart} onChange={(event) => onChange({ ...value, salesStart: event.target.value })} /></FormField>
    <FormField label="إغلاق البيع" required><Input required type="date" value={value.salesClose} onChange={(event) => onChange({ ...value, salesClose: event.target.value })} /></FormField>
    <FormField label="السعة" required><Input required inputMode="decimal" value={value.capacity} onChange={(event) => onChange({ ...value, capacity: event.target.value })} /></FormField>
    <FormField label="العملة" required><Input required value={value.currency} onChange={(event) => onChange({ ...value, currency: event.target.value.toUpperCase() })} /></FormField>
    <FormField label="سعر الثنائي"><Input inputMode="decimal" value={value.prices.double ?? ''} onChange={(event) => onChange({ ...value, prices: { ...value.prices, double: event.target.value || undefined } })} /></FormField>
    <FormField label="المتطلبات (مفصولة بفاصلة)"><Input value={requirements} onChange={(event) => { setRequirements(event.target.value); syncStructured(event.target.value, components); }} placeholder="HOTEL,FLIGHT,TRANSPORT" /></FormField>
    <FormField label="المكونات JSON"><Textarea value={components} onChange={(event) => { setComponents(event.target.value); syncStructured(requirements, event.target.value); }} /></FormField>
    <FormField label="ملاحظات"><Textarea value={value.notes ?? ''} onChange={(event) => onChange({ ...value, notes: event.target.value })} /></FormField>
    <Button type="submit">{submitLabel}</Button>
  </form>;
}

export function ProgramsPage({ api = hajjUmrahApi }: { readonly api?: HajjUmrahApi } = {}) {
  const [rows, setRows] = useState<Program[]>([]);
  const [capabilities, setCapabilities] = useState<HajjUmrahCapabilities>(emptyCapabilities);
  const [form, setForm] = useState<ProgramInput>(emptyProgramInput());
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function reload() {
    setLoading(true);
    try {
      const [nextRows, nextCapabilities] = await Promise.all([loadPrograms(api), api.capabilities()]);
      setRows(nextRows); setCapabilities(nextCapabilities); setError('');
    } catch (error) { setError(errorMessage(error)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, [api]);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      setRows(await createProgramAndReload(api, form));
      setForm(emptyProgramInput()); setShowCreate(false); setNotice('تم إنشاء البرنامج وحفظه على الخادم.');
    } catch (error) { setNotice(errorMessage(error)); }
  }
  const filtered = useMemo(
    () => rows.filter((row) => row.code.includes(query) || row.arabicName.includes(query)),
    [rows, query],
  );

  return <section aria-label="برامج الحج والعمرة">
    <Card title="برامج الحج والعمرة">
      <Input aria-label="بحث البرامج" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث بالاسم أو الكود" />
      {capabilities.programCreate && <Button type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'إغلاق النموذج' : 'إنشاء برنامج'}</Button>}
    </Card>
    {showCreate && capabilities.programCreate && <Card title="إنشاء برنامج"><ProgramForm value={form} onChange={setForm} submitLabel="حفظ البرنامج" onSubmit={create} /></Card>}
    <Card title="قائمة البرامج"><ProgramsView rows={filtered} capabilities={capabilities} loading={loading} error={error} /></Card>
    {notice && <Toast>{notice}</Toast>}
  </section>;
}

const workspaceTabs = [
  { id: 'basic', label: 'البيانات الأساسية' },
  { id: 'dates', label: 'التواريخ والسعة' },
  { id: 'prices', label: 'الأسعار' },
  { id: 'supply', label: 'المتطلبات والمكونات' },
  { id: 'versions', label: 'الإصدارات' },
] as const;

export function ProgramWorkspaceView({
  program,
  versions,
  capabilities,
  loading = false,
  error = '',
  onAction,
  onCancel,
  onReopen,
}: {
  readonly program: Program | null;
  readonly versions: readonly ProgramVersion[];
  readonly capabilities: HajjUmrahCapabilities;
  readonly loading?: boolean;
  readonly error?: string;
  readonly onAction?: (action: ProgramAction) => void;
  readonly onCancel?: () => void;
  readonly onReopen?: () => void;
}) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!program) return <EmptyState title="اختر برنامجاً من قائمة البرامج" />;
  return <Card title={`${program.arabicName} — ${program.code}`}>
    <p><Badge tone={lifecycleTone(program.status)}>{lifecycleLabels[program.status]}</Badge> <Badge tone={program.bookingOpen ? 'success' : 'warning'}>{program.bookingOpen ? 'الحجز متاح' : 'الحجز مغلق'}</Badge></p>
    <p>الموسم: {program.seasonId} · الإصدار الحالي: {program.currentVersion} · عدد الإصدارات: {versions.length}</p>
    {capabilities.programAvailability && program.status === 'BOOKABLE' && onAction && <Button type="button" onClick={() => onAction(program.bookingOpen ? 'booking-close' : 'booking-open')}>{program.bookingOpen ? 'إغلاق الحجز' : 'فتح الحجز'}</Button>}
    {capabilities.programLifecycle && program.status === 'PREPARING' && onAction && <Button type="button" onClick={() => onAction('open')}>اعتماد الجاهزية وإتاحة البرنامج</Button>}
    {capabilities.programLifecycle && program.status === 'BOOKABLE' && onAction && <Button type="button" onClick={() => onAction('departure')}>تسجيل المغادرة</Button>}
    {capabilities.programLifecycle && program.status === 'IN_TRIP' && onAction && <Button type="button" onClick={() => onAction('return')}>تسجيل العودة وإنهاء البرنامج</Button>}
    {capabilities.programCancel && (program.status === 'PREPARING' || program.status === 'BOOKABLE') && onCancel && <Button type="button" onClick={onCancel}>إلغاء البرنامج</Button>}
    {capabilities.programReopen && program.status === 'CLOSED' && onReopen && <Button type="button" onClick={onReopen}>إعادة فتح استثنائية</Button>}
  </Card>;
}

function browserProgramId() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('id') ?? '';
}

export function ProgramWorkspacePage({
  api = hajjUmrahApi,
  programId,
}: {
  readonly api?: HajjUmrahApi;
  readonly programId?: string;
} = {}) {
  const id = programId ?? browserProgramId();
  const [program, setProgram] = useState<Program | null>(null);
  const [versions, setVersions] = useState<ProgramVersion[]>([]);
  const [capabilities, setCapabilities] = useState<HajjUmrahCapabilities>(emptyCapabilities);
  const [tab, setTab] = useState('basic');
  const [editor, setEditor] = useState<ProgramInput>(emptyProgramInput());
  const [reasonMode, setReasonMode] = useState<'cancel' | 'reopen' | 'amend' | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function reload() {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [nextProgram, nextVersions, nextCapabilities] = await Promise.all([
        api.getProgram(id),
        api.versions(id),
        api.capabilities(),
      ]);
      setProgram(nextProgram); setVersions(nextVersions); setCapabilities(nextCapabilities);
      setEditor(programToInput(nextProgram)); setError('');
    } catch (error) { setError(errorMessage(error)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, [api, id]);

  async function action(value: ProgramAction) {
    if (!program) return;
    try {
      const next = await applyProgramAction(api, program.id, value);
      setProgram(next); setEditor(programToInput(next)); setNotice('تم تنفيذ الإجراء وحفظه على الخادم.');
      setVersions(await api.versions(program.id));
    } catch (error) { setNotice(errorMessage(error)); }
  }

  async function saveDefinition(event: FormEvent) {
    event.preventDefault();
    if (!program) return;
    try {
      if (program.status === 'PREPARING') {
        const next = await api.editProgram(program.id, editor);
        setProgram(next); setVersions(await api.versions(program.id)); setNotice('تم حفظ تعديل التجهيز وإصدار نسخة جديدة.');
      } else {
        setReasonMode('amend');
      }
    } catch (error) { setNotice(errorMessage(error)); }
  }

  async function submitReason() {
    if (!program || !reason.trim() || !reasonMode) return;
    try {
      let next: Program;
      if (reasonMode === 'cancel') next = await api.cancelProgram(program.id, reason);
      else if (reasonMode === 'reopen') next = await api.reopenProgram(program.id, reason);
      else next = await api.amendProgram(program.id, editor, reason);
      setProgram(next); setEditor(programToInput(next)); setVersions(await api.versions(program.id));
      setNotice(reasonMode === 'amend' ? 'تم حفظ التعديل كإصدار جديد.' : 'تم تنفيذ الإجراء وحفظه على الخادم.');
      setReasonMode(null); setReason('');
    } catch (error) { setNotice(errorMessage(error)); }
  }

  return <section aria-label="مساحة عمل البرنامج">
    <ProgramWorkspaceView
      program={program}
      versions={versions}
      capabilities={capabilities}
      loading={loading}
      error={error}
      onAction={(value) => void action(value)}
      onCancel={() => setReasonMode('cancel')}
      onReopen={() => setReasonMode('reopen')}
    />
    {program && <>
      <Tabs tabs={workspaceTabs} active={tab} onChange={setTab} />
      {tab === 'basic' && <Card title="البيانات الأساسية والموسم">
        <p>النوع: {program.type === 'HAJJ' ? 'حج' : 'عمرة'} · الموسم: {program.seasonId}</p>
        <p>الاسم الإنجليزي: {program.englishName ?? '—'} · مسؤول العمليات: {program.operationsManager ?? '—'} · قائد المجموعة: {program.groupLeader ?? '—'} · المرشد: {program.guide ?? '—'} · التواصل: {program.contact ?? '—'}</p>
        {(program.status === 'PREPARING' ? capabilities.programEdit : capabilities.programAmend) &&
          <ProgramForm value={editor} onChange={setEditor} submitLabel={program.status === 'PREPARING' ? 'حفظ تعديل التجهيز' : 'إنشاء تعديل معتمد'} onSubmit={saveDefinition} />}
      </Card>}
      {tab === 'dates' && <Card title="التواريخ والسعة">
        <p>السفر: {program.snapshot.departureDate.slice(0, 10)} · العودة: {program.snapshot.returnDate.slice(0, 10)}</p>
        <p>البيع: {program.snapshot.salesStart.slice(0, 10)} — {program.snapshot.salesClose.slice(0, 10)} · السعة: {program.snapshot.capacity}</p>
        <p>مدة الحجز المؤقت: {program.temporaryHoldMinutes} دقيقة</p>
      </Card>}
      {tab === 'prices' && <Card title="الأسعار والسياسات">
        {!Object.entries(program.snapshot.prices).length ? <EmptyState title="لا توجد أسعار" /> : <DataGrid columns={['الفئة', 'السعر', 'العملة']}>
          {Object.entries(program.snapshot.prices).map(([kind, value]) => <tr key={kind}><td>{kind}</td><td>{value}</td><td>{program.snapshot.currency}</td></tr>)}
        </DataGrid>}
        <p>الحد الأدنى للعربون: {program.minimumDepositPolicy ?? '—'} · سياسة الإلغاء: {program.snapshot.cancellationPolicy ?? '—'}</p>
      </Card>}
      {tab === 'supply' && <Card title="المتطلبات والمكونات">
        <p>المتطلبات: {program.snapshot.requirements.join('، ') || '—'}</p>
        {!program.snapshot.components.length ? <EmptyState title="لا توجد مكونات مرتبطة بعد" /> : <DataGrid columns={['الترتيب', 'النوع', 'المكون', 'المرجع التعاقدي', 'الفترة']}>
          {program.snapshot.components.map((component) => <tr key={`${component.sequence}:${component.type}`}>
            <td>{component.sequence}</td><td>{component.type}</td><td>{component.title}</td><td>{component.inventoryReference ?? '—'}</td><td>{component.start ?? '—'}{component.end ? ` — ${component.end}` : ''}</td>
          </tr>)}
        </DataGrid>}
        <p>عند إتاحة البرنامج للحجز، الخادم يتحقق من الموسم والأسعار وأدلة التوريد الفعلية قبل تغيير الحالة.</p>
      </Card>}
      {tab === 'versions' && <Card title="الإصدارات">
        {!versions.length ? <EmptyState title="لا يوجد تاريخ إصدارات" /> : <DataGrid columns={['الإصدار', 'السبب', 'التاريخ', 'المنفذ']}>
          {versions.map((version) => <tr key={version.id}><td>{version.version}</td><td>{version.reason}</td><td>{version.effectiveAt}</td><td>{version.actorId}</td></tr>)}
        </DataGrid>}
      </Card>}
    </>}
    {notice && <Toast>{notice}</Toast>}
    <Dialog open={Boolean(reasonMode)} title={reasonMode === 'reopen' ? 'إعادة فتح استثنائية' : reasonMode === 'amend' ? 'سبب التعديل' : 'إلغاء البرنامج'} onClose={() => { setReasonMode(null); setReason(''); }}>
      <FormField label="السبب" required><Textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></FormField>
      <Button type="button" disabled={!reason.trim()} onClick={() => void submitReason()}>تأكيد</Button>
    </Dialog>
  </section>;
}

export const hajjUmrahLifecycleLabels = lifecycleLabels;
