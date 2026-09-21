import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, type PrismaClient } from '@prisma/client';
import { companyId, decimalAmount } from '@elhafez/contracts';
import type {
  InvoiceConversion,
  ProcurementHistory,
  ProcurementPolicy,
  PurchaseOrder,
} from '../domain/procurement.js';
import { PrismaProcurementRepository } from './prisma-procurement.repository.js';

type Row = Record<string, unknown>;

function fakePrisma() {
  const policies = new Map<string, Row>();
  const commitments = new Map<string, Row>();
  const purchaseOrders = new Map<string, Row>();
  const poNumberCounters = new Map<string, Row>();
  const lines = new Map<string, Row>();
  const commitmentHistory = new Map<string, Row>();
  const poHistory = new Map<string, Row>();
  const conversions = new Map<string, Row>();

  const key = (company: string, id: string) => `${company}:${id}`;
  const withLines = (row: Row | undefined) =>
    row
      ? {
          ...row,
          lines: [...lines.values()].filter(
            (line) =>
              line.companyId === row.companyId &&
              line.purchaseOrderId === row.id,
          ),
        }
      : null;

  const db: Record<string, unknown> = {
    procPolicy: {
      findUnique: async ({ where }: { where: { companyId: string } }) =>
        policies.get(where.companyId) ?? null,
      create: async ({ data }: { data: Row }) => {
        if (policies.has(String(data.companyId))) throw new Error('unique');
        policies.set(String(data.companyId), data);
        return data;
      },
    },
    procSupplierCommitment: {
      findUnique: async ({ where }: { where: Row }) => {
        if (where.id) {
          return [...commitments.values()].find((row) => row.id === where.id) ?? null;
        }
        const composite = where.companyId_id as { companyId: string; id: string } | undefined;
        if (composite) return commitments.get(key(composite.companyId, composite.id)) ?? null;
        const source = where.companyId_sourceType_sourceId as
          | { companyId: string; sourceType: string; sourceId: string }
          | undefined;
        if (source) {
          return (
            [...commitments.values()].find(
              (row) =>
                row.companyId === source.companyId &&
                row.sourceType === source.sourceType &&
                row.sourceId === source.sourceId,
            ) ?? null
          );
        }
        return null;
      },
      create: async ({ data }: { data: Row }) => {
        commitments.set(key(String(data.companyId), String(data.id)), data);
        return data;
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const composite = where.companyId_id as { companyId: string; id: string };
        const current = commitments.get(key(composite.companyId, composite.id));
        if (!current) throw new Error('not found');
        const next = { ...current, ...data };
        commitments.set(key(composite.companyId, composite.id), next);
        return next;
      },
    },
    procCommitmentHistory: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        commitmentHistory.get(where.id) ?? null,
      findMany: async ({ where }: { where: { companyId: string; aggregateId: string } }) =>
        [...commitmentHistory.values()].filter(
          (row) =>
            row.companyId === where.companyId && row.aggregateId === where.aggregateId,
        ),
      create: async ({ data }: { data: Row }) => {
        if (commitmentHistory.has(String(data.id))) throw new Error('unique');
        commitmentHistory.set(String(data.id), data);
        return data;
      },
    },
    procPurchaseOrder: {
      findUnique: async ({ where }: { where: Row }) => {
        if (where.id) {
          return withLines(
            [...purchaseOrders.values()].find((row) => row.id === where.id),
          );
        }
        const composite = where.companyId_id as { companyId: string; id: string } | undefined;
        if (composite) {
          return withLines(purchaseOrders.get(key(composite.companyId, composite.id)));
        }
        const number = where.companyId_branchId_number as
          | { companyId: string; branchId: string; number: string }
          | undefined;
        if (number) {
          return withLines(
            [...purchaseOrders.values()].find(
              (row) =>
                row.companyId === number.companyId &&
                row.branchId === number.branchId &&
                row.number === number.number,
            ),
          );
        }
        return null;
      },
      findMany: async ({ where }: { where: Row }) =>
        [...purchaseOrders.values()]
          .filter(
            (row) =>
              row.companyId === where.companyId &&
              (!where.commitmentId || row.commitmentId === where.commitmentId),
          )
          .map((row) => withLines(row)),
      create: async ({ data }: { data: Row }) => {
        const nested = data.lines as { create: Row[] };
        const row = { ...data };
        delete row.lines;
        purchaseOrders.set(key(String(data.companyId), String(data.id)), row);
        for (const line of nested.create) {
          const stored = {
            ...line,
            purchaseOrderId: data.id,
            orderedQuantity: new Prisma.Decimal(String(line.orderedQuantity)),
            receivedQuantity: new Prisma.Decimal(String(line.receivedQuantity)),
            invoicedQuantity: new Prisma.Decimal(String(line.invoicedQuantity)),
          };
          lines.set(key(String(line.companyId), String(line.id)), stored);
        }
        return withLines(row);
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const composite = where.companyId_id as { companyId: string; id: string };
        const current = purchaseOrders.get(key(composite.companyId, composite.id));
        if (!current) throw new Error('not found');
        const next = { ...current, ...data };
        purchaseOrders.set(key(composite.companyId, composite.id), next);
        return withLines(next);
      },
    },
    procPoNumberCounter: {
      upsert: async ({ where, create, update }: { where: Row; create: Row; update: Row }) => {
        const composite=where.companyId_branchId_year as {companyId:string;branchId:string;year:number};
        const counterKey=`${composite.companyId}:${composite.branchId}:${composite.year}`;
        const old=poNumberCounters.get(counterKey);
        if(!old){poNumberCounters.set(counterKey,create);return create;}
        const increment=((update.nextValue as {increment:number}).increment);
        const next={...old,nextValue:Number(old.nextValue)+increment};
        poNumberCounters.set(counterKey,next);
        return next;
      },
    },
    procPurchaseOrderLine: {
      findUnique: async ({ where }: { where: Row }) => {
        const composite = where.companyId_id as { companyId: string; id: string };
        return lines.get(key(composite.companyId, composite.id)) ?? null;
      },
      findMany: async ({ where }: { where: { companyId: string; purchaseOrderId: string } }) =>
        [...lines.values()].filter(
          (row) =>
            row.companyId === where.companyId &&
            row.purchaseOrderId === where.purchaseOrderId,
        ),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const current = lines.get(key(String(where.companyId), String(where.id)));
        if (!current || current.purchaseOrderId !== where.purchaseOrderId) {
          return { count: 0 };
        }

        const receivedFilter = where.receivedQuantity as Prisma.Decimal | { lte: Prisma.Decimal } | undefined;
        const invoicedFilter = where.invoicedQuantity as
          | { lte?: Prisma.Decimal; gte?: Prisma.Decimal }
          | undefined;
        const received = current.receivedQuantity as Prisma.Decimal;
        const invoiced = current.invoicedQuantity as Prisma.Decimal;
        if (receivedFilter instanceof Prisma.Decimal && !received.equals(receivedFilter)) return { count: 0 };
        if (receivedFilter && !(receivedFilter instanceof Prisma.Decimal) && received.gt(receivedFilter.lte)) return { count: 0 };
        if (invoicedFilter?.lte && invoiced.gt(invoicedFilter.lte)) return { count: 0 };
        if (invoicedFilter?.gte && invoiced.lt(invoicedFilter.gte)) return { count: 0 };

        const next = { ...current };
        const receivedData = data.receivedQuantity as Prisma.Decimal | { increment: Prisma.Decimal } | undefined;
        const invoicedData = data.invoicedQuantity as
          | { increment?: Prisma.Decimal; decrement?: Prisma.Decimal }
          | undefined;
        if (receivedData instanceof Prisma.Decimal) {
          next.receivedQuantity = receivedData;
        } else if (receivedData?.increment) {
          next.receivedQuantity = received.add(receivedData.increment);
        }
        if (invoicedData?.increment) {
          next.invoicedQuantity = invoiced.add(invoicedData.increment);
        }
        if (invoicedData?.decrement) {
          next.invoicedQuantity = invoiced.sub(invoicedData.decrement);
        }
        lines.set(key(String(where.companyId), String(where.id)), next);
        return { count: 1 };
      },
    },
    procPoHistory: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        poHistory.get(where.id) ?? null,
      findMany: async ({ where }: { where: { companyId: string; aggregateId: string } }) =>
        [...poHistory.values()].filter(
          (row) =>
            row.companyId === where.companyId && row.aggregateId === where.aggregateId,
        ),
      create: async ({ data }: { data: Row }) => {
        if (poHistory.has(String(data.id))) throw new Error('unique');
        poHistory.set(String(data.id), data);
        return data;
      },
    },
    procInvoiceConversion: {
      findUnique: async ({ where }: { where: Row }) => {
        const composite = where.companyId_id as { companyId: string; id: string } | undefined;
        if (composite) return conversions.get(key(composite.companyId, composite.id)) ?? null;
        const billing = where.companyId_billingInvoiceId_lineId as
          | { companyId: string; billingInvoiceId: string; lineId: string }
          | undefined;
        if (billing) {
          return (
            [...conversions.values()].find(
              (row) =>
                row.companyId === billing.companyId &&
                row.billingInvoiceId === billing.billingInvoiceId &&
                row.lineId === billing.lineId,
            ) ?? null
          );
        }
        return null;
      },
      create: async ({ data }: { data: Row }) => {
        const stored = {
          ...data,
          quantity: new Prisma.Decimal(String(data.quantity)),
          reopenedQuantity: new Prisma.Decimal(String(data.reopenedQuantity)),
        };
        conversions.set(key(String(data.companyId), String(data.id)), stored);
        return stored;
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const composite = where.companyId_id as { companyId: string; id: string };
        const current = conversions.get(key(composite.companyId, composite.id));
        if (!current) throw new Error('not found');
        const next = { ...current, ...data };
        conversions.set(key(composite.companyId, composite.id), next);
        return next;
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const current = conversions.get(key(String(where.companyId), String(where.id)));
        if (!current || (where.status && current.status !== where.status)) return { count: 0 };
        const next = { ...current, ...data };
        conversions.set(key(String(where.companyId), String(where.id)), next);
        return { count: 1 };
      },
    },
  };

  db.$transaction = async (operation: unknown) => {
    if (typeof operation === 'function') {
      return (operation as (client: unknown) => unknown)(db);
    }
    return Promise.all(operation as Promise<unknown>[]);
  };

  return db as unknown as PrismaClient;
}

const company = companyId('company-persisted');

function history(id: string, kind: string): ProcurementHistory {
  return {
    id: `${id}:${kind}`,
    companyId: company,
    aggregateId: id,
    kind,
    createdAt: '2026-09-19T00:00:00.000Z',
  };
}

test('Prisma procurement state survives repository restart and replay gates stay durable', async () => {
  const db = fakePrisma();
  const repository = new PrismaProcurementRepository(db);
  const policy: ProcurementPolicy = {
    companyId: company,
    commitmentTiming: 'ON_PO_APPROVAL',
    version: 1,
    effectiveFrom: '2026-09-19',
    requestHash: 'policy-hash',
  };
  await repository.savePolicy(policy);

  const po: PurchaseOrder = {
    id: 'po',
    companyId: company,
    branchId: 'branch-a',
    supplierId: 'supplier',
    number: 'PO-1',
    origin: 'AUTO',
    status: 'DRAFT',
    requestHash: 'po-hash',
    createdAt: '2026-09-19T00:00:00.000Z',
    lines: [
      {
        id: 'line',
        companyId: company,
        purchaseOrderId: 'po',
        itemReference: 'service',
        orderedQuantity: decimalAmount('10'),
        receivedQuantity: decimalAmount('0'),
        invoicedQuantity: decimalAmount('0'),
      },
    ],
  };
  await repository.savePo(po, history('po', 'CREATED'));
  await repository.approvePo(company, 'po', history('po', 'APPROVED'));
  await repository.receive(
    company,
    'po',
    'line',
    decimalAmount('10'),
    'receipt-1',
    'receipt-hash',
  );

  const conversion: InvoiceConversion = {
    id: 'conversion',
    companyId: company,
    purchaseOrderId: 'po',
    lineId: 'line',
    billingInvoiceId: 'invoice',
    quantity: decimalAmount('4'),
    reopenedQuantity: decimalAmount('0'),
    requestHash: 'conversion-hash',
    status: 'RESERVED',
    createdAt: '2026-09-19T00:00:00.000Z',
  };
  await repository.reserveConversion(conversion);
  await repository.completeConversion(company, 'conversion', 'invoice');

  const afterRestart = new PrismaProcurementRepository(db);
  assert.equal((await afterRestart.policy(company))?.version, 1);
  assert.equal((await afterRestart.po(company, 'po'))?.lines[0]?.receivedQuantity, '10');
  assert.equal((await afterRestart.po(company, 'po'))?.lines[0]?.invoicedQuantity, '4');
  assert.equal((await afterRestart.po(company, 'po'))?.status, 'PARTIALLY_INVOICED');

  await afterRestart.receive(
    company,
    'po',
    'line',
    decimalAmount('10'),
    'receipt-1',
    'receipt-hash',
  );
  await assert.rejects(
    afterRestart.receive(
      company,
      'po',
      'line',
      decimalAmount('1'),
      'receipt-1',
      'different-hash',
    ),
    /conflicting replay/,
  );

  await afterRestart.reopenConversion(
    company,
    'conversion',
    'invoice',
    'cancel-event',
    'cancel-hash',
  );
  assert.equal((await afterRestart.po(company, 'po'))?.lines[0]?.invoicedQuantity, '0');
  assert.equal((await afterRestart.po(company, 'po'))?.status, 'RECEIVED');

  const secondRestart = new PrismaProcurementRepository(db);
  await secondRestart.reopenConversion(
    company,
    'conversion',
    'invoice',
    'cancel-event',
    'cancel-hash',
  );
  assert.equal((await secondRestart.po(company, 'po'))?.lines[0]?.invoicedQuantity, '0');
  await assert.rejects(
    secondRestart.reopenConversion(
      company,
      'conversion',
      'invoice',
      'cancel-event',
      'changed-hash',
    ),
    /conflicting replay/,
  );
});

test('receipt replay preserves its exact before and after quantities after later receipts',async()=>{
  const db=fakePrisma(),repository=new PrismaProcurementRepository(db);
  const po:PurchaseOrder={id:'po-outcome',companyId:company,branchId:'branch-a',supplierId:'supplier',number:'PO-OUTCOME',origin:'AUTO',status:'DRAFT',requestHash:'po-outcome-hash',createdAt:'2026-09-20T00:00:00.000Z',lines:[{id:'line-outcome',companyId:company,purchaseOrderId:'po-outcome',itemReference:'service',orderedQuantity:decimalAmount('10'),receivedQuantity:decimalAmount('0'),invoicedQuantity:decimalAmount('0')}]};
  await repository.savePo(po,history('po-outcome','CREATED'));
  await repository.approvePo(company,'po-outcome',history('po-outcome','APPROVED'));
  const first=await repository.receive(company,'po-outcome','line-outcome',decimalAmount('4'),'r-1','hash-r1');
  const second=await repository.receive(company,'po-outcome','line-outcome',decimalAmount('3'),'r-2','hash-r2');
  const replay=await repository.receive(company,'po-outcome','line-outcome',decimalAmount('4'),'r-1','hash-r1');
  assert.equal(first.previousReceivedQuantity,'0');
  assert.equal(first.resultingReceivedQuantity,'4');
  assert.equal(second.previousReceivedQuantity,'4');
  assert.equal(second.resultingReceivedQuantity,'7');
  assert.equal(replay.previousReceivedQuantity,'0');
  assert.equal(replay.resultingReceivedQuantity,'4');
  assert.equal(replay.purchaseOrder.lines[0]?.receivedQuantity,'7');
});

test('Prisma PO numbering counter is isolated by branch and year',async()=>{
  const db=fakePrisma(),repository=new PrismaProcurementRepository(db);
  assert.equal(await repository.nextPoNumber(company,'branch-a',2026),1);
  assert.equal(await repository.nextPoNumber(company,'branch-a',2026),2);
  assert.equal(await repository.nextPoNumber(company,'branch-b',2026),1);
  assert.equal(await repository.nextPoNumber(company,'branch-a',2027),1);
});
