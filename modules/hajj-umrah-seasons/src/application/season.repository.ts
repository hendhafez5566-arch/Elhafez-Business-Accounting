import type{CompanyId}from'@elhafez/contracts';import type{Season,SeasonHistory}from'../domain/season.js';
export interface SeasonRepository{create(value:Season,history:SeasonHistory):Promise<Season>;save(value:Season,history:SeasonHistory):Promise<Season>;get(companyId:CompanyId,branchId:string,id:string):Promise<Season|null>;list(companyId:CompanyId,branchId:string,status?:Season['status']):Promise<Season[]>;}
export const SEASON_REPOSITORY=Symbol('SEASON_REPOSITORY');
