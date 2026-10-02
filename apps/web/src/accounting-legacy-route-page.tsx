import { useEffect, useState } from 'react';
import { accountingApi, type AccountingCapabilities, type AccountingOverview } from './accounting-client.js';
import { AccountingWorkspaceView } from './accounting-workspace-page.js';
import { EmptyState, ErrorState, LoadingState } from './ui.js';

type AccountingSection = Parameters<typeof AccountingWorkspaceView>[0]['section'];

const emptyOverview: AccountingOverview = {
  fiscalYears: [],
  periods: [],
  accounts: [],
  journals: [],
  invoices: [],
  treasuries: [],
  vouchers: [],
  taxPolicies: [],
  approvalPolicies: [],
  approvalRequests: [],
  controlIssues: [],
  reports: {
    trialBalance: { rows: [] },
    incomeStatement: { rows: [] },
    balanceSheet: { rows: [] },
    treasury: { totals: [] },
    tax: { totals: [], facts: [] },
  },
};

export function AccountingLegacyRoutePage({ initialSection }: { readonly initialSection: AccountingSection }) {
  const [data, setData] = useState<AccountingOverview>(emptyOverview);
  const [capabilities, setCapabilities] = useState<AccountingCapabilities>({ read: false, operate: false });
  const [section, setSection] = useState<AccountingSection>(initialSection);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const [nextCapabilities, nextData] = await Promise.all([
        accountingApi.capabilities(),
        accountingApi.overview(),
      ]);
      setCapabilities(nextCapabilities);
      setData(nextData);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'تعذر تحميل المحاسبة.');
    } finally {
      setLoading(false);
    }
  }

  async function done(message: string) {
    setNotice(message);
    await reload();
  }

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);
  useEffect(() => {
    void reload();
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!capabilities.read) return <EmptyState title="لا توجد صلاحية للمحاسبة" />;

  return <AccountingWorkspaceView
    data={data}
    cap={capabilities}
    section={section}
    onSectionChange={setSection}
    notice={notice}
    reload={reload}
    done={done}
  />;
}
