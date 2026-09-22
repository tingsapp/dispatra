import type { PricingMethod } from '../types/pricing';

/** Only Zone and legacy Imported cards expose dimensional pricing in V1. */
export const hasDimensionalWeightSetting = (method: PricingMethod): boolean => method === 'ZONE' || method === 'IMPORTED';
