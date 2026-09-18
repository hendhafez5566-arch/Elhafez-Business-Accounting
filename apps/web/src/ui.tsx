import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, useEffect, useId, useRef } from 'react';

type Tone = 'neutral' | 'success' | 'error' | 'warning' | 'info';
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { readonly loading?: boolean };
export function Button({ children, loading, disabled, className = '', ...props }: ButtonProps) {
  return <button className={`ui-button ${className}`} disabled={disabled || loading} aria-busy={loading} {...props}>{loading ? 'جارٍ الحفظ…' : children}</button>;
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input className="ui-input" {...props} />; }
export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select className="ui-input" {...props}>{children}</select>; }
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className="ui-input" {...props} />; }
export function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) { return <input type="checkbox" className="ui-checkbox" {...props} />; }
export function FormField({ label, required, error, children }: { readonly label: string; readonly required?: boolean; readonly error?: string; readonly children: ReactNode }) {
  const id = useId(); return <label className="ui-field" htmlFor={id}><span>{label}{required && <span aria-hidden="true"> *</span>}</span>{children}{error && <small role="alert">{error}</small>}</label>;
}
export function Card({ title, children }: { readonly title?: string; readonly children: ReactNode }) { return <section className="ui-card">{title && <h2>{title}</h2>}{children}</section>; }
export function Badge({ tone = 'neutral', children }: { readonly tone?: Tone; readonly children: ReactNode }) { return <span className={`ui-badge ${tone}`}>{children}</span>; }
export function DataGrid({ columns, children }: { readonly columns: readonly string[]; readonly children?: ReactNode }) { return <div className="ui-table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
export function EmptyState({ title = 'لا توجد بيانات', children }: { readonly title?: string; readonly children?: ReactNode }) { return <section className="ui-state"><h2>{title}</h2>{children}</section>; }
export function LoadingState() { return <section className="ui-state" role="status">جارٍ التحميل…</section>; }
export function ErrorState({ message = 'حدث خطأ غير متوقع' }: { readonly message?: string }) { return <section className="ui-state" role="alert">{message}</section>; }
export function Pagination({ page, pages, onChange }: { readonly page: number; readonly pages: number; readonly onChange: (page: number) => void }) { return <nav aria-label="ترقيم الصفحات" className="ui-pagination"><Button onClick={() => onChange(page - 1)} disabled={page <= 1}>السابق</Button><span>{page} / {pages}</span><Button onClick={() => onChange(page + 1)} disabled={page >= pages}>التالي</Button></nav>; }
export function Tabs({ tabs, active, onChange }: { readonly tabs: readonly { id: string; label: string }[]; readonly active: string; readonly onChange: (id: string) => void }) { return <div role="tablist" className="ui-tabs">{tabs.map((tab) => <button key={tab.id} role="tab" aria-selected={active === tab.id} onClick={() => onChange(tab.id)}>{tab.label}</button>)}</div>; }
export function Dropdown({ label, children }: { readonly label: string; readonly children: ReactNode }) { return <details className="ui-dropdown"><summary>{label}</summary>{children}</details>; }
export function Drawer({ open, title, onClose, children }: { readonly open: boolean; readonly title: string; readonly onClose: () => void; readonly children: ReactNode }) { return <div className={`ui-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}><aside role="dialog" aria-modal="true" aria-label={title}><Button onClick={onClose} aria-label="إغلاق">×</Button><h2>{title}</h2>{children}</aside><button className="ui-backdrop" tabIndex={open ? 0 : -1} aria-label="إغلاق القائمة" onClick={onClose} /></div>; }
export function Dialog({ open, title, onClose, children }: { readonly open: boolean; readonly title: string; readonly onClose: () => void; readonly children: ReactNode }) { const ref = useRef<HTMLDialogElement>(null); useEffect(() => { const dialog = ref.current; if (!dialog) return; if (open) dialog.showModal(); else dialog.close(); }, [open]); return <dialog ref={ref} aria-labelledby="dialog-title" onClose={onClose}><header><h2 id="dialog-title">{title}</h2><Button onClick={onClose} aria-label="إغلاق">×</Button></header>{children}</dialog>; }
export function ConfirmationDialog({ open, onClose, onConfirm, title = 'تأكيد الإجراء', children }: { readonly open: boolean; readonly onClose: () => void; readonly onConfirm: () => void; readonly title?: string; readonly children: ReactNode }) { return <Dialog open={open} title={title} onClose={onClose}>{children}<footer><Button onClick={onClose}>إلغاء</Button><Button onClick={onConfirm}>تأكيد</Button></footer></Dialog>; }
export function Toast({ tone = 'info', children }: { readonly tone?: Tone; readonly children: ReactNode }) { return <div className={`ui-toast ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>; }
