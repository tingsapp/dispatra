import { BillingConfig } from '../../types/billing';
import { PricingConfig, RateCard } from '../../types/pricing';
import { SimplePricingConfig } from '../../types/simplePricing';
import { ZoneActions } from './RateCardZones';
export interface RateCardEditorProps {
  draft: RateCard; isNew: boolean; config: PricingConfig; catalogue: SimplePricingConfig; billing: BillingConfig;
  patchDraft: (changes: Partial<RateCard>) => void;
  zoneActions: ZoneActions;
}
