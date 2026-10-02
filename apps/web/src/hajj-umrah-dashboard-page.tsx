import { useEffect, useMemo, useState } from 'react';
import { hajjUmrahApi, type Program } from './hajj-umrah-client.js';
import { hajjUmrahOperationsApi, type Booking, type Incident } from './hajj-umrah-operations-client.js';
import { ActionBar, Badge, Button, Card, EmptyState, ErrorState, LoadingState, MetricCard } from './ui.js';

const errorMessage = (value: unknown) => value instanceof Error ? value.message : 'تعذر تحميل لوحة الحج والعمرة.';
const go = (path: string) => window.location.assign(path);

export function HajjUmrahDashboardPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const [nextPrograms, nextBookings, nextIncidents] = await Promise.all([
        hajjUmrahApi.listPrograms(),
        hajjUmrahOperationsApi.listBookings(),
        hajjUmrahOperationsApi.listIncidents(),
      ]);
      setPrograms(nextPrograms);
      setBookings(nextBookings);
      setIncidents(nextIncidents);
    } catch (value) {
      setError(errorMessage(value));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, []);

  const activeBookings = useMemo(
    () => bookings.filter((booking) => !['COMPLETED', 'CANCELLED'].includes(booking.status)),
    [bookings],
  );
  const temporaryBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'PRELIMINARY'),
    [bookings],
  );
  const openIncidents = useMemo(
    () => incidents.filter((incident) => incident.status === 'OPEN'),
    [incidents],
  );
  const openPrograms = useMemo(
    () => programs.filter((program) => program.status === 'BOOKABLE' && program.bookingOpen),
    [programs],
  );
  const upcoming = useMemo(
    () => programs
      .filter((program) => !['CLOSED', 'CANCELLED'].includes(program.status))
      .sort((left, right) => left.snapshot.departureDate.localeCompare(right.snapshot.departureDate))
      .slice(0, 4),
    [programs],
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return <section dir="rtl" aria-label="لوحة الحج والعمرة" className="ui-dashboard">
    <header className="ui-inline">
      <div>
        <small>الحج والعمرة</small>
        <h2>لوحة التشغيل</h2>
      </div>
      <div className="ui-inline"><Badge tone="success">Core مباشر</Badge><small>الفرع الحالي</small></div>
    </header>

    <div className="ui-metric-grid" aria-label="مؤشرات الحج والعمرة">
      <MetricCard label="برامج مفتوحة للبيع" value={openPrograms.length} tone="success" />
      <MetricCard label="حجوزات قيد العمل" value={activeBookings.length} tone="info" />
      <MetricCard label="حجوزات مؤقتة" value={temporaryBookings.length} tone={temporaryBookings.length ? 'warning' : 'neutral'} />
      <MetricCard label="مشاكل تشغيل مفتوحة" value={openIncidents.length} tone={openIncidents.length ? 'warning' : 'success'} />
    </div>

    <Card title="إجراءات موجهة">
      <div className="ui-grid-md">
        <Button type="button" onClick={() => go('/hajj-umrah/programs')}>إنشاء برنامج حج/عمرة</Button>
        <Button type="button" variant="secondary" onClick={() => go('/hajj-umrah/bookings')}>إنشاء حجز حج/عمرة</Button>
        <Button type="button" variant="secondary" onClick={() => go('/hajj-umrah/readiness')}>استكمال حجز موجود</Button>
        <Button type="button" variant="secondary" onClick={() => go('/hajj-umrah/readiness')}>تجهيز وتشغيل فوج</Button>
      </div>
    </Card>

    <section className="ui-dashboard-grid">
      <Card title="خطة العمل الحالية">
        {!activeBookings.length && !openIncidents.length
          ? <EmptyState title="لا توجد مهام عاجلة حاليًا" />
          : <div className="ui-flow">
              {temporaryBookings.slice(0, 4).map((booking) => <div className="ui-record-card" key={booking.id}>
                <strong>{booking.code}</strong>
                <small>الحجز يحتاج استكمال التأكيد والجاهزية.</small>
                <ActionBar><Button type="button" variant="secondary" onClick={() => go('/hajj-umrah/bookings')}>نفّذ الآن</Button></ActionBar>
              </div>)}
              {openIncidents.slice(0, 4).map((incident) => <div className="ui-record-card" key={incident.id}>
                <div className="ui-inline"><strong>{incident.summary}</strong><Badge tone={incident.severity === 'CRITICAL' || incident.severity === 'HIGH' ? 'error' : 'warning'}>{incident.severity}</Badge></div>
                <small>واقعة تشغيل مفتوحة تحتاج متابعة.</small>
                <ActionBar><Button type="button" variant="secondary" onClick={() => go('/hajj-umrah/trip-operations')}>نفّذ الآن</Button></ActionBar>
              </div>)}
            </div>}
      </Card>

      <Card title="أقرب برامج سفر">
        {!upcoming.length ? <EmptyState title="لا توجد برامج قادمة" /> : <div className="ui-flow">
          {upcoming.map((program) => <div key={program.id} className="ui-record-card">
            <div className="ui-inline"><strong>{program.code} — {program.arabicName}</strong><Badge>{program.type === 'HAJJ' ? 'حج' : 'عمرة'}</Badge></div>
            <small>{program.snapshot.departureDate} — {program.snapshot.returnDate}</small>
            <ActionBar><Button type="button" variant="secondary" onClick={() => go(`/hajj-umrah/program-workspace?programId=${encodeURIComponent(program.id)}`)}>ملف البرنامج</Button></ActionBar>
          </div>)}
        </div>}
      </Card>
    </section>
  </section>;
}
