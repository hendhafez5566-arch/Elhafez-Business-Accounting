import type { RoomAssignment, RoomingHistory } from '../domain/rooming.js';

export interface RoomingRepository {
  createGuarded(value: RoomAssignment, history: RoomingHistory, capacity: number): Promise<RoomAssignment>;
  saveGuarded(value: RoomAssignment, history: RoomingHistory, capacity: number): Promise<RoomAssignment>;
  save(value: RoomAssignment, history: RoomingHistory): Promise<RoomAssignment>;
  swap(a: RoomAssignment, historyA: RoomingHistory, b: RoomAssignment, historyB: RoomingHistory): Promise<void>;
  get(companyId: string, branchId: string, id: string): Promise<RoomAssignment | null>;
  list(companyId: string, branchId: string, programId?: string): Promise<RoomAssignment[]>;
  history(companyId: string, branchId: string, assignmentId: string): Promise<RoomingHistory[]>;
}
export const ROOMING_REPOSITORY = Symbol('ROOMING_REPOSITORY');
