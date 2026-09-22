import type{TicketHistory,TicketRecord}from'../domain/ticket.js';
export interface TicketRepository{create(v:TicketRecord,h:TicketHistory):Promise<TicketRecord>;save(v:TicketRecord,h:TicketHistory):Promise<TicketRecord>;get(c:string,b:string,id:string):Promise<TicketRecord|null>;list(c:string,b:string,programId?:string):Promise<TicketRecord[]>;history(c:string,b:string,id:string):Promise<TicketHistory[]>;}
export const TICKET_REPOSITORY=Symbol('TICKET_REPOSITORY');
