import type { BillingConfig, QuoteSettings } from '../types/billing';

/** Read old frozen quote contexts without changing their currency, tax or validity. */
export const quoteSettingsFor = (config: BillingConfig): QuoteSettings => config.quoteSettings
  ?? (config as unknown as { invoicing: QuoteSettings }).invoicing;
