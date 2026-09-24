import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  decimalAmount,
  type CompanyId,
  type DecimalAmount,
  type SourceReference,
} from '@elhafez/contracts';
import type {
  Allocation,
  AllocationCostEffect,
  AllocationCoverageRequirement,
  AllocationEconomicEvidence,
  ContractType,
  ContractVersion,
  FlightBlock,
  FlightBlockConsumption,
  HotelInventory,
  ProcurementRequest,
  ReleaseBlocker,
  StopSale,
  TourismContract,
  TransportCapacity,
  VisaQuota,
  GenericServiceInventory,
} from '../domain/inventory.js';
import type {
  AdjustAllocationInput,
  AllocateCapacityInput,
  AllocationResult,
  AmendContractInput,
  AvailabilityResult,
  CheckAvailabilityInput,
  ConsumeFlightBlockInput,
  CreateFlightBlockInput,
  CreateHotelInventoryInput,
  CreateStopSaleInput,
  CreateTourismContractInput,
  CreateTransportCapacityInput,
  CreateVisaQuotaInput,
  CreateGenericServiceInput,
  InternalFirstFulfillmentInput,
  ProtectAllocationCoverageInput,
  ProgramSupplyEvidence,
  ProgramSupplyEvidenceInput,
  RegisterAllocationEconomicEvidenceInput,
  ReleaseAllocationCoverageInput,
  ReleaseAllocationInput,
  ReleaseResult,
  PlanStandaloneSupplyInput,
  CommitStandaloneSupplyPlanInput,
  StandaloneSupplyPlan,
  StandaloneSupplyCommit,
  StandaloneSupplyRequest,
  StandaloneSupplyPlanLine,
  StandaloneSupplyResidual,
} from '../application/inventory.application-service.js';
import { idempotencyHash } from '../application/idempotency-hash.js';
import type {
  AdjustmentResult,
  TourismInventoryRepository,
} from './inventory.repository.js';

type Tx = Prisma.TransactionClient;

type AllocationRow = {
  id: string;
  companyId: string;
  contractId: string;
  contractVersionId: string;
  resourceType: string;
  resourceId: string;
  program: Prisma.JsonValue;
  serviceDate: Date;
  periodEnd: Date | null;
  quantity: Prisma.Decimal;
  status: string;
  releaseBlockerReason: string | null;
  flightSegmentReference: Prisma.JsonValue | null;
  visaBatchReference: Prisma.JsonValue | null;
  createdAt: Date;
  sourceReference: Prisma.JsonValue | null;
};

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const source = (value: Prisma.JsonValue | null): SourceReference | undefined =>
  value === null ? undefined : (value as unknown as SourceReference);
const amount = (value: { toString(): string }): DecimalAmount => decimalAmount(value.toString());
const iso = (value: Date): string => value.toISOString();

function contract(row: {
  id: string;
  companyId: string;
  type: string;
  status: string;
  supplierId: string | null;
  effectiveFrom: Date;
  effectiveTo: Date;
  createdAt: Date;
  sourceReference: Prisma.JsonValue | null;
}): TourismContract {
  return {
    id: row.id,
    companyId: row.companyId as CompanyId,
    type: row.type as TourismContract['type'],
    status: row.status as TourismContract['status'],
    supplierId: row.supplierId ?? undefined,
    effectiveFrom: iso(row.effectiveFrom),
    effectiveTo: iso(row.effectiveTo),
    createdAt: iso(row.createdAt),
    sourceReference: source(row.sourceReference),
  };
}

function version(row: {
  id: string;
  companyId: string;
  contractId: string;
  versionNumber: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  terms: Prisma.JsonValue;
  createdAt: Date;
  isCurrent: boolean;
}): ContractVersion {
  return {
    id: row.id,
    companyId: row.companyId as CompanyId,
    contractId: row.contractId,
    versionNumber: row.versionNumber,
    effectiveFrom: iso(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? iso(row.effectiveTo) : undefined,
    terms: row.terms as Record<string, unknown>,
    createdAt: iso(row.createdAt),
    isCurrent: row.isCurrent,
  };
}

function allocation(row: AllocationRow): Allocation {
  return {
    id: row.id,
    companyId: row.companyId as CompanyId,
    contractId: row.contractId,
    contractVersionId: row.contractVersionId,
    resourceType: row.resourceType as ContractType,
    resourceId: row.resourceId,
    program: row.program as unknown as SourceReference,
    serviceDate: iso(row.serviceDate),
    periodEnd: row.periodEnd ? iso(row.periodEnd) : undefined,
    quantity: amount(row.quantity),
    status: row.status as Allocation['status'],
    releaseBlockerReason: row.releaseBlockerReason ?? undefined,
    flightSegmentReference: source(row.flightSegmentReference),
    visaBatchReference: source(row.visaBatchReference),
    createdAt: iso(row.createdAt),
    sourceReference: source(row.sourceReference),
  };
}

function sameSource(left: SourceReference, right: SourceReference): boolean {
  return left.sourceType === right.sourceType && left.sourceId === right.sourceId;
}

export class PrismaTourismInventoryRepository implements TourismInventoryRepository {
  constructor(private readonly db: PrismaClient) {}

  async planStandaloneSupply(input: PlanStandaloneSupplyInput): Promise<StandaloneSupplyPlan> {
    if (!input.branchId.trim() || !input.service.sourceId.trim() || !Number.isInteger(input.serviceRevision) || input.serviceRevision < 1 || input.requests.length === 0) {
      throw new Error('branch, real service source and supply requests are required');
    }
    const groups = new Map<string, StandaloneSupplyRequest[]>();
    const seen = new Set<string>();
    for (const request of input.requests) {
      const quantity = new Prisma.Decimal(request.quantity);
      const cost = new Prisma.Decimal(request.unitCost);
      if (!request.requestId.trim() || !request.currency.trim() || !request.unit.trim() || quantity.lte(0) || cost.lt(0)) {
        throw new Error('valid quantity, currency, unit and nonnegative cost are required');
      }
      const candidate = `${request.requestId}:${request.contractId}:${request.resourceId}:${request.serviceDate}`;
      if (seen.has(candidate)) throw new Error('duplicate supply candidate');
      seen.add(candidate);
      const group = groups.get(request.requestId) ?? [];
      if (group.length && (group[0]!.quantity !== request.quantity || group[0]!.unit !== request.unit || group[0]!.currency !== request.currency || group[0]!.resourceType !== request.resourceType)) {
        throw new Error('candidate group must have one demand, unit, currency and resource type');
      }
      group.push(request);
      groups.set(request.requestId, group);
    }
    const lines: StandaloneSupplyPlanLine[] = [];
    const residuals: StandaloneSupplyResidual[] = [];
    const totals = new Map<string, Prisma.Decimal>();
    for (const candidates of groups.values()) {
      const first = candidates[0]!;
      let remaining = new Prisma.Decimal(first.quantity);
      for (const request of candidates) {
        const start = new Date(request.serviceDate);
        const end = new Date(request.periodEnd ?? request.serviceDate);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) throw new Error('invalid service window');
        const owner = await this.db.tciContract.findUnique({where:{companyId_id:{companyId:input.companyId,id:request.contractId}}});
        if (!owner || owner.type !== request.resourceType || !['ACTIVE','AMENDED'].includes(owner.status) || owner.effectiveFrom > start || owner.effectiveTo < end || (request.supplierId && owner.supplierId !== request.supplierId)) {
          throw new Error('candidate contract is not active, scoped or supplier-matched');
        }
        const version = await this.db.tciContractVersion.findFirst({where:{companyId:input.companyId,contractId:request.contractId,isCurrent:true}});
        const terms = version?.terms;
        const pricing = terms && typeof terms === 'object' && !Array.isArray(terms) ? terms.standalonePricing : null;
        if (!version || !pricing || typeof pricing !== 'object' || Array.isArray(pricing) ||
            pricing.currency !== request.currency || pricing.unit !== request.unit ||
            typeof pricing.unitCost !== 'string' || !new Prisma.Decimal(pricing.unitCost).eq(request.unitCost)) {
          throw new Error('contract version lacks matching standalone pricing evidence');
        }
        const stopped = await this.db.tciStopSale.findFirst({where:{companyId:input.companyId,contractId:request.contractId,isActive:true,effectiveFrom:{lte:end},effectiveTo:{gte:start}}});
        const available = stopped ? new Prisma.Decimal(0) : new Prisma.Decimal(await this.resourceAvailable(this.db, {companyId:input.companyId,contractId:request.contractId,resourceType:request.resourceType,resourceId:request.resourceId,serviceDate:request.serviceDate,...(request.periodEnd?{periodEnd:request.periodEnd}:{})}));
        const allocated = Prisma.Decimal.min(remaining, available);
        const costAmount = allocated.mul(request.unitCost);
        lines.push({requestId:request.requestId,contractId:request.contractId,pricingVersionId:version.id,resourceType:request.resourceType,resourceId:request.resourceId,...(owner.supplierId?{supplierId:owner.supplierId}:{}),serviceDate:request.serviceDate,...(request.periodEnd?{periodEnd:request.periodEnd}:{}),requestedQuantity:first.quantity,allocationQuantity:amount(allocated),unit:request.unit,currency:request.currency,unitCost:request.unitCost,costAmount:amount(costAmount)});
        totals.set(request.currency,(totals.get(request.currency)??new Prisma.Decimal(0)).add(costAmount));
        remaining = remaining.sub(allocated);
      }
      if (remaining.gt(0)) {
        const quote=input.externalQuotes?.find(value=>value.requestId===first.requestId);
        if ((input.externalQuotes?.filter(value=>value.requestId===first.requestId).length ?? 0) > 1) throw new Error('multiple external quotes require staff selection before preview');
        if (quote) {
          if(!quote.supplierId.trim()||!quote.quoteReference.trim()||quote.currency!==first.currency||new Prisma.Decimal(quote.unitCost).lt(0))throw new Error('invalid external supplier quote');
          const externalCost=remaining.mul(quote.unitCost);
          totals.set(quote.currency,(totals.get(quote.currency)??new Prisma.Decimal(0)).add(externalCost));
          residuals.push({requestId:first.requestId,resourceType:first.resourceType,quantity:amount(remaining),unit:first.unit,currency:quote.currency,supplierId:quote.supplierId,unitCost:quote.unitCost,costAmount:amount(externalCost),quoteReference:quote.quoteReference});
        } else residuals.push({requestId:first.requestId,resourceType:first.resourceType,quantity:amount(remaining),unit:first.unit,currency:first.currency});
      }
    }
    const plan: StandaloneSupplyPlan = {planId:randomUUID(),version:1,inputHash:idempotencyHash(input),companyId:input.companyId,branchId:input.branchId,expiresAt:new Date(Date.now()+15*60_000).toISOString(),service:input.service,serviceRevision:input.serviceRevision,lines,residuals,totalsByCurrency:Object.fromEntries([...totals].map(([currency,value])=>[currency,amount(value)]))};
    await this.db.tciStandaloneSupplyPlan.create({data:{id:plan.planId,companyId:input.companyId,branchId:input.branchId,serviceType:input.service.sourceType,serviceId:input.service.sourceId,inputHash:plan.inputHash,version:plan.version,expiresAt:new Date(plan.expiresAt),snapshot:json(plan),requests:json(input.requests),status:'PROPOSED'}});
    return plan;
  }

  async getStandaloneSupplyPlan(companyId: CompanyId, planId: string): Promise<StandaloneSupplyPlan | null> {
    const row = await this.db.tciStandaloneSupplyPlan.findUnique({where:{id:planId}});
    return row?.companyId===companyId ? row.snapshot as unknown as StandaloneSupplyPlan : null;
  }

  async commitStandaloneSupplyPlan(input: CommitStandaloneSupplyPlanInput, key: string | undefined, hash: string): Promise<StandaloneSupplyCommit> {
    if (!key?.trim()) throw new Error('supply plan commit requires an idempotency key');
    return this.command(input.companyId,key,hash,async tx=>{
      const row=await tx.tciStandaloneSupplyPlan.findUnique({where:{id:input.planId}});
      if (!row || row.companyId!==input.companyId || row.branchId!==input.branchId || row.serviceType!==input.service.sourceType || row.serviceId!==input.service.sourceId || row.inputHash!==input.inputHash || row.version!==input.planVersion) throw new Error('supply plan scope or version mismatch');
      if (row.status==='COMMITTED') return row.committed as unknown as StandaloneSupplyCommit;
      if (row.status!=='PROPOSED' || row.expiresAt<=new Date()) throw new Error('supply plan expired; preview again');
      const plan=row.snapshot as unknown as StandaloneSupplyPlan;
      const requests=row.requests as unknown as StandaloneSupplyRequest[];
      const ids:string[]=[];
      for (const line of plan.lines) {
        if (new Prisma.Decimal(line.allocationQuantity).isZero()) continue;
        const request=requests.find(v=>v.requestId===line.requestId&&v.contractId===line.contractId&&v.resourceId===line.resourceId&&v.serviceDate===line.serviceDate);
        if (!request) throw new Error('supply plan candidate is missing');
        const start=new Date(line.serviceDate);const end=new Date(line.periodEnd??line.serviceDate);
        const owner=await tx.tciContract.findUnique({where:{companyId_id:{companyId:input.companyId,id:line.contractId}}});
        if(!owner||!['ACTIVE','AMENDED'].includes(owner.status)||owner.effectiveFrom>start||owner.effectiveTo<end)throw new Error('PLAN_CHANGED: contract unavailable');
        const version=await tx.tciContractVersion.findFirst({where:{companyId:input.companyId,contractId:line.contractId,isCurrent:true}});
        if(!version||version.id!==line.pricingVersionId)throw new Error('PLAN_CHANGED: contract pricing changed');
        const stopped=await tx.tciStopSale.findFirst({where:{companyId:input.companyId,contractId:line.contractId,isActive:true,effectiveFrom:{lte:end},effectiveTo:{gte:start}}});
        if(stopped)throw new Error('PLAN_CHANGED: stop sale');
        const result=await this.allocateTx(tx,{companyId:input.companyId,contractId:line.contractId,resourceType:line.resourceType,resourceId:line.resourceId,program:input.service,serviceDate:line.serviceDate,...(line.periodEnd?{periodEnd:line.periodEnd}:{}),quantity:line.allocationQuantity,...(request.flightSegmentReference?{flightSegmentReference:request.flightSegmentReference}:{}),...(request.visaBatchReference?{visaBatchReference:request.visaBatchReference}:{})});
        if(!result.allocation)throw new Error('PLAN_CHANGED: allocation evidence missing');
        ids.push(result.allocation.id);
      }
      const committed:StandaloneSupplyCommit={planId:row.id,version:row.version,allocationIds:ids,residuals:plan.residuals};
      await tx.tciStandaloneSupplyPlan.update({where:{id:row.id},data:{status:'COMMITTED',committed:json(committed)}});
      return committed;
    });
  }

  private async command<T>(
    companyId: CompanyId,
    key: string | undefined,
    hash: string,
    work: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    return this.db.$transaction(
      async (tx) => {
        if (key) {
          const old = await tx.tciIdempotencyKey.findUnique({
            where: { companyId_key: { companyId, key } },
          });
          if (old) {
            if (old.requestHash !== hash) {
              throw new Error(`Idempotency conflict for '${key}'`);
            }
            return old.result as unknown as T;
          }
        }

        const result = await work(tx);
        if (key) {
          await tx.tciIdempotencyKey.create({
            data: {
              id: randomUUID(),
              companyId,
              key,
              requestHash: hash,
              result: json(result),
            },
          });
        }
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async createContract(
    input: CreateTourismContractInput,
    key: string | undefined,
    hash: string,
  ): Promise<TourismContract> {
    return this.command(input.companyId, key, hash, async (tx) => {
      const id = randomUUID();
      const created = await tx.tciContract.create({
        data: {
          id,
          companyId: input.companyId,
          type: input.type,
          status: 'ACTIVE',
          supplierId: input.supplierId,
          effectiveFrom: new Date(input.effectiveFrom),
          effectiveTo: new Date(input.effectiveTo),
          sourceReference: input.sourceReference ? json(input.sourceReference) : Prisma.JsonNull,
        },
      });
      const initialVersion = await tx.tciContractVersion.create({
        data: {
          id: randomUUID(),
          companyId: input.companyId,
          contractId: id,
          versionNumber: 1,
          effectiveFrom: new Date(input.effectiveFrom),
          effectiveTo: new Date(input.effectiveTo),
          terms: json({ type: input.type, supplierId: input.supplierId ?? null }),
          isCurrent: true,
        },
      });
      await this.history(tx, input.companyId, id, 'CONTRACT_CREATED', initialVersion.id);
      return contract(created);
    });
  }

  async amendContract(
    input: AmendContractInput,
    key: string | undefined,
    hash: string,
  ): Promise<ContractVersion> {
    return this.command(input.companyId, key, hash, async (tx) => {
      const currentContract = await tx.tciContract.findUnique({
        where: { companyId_id: { companyId: input.companyId, id: input.contractId } },
      });
      if (!currentContract) throw new Error('contract not found for company');

      const currentVersion = await tx.tciContractVersion.findFirst({
        where: { companyId: input.companyId, contractId: input.contractId, isCurrent: true },
      });
      if (!currentVersion) throw new Error('current contract version not found');

      const dateBlockers = await tx.tciAllocation.count({
        where: {
          companyId: input.companyId,
          contractId: input.contractId,
          status: { in: ['CONFIRMED', 'PARTIALLY_RELEASED'] },
          OR: [
            { serviceDate: { lt: new Date(input.effectiveFrom) } },
            ...(input.effectiveTo
              ? [{ serviceDate: { gt: new Date(input.effectiveTo) } }]
              : []),
          ],
        },
      });
      const protectedCoverage = await tx.tciAllocationCoverageRequirement.count({
        where: {
          companyId: input.companyId,
          active: true,
          allocation: {
            contractId: input.contractId,
            OR: [
              { serviceDate: { lt: new Date(input.effectiveFrom) } },
              ...(input.effectiveTo
                ? [{ serviceDate: { gt: new Date(input.effectiveTo) } }]
                : []),
            ],
          },
        },
      });
      if (dateBlockers || protectedCoverage) {
        throw new Error('amendment would remove required active program coverage');
      }

      await tx.tciContractVersion.updateMany({
        where: {
          companyId: input.companyId,
          contractId: input.contractId,
          isCurrent: true,
        },
        data: { isCurrent: false },
      });

      const created = await tx.tciContractVersion.create({
        data: {
          id: randomUUID(),
          companyId: input.companyId,
          contractId: input.contractId,
          versionNumber: currentVersion.versionNumber + 1,
          effectiveFrom: new Date(input.effectiveFrom),
          effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
          terms: json(input.terms),
          isCurrent: true,
        },
      });
      await tx.tciContract.update({
        where: { companyId_id: { companyId: input.companyId, id: input.contractId } },
        data: { status: 'AMENDED' },
      });
      await this.history(
        tx,
        input.companyId,
        input.contractId,
        'CONTRACT_AMENDED',
        created.id,
      );
      return version(created);
    });
  }

  async contract(companyId: CompanyId, id: string): Promise<TourismContract | null> {
    const row = await this.db.tciContract.findUnique({
      where: { companyId_id: { companyId, id } },
    });
    return row ? contract(row) : null;
  }

  async versions(companyId: CompanyId, id: string): Promise<ContractVersion[]> {
    return (
      await this.db.tciContractVersion.findMany({
        where: { companyId, contractId: id },
        orderBy: { versionNumber: 'asc' },
      })
    ).map(version);
  }

  async createHotel(
    input: CreateHotelInventoryInput,
    key: string | undefined,
    hash: string,
  ): Promise<HotelInventory> {
    return this.command(input.companyId, key, hash, async (tx) => {
      await this.requireContract(tx, input.companyId, input.contractId, 'HOTEL');
      const row = await tx.tciHotelInventory.create({
        data: {
          id: randomUUID(),
          companyId: input.companyId,
          contractId: input.contractId,
          hotelId: input.hotelId,
          roomId: input.roomId,
          serviceDate: new Date(input.serviceDate),
          contractedQuantity: input.contractedQuantity,
          allocatedQuantity: '0',
          availableQuantity: input.contractedQuantity,
          status: 'ACTIVE',
        },
      });
      await this.history(
        tx,
        input.companyId,
        input.contractId,
        'HOTEL_INVENTORY_CREATED',
        row.id,
      );
      return {
        id: row.id,
        companyId: row.companyId as CompanyId,
        contractId: row.contractId,
        hotelId: row.hotelId,
        roomId: row.roomId ?? undefined,
        serviceDate: iso(row.serviceDate),
        contractedQuantity: amount(row.contractedQuantity),
        allocatedQuantity: amount(row.allocatedQuantity),
        availableQuantity: amount(row.availableQuantity),
        status: 'ACTIVE',
      };
    });
  }

  async createFlight(
    input: CreateFlightBlockInput,
    key: string | undefined,
    hash: string,
  ): Promise<FlightBlock> {
    return this.command(input.companyId, key, hash, async (tx) => {
      await this.requireContract(tx, input.companyId, input.contractId, 'FLIGHT_BLOCK');
      const row = await tx.tciFlightBlock.create({
        data: {
          id: randomUUID(),
          companyId: input.companyId,
          contractId: input.contractId,
          flightNumber: input.flightNumber,
          origin: input.origin,
          destination: input.destination,
          departureDate: new Date(input.departureDate),
          totalSeats: input.totalSeats,
          consumedSeats: '0',
          availableSeats: input.totalSeats,
        },
      });
      return {
        id: row.id,
        companyId: row.companyId as CompanyId,
        contractId: row.contractId,
        flightNumber: row.flightNumber,
        origin: row.origin,
        destination: row.destination,
        departureDate: iso(row.departureDate),
        totalSeats: amount(row.totalSeats),
        consumedSeats: amount(row.consumedSeats),
        availableSeats: amount(row.availableSeats),
      };
    });
  }

  async createTransport(
    input: CreateTransportCapacityInput,
    key: string | undefined,
    hash: string,
  ): Promise<TransportCapacity> {
    return this.command(input.companyId, key, hash, async (tx) => {
      await this.requireContract(tx, input.companyId, input.contractId, 'TRANSPORT');
      const row = await tx.tciTransportCapacity.create({
        data: {
          id: randomUUID(),
          companyId: input.companyId,
          contractId: input.contractId,
          vehicleId: input.vehicleId,
          capacityUnits: input.capacityUnits,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          consumedUnits: '0',
        },
      });
      return {
        id: row.id,
        companyId: row.companyId as CompanyId,
        contractId: row.contractId,
        vehicleId: row.vehicleId,
        capacityUnits: amount(row.capacityUnits),
        periodStart: iso(row.periodStart),
        periodEnd: iso(row.periodEnd),
        consumedUnits: amount(row.consumedUnits),
      };
    });
  }

  async createVisa(
    input: CreateVisaQuotaInput,
    key: string | undefined,
    hash: string,
  ): Promise<VisaQuota> {
    return this.command(input.companyId, key, hash, async (tx) => {
      await this.requireContract(tx, input.companyId, input.contractId, 'VISA');
      const row = await tx.tciVisaQuota.create({
        data: {
          id: randomUUID(),
          companyId: input.companyId,
          contractId: input.contractId,
          visaType: input.visaType,
          nationality: input.nationality,
          quotaTotal: input.quotaTotal,
          quotaConsumed: '0',
          quotaRemaining: input.quotaTotal,
          effectiveFrom: new Date(input.effectiveFrom),
          effectiveTo: new Date(input.effectiveTo),
        },
      });
      return {
        id: row.id,
        companyId: row.companyId as CompanyId,
        contractId: row.contractId,
        visaType: row.visaType,
        nationality: row.nationality ?? undefined,
        quotaTotal: amount(row.quotaTotal),
        quotaConsumed: amount(row.quotaConsumed),
        quotaRemaining: amount(row.quotaRemaining),
        effectiveFrom: iso(row.effectiveFrom),
        effectiveTo: iso(row.effectiveTo),
      };
    });
  }

  async createService(input:CreateGenericServiceInput,key:string|undefined,hash:string):Promise<GenericServiceInventory>{return this.command(input.companyId,key,hash,async(tx)=>{await this.requireContract(tx,input.companyId,input.contractId,'SERVICE');const row=await tx.tciServiceInventory.create({data:{id:randomUUID(),companyId:input.companyId,contractId:input.contractId,category:input.category,name:input.name,description:input.description,unit:input.unit,serviceStart:new Date(input.serviceStart),serviceEnd:new Date(input.serviceEnd),capacity:input.capacity,allocatedQuantity:'0',availableQuantity:input.capacity,releaseDeadline:input.releaseDeadline?new Date(input.releaseDeadline):null,status:'ACTIVE'}});return{id:row.id,companyId:row.companyId as CompanyId,contractId:row.contractId,category:row.category as GenericServiceInventory['category'],name:row.name,description:row.description??undefined,unit:row.unit,serviceStart:iso(row.serviceStart),serviceEnd:iso(row.serviceEnd),capacity:amount(row.capacity),allocatedQuantity:amount(row.allocatedQuantity),availableQuantity:amount(row.availableQuantity),releaseDeadline:row.releaseDeadline?iso(row.releaseDeadline):undefined,status:row.status as GenericServiceInventory['status']}})}

  async createStopSale(
    input: CreateStopSaleInput,
    key: string | undefined,
    hash: string,
  ): Promise<StopSale> {
    return this.command(input.companyId, key, hash, async (tx) => {
      await this.requireContract(tx, input.companyId, input.contractId);
      const row = await tx.tciStopSale.create({
        data: {
          id: randomUUID(),
          companyId: input.companyId,
          contractId: input.contractId,
          reason: input.reason,
          effectiveFrom: new Date(input.effectiveFrom),
          effectiveTo: new Date(input.effectiveTo),
          isActive: true,
        },
      });
      return {
        id: row.id,
        companyId: row.companyId as CompanyId,
        contractId: row.contractId,
        reason: row.reason,
        effectiveFrom: iso(row.effectiveFrom),
        effectiveTo: iso(row.effectiveTo),
        createdAt: iso(row.createdAt),
        isActive: row.isActive,
      };
    });
  }

  async availability(input: CheckAvailabilityInput): Promise<AvailabilityResult> {
    const stopSale = await this.db.tciStopSale.findFirst({
      where: {
        companyId: input.companyId,
        contractId: input.contractId,
        isActive: true,
        effectiveFrom: { lte: new Date(input.serviceDate) },
        effectiveTo: { gte: new Date(input.serviceDate) },
      },
    });
    if (stopSale) {
      return {
        available: false,
        availableQuantity: decimalAmount('0'),
        blockerReason: `Stop sale: ${stopSale.reason}`,
      };
    }
    const availableQuantity = await this.resourceAvailable(this.db, input);
    return { available: availableQuantity !== '0', availableQuantity };
  }

  async supplyEvidence(input: ProgramSupplyEvidenceInput): Promise<ProgramSupplyEvidence> {
    const serviceDate = new Date(input.serviceDate);
    const periodEnd = new Date(input.periodEnd ?? input.serviceDate);
    let contractId: string | undefined;

    if (input.resourceType === 'HOTEL') {
      contractId = (
        await this.db.tciHotelInventory.findFirst({
          where: {
            companyId: input.companyId,
            id: input.resourceId,
            serviceDate,
            status: 'ACTIVE',
          },
          select: { contractId: true },
        })
      )?.contractId;
    } else if (input.resourceType === 'FLIGHT_BLOCK') {
      contractId = (
        await this.db.tciFlightBlock.findFirst({
          where: {
            companyId: input.companyId,
            id: input.resourceId,
            departureDate: serviceDate,
          },
          select: { contractId: true },
        })
      )?.contractId;
    } else if (input.resourceType === 'TRANSPORT') {
      contractId = (
        await this.db.tciTransportCapacity.findFirst({
          where: {
            companyId: input.companyId,
            id: input.resourceId,
            periodStart: { lte: serviceDate },
            periodEnd: { gte: periodEnd },
          },
          select: { contractId: true },
        })
      )?.contractId;
    } else if (input.resourceType === 'VISA') {
      contractId = (
        await this.db.tciVisaQuota.findFirst({
          where: {
            companyId: input.companyId,
            id: input.resourceId,
            effectiveFrom: { lte: serviceDate },
            effectiveTo: { gte: periodEnd },
          },
          select: { contractId: true },
        })
      )?.contractId;
    } else if (input.resourceType === 'SERVICE') {
      contractId = (
        await this.db.tciServiceInventory.findFirst({
          where: {
            companyId: input.companyId,
            id: input.resourceId,
            ...(input.serviceCategory ? { category: input.serviceCategory } : {}),
            serviceStart: { lte: serviceDate },
            serviceEnd: { gte: periodEnd },
            status: 'ACTIVE',
          },
          select: { contractId: true },
        })
      )?.contractId;
    }

    if (!contractId) {
      return {
        available: false,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        availableQuantity: decimalAmount('0'),
        blockerReason: 'no matching contracted resource evidence',
      };
    }

    const owner = await this.db.tciContract.findUnique({
      where: { companyId_id: { companyId: input.companyId, id: contractId } },
    });
    if (
      !owner ||
      !['ACTIVE', 'AMENDED'].includes(owner.status) ||
      owner.effectiveFrom > serviceDate ||
      owner.effectiveTo < periodEnd
    ) {
      return {
        available: false,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        contractId,
        availableQuantity: decimalAmount('0'),
        blockerReason: 'contract is not active for the required service window',
      };
    }

    const availability = await this.availability({
      companyId: input.companyId,
      contractId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      serviceDate: input.serviceDate,
      ...(input.periodEnd ? { periodEnd: input.periodEnd } : {}),
    });
    return {
      ...availability,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      contractId,
    };
  }

  async allocate(
    input: AllocateCapacityInput,
    key: string | undefined,
    hash: string,
  ): Promise<AllocationResult> {
    try {
      return await this.command(input.companyId, key, hash, (tx) =>
        this.allocateTx(tx, input),
      );
    } catch (error) {
      if (
        input.resourceType === 'VISA' &&
        input.visaBatchReference &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const prior = await this.findVisaBatchAllocation(
          input.companyId,
          idempotencyHash(input.visaBatchReference),
        );
        if (prior && this.sameVisaAllocation(prior, input)) {
          return { allocation: prior };
        }
      }
      throw error;
    }
  }

  private async allocateTx(tx: Tx, input: AllocateCapacityInput): Promise<AllocationResult> {
    const stopSale = await tx.tciStopSale.findFirst({
      where: {
        companyId: input.companyId,
        contractId: input.contractId,
        isActive: true,
        effectiveFrom: { lte: new Date(input.serviceDate) },
        effectiveTo: { gte: new Date(input.serviceDate) },
      },
    });
    if (stopSale) throw new Error(`stop sale in effect: ${stopSale.reason}`);

    let visaBatchKey: string | null = null;
    if (input.resourceType === 'VISA') {
      if (!input.visaBatchReference) throw new Error('visa batch evidence is required');
      visaBatchKey = idempotencyHash(input.visaBatchReference);
      const prior = await tx.tciAllocation.findUnique({
        where: {
          companyId_visaBatchKey: {
            companyId: input.companyId,
            visaBatchKey,
          },
        },
      });
      if (prior) {
        const mapped = allocation(prior);
        if (this.sameVisaAllocation(mapped, input)) return { allocation: mapped };
        throw new Error('conflicting visa batch reuse');
      }
    }

    const currentVersion = await tx.tciContractVersion.findFirst({
      where: {
        companyId: input.companyId,
        contractId: input.contractId,
        isCurrent: true,
      },
    });
    if (!currentVersion) throw new Error('current contract version not found');

    await this.consume(tx, input);
    const row = await tx.tciAllocation.create({
      data: {
        id: randomUUID(),
        companyId: input.companyId,
        contractId: input.contractId,
        contractVersionId: currentVersion.id,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        program: json(input.program),
        serviceDate: new Date(input.serviceDate),
        periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
        quantity: input.quantity,
        status: 'CONFIRMED',
        visaBatchKey,
        flightSegmentReference: input.flightSegmentReference
          ? json(input.flightSegmentReference)
          : Prisma.JsonNull,
        visaBatchReference: input.visaBatchReference
          ? json(input.visaBatchReference)
          : Prisma.JsonNull,
        sourceReference: input.sourceReference ? json(input.sourceReference) : Prisma.JsonNull,
      },
    });
    await this.history(
      tx,
      input.companyId,
      input.contractId,
      'ALLOCATION_CREATED',
      row.id,
    );
    return { allocation: allocation(row) };
  }

  private async consume(tx: Tx, input: AllocateCapacityInput): Promise<void> {
    let count = 0;
    if (input.resourceType === 'HOTEL') {
      count = (
        await tx.tciHotelInventory.updateMany({
          where: {
            companyId: input.companyId,
            id: input.resourceId,
            contractId: input.contractId,
            serviceDate: new Date(input.serviceDate),
            status: 'ACTIVE',
            availableQuantity: { gte: input.quantity },
          },
          data: {
            allocatedQuantity: { increment: input.quantity },
            availableQuantity: { decrement: input.quantity },
          },
        })
      ).count;
    } else if (input.resourceType === 'FLIGHT_BLOCK') {
      count = (
        await tx.tciFlightBlock.updateMany({
          where: {
            companyId: input.companyId,
            id: input.resourceId,
            contractId: input.contractId,
            departureDate: new Date(input.serviceDate),
            availableSeats: { gte: input.quantity },
          },
          data: {
            consumedSeats: { increment: input.quantity },
            availableSeats: { decrement: input.quantity },
          },
        })
      ).count;
    } else if (input.resourceType === 'VISA') {
      count = (
        await tx.tciVisaQuota.updateMany({
          where: {
            companyId: input.companyId,
            id: input.resourceId,
            contractId: input.contractId,
            effectiveFrom: { lte: new Date(input.serviceDate) },
            effectiveTo: { gte: new Date(input.serviceDate) },
            quotaRemaining: { gte: input.quantity },
          },
          data: {
            quotaConsumed: { increment: input.quantity },
            quotaRemaining: { decrement: input.quantity },
          },
        })
      ).count;
    } else if(input.resourceType==='SERVICE'){
      count=(await tx.tciServiceInventory.updateMany({where:{companyId:input.companyId,id:input.resourceId,contractId:input.contractId,serviceStart:{lte:new Date(input.serviceDate)},serviceEnd:{gte:new Date(input.periodEnd??input.serviceDate)},status:'ACTIVE',availableQuantity:{gte:input.quantity}},data:{allocatedQuantity:{increment:input.quantity},availableQuantity:{decrement:input.quantity}}})).count;
    } else {
      if (!input.periodEnd) throw new Error('transport periodEnd is required');
      const capacity = await tx.tciTransportCapacity.findUnique({
        where: {
          companyId_id: {
            companyId: input.companyId,
            id: input.resourceId,
          },
        },
      });
      if (
        capacity &&
        capacity.contractId === input.contractId &&
        capacity.periodStart <= new Date(input.serviceDate) &&
        capacity.periodEnd >= new Date(input.periodEnd)
      ) {
        const used = await tx.tciAllocation.aggregate({
          _sum: { quantity: true },
          where: {
            companyId: input.companyId,
            resourceType: 'TRANSPORT',
            resourceId: input.resourceId,
            status: { in: ['CONFIRMED', 'PARTIALLY_RELEASED', 'CONSUMED'] },
            serviceDate: { lt: new Date(input.periodEnd) },
            periodEnd: { gt: new Date(input.serviceDate) },
          },
        });
        const requested = new Prisma.Decimal(used._sum.quantity ?? 0).add(input.quantity);
        if (requested.lte(capacity.capacityUnits)) count = 1;
      }
    }

    if (count !== 1) {
      throw new Error(`insufficient ${input.resourceType} capacity or resource mismatch`);
    }
  }

  async release(
    input: ReleaseAllocationInput,
    key: string | undefined,
    hash: string,
  ): Promise<ReleaseResult> {
    return this.command(input.companyId, key, hash, async (tx) => {
      const row = await tx.tciAllocation.findUnique({
        where: {
          companyId_id: {
            companyId: input.companyId,
            id: input.allocationId,
          },
        },
      });
      if (!row) throw new Error('allocation not found for company');
      if (new Prisma.Decimal(input.quantity).gt(row.quantity)) {
        throw new Error('release exceeds allocated quantity');
      }

      const remaining = row.quantity.sub(input.quantity);
      const blockers = await this.releaseBlockersTx(tx, row, remaining);
      if (blockers.length) {
        const evidence = JSON.stringify(blockers);
        await tx.tciAllocation.update({
          where: {
            companyId_id: {
              companyId: input.companyId,
              id: row.id,
            },
          },
          data: { releaseBlockerReason: evidence },
        });
        await tx.tciAllocationRelease.create({
          data: {
            id: randomUUID(),
            companyId: input.companyId,
            allocationId: row.id,
            releasedQuantity: '0',
            blockerEvidence: evidence,
            status: 'BLOCKED',
          },
        });
        return {
          success: false,
          blockerEvidence: evidence,
          releasedQuantity: decimalAmount('0'),
        };
      }

      await this.restore(
        tx,
        row.resourceType as ContractType,
        row.resourceId,
        input.companyId,
        input.quantity,
      );
      const status = remaining.isZero() ? 'RELEASED' : 'PARTIALLY_RELEASED';
      await tx.tciAllocation.update({
        where: {
          companyId_id: {
            companyId: input.companyId,
            id: row.id,
          },
        },
        data: {
          quantity: remaining,
          status,
          releaseBlockerReason: null,
        },
      });
      await tx.tciAllocationRelease.create({
        data: {
          id: randomUUID(),
          companyId: input.companyId,
          allocationId: row.id,
          releasedQuantity: input.quantity,
          status: 'SUCCESS',
        },
      });
      return { success: true, releasedQuantity: input.quantity };
    });
  }

  async adjust(
    input: AdjustAllocationInput,
    key: string | undefined,
    hash: string,
  ): Promise<AdjustmentResult> {
    return this.command(input.companyId, key, hash, async (tx) => {
      const existingEffect = await tx.tciAllocationCostEffect.findUnique({
        where: {
          companyId_id: {
            companyId: input.companyId,
            id: input.costEffectId,
          },
        },
      });
      if (existingEffect) {
        if (existingEffect.requestHash !== hash) {
          throw new Error('conflicting allocation cost effect replay');
        }
        const existingAllocation = await tx.tciAllocation.findUnique({
          where: {
            companyId_id: {
              companyId: input.companyId,
              id: existingEffect.allocationId,
            },
          },
        });
        if (!existingAllocation) throw new Error('allocation cost effect lost its allocation');
        return {
          allocation: allocation(existingAllocation),
          previousQuantity: amount(existingEffect.previousQuantity),
          costEffectId: existingEffect.id,
        };
      }

      const row = await tx.tciAllocation.findUnique({
        where: {
          companyId_id: {
            companyId: input.companyId,
            id: input.allocationId,
          },
        },
      });
      if (!row) throw new Error('allocation not found for company');

      const previousQuantity = amount(row.quantity);
      const next = new Prisma.Decimal(input.newQuantity);
      const delta = next.sub(row.quantity);
      if (delta.gt(0)) {
        await this.consume(tx, {
          companyId: input.companyId,
          contractId: row.contractId,
          resourceType: row.resourceType as ContractType,
          resourceId: row.resourceId,
          program: row.program as unknown as SourceReference,
          serviceDate: iso(row.serviceDate),
          periodEnd: row.periodEnd ? iso(row.periodEnd) : undefined,
          quantity: amount(delta),
          sourceReference: input.sourceReference,
          visaBatchReference: source(row.visaBatchReference),
        });
      } else if (delta.lt(0)) {
        await this.restore(
          tx,
          row.resourceType as ContractType,
          row.resourceId,
          input.companyId,
          amount(delta.negated()),
        );
      }

      const updated = await tx.tciAllocation.update({
        where: {
          companyId_id: {
            companyId: input.companyId,
            id: row.id,
          },
        },
        data: { quantity: input.newQuantity },
      });
      await tx.tciAllocationCostEffect.create({
        data: {
          id: input.costEffectId,
          companyId: input.companyId,
          allocationId: row.id,
          program: json(row.program),
          previousQuantity: row.quantity,
          newQuantity: input.newQuantity,
          costAmount: input.costAmount,
          postingDate: new Date(input.postingDate),
          status: 'PENDING',
          requestHash: hash,
        },
      });
      await this.history(
        tx,
        input.companyId,
        row.contractId,
        'ALLOCATION_ADJUSTED',
        row.id,
      );
      return {
        allocation: allocation(updated),
        previousQuantity,
        costEffectId: input.costEffectId,
      };
    });
  }

  async costEffect(
    companyId: CompanyId,
    effectId: string,
  ): Promise<AllocationCostEffect | null> {
    const row = await this.db.tciAllocationCostEffect.findUnique({
      where: { companyId_id: { companyId, id: effectId } },
    });
    return row
      ? {
          id: row.id,
          companyId: row.companyId as CompanyId,
          allocationId: row.allocationId,
          program: row.program as unknown as SourceReference,
          previousQuantity: amount(row.previousQuantity),
          newQuantity: amount(row.newQuantity),
          costAmount: amount(row.costAmount),
          postingDate: row.postingDate.toISOString().slice(0, 10),
          status: row.status as AllocationCostEffect['status'],
          ownerReference: row.ownerReference ?? undefined,
          requestHash: row.requestHash,
          createdAt: iso(row.createdAt),
          completedAt: row.completedAt ? iso(row.completedAt) : undefined,
        }
      : null;
  }

  async completeCostEffect(
    companyId: CompanyId,
    effectId: string,
    ownerReference: string,
  ): Promise<AllocationCostEffect> {
    await this.db.tciAllocationCostEffect.updateMany({
      where: {
        companyId,
        id: effectId,
        status: 'PENDING',
      },
      data: {
        status: 'COMPLETED',
        ownerReference,
        completedAt: new Date(),
      },
    });
    const value = await this.costEffect(companyId, effectId);
    if (!value) throw new Error('allocation cost effect not found for company');
    if (value.status !== 'COMPLETED') throw new Error('allocation cost effect was not completed');
    if (value.ownerReference !== ownerReference) {
      throw new Error('allocation cost effect owner reference conflict');
    }
    return value;
  }

  async consumeFlight(
    input: ConsumeFlightBlockInput,
    key: string | undefined,
    hash: string,
  ): Promise<FlightBlockConsumption> {
    return this.command(input.companyId, key, hash, async (tx) => {
      const block = await tx.tciFlightBlock.findUnique({
        where: {
          companyId_id: {
            companyId: input.companyId,
            id: input.flightBlockId,
          },
        },
      });
      if (!block) throw new Error('flight block not found for company');
      const updated = await tx.tciFlightBlock.updateMany({
        where: {
          companyId: input.companyId,
          id: input.flightBlockId,
          availableSeats: { gte: input.seats },
        },
        data: {
          consumedSeats: { increment: input.seats },
          availableSeats: { decrement: input.seats },
        },
      });
      if (updated.count !== 1) throw new Error('insufficient shared flight seats');
      const row = await tx.tciFlightBlockConsumption.create({
        data: {
          id: randomUUID(),
          companyId: input.companyId,
          flightBlockId: input.flightBlockId,
          program: json(input.program),
          consumedSeats: input.seats,
          sourceReference: json(input.flightSegmentReference),
        },
      });
      return {
        id: row.id,
        companyId: row.companyId as CompanyId,
        flightBlockId: row.flightBlockId,
        program: row.program as unknown as SourceReference,
        consumedSeats: amount(row.consumedSeats),
        consumedAt: iso(row.consumedAt),
        sourceReference: source(row.sourceReference),
      };
    });
  }

  async internalFirst(
    input: InternalFirstFulfillmentInput,
    key: string | undefined,
    hash: string,
  ): Promise<AllocationResult> {
    return this.command(input.companyId, key, hash, async (tx) => {
      const available = await this.resourceAvailable(
        tx,
        {
          companyId: input.companyId,
          contractId: '',
          resourceType: input.contractType,
          resourceId: input.resourceId,
          serviceDate: input.serviceDate,
          periodEnd: input.periodEnd,
        },
        false,
      );
      const take = Prisma.Decimal.min(
        new Prisma.Decimal(available),
        new Prisma.Decimal(input.requiredQuantity),
      );
      const result: AllocationResult = {};

      if (take.gt(0)) {
        const resourceContract = await this.resourceContract(
          tx,
          input.companyId,
          input.contractType,
          input.resourceId,
        );
        if (!resourceContract) throw new Error('internal resource not found');
        Object.assign(
          result,
          await this.allocateTx(tx, {
            ...input,
            contractId: resourceContract,
            resourceType: input.contractType,
            quantity: amount(take),
          }),
        );
      }

      const residual = new Prisma.Decimal(input.requiredQuantity).sub(take);
      if (residual.gt(0)) {
        const request: ProcurementRequest = {
          id: randomUUID(),
          companyId: input.companyId,
          program: input.program,
          residualQuantity: amount(residual),
          procurementType: input.contractType,
          externalReference: '',
          referenceData: input.referenceData,
          createdAt: new Date().toISOString(),
          sourceReference: input.sourceReference,
        };
        await tx.tciProcurementRequest.create({
          data: {
            id: request.id,
            companyId: input.companyId,
            program: json(input.program),
            residualQuantity: request.residualQuantity,
            procurementType: input.contractType,
            externalReference: null,
            referenceData: json(input.referenceData),
            sourceReference: input.sourceReference
              ? json(input.sourceReference)
              : Prisma.JsonNull,
          },
        });
        return { ...result, procurementRequest: request };
      }
      return result;
    });
  }

  async attachProcurementReference(
    companyId: CompanyId,
    requestId: string,
    externalReference: string,
  ): Promise<void> {
    const updated = await this.db.tciProcurementRequest.updateMany({
      where: { companyId, id: requestId },
      data: { externalReference },
    });
    if (updated.count !== 1) throw new Error('procurement evidence not found for company');
  }

  async allocation(companyId: CompanyId, allocationId: string): Promise<Allocation | null> {
    const row = await this.db.tciAllocation.findUnique({
      where: { companyId_id: { companyId, id: allocationId } },
    });
    return row ? allocation(row as AllocationRow) : null;
  }

  async registerEconomicEvidence(
    input: RegisterAllocationEconomicEvidenceInput,
    key: string | undefined,
    hash: string,
  ): Promise<AllocationEconomicEvidence> {
    return this.command(input.companyId, key, hash, async (tx) => {
      const allocationRow = await tx.tciAllocation.findUnique({
        where: {
          companyId_id: {
            companyId: input.companyId,
            id: input.allocationId,
          },
        },
      });
      if (!allocationRow) throw new Error('allocation not found for company');
      const evidenceKey = idempotencyHash(input.evidence);
      const old = await tx.tciAllocationEconomicEvidence.findUnique({
        where: {
          companyId_allocationId_evidenceKey: {
            companyId: input.companyId,
            allocationId: input.allocationId,
            evidenceKey,
          },
        },
      });
      if (old) {
        if (old.kind !== input.kind) throw new Error('conflicting economic evidence replay');
        return {
          id: old.id,
          companyId: old.companyId as CompanyId,
          allocationId: old.allocationId,
          kind: old.kind,
          evidence: old.evidence as unknown as SourceReference,
          createdAt: iso(old.createdAt),
        };
      }
      const row = await tx.tciAllocationEconomicEvidence.create({
        data: {
          id: randomUUID(),
          companyId: input.companyId,
          allocationId: input.allocationId,
          kind: input.kind,
          evidenceKey,
          evidence: json(input.evidence),
        },
      });
      return {
        id: row.id,
        companyId: row.companyId as CompanyId,
        allocationId: row.allocationId,
        kind: row.kind,
        evidence: row.evidence as unknown as SourceReference,
        createdAt: iso(row.createdAt),
      };
    });
  }

  async protectCoverage(
    input: ProtectAllocationCoverageInput,
    key: string | undefined,
    hash: string,
  ): Promise<AllocationCoverageRequirement> {
    return this.command(input.companyId, key, hash, async (tx) => {
      const allocationRow = await tx.tciAllocation.findUnique({
        where: {
          companyId_id: {
            companyId: input.companyId,
            id: input.allocationId,
          },
        },
      });
      if (!allocationRow) throw new Error('allocation not found for company');
      if (new Prisma.Decimal(input.minimumQuantity).gt(allocationRow.quantity)) {
        throw new Error('coverage minimum exceeds current allocation');
      }

      const requirementKey = idempotencyHash(input.requirementReference);
      const old = await tx.tciAllocationCoverageRequirement.findUnique({
        where: {
          companyId_allocationId_requirementKey: {
            companyId: input.companyId,
            allocationId: input.allocationId,
            requirementKey,
          },
        },
      });
      if (old) {
        if (!old.minimumQuantity.equals(input.minimumQuantity)) {
          throw new Error('conflicting coverage requirement replay');
        }
        const row = old.active
          ? old
          : await tx.tciAllocationCoverageRequirement.update({
              where: {
                companyId_allocationId_requirementKey: {
                  companyId: input.companyId,
                  allocationId: input.allocationId,
                  requirementKey,
                },
              },
              data: { active: true, releasedAt: null },
            });
        return this.coverage(row);
      }

      const row = await tx.tciAllocationCoverageRequirement.create({
        data: {
          id: randomUUID(),
          companyId: input.companyId,
          allocationId: input.allocationId,
          minimumQuantity: input.minimumQuantity,
          requirementKey,
          requirementReference: json(input.requirementReference),
          active: true,
        },
      });
      return this.coverage(row);
    });
  }

  async releaseCoverage(
    input: ReleaseAllocationCoverageInput,
    key: string | undefined,
    hash: string,
  ): Promise<AllocationCoverageRequirement> {
    return this.command(input.companyId, key, hash, async (tx) => {
      const requirementKey = idempotencyHash(input.requirementReference);
      const old = await tx.tciAllocationCoverageRequirement.findUnique({
        where: {
          companyId_allocationId_requirementKey: {
            companyId: input.companyId,
            allocationId: input.allocationId,
            requirementKey,
          },
        },
      });
      if (!old) throw new Error('coverage requirement not found for company');
      const row = old.active
        ? await tx.tciAllocationCoverageRequirement.update({
            where: {
              companyId_allocationId_requirementKey: {
                companyId: input.companyId,
                allocationId: input.allocationId,
                requirementKey,
              },
            },
            data: { active: false, releasedAt: new Date() },
          })
        : old;
      return this.coverage(row);
    });
  }

  async releaseBlockers(
    companyId: CompanyId,
    allocationId: string,
  ): Promise<ReleaseBlocker[]> {
    const row = await this.db.tciAllocation.findUnique({
      where: { companyId_id: { companyId, id: allocationId } },
    });
    if (!row) throw new Error('allocation not found for company');
    return this.releaseBlockersTx(this.db, row);
  }

  async idempotency(
    companyId: CompanyId,
    key: string,
  ): Promise<{ requestHash: string; result: Record<string, unknown> } | null> {
    const row = await this.db.tciIdempotencyKey.findUnique({
      where: { companyId_key: { companyId, key } },
    });
    return row
      ? {
          requestHash: row.requestHash,
          result: row.result as Record<string, unknown>,
        }
      : null;
  }

  private async releaseBlockersTx(
    db: Tx | PrismaClient,
    row: AllocationRow,
    proposedRemaining?: Prisma.Decimal,
  ): Promise<ReleaseBlocker[]> {
    const blockers: ReleaseBlocker[] = [];
    if (row.status === 'CONSUMED') {
      blockers.push({
        code: 'CONSUMED',
        message: 'allocation has already been consumed',
      });
    }
    if(row.resourceType==='SERVICE'){const service=await db.tciServiceInventory.findFirst({where:{companyId:row.companyId,id:row.resourceId}});if(service?.releaseDeadline&&service.releaseDeadline<new Date()){blockers.push({code:'RELEASE_DEADLINE',message:'contracted service release deadline has passed'})}}

    const evidence = await db.tciAllocationEconomicEvidence.findFirst({
      where: { companyId: row.companyId, allocationId: row.id },
      orderBy: { createdAt: 'asc' },
    });
    if (evidence) {
      blockers.push({
        code: 'FINANCIAL_HISTORY',
        message: `allocation has protected economic history: ${evidence.kind}`,
        evidence: evidence.evidence as unknown as SourceReference,
      });
    }

    const completedCost = await db.tciAllocationCostEffect.findFirst({
      where: {
        companyId: row.companyId,
        allocationId: row.id,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'asc' },
    });
    if (completedCost) {
      blockers.push({
        code: 'FINANCIAL_HISTORY',
        message: `allocation has completed cost effect ${completedCost.id}`,
      });
    }

    const coverageRows = await db.tciAllocationCoverageRequirement.findMany({
      where: {
        companyId: row.companyId,
        allocationId: row.id,
        active: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    for (const coverageRow of coverageRows) {
      if (
        proposedRemaining === undefined ||
        proposedRemaining.lt(coverageRow.minimumQuantity)
      ) {
        blockers.push({
          code: 'PROGRAM_COVERAGE',
          message: 'release would violate required active program coverage',
          evidence: coverageRow.requirementReference as unknown as SourceReference,
        });
      }
    }
    return blockers;
  }

  private async restore(
    tx: Tx,
    type: ContractType,
    id: string,
    companyId: CompanyId,
    quantity: DecimalAmount,
  ): Promise<void> {
    if (type === 'HOTEL') {
      await tx.tciHotelInventory.update({
        where: { companyId_id: { companyId, id } },
        data: {
          allocatedQuantity: { decrement: quantity },
          availableQuantity: { increment: quantity },
        },
      });
    } else if (type === 'FLIGHT_BLOCK') {
      await tx.tciFlightBlock.update({
        where: { companyId_id: { companyId, id } },
        data: {
          consumedSeats: { decrement: quantity },
          availableSeats: { increment: quantity },
        },
      });
    } else if (type === 'VISA') {
      await tx.tciVisaQuota.update({
        where: { companyId_id: { companyId, id } },
        data: {
          quotaConsumed: { decrement: quantity },
          quotaRemaining: { increment: quantity },
        },
      });
    } else if(type==='SERVICE'){
      await tx.tciServiceInventory.update({where:{companyId_id:{companyId,id}},data:{allocatedQuantity:{decrement:quantity},availableQuantity:{increment:quantity}}});
    }
    // Transport availability is derived from overlapping active allocations, so no scalar restore exists.
  }

  private async resourceAvailable(
    db: Tx | PrismaClient,
    input: CheckAvailabilityInput,
    matchContract = true,
  ): Promise<DecimalAmount> {
    const contractFilter = matchContract ? { contractId: input.contractId } : {};
    if (input.resourceType === 'HOTEL') {
      const row = await db.tciHotelInventory.findFirst({
        where: {
          companyId: input.companyId,
          id: input.resourceId,
          ...contractFilter,
          serviceDate: new Date(input.serviceDate),
          status: 'ACTIVE',
        },
      });
      return row ? amount(row.availableQuantity) : decimalAmount('0');
    }
    if (input.resourceType === 'FLIGHT_BLOCK') {
      const row = await db.tciFlightBlock.findFirst({
        where: {
          companyId: input.companyId,
          id: input.resourceId,
          ...contractFilter,
          departureDate: new Date(input.serviceDate),
        },
      });
      return row ? amount(row.availableSeats) : decimalAmount('0');
    }
    if (input.resourceType === 'VISA') {
      const row = await db.tciVisaQuota.findFirst({
        where: {
          companyId: input.companyId,
          id: input.resourceId,
          ...contractFilter,
          effectiveFrom: { lte: new Date(input.serviceDate) },
          effectiveTo: { gte: new Date(input.serviceDate) },
        },
      });
      return row ? amount(row.quotaRemaining) : decimalAmount('0');
    }
    if(input.resourceType==='SERVICE'){const row=await db.tciServiceInventory.findFirst({where:{companyId:input.companyId,id:input.resourceId,...contractFilter,serviceStart:{lte:new Date(input.serviceDate)},serviceEnd:{gte:new Date(input.periodEnd??input.serviceDate)},status:'ACTIVE'}});return row?amount(row.availableQuantity):decimalAmount('0');}

    const capacity = await db.tciTransportCapacity.findFirst({
      where: {
        companyId: input.companyId,
        id: input.resourceId,
        ...contractFilter,
      },
    });
    if (!capacity || !input.periodEnd) return decimalAmount('0');
    const used = await db.tciAllocation.aggregate({
      _sum: { quantity: true },
      where: {
        companyId: input.companyId,
        resourceType: 'TRANSPORT',
        resourceId: input.resourceId,
        status: { in: ['CONFIRMED', 'PARTIALLY_RELEASED', 'CONSUMED'] },
        serviceDate: { lt: new Date(input.periodEnd) },
        periodEnd: { gt: new Date(input.serviceDate) },
      },
    });
    return amount(
      Prisma.Decimal.max(
        new Prisma.Decimal(0),
        capacity.capacityUnits.sub(used._sum.quantity ?? 0),
      ),
    );
  }

  private async resourceContract(
    tx: Tx,
    companyId: CompanyId,
    type: ContractType,
    id: string,
  ): Promise<string | undefined> {
    if (type === 'HOTEL') {
      return (
        await tx.tciHotelInventory.findUnique({
          where: { companyId_id: { companyId, id } },
        })
      )?.contractId;
    }
    if (type === 'FLIGHT_BLOCK') {
      return (
        await tx.tciFlightBlock.findUnique({
          where: { companyId_id: { companyId, id } },
        })
      )?.contractId;
    }
    if (type === 'TRANSPORT') {
      return (
        await tx.tciTransportCapacity.findUnique({
          where: { companyId_id: { companyId, id } },
        })
      )?.contractId;
    }
    if (type === 'VISA') {
      return (
        await tx.tciVisaQuota.findUnique({
          where: { companyId_id: { companyId, id } },
        })
      )?.contractId;
    }
    if (type === 'SERVICE') {
      return (
        await tx.tciServiceInventory.findUnique({
          where: { companyId_id: { companyId, id } },
        })
      )?.contractId;
    }
    return undefined;
  }

  private async requireContract(
    tx: Tx,
    companyId: CompanyId,
    id: string,
    type?: ContractType,
  ): Promise<void> {
    const row = await tx.tciContract.findUnique({
      where: { companyId_id: { companyId, id } },
    });
    if (!row || (type && row.type !== type)) {
      throw new Error('matching contract not found for company');
    }
  }

  private async history(
    tx: Tx,
    companyId: CompanyId,
    contractId: string,
    kind: string,
    aggregateId: string,
  ) {
    return tx.tciContractHistory.create({
      data: {
        id: randomUUID(),
        companyId,
        contractId,
        kind,
        aggregateId,
        evidence: json({}),
      },
    });
  }

  private coverage(row: {
    id: string;
    companyId: string;
    allocationId: string;
    minimumQuantity: Prisma.Decimal;
    requirementReference: Prisma.JsonValue;
    active: boolean;
    createdAt: Date;
    releasedAt: Date | null;
  }): AllocationCoverageRequirement {
    return {
      id: row.id,
      companyId: row.companyId as CompanyId,
      allocationId: row.allocationId,
      minimumQuantity: amount(row.minimumQuantity),
      requirementReference: row.requirementReference as unknown as SourceReference,
      active: row.active,
      createdAt: iso(row.createdAt),
      releasedAt: row.releasedAt ? iso(row.releasedAt) : undefined,
    };
  }

  private async findVisaBatchAllocation(
    companyId: CompanyId,
    visaBatchKey: string,
  ): Promise<Allocation | null> {
    const row = await this.db.tciAllocation.findUnique({
      where: {
        companyId_visaBatchKey: {
          companyId,
          visaBatchKey,
        },
      },
    });
    return row ? allocation(row) : null;
  }

  private sameVisaAllocation(
    prior: Allocation,
    input: AllocateCapacityInput,
  ): boolean {
    return (
      prior.resourceType === 'VISA' &&
      prior.contractId === input.contractId &&
      prior.resourceId === input.resourceId &&
      prior.serviceDate === new Date(input.serviceDate).toISOString() &&
      prior.quantity === input.quantity &&
      sameSource(prior.program, input.program)
    );
  }
}
