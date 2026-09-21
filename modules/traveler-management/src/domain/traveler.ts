import { ContractValidationError, type CompanyId } from '@elhafez/contracts';

declare const travelerIdBrand: unique symbol;
export type TravelerId = string & { readonly [travelerIdBrand]: 'TravelerId' };
declare const travelDocumentIdBrand: unique symbol;
export type TravelDocumentId = string & { readonly [travelDocumentIdBrand]: 'TravelDocumentId' };

export type TravelerStatus = 'ACTIVE' | 'ARCHIVED';
export type TravelerGender = 'MALE' | 'FEMALE';

export interface Traveler {
  readonly id: TravelerId;
  readonly companyId: CompanyId;
  readonly fullName: string;
  readonly dateOfBirth: string | null;
  readonly gender: TravelerGender | null;
  readonly nationality: string | null;
  readonly partyId: string | null;
  readonly customerId: string | null;
  readonly status: TravelerStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TravelDocument {
  readonly id: TravelDocumentId;
  readonly companyId: CompanyId;
  readonly travelerId: TravelerId;
  readonly documentType: 'PASSPORT';
  readonly documentNumber: string;
  readonly issuingCountry: string | null;
  readonly issuingPlace: string | null;
  readonly holderNameSnapshot: string;
  readonly issueDate: string | null;
  readonly expiryDate: string | null;
  readonly isCurrent: boolean;
  readonly supersededByDocumentId: TravelDocumentId | null;
  readonly createdAt: string;
}

export interface CreateTravelerInput {
  readonly fullName: string;
  readonly dateOfBirth?: string;
  readonly gender?: TravelerGender;
  readonly nationality?: string;
  readonly partyId?: string;
  readonly customerId?: string;
}

export interface UpdateTravelerInput {
  readonly fullName?: string;
  readonly dateOfBirth?: string | null;
  readonly gender?: TravelerGender | null;
  readonly nationality?: string | null;
}

export interface CreateTravelDocumentInput {
  readonly documentType?: 'PASSPORT';
  readonly documentNumber: string;
  readonly issuingCountry?: string;
  readonly issuingPlace?: string;
  readonly issueDate?: string;
  readonly expiryDate?: string;
}

export const travelerId = (value: string): TravelerId => {
  const normalized = value.trim();
  if (!normalized) throw new ContractValidationError('travelerId', 'is required');
  return normalized as TravelerId;
};

export const travelDocumentId = (value: string): TravelDocumentId => {
  const normalized = value.trim();
  if (!normalized) throw new ContractValidationError('travelDocumentId', 'is required');
  return normalized as TravelDocumentId;
};

export const requiredText = (value: string, field: string): string => {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new ContractValidationError(field, 'is required');
  return normalized;
};

export const optionalText = (value: string | undefined | null): string | null => value?.trim() || null;

export const isoDate = (value: string | undefined | null, field: string): string | null => {
  if (!value?.trim()) return null;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new ContractValidationError(field, 'must be an ISO date (YYYY-MM-DD)');
  const date = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== normalized) throw new ContractValidationError(field, 'must be a valid calendar date');
  return normalized;
};

export const passportNumber = (value: string): string => {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '');
  if (!/^[A-Z0-9]{4,20}$/.test(normalized)) throw new ContractValidationError('documentNumber', 'must be 4-20 alphanumeric characters');
  return normalized;
};
