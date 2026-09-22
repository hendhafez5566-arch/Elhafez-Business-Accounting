import type {RoomAssignment,RoomingHistory}from'../domain/rooming.js';
export interface RoomingRepository{
 create(v:RoomAssignment,h:RoomingHistory):Promise<RoomAssignment>;
 save(v:RoomAssignment,h:RoomingHistory):Promise<RoomAssignment>;
 swap(a:RoomAssignment,ha:RoomingHistory,b:RoomAssignment,hb:RoomingHistory):Promise<void>;
 get(companyId:string,branchId:string,id:string):Promise<RoomAssignment|null>;
 list(companyId:string,branchId:string,programId?:string):Promise<RoomAssignment[]>;
 history(companyId:string,branchId:string,assignmentId:string):Promise<RoomingHistory[]>;
 overlappingTraveler(companyId:string,branchId:string,travelerId:string,startDate:string,endDate:string,excludeId?:string):Promise<RoomAssignment|null>;
 activeAllocationCount(companyId:string,branchId:string,allocationId:string,startDate:string,endDate:string,excludeId?:string):Promise<number>;
}
export const ROOMING_REPOSITORY=Symbol('ROOMING_REPOSITORY');
