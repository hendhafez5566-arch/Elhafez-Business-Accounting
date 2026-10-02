import type { ReactNode } from 'react';
import { Button, Dialog } from './primitives.js';

export function PrintPreviewShell({
  open,
  title,
  onClose,
  onPrint,
  onPdf,
  onWhatsApp,
  children,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly onPrint: () => void;
  readonly onPdf?: () => void;
  readonly onWhatsApp?: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <section className="ui-print-preview" aria-label="معاينة الطباعة">
        {children}
      </section>
      <footer className="ui-dialog__footer ui-print-preview__actions">
        <Button type="button" variant="secondary" onClick={onClose}>إغلاق</Button>
        {onWhatsApp ? <Button type="button" variant="secondary" onClick={onWhatsApp}>واتساب</Button> : null}
        {onPdf ? <Button type="button" variant="secondary" onClick={onPdf}>PDF</Button> : null}
        <Button type="button" onClick={onPrint}>طباعة</Button>
      </footer>
    </Dialog>
  );
}
