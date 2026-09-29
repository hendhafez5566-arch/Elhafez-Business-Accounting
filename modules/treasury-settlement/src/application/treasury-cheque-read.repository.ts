import type { Cheque } from '../domain/treasury.js';

export const TREASURY_CHEQUE_READ_REPOSITORY = Symbol('TREASURY_CHEQUE_READ_REPOSITORY');

export interface TreasuryChequeReadRepository {
  list(companyId: string): Promise<Cheque[]>;
}
