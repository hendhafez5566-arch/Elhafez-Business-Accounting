import { TourismContractInventoryPage as TourismContractInventoryWorkspace } from './tourism-contract-inventory-workspace.js';
import { TourismContractParityPanels } from './tourism-contract-parity-panels.js';

export function TourismContractInventoryPage(){
 return <section className="ui-dashboard" aria-label="التعاقدات والمخزون السياحي">
  <TourismContractInventoryWorkspace/>
  <TourismContractParityPanels/>
 </section>;
}
