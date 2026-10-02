import * as React from 'react';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActionBar,
  Badge,
  Button,
  Card,
  DataGrid,
  EmptyState,
  Input,
  MetricCard,
  PageHeader,
  Select,
} from '../../ui.js';
import type {
  AccountingCapabilities,
  AccountingOverview,
} from '../../accounting-client.js';

export interface AccountingPresentationProps {
  readonly data: AccountingOverview;
  readonly capabilities: AccountingCapabilities;
  readonly notice: string;
  readonly reload: () => Promise<void>;
}

export type AccountingPresentation = React.ComponentType<AccountingPresentationProps>;

export interface ListControls {
  readonly query: string;
  readonly sort: 'asc' | 'desc';
}

export function filterAndSortRows<T>(
  rows: readonly T[],
  controls: ListControls,
  searchable: (row: T) => readonly (string | undefined)[],
  sortable: (row: T) => string,
): T[] {
  const query = controls.query.trim().toLocaleLowerCase('ar');
  return [...rows]
    .filter((row) => !query || searchable(row).some((value) => value?.toLocaleLowerCase('ar').includes(query)))
    .sort((left, right) => {
      const comparison = sortable(left).localeCompare(sortable(right), 'ar', { numeric: true });
      return controls.sort === 'asc' ? comparison : -comparison;
    });
}

export function useListControls<T>(
  rows: readonly T[],
  searchable: (row: T) => readonly (string | undefined)[],
  sortable: (row: T) => string,
) {
  const [controls, setControls] = useState<ListControls>({ query: '', sort: 'desc' });
  const visibleRows = useMemo(
    () => filterAndSortRows(rows, controls, searchable, sortable),
    [rows, controls, searchable, sortable],
  );
  return { controls, setControls, visibleRows };
}

export function AccountingPage({ accent, children }: { readonly accent: string; readonly children: ReactNode }) {
  return <main className={`accounting-route accounting-route--${accent}`} dir="rtl">{children}</main>;
}

export function AccountingHeader({
  title,
  children,
  reload,
  notice,
}: {
  readonly title: string;
  readonly children?: ReactNode;
  readonly reload: () => Promise<void>;
  readonly notice: string;
}) {
  return (
    <>
      <PageHeader
        eyebrow="المحاسبة والمالية"
        title={title}
        actions={<ActionBar>{children}<Button variant="secondary" onClick={() => void reload()}>تحديث</Button></ActionBar>}
      />
      {notice ? <p className="accounting-notice" role="status">{notice}</p> : null}
    </>
  );
}

export function ListToolbar({
  controls,
  onChange,
  placeholder = 'بحث في السجلات…',
}: {
  readonly controls: ListControls;
  readonly onChange: (controls: ListControls) => void;
  readonly placeholder?: string;
}) {
  return (
    <div className="accounting-toolbar" role="search">
      <Input
        aria-label="بحث"
        placeholder={placeholder}
        value={controls.query}
        onChange={(event) => onChange({ ...controls, query: event.target.value })}
      />
      <Select
        aria-label="ترتيب النتائج"
        value={controls.sort}
        onChange={(event) => onChange({ ...controls, sort: event.target.value as ListControls['sort'] })}
      >
        <option value="desc">الأحدث أولاً</option>
        <option value="asc">الأقدم أولاً</option>
      </Select>
      <Button variant="ghost" type="button" disabled title="BLOCKED-BY-BACKEND: لا يوجد عقد تصدير لهذه الشاشة">تصدير CSV</Button>
    </div>
  );
}

export function EmptyRow({ columns, label = 'لا توجد سجلات مطابقة' }: { readonly columns: number; readonly label?: string }) {
  return <tr><td colSpan={columns}><EmptyState title={label} /></td></tr>;
}

export function KpiStrip({ items }: { readonly items: readonly [string, ReactNode][] }) {
  return <section className="accounting-kpis">{items.map(([label, value]) => <MetricCard key={label} label={label} value={value} />)}</section>;
}

export function UnsupportedAction({ children, reason }: { readonly children: ReactNode; readonly reason?: string }) {
  return <Button variant="secondary" disabled title={`BLOCKED-BY-BACKEND: ${reason ?? 'لا يوفر المالك الخلفي عقدًا مناسبًا'}`}>{children}</Button>;
}

export function Status({ value }: { readonly value: string }) {
  const tone = value === 'POSTED' || value === 'OPEN' || value === 'ACTIVE' || value === 'CLEARED'
    ? 'success'
    : value === 'VOIDED' || value === 'REVERSED' || value === 'CLOSED'
      ? 'warning'
      : 'neutral';
  return <Badge tone={tone}>{value}</Badge>;
}

export function money(value: string | undefined, currency = '') {
  return value ? `${value} ${currency}` : '—';
}

export { ActionBar, Badge, Button, Card, DataGrid, EmptyState, Input, Select };
