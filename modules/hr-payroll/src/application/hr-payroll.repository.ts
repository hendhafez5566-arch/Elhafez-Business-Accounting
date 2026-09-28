import type{BranchId,CompanyId}from'@elhafez/contracts';import type{AttendanceRecord,Employee,LeaveRequest,PayComponent,PayrollLine,PayrollRun}from'../domain/hr-payroll.js';
export const HR_REPOSITORY=Symbol('HR_REPOSITORY');
export interface HrPayrollRepository{
 saveEmployee(v:Employee):Promise<Employee>;employee(companyId:CompanyId,branchId:BranchId,id:string):Promise<Employee|null>;listEmployees(companyId:CompanyId,branchId:BranchId):Promise<Employee[]>;
 saveAttendance(v:AttendanceRecord):Promise<AttendanceRecord>;attendance(companyId:CompanyId,branchId:BranchId,employeeId:string,from:string,to:string):Promise<AttendanceRecord[]>;
 saveLeave(v:LeaveRequest):Promise<LeaveRequest>;leave(companyId:CompanyId,branchId:BranchId,id:string):Promise<LeaveRequest|null>;listLeave(companyId:CompanyId,branchId:BranchId):Promise<LeaveRequest[]>;
 saveComponent(v:PayComponent):Promise<PayComponent>;components(companyId:CompanyId,branchId:BranchId,employeeId:string):Promise<PayComponent[]>;
 saveRun(v:PayrollRun,lines?:readonly PayrollLine[]):Promise<PayrollRun>;run(companyId:CompanyId,branchId:BranchId,id:string):Promise<PayrollRun|null>;runs(companyId:CompanyId,branchId:BranchId):Promise<PayrollRun[]>;lines(companyId:CompanyId,branchId:BranchId,runId:string):Promise<PayrollLine[]>;
}
