import type { PricingMethod, RateCard } from '../types/pricing';

// Imported pricing is managed automatically by the External TMS preference.
export const SETTINGS_PRICING_METHODS: readonly PricingMethod[] = [
  'BASE_PLUS_DISTANCE', 'FIXED', 'ZONE', 'HOURLY'
];

export const isSettingsRateCard = (card: RateCard): boolean =>
  card.status === 'ACTIVE' && SETTINGS_PRICING_METHODS.includes(card.pricingMethod);
