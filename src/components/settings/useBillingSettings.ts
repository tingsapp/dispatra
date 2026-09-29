import { useContext, useEffect, useState } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { useWorkspaceAccount, companySettingsKey } from '../../portal/WorkspaceAccount';
import { api } from '../../portal/api';
import { companySettingsBilling } from '../../lib/serverCompanySettings';
import { loadBillingConfig, saveBillingConfig } from '../../lib/billingStorage';
import { isValidFuelPercent, normalizeFuelSurcharge } from '../../lib/billingEngine';
import { isValidTaxRate } from '../../lib/taxRate';
import { BillingConfig } from '../../types/billing';
import { useSettingsGuard } from './useSettingsGuard';
export function useBillingSettings(onNotification?: (message: string) => void) {
  const workspace = useWorkspaceAccount();
  const queryClient = useContext(QueryClientContext);
  const [config, setConfig] = useState<BillingConfig>(() => workspace ? companySettingsBilling(workspace.settings.data, loadBillingConfig()) : loadBillingConfig());
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState(config);
  useEffect(() => { if (workspace && JSON.stringify(config) === JSON.stringify(baseline)) { const server = companySettingsBilling(workspace.settings.data, loadBillingConfig()); setConfig(server); setBaseline(server); } }, [workspace?.settings.version]);
  const dirty = JSON.stringify(config) !== JSON.stringify(baseline);
  useSettingsGuard(dirty);


  const patch = <K extends keyof BillingConfig>(key: K, value: Partial<BillingConfig[K]>) => {
    setConfig((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...value } }));
    setIsSaved(false);
    setSaveError(null);
  };

  const handleSave = async () => {
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
    if (workspace) {
      try {
        if (!queryClient) throw new Error('Workspace query context is unavailable.');
        const slug = workspace.account.organization!.slug;
        const data = { ...workspace.settings.data,
          fuel_percent: String(config.fuelSurcharge.percent), fuel_enabled: config.fuelSurcharge.percent > 0 };
        const saved = await api.saveCompanySettings(slug, { version: workspace.settings.version, data }, crypto.randomUUID());
        queryClient.setQueryData(companySettingsKey(slug), saved);
        await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'settings'] });
        const next = companySettingsBilling(saved.data, loadBillingConfig());
        setConfig(next); setBaseline(next); setIsSaved(true); onNotification?.('Settings saved.');
      } catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save settings.'); }
      return;
    }
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
