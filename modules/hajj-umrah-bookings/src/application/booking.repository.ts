import type { Booking, BookingHistory } from '../domain/booking.js';

export interface BookingRepository {
  create(value: Booking, history: BookingHistory): Promise<Booking>;
  save(value: Booking, history: BookingHistory): Promise<Booking>;
  get(companyId: string, branchId: string, id: string): Promise<Booking | null>;
  list(companyId: string, branchId: string): Promise<Booking[]>;
  history(companyId: string, branchId: string, bookingId: string): Promise<BookingHistory[]>;
}
export const BOOKING_REPOSITORY = Symbol('BOOKING_REPOSITORY');
