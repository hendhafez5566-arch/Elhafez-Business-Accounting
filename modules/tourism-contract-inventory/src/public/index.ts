/** The only importable boundary for tourism contract inventory capabilities. */
export { TourismContractInventoryModule } from './tourism-contract-inventory.module.js';
export { TourismContractInventoryApplicationServiceImpl } from './application/tourism-contract-inventory.application-service.impl.js';
export type {
  TourismContract, ContractVersion, HotelInventory, FlightBlock, FlightBlockConsumption,
  TransportCapacity, VisaQuota, StopSale, Allocation, AllocationRelease, ProcurementRequest,
  IdempotencyKey, ContractHistory, ContractType, ContractStatus, AllocationStatus, CapacitySourceType
} from './domain/inventory.js';
export type {
  CreateTourismContractInput, AmendContractInput, CreateHotelInventoryInput,
  CreateFlightBlockInput, CreateTransportCapacityInput, CreateVisaQuotaInput,
  CreateStopSaleInput, AllocateCapacityInput, ReleaseAllocationInput,
  AdjustAllocationInput, ConsumeFlightBlockInput, InternalFirstFulfillmentInput,
  CheckAvailabilityInput, AvailabilityResult, AllocationResult, ReleaseResult,
  IdempotencyCheckResult, TourismContractInventoryApplicationService
} from './application/inventory.application-service.js';
export type {
  TourismContractRepository, ContractVersionRepository, HotelInventoryRepository,
  FlightBlockRepository, FlightBlockConsumptionRepository, TransportCapacityRepository,
  VisaQuotaRepository, StopSaleRepository, AllocationRepository, AllocationReleaseRepository,
  ProcurementRequestRepository, IdempotencyKeyRepository, ContractHistoryRepository
} from './infrastructure/inventory.repository.js';
