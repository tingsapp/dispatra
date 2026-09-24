import { useState } from 'react';
import { loadBillingConfig, saveBillingConfig } from '../../lib/billingStorage';
import { isValidFuelPercent, normalizeFuelSurcharge } from '../../lib/billingEngine';
import { isValidTaxRate } from '../../lib/taxRate';
import { BillingConfig } from '../../types/billing';
import { useSettingsGuard } from './useSettingsGuard';
export function useBillingSettings(onNotification?: (message: string) => void) {
  const [config, setConfig] = useState<BillingConfig>(() => loadBillingConfig());
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState(config);
  const dirty = JSON.stringify(config) !== JSON.stringify(baseline);
  useSettingsGuard(dirty);


  const patch = <K extends keyof BillingConfig>(key: K, value: Partial<BillingConfig[K]>) => {
    setConfig((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...value } }));
    setIsSaved(false);
    setSaveError(null);
  };

  const handleSave = () => {
    if (config.companyTax.enabled && !isValidTaxRate(config.companyTax.ratePercent)) {
      setSaveError('Enter a GST/HST rate from 0 to 100%.');
      return;
    }
    if (config.companyTax.provincialEnabled && !isValidTaxRate(config.companyTax.provincialRatePercent)) {
      setSaveError('Enter a provincial tax rate from 0 to 100%.');
      return;
    }
    if (!isValidFuelPercent(config.fuelSurcharge.percent)) {
      setSaveError('Enter a fuel surcharge of 0% or more in Fuel Surcharge.');
      return;
    }
    setSaveError(null);
    // Merge only edited top-level fields, preserving defaults saved elsewhere.
    const latest = loadBillingConfig();
    const next = { ...latest };
    for (const key of Object.keys(config) as (keyof BillingConfig)[]) {
      if (JSON.stringify(config[key]) === JSON.stringify(baseline[key])) continue;
      if (Array.isArray(config[key])) { Object.assign(next, { [key]: config[key] }); continue; }
      const changed = Object.fromEntries(Object.entries(config[key]).filter(([field, value]) => JSON.stringify(value) !== JSON.stringify((baseline[key] as unknown as Record<string, unknown>)[field])));
      Object.assign(next, { [key]: { ...latest[key], ...changed } });
    }
    if (config.fuelSurcharge.percent !== baseline.fuelSurcharge.percent) {
      next.fuelSurcharge = { ...next.fuelSurcharge, mode: 'fixed_percent', enabled: next.fuelSurcharge.percent > 0 };
    }
    next.fuelSurcharge = normalizeFuelSurcharge(next.fuelSurcharge);
    saveBillingConfig(next);
    setConfig(next);
    setBaseline(next);
    setIsSaved(true);
    onNotification?.('Settings saved.');
    setTimeout(() => setIsSaved(false), 2500);
  };



  return { config, patch, dirty, isSaved, saveError, handleSave };
}
export type BillingEditor = ReturnType<typeof useBillingSettings>;
