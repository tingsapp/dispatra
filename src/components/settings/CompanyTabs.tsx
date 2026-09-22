import { CompanyDetails } from './CompanyDetails';
import { RegionalSettings } from './RegionalSettings';
import { TaxSettings } from './TaxSettings';
import { BillingEditor } from './useBillingSettings';
import { Tabs } from '../ui/Tabs';

export function CompanyTabs({ editor }: { editor: BillingEditor }) {
  return <Tabs label="Company sections" keepMounted={false} items={[
    { id: 'general', label: 'General', content: <div className="app-sections"><CompanyDetails editor={editor} /><RegionalSettings editor={editor} /></div> },
    { id: 'taxes', label: 'Taxes', content: <TaxSettings editor={editor} /> },
  ]} />;
}
