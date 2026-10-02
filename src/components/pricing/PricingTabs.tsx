import { Tabs, type TabItem } from '../ui/Tabs';

export function PricingTabs({ tabs }: { tabs: TabItem[] }) {
  return <Tabs label="Settings sections" items={tabs} />;
}
