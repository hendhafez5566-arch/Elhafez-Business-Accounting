import { type FormEvent, useEffect, useState } from 'react';
import { AppShell } from './app-shell.js';
import { browserPathname } from './app-entry-path.js';
import { TenantAuthClient } from './tenant-auth-client.js';
import {
  clearTenantSession,
  readTenantSession,
  selectTenantBranch,
  TENANT_SESSION_EVENT,
  type TenantSession,
  writeTenantSession,
} from './tenant-session.js';
import { Button, Card, EmptyState, FormField, Input, Toast } from './ui.js';

export function TenantApplication({ client = new TenantAuthClient() }: { client?: TenantAuthClient } = {}) {
  const [session, setSession] = useState<TenantSession | null>(() => readTenantSession());
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const sync = () => setSession(readTenantSession());
    window.addEventListener(TENANT_SESSION_EVENT, sync);
    setReady(true);
    return () => window.removeEventListener(TENANT_SESSION_EVENT, sync);
  }, []);

  async function logout() {
    const current = readTenantSession();
    clearTenantSession();
    setSession(null);
    if (current) await client.logout(current.token);
  }

  if (!ready) return <BootShell />;
  if (!session) {
    return (
      <TenantLogin
        client={client}
        busy={busy}
        setBusy={setBusy}
        error={error}
        setError={setError}
        onSuccess={value => {
          writeTenantSession(value);
          setSession(value);
        }}
      />
    );
  }
  if (session.mustChangePassword) {
    return (
      <InitialPasswordSetup
        client={client}
        session={session}
        onChanged={value => {
          writeTenantSession(value);
          setSession(value);
        }}
        onLogout={() => void logout()}
      />
    );
  }
  if (!session.subscription.allowed) {
    return (
      <main className="tenant-entry-shell tenant-access-shell" dir="rtl">
        <Card title="الاشتراك غير متاح">
          <EmptyState title="لا يمكن فتح النظام حاليًا">
            <p>حالة الاشتراك: <strong>{session.subscription.status}</strong></p>
            <p>{session.subscription.reason ?? 'يرجى التواصل مع إدارة المنصة لتجديد أو تفعيل الاشتراك.'}</p>
            <Button type="button" onClick={() => void logout()}>تسجيل الخروج</Button>
          </EmptyState>
        </Card>
      </main>
    );
  }

  const branch = session.branches.find(value => value.id === session.branchId);
  return (
    <AppShell
      pathname={browserPathname()}
      preferenceScope={session.userId}
      companyLabel={session.companyName}
      branchLabel={branch?.name ?? session.branchId}
      userLabel={session.username}
      subscriptionStatus={session.subscription.status}
      branches={session.branches.map(value => ({ id: value.id, name: value.name }))}
      branchId={session.branchId}
      onBranchChange={branchId => {
        const next = selectTenantBranch(branchId);
        setSession(next);
      }}
      onLogout={() => void logout()}
      sessionKey={session.companyId + ':' + session.branchId}
    />
  );
}

function BootShell() {
  return (
    <main className="tenant-boot-shell" dir="rtl" aria-live="polite" aria-busy="true">
      <div className="tenant-boot-shell__mark" aria-hidden="true">ح</div>
      <strong>ELHAFEZ Business Platform</strong>
      <span className="tenant-boot-shell__spinner" aria-hidden="true" />
      <p>جارٍ تحميل النظام…</p>
    </main>
  );
}

function TenantLogin({
  client,
  busy,
  setBusy,
  error,
  setError,
  onSuccess,
}: {
  client: TenantAuthClient;
  busy: boolean;
  setBusy: (value: boolean) => void;
  error: string;
  setError: (value: string) => void;
  onSuccess: (value: TenantSession) => void;
}) {
  const [companyCode, setCompanyCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSuccess(await client.login({
        companyCode: companyCode.trim(),
        username: username.trim(),
        password,
      }));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'تعذر تسجيل الدخول.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="tenant-entry-shell tenant-login-shell" dir="rtl">
      <form className="tenant-entry-card tenant-login-card" onSubmit={submit}>
        <header className="tenant-entry-header">
          <div className="tenant-entry-logo" aria-hidden="true">ح</div>
          <div>
            <strong>ELHAFEZ TECHNOLOGY</strong>
            <span>Business Platform</span>
          </div>
        </header>
        <div className="tenant-entry-heading">
          <h1>تسجيل الدخول</h1>
          <p>أدخل كود الشركة وبيانات حسابك للوصول إلى النظام.</p>
        </div>

        <FormField label="كود الشركة" required>
          <Input
            required
            autoCapitalize="characters"
            autoComplete="organization"
            value={companyCode}
            onChange={event => setCompanyCode(event.target.value)}
          />
        </FormField>
        <FormField label="اسم المستخدم" required>
          <Input
            required
            autoCapitalize="none"
            autoComplete="username"
            minLength={3}
            maxLength={40}
            value={username}
            onChange={event => setUsername(event.target.value)}
          />
        </FormField>
        <FormField label="كلمة المرور" required>
          <div className="tenant-password-control">
            <Input
              required
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
            <Button type="button" variant="secondary" onClick={() => setShowPassword(value => !value)}>
              {showPassword ? 'إخفاء' : 'إظهار'}
            </Button>
          </div>
        </FormField>
        {error ? <Toast tone="error">{error}</Toast> : null}
        <Button
          className="tenant-entry-submit"
          type="submit"
          disabled={busy || !companyCode.trim() || !username.trim() || !password}
        >
          {busy ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول'}
        </Button>
        <p className="tenant-entry-note">استخدم كود الشركة وبيانات الحساب الممنوحة لك من إدارة المنصة.</p>
      </form>
    </main>
  );
}

type SetupStep = 1 | 2 | 3;

function InitialPasswordSetup({
  client,
  session,
  onChanged,
  onLogout,
}: {
  client: TenantAuthClient;
  session: TenantSession;
  onChanged: (value: TenantSession) => void;
  onLogout: () => void;
}) {
  const [step, setStep] = useState<SetupStep>(1);
  const [username, setUsername] = useState(session.username);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const branch = session.branches.find(value => value.id === session.branchId);

  function validateCredentials() {
    const nextUsername = username.trim();
    if (nextUsername.length < 3 || nextUsername.length > 40) {
      setError('اسم المستخدم يجب أن يكون بين 3 و40 حرفًا.');
      return false;
    }
    if (password.length < 12) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 12 حرفًا.');
      return false;
    }
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين.');
      return false;
    }
    setError('');
    return true;
  }

  function nextFromCredentials() {
    if (validateCredentials()) setStep(2);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!validateCredentials()) {
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      const nextUsername = username.trim();
      const result = await client.initialPassword(
        session.token,
        session.companyId,
        password,
        nextUsername === session.username ? undefined : nextUsername,
      );
      onChanged({ ...session, username: result.username, mustChangePassword: false });
      setPassword('');
      setConfirm('');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'تعذر حفظ بيانات الدخول.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="tenant-entry-shell tenant-setup-shell" dir="rtl">
      <form className="tenant-entry-card tenant-setup-card" onSubmit={submit}>
        <header className="tenant-entry-header tenant-setup-brand">
          <div className="tenant-entry-logo" aria-hidden="true">ح</div>
          <div>
            <strong>ELHAFEZ TECHNOLOGY</strong>
            <span>إعداد النظام لأول مرة</span>
          </div>
        </header>

        <SetupStepper step={step} />

        {step === 1 ? (
          <section className="tenant-setup-panel" aria-labelledby="setup-credentials-title">
            <div className="tenant-entry-heading">
              <h1 id="setup-credentials-title">إعداد بيانات الدخول</h1>
              <p>عيّن اسم المستخدم وكلمة المرور التي ستستخدمها بعد هذه الخطوة.</p>
            </div>
            <FormField label="اسم المستخدم" required>
              <Input
                required
                autoCapitalize="none"
                autoComplete="username"
                minLength={3}
                maxLength={40}
                value={username}
                onChange={event => setUsername(event.target.value)}
              />
            </FormField>
            <FormField label="كلمة المرور الجديدة" required hint="12 حرفًا على الأقل">
              <div className="tenant-password-control">
                <Input
                  required
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={12}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                />
                <Button type="button" variant="secondary" onClick={() => setShowPassword(value => !value)}>
                  {showPassword ? 'إخفاء' : 'إظهار'}
                </Button>
              </div>
            </FormField>
            <FormField label="تأكيد كلمة المرور" required>
              <Input
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={12}
                value={confirm}
                onChange={event => setConfirm(event.target.value)}
              />
            </FormField>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="tenant-setup-panel" aria-labelledby="setup-company-title">
            <div className="tenant-entry-heading">
              <h1 id="setup-company-title">بيانات الشركة</h1>
              <p>راجع بيانات الشركة والفرع المرتبطين بحسابك على المنصة.</p>
            </div>
            <dl className="tenant-setup-summary">
              <div><dt>اسم الشركة</dt><dd>{session.companyName}</dd></div>
              <div><dt>كود الشركة</dt><dd>{session.companyCode}</dd></div>
              <div><dt>الفرع الحالي</dt><dd>{branch?.name ?? session.branchId}</dd></div>
            </dl>
            <p className="tenant-setup-help">هذه البيانات مصدرها إعداد الشركة في المنصة ولا يتم إنشاء نسخة محلية منها داخل واجهة الدخول.</p>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="tenant-setup-panel" aria-labelledby="setup-review-title">
            <div className="tenant-entry-heading">
              <h1 id="setup-review-title">المراجعة</h1>
              <p>تأكد من البيانات قبل حفظ بيانات الدخول وفتح النظام.</p>
            </div>
            <dl className="tenant-setup-summary tenant-setup-summary--review">
              <div><dt>اسم المستخدم</dt><dd>{username.trim()}</dd></div>
              <div><dt>الشركة</dt><dd>{session.companyName}</dd></div>
              <div><dt>الفرع</dt><dd>{branch?.name ?? session.branchId}</dd></div>
              <div><dt>كلمة المرور</dt><dd>جاهزة للحفظ</dd></div>
            </dl>
          </section>
        ) : null}

        {error ? <Toast tone="error">{error}</Toast> : null}

        <footer className="tenant-setup-actions">
          {step > 1 ? (
            <Button type="button" variant="secondary" onClick={() => setStep((step - 1) as SetupStep)} disabled={busy}>
              السابق
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={onLogout} disabled={busy}>تسجيل الخروج</Button>
          )}
          {step === 1 ? <Button type="button" onClick={nextFromCredentials}>التالي</Button> : null}
          {step === 2 ? <Button type="button" onClick={() => setStep(3)}>التالي</Button> : null}
          {step === 3 ? <Button type="submit" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ وفتح النظام'}</Button> : null}
        </footer>
      </form>
    </main>
  );
}

function SetupStepper({ step }: { readonly step: SetupStep }) {
  const steps: readonly { readonly id: SetupStep; readonly label: string }[] = [
    { id: 1, label: 'بيانات الدخول' },
    { id: 2, label: 'بيانات الشركة' },
    { id: 3, label: 'المراجعة' },
  ];
  return (
    <ol className="tenant-setup-stepper" aria-label="خطوات الإعداد">
      {steps.map(item => (
        <li key={item.id} data-state={item.id === step ? 'active' : item.id < step ? 'complete' : 'pending'}>
          <span aria-hidden="true">{item.id}</span>
          <strong>{item.label}</strong>
        </li>
      ))}
    </ol>
  );
}
