import { CrmNewServiceLauncherPage } from './crm-service-launcher-page.js';
import { TourismServicesPage } from './tourism-services-page.js';

export function CrmAwareTourismServicesPage(){
 const customerPartyId=typeof window==='undefined'?'':new URLSearchParams(window.location.search).get('customerPartyId')?.trim()??'';
 return customerPartyId?<CrmNewServiceLauncherPage/>:<TourismServicesPage/>;
}
