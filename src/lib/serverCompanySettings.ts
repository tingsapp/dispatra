import type { components } from '../portal/schema';
import type { BillingConfig } from '../types/billing';
import { companySlugForPath } from './pageRoutes';
export type CompanySettings = components['schemas']['SettingsData-Output'];
const snapshots = new Map<string, CompanySettings>();
export function setServerCompanySettings(slug: string, data: CompanySettings | null) {
  if (data) snapshots.set(slug, data); else snapshots.delete(slug);
}
export function companyAddress(data: CompanySettings) {
  return typeof data.address === 'string' ? data.address : data.address?.text ?? '';
}
/** Transitional read-through: the in-memory server snapshot takes precedence over local preview values. */
export function companySettingsBilling(data: CompanySettings, base: BillingConfig): BillingConfig {
  return { ...base,
    company: { name: data.company_name, address: companyAddress(data), email: data.email, phone: data.phone, logoDataUrl: data.logo_url },
    companyTax: { enabled: data.gst_enabled, ratePercent: Number(data.gst_percent), provincialEnabled: data.provincial_enabled, provincialRatePercent: Number(data.provincial_percent) },
    general: { ...base.general, timeZone: data.time_zone, distanceUnit: data.distance_unit, weightUnit: data.weight_unit, dimensionUnit: data.dimension_unit },
    quoteSettings: { ...base.quoteSettings, currency: data.currency, taxRegistrationNumber: data.tax_registration_number, quoteValidityDays: data.quote_validity_days },
    fuelSurcharge: { ...base.fuelSurcharge, enabled: data.fuel_enabled, percent: Number(data.fuel_percent) },
    dispatch: { ...base.dispatch, maxActiveOrdersPerDriver: data.maximum_active_orders },
  };
}
export function withServerCompanySettings(base: BillingConfig): BillingConfig {
  const slug = companySlugForPath(typeof location === 'undefined' ? '' : location.pathname);
  const data = slug ? snapshots.get(slug) : undefined;
  return data ? companySettingsBilling(data, base) : base;
}
