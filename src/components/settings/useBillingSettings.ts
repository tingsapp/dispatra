import { useState } from 'react';
import { loadBillingConfig, saveBillingConfig } from '../../lib/billingStorage';
import { DESTINATION_TAX_RATES, isValidDestinationTaxRate } from '../../lib/destinationTaxRates';
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
    if (Object.entries(config.destinationTaxRates).some(([province, rate]) => DESTINATION_TAX_RATES[province as keyof typeof DESTINATION_TAX_RATES] && !isValidDestinationTaxRate(rate))) {
      setSaveError('Enter a tax rate from 0 to 100% for each edited province in Taxes.');
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
