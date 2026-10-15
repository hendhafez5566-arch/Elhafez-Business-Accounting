import { Button, Card, EmptyState } from './ui.js';

export interface QuotationDeliveryActionsProps {
  readonly selected: boolean;
  readonly sent: boolean;
  readonly onPrint: () => void;
  readonly onPdf: () => void;
  readonly onWhatsApp: () => void;
  readonly onShare: () => void;
}

// Pure presentation of existing quotation state; actions stay with the page's
// canonical API handlers and never record external delivery merely by rendering.
export function QuotationDeliveryActions(props: QuotationDeliveryActionsProps) {
  return <Card title="الإرسال والتصدير">{props.selected ? <>
    <Button onClick={props.onPrint}>طباعة</Button>
    <Button onClick={props.onPdf}>حفظ PDF</Button>
    <Button onClick={props.onWhatsApp} disabled={!props.sent}>واتساب</Button>
    <Button onClick={props.onShare} disabled={!props.sent}>مشاركة</Button>
    {!props.sent && <small>واتساب والمشاركة يتاحان بعد إرسال مراجعة العرض.</small>}
  </> : <EmptyState title="اختر عرض سعر لتفعيل أدوات الإرسال والتصدير"/>}</Card>;
}
