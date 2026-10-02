import type { AppRoute } from './routes.js';
import { AccountingLegacyRoutePage } from './accounting-legacy-route-page.js';
import { AccountingLandingPage, AccountsPage, AccrualsPage, AssetsPage, BudgetsPage, ChequesPage, CostCentersPage, CurrenciesPage, ExpensesPage, InvoicesPage, JournalPage, LoansPage, PaymentsPage, PeriodsPage, ReceiptsPage, SettlementsPage, TaxesPage, TreasuryPage, TrialPage } from './pages/accounting/accounting-pages.js';

const route=(id:string,path:string,label:string,element:React.ComponentType<React.ComponentProps<typeof AccountingLandingPage>>,blueprint:AppRoute['design']['blueprint']='data-table'):AppRoute=>({id,path,label,group:'المحاسبة والمالية',icon:'analytics',design:{blueprint,reference:blueprint==='dashboard'?'financial-reporting-center':blueprint==='master-detail'?'account-statement':'data-table'},element:<AccountingLegacyRoutePage presentation={element}/>});
export const accountingLegacyRoutes:readonly AppRoute[]=[
 route('accounting-workspace','/accounting','المحاسبة والمالية',AccountingLandingPage,'dashboard'),
 route('accounting-invoices','/accounting/invoices','الفواتير',InvoicesPage),
 route('accounting-receipts','/accounting/receipts','سندات القبض',ReceiptsPage),
 route('accounting-payments','/accounting/payments','سندات الصرف',PaymentsPage),
 route('accounting-expenses','/accounting/expenses','المصروفات',ExpensesPage),
 route('accounting-settlements','/accounting/settlements','التسويات',SettlementsPage,'master-detail'),
 route('accounting-accruals','/accounting/accruals','الاستحقاقات',AccrualsPage),
 route('accounting-cheques','/accounting/cheques','الشيكات',ChequesPage),
 route('accounting-treasury','/accounting/treasury','الخزينة والبنوك',TreasuryPage,'master-detail'),
 route('accounting-currencies','/accounting/currencies','العملات وأسعار الصرف',CurrenciesPage),
 route('accounting-taxes','/accounting/taxes','الضرائب',TaxesPage),
 route('accounting-periods','/accounting/periods','الفترات المالية',PeriodsPage),
 route('accounting-journal','/accounting/journal','القيود اليومية',JournalPage),
 route('accounting-accounts','/accounting/accounts','دليل الحسابات',AccountsPage,'master-detail'),
 route('accounting-trial','/accounting/trial','ميزان المراجعة',TrialPage),
 route('accounting-costcenters','/accounting/costcenters','مراكز التكلفة',CostCentersPage,'master-detail'),
 route('accounting-assets','/accounting/assets','الأصول',AssetsPage),
 route('accounting-loans','/accounting/loans','القروض والتمويل',LoansPage),
 route('accounting-budgets','/accounting/budgets','الموازنات',BudgetsPage),
];
