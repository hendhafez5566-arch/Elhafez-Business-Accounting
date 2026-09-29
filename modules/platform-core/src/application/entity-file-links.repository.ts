export interface EntityFileLinkRecord {
  readonly id:string;
  readonly companyId:string;
  readonly entityType:string;
  readonly entityId:string;
  readonly fileId:string;
  readonly label:string|null;
  readonly createdBy:string|null;
  readonly createdAt:Date;
}

export interface EntityFileLinksRepository {
  save(record:EntityFileLinkRecord):Promise<void>;
  list(companyId:string,entityType:string,entityId:string):Promise<EntityFileLinkRecord[]>;
  find(companyId:string,entityType:string,entityId:string,fileId:string):Promise<EntityFileLinkRecord|undefined>;
}

export const ENTITY_FILE_LINKS_REPOSITORY=Symbol('ENTITY_FILE_LINKS_REPOSITORY');
