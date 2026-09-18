import { CanadianProvince } from './taxAddress';

// Ordinary domestic freight rates; source: CRA GST/HST calculator and freight-carrier guidance.
export const DESTINATION_TAX_RATES_EFFECTIVE_FROM = '2025-04-01';
type DestinationTaxRate = { name: 'GST' | 'HST'; ratePercent: number };
export const DESTINATION_TAX_RATES: Readonly<Record<CanadianProvince, DestinationTaxRate | null>> = {
  AB: { name: 'GST', ratePercent: 5 },
  BC: { name: 'GST', ratePercent: 5 },
  MB: { name: 'GST', ratePercent: 5 },
  NB: { name: 'HST', ratePercent: 15 },
  NL: { name: 'HST', ratePercent: 15 },
  NS: { name: 'HST', ratePercent: 14 },
  NT: { name: 'GST', ratePercent: 5 },
  NU: { name: 'GST', ratePercent: 5 },
  ON: { name: 'HST', ratePercent: 13 },
  PE: { name: 'HST', ratePercent: 15 },
  QC: null, // GST/QST requires review; never silently fall back to GST alone.
  SK: { name: 'GST', ratePercent: 5 },
  YT: { name: 'GST', ratePercent: 5 },
};

export const isValidDestinationTaxRate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
