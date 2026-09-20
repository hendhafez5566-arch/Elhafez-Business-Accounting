export {
  TourismContractInventoryModule,
  TOURISM_CONTRACT_INVENTORY_SERVICE,
} from '../tourism-contract-inventory.module.js';
export type {
  TourismContractInventoryApplicationService,
  CreateTourismContractInput,
  AmendContractInput,
  CreateHotelInventoryInput,
  CreateFlightBlockInput,
  CreateTransportCapacityInput,
  CreateVisaQuotaInput,
  CreateStopSaleInput,
  AllocateCapacityInput,
  ReleaseAllocationInput,
  AdjustAllocationInput,
  ConsumeFlightBlockInput,
  InternalFirstFulfillmentInput,
  CheckAvailabilityInput,
  RegisterAllocationEconomicEvidenceInput,
  ProtectAllocationCoverageInput,
  ReleaseAllocationCoverageInput,
  AvailabilityResult,
  AllocationResult,
  ReleaseResult,
} from '../application/inventory.application-service.js';
export type {
  TourismContract,
  ContractVersion,
  HotelInventory,
  FlightBlock,
  FlightBlockConsumption,
  TransportCapacity,
  VisaQuota,
  StopSale,
  Allocation,
  AllocationRelease,
  ProcurementRequest,
  AllocationEconomicEvidence,
  AllocationCoverageRequirement,
  ReleaseBlocker,
  ContractType,
  ContractStatus,
  AllocationStatus,
  ResourceType,
} from '../domain/inventory.js';

export { HistoricalImportApplicationService } from '../application/historical-import.application-service.js';
export type { HistoricalImportCommand, HistoricalImportResult, HistoricalEquivalence } from '../application/historical-import.application-service.js';
