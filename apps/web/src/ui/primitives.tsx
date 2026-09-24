import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
} from 'react';

export type Tone = 'neutral' | 'success' | 'error' | 'warning' | 'info';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly loading?: boolean;
  readonly variant?: ButtonVariant;
};

export function Button({
  children,
  loading = false,
  disabled,
  className = '',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const classes = ['ui-button', 'ui-button--' + variant, className].filter(Boolean).join(' ');
  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading} {...props}>
      {loading ? 'جارٍ الحفظ…' : children}
    </button>
  );
}

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={['ui-input', className].filter(Boolean).join(' ')} {...props} />;
}

export function Select({
  children,
  className = '',
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={['ui-input', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </select>
  );
}

export function Textarea({
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={['ui-input', className].filter(Boolean).join(' ')} {...props} />;
}

export function Checkbox({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={['ui-checkbox', className].filter(Boolean).join(' ')} {...props} />;
}

export function FormField({
  label,
  required,
  error,
  hint,
  children,
}: {
  readonly label: string;
  readonly required?: boolean;
  readonly error?: string;
  readonly hint?: string;
  readonly children: ReactNode;
}) {
  return (
    <label className="ui-field">
      <span className="ui-field__label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      {children}
      {hint && !error && <small className="ui-field__hint">{hint}</small>}
      {error && <small className="ui-field__error" role="alert">{error}</small>}
    </label>
  );
}

export function PageHeader({
  id,
  eyebrow,
  title,
  description,
  actions,
}: {
  readonly id?: string;
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
}) {
  return (
    <header className="ui-page-header">
      <div>
        {eyebrow && <p className="ui-page-header__eyebrow">{eyebrow}</p>}
        <h1 id={id}>{title}</h1>
        {description && <p className="ui-page-header__description">{description}</p>}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  children,
  className = '',
}: {
  readonly title?: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section className={['ui-card', className].filter(Boolean).join(' ')}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="ui-form-section">
      <header>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </header>
      <div className="ui-form-section__body">{children}</div>
    </section>
  );
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  readonly tone?: Tone;
  readonly children: ReactNode;
}) {
  return <span className={'ui-badge ' + tone}>{children}</span>;
}

export const StatusBadge = Badge;

export function MetricCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly detail?: ReactNode;
  readonly tone?: Tone;
}) {
  return (
    <section className="ui-metric-card" data-tone={tone}>
      <span className="ui-metric-card__label">{label}</span>
      <strong className="ui-metric-card__value">{value}</strong>
      {detail && <small className="ui-metric-card__detail">{detail}</small>}
    </section>
  );
}

export function ActionBar({ children }: { readonly children: ReactNode }) {
  return <div className="ui-action-bar">{children}</div>;
}

export function DataGrid({
  columns,
  children,
  caption,
}: {
  readonly columns: readonly string[];
  readonly children?: ReactNode;
  readonly caption?: string;
}) {
  return (
    <div className="ui-table-wrap">
      <table>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({
  title = 'لا توجد بيانات',
  children,
}: {
  readonly title?: string;
  readonly children?: ReactNode;
}) {
  return <section className="ui-state"><h2>{title}</h2>{children}</section>;
}

export function LoadingState() {
  return <section className="ui-state" role="status">جارٍ التحميل…</section>;
}

export function ErrorState({ message = 'حدث خطأ غير متوقع' }: { readonly message?: string }) {
  return <section className="ui-state ui-state--error" role="alert">{message}</section>;
}

export function Pagination({
  page,
  pages,
  onChange,
}: {
  readonly page: number;
  readonly pages: number;
  readonly onChange: (page: number) => void;
}) {
  return (
    <nav aria-label="ترقيم الصفحات" className="ui-pagination">
      <Button variant="secondary" onClick={() => onChange(page - 1)} disabled={page <= 1}>السابق</Button>
      <span>{page} / {pages}</span>
      <Button variant="secondary" onClick={() => onChange(page + 1)} disabled={page >= pages}>التالي</Button>
    </nav>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  readonly tabs: readonly { id: string; label: string }[];
  readonly active: string;
  readonly onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="ui-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Dropdown({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return <details className="ui-dropdown"><summary>{label}</summary><div className="ui-dropdown__content">{children}</div></details>;
}

export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  return (
    <div className={'ui-drawer ' + (open ? 'is-open' : '')} aria-hidden={!open}>
      <aside role="dialog" aria-modal="true" aria-label={title}>
        <div className="ui-drawer__header">
          <h2>{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="إغلاق">×</Button>
        </div>
        {children}
      </aside>
      <button
        type="button"
        className="ui-backdrop"
        tabIndex={open ? 0 : -1}
        aria-label="إغلاق القائمة"
        onClick={onClose}
      />
    </div>
  );
}

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby="dialog-title" onClose={onClose}>
      <header className="ui-dialog__header">
        <h2 id="dialog-title">{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label="إغلاق">×</Button>
      </header>
      {children}
    </dialog>
  );
}

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title = 'تأكيد الإجراء',
  children,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly title?: string;
  readonly children: ReactNode;
}) {
  return (
    <Dialog open={open} title={title} onClose={onClose}>
      {children}
      <footer className="ui-dialog__footer">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button onClick={onConfirm}>تأكيد</Button>
      </footer>
    </Dialog>
  );
}

export function Toast({
  tone = 'info',
  children,
}: {
  readonly tone?: Tone;
  readonly children: ReactNode;
}) {
  return <div className={'ui-toast ' + tone} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}
