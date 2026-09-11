import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Receipt,
  RotateCcw,
  Check,
  Percent,
  Fuel,
  Coins,
  Landmark,
  Plus,
  Trash2,
  TrendingUp,
  AlertTriangle,
  Calculator,
  SlidersHorizontal,
  ArrowRight
} from 'lucide-react';
import { BillingConfig, TaxRate, ChargeGroup, TaxProfileConfig } from '../types/billing';
import { loadBillingConfig, saveBillingConfig, resetBillingConfig } from '../lib/billingStorage';
import { resolveFuelPercent } from '../lib/billingEngine';
import { calculatePricing } from '../lib/pricingEngine';
import { loadSimplePricingConfig } from '../lib/simplePricingStorage';
import { loadPricingConfig } from '../lib/pricingStorage';
import { loadCustomers } from '../lib/customerStorage';
import { PricingOrderInput } from '../types/pricing';
import { Select } from '../components/ui/Select';

interface BillingSettingsPageProps {
  onBackToMonitor: () => void;
  onOpenSimulator?: () => void;
  onNotification?: (msg: string) => void;
}

type TabId = 'general' | 'taxes' | 'charges' | 'costs';

const CHARGE_GROUPS: { value: ChargeGroup; label: string }[] = [
  { value: 'transport', label: 'Transport' },
  { value: 'accessorials', label: 'Accessorials' },
  { value: 'service_charge', label: 'Service Fee' },
  { value: 'fuel_surcharge', label: 'Fuel Surcharge' }
];

const fieldClass =
  'w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400';
const labelClass = 'block text-xs font-medium text-slate-700 mb-1.5';
const hintClass = 'text-[11px] text-slate-500 mt-1';
const cardClass = 'bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs';
const checkboxClass =
  'w-4 h-4 rounded border-slate-300 accent-slate-900 focus:ring-2 focus:ring-slate-900/20 cursor-pointer';

/** Small labelled numeric field with an optional prefix/suffix adornment. */
const NumberField: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  hint?: string;
}> = ({ label, value, onChange, prefix, suffix, step = 0.01, hint }) => (
  <div>
    <label className={labelClass}>{label}</label>
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="number"
        step={step}
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={`${fieldClass} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-10' : ''}`}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
    {hint && <p className={hintClass}>{hint}</p>}
  </div>
);

export const BillingSettingsPage: React.FC<BillingSettingsPageProps> = ({
  onBackToMonitor,
  onOpenSimulator,
  onNotification
}) => {
  const [config, setConfig] = useState<BillingConfig>(() => loadBillingConfig());
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [isSaved, setIsSaved] = useState(false);

  const catalogue = useMemo(() => loadSimplePricingConfig(), []);
  const pricing = useMemo(() => loadPricingConfig(), []);
  const customers = useMemo(() => loadCustomers(), []);
  const vehicles = catalogue.vehicles;
  const [activeTaxProfileId, setActiveTaxProfileId] = useState<string>(
    () => loadBillingConfig().invoicing.defaultTaxProfileId
  );

  const patch = <K extends keyof BillingConfig>(key: K, value: Partial<BillingConfig[K]>) => {
    setConfig((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...value } }));
    setIsSaved(false);
  };

  const handleSave = () => {
    saveBillingConfig(config);
    setIsSaved(true);
    onNotification?.('Saved billing, tax, and operating cost settings.');
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleReset = () => {
    const defaults = resetBillingConfig();
    setConfig(defaults);
    setActiveTaxProfileId(defaults.invoicing.defaultTaxProfileId);
    setIsSaved(false);
    onNotification?.('Reset billing settings to defaults.');
  };

  // Worked example through the shared engine so every change shows its effect immediately.
  const preview = useMemo(() => {
    const service = catalogue.services.find((s) => s.active) ?? catalogue.services[0];
    const order: PricingOrderInput = {
      customerId: null,
      serviceId: service?.id ?? '',
      vehicleId: 'veh_2_ton',
      stops: [
        { id: 'p', type: 'PICKUP', zoneId: null, residential: false, waitMinutes: 0 },
        { id: 'd', type: 'DROPOFF', zoneId: null, residential: false, waitMinutes: 25 }
      ],
      routeKm: 25,
      estimatedMinutes: 45,
      actualMinutes: null,
      packages: [{ id: 'pk', quantity: 2, weightKg: 30, lengthCm: 60, widthCm: 50, heightCm: 50, declaredValue: 0 }],
      accessorials: [{ accessorialId: 'acc_stairs', quantity: 2 }],
      scheduledAt: null,
      source: 'DISPATCHER',
      importedPrice: null,
      externalSource: null,
      externalReference: null,
      adjustments: [],
      rateCardOverrideId: null,
      stage: 'ESTIMATE'
    };
    return calculatePricing(order, { billing: config, catalogue, pricing, customers });
  }, [config, catalogue, pricing, customers]);

  const activeProfile: TaxProfileConfig | undefined =
    config.taxProfiles.find((p) => p.id === activeTaxProfileId) ?? config.taxProfiles[0];

  const patchProfile = (id: string, changes: Partial<TaxProfileConfig>) => {
    setConfig((prev) => ({
      ...prev,
      taxProfiles: prev.taxProfiles.map((p) => (p.id === id ? { ...p, ...changes } : p))
    }));
    setIsSaved(false);
  };

  const updateTax = (id: string, changes: Partial<TaxRate>) => {
    if (!activeProfile) return;
    patchProfile(activeProfile.id, {
      taxes: activeProfile.taxes.map((t) => (t.id === id ? { ...t, ...changes } : t))
    });
  };

  const addTax = () => {
    if (!activeProfile) return;
    patchProfile(activeProfile.id, {
      taxes: [
        ...activeProfile.taxes,
        {
          id: `tax_${Date.now()}`,
          name: 'New Tax',
          ratePercent: 0,
          appliesTo: ['transport', 'accessorials'],
          active: false
        }
      ]
    });
  };

  const removeTax = (id: string) => {
    if (!activeProfile) return;
    patchProfile(activeProfile.id, { taxes: activeProfile.taxes.filter((t) => t.id !== id) });
  };

  const toggleTaxGroup = (tax: TaxRate, group: ChargeGroup) => {
    const next = tax.appliesTo.includes(group)
      ? tax.appliesTo.filter((g) => g !== group)
      : [...tax.appliesTo, group];
    updateTax(tax.id, { appliesTo: next });
  };

  const addProfile = () => {
    const id = `taxp_${Date.now()}`;
    setConfig((prev) => ({
      ...prev,
      taxProfiles: [...prev.taxProfiles, { id, name: 'New Tax Profile', description: '', taxes: [] }]
    }));
    setActiveTaxProfileId(id);
    setIsSaved(false);
  };

  const removeProfile = (id: string) => {
    if (config.taxProfiles.length <= 1) {
      onNotification?.('At least one tax profile is required.');
      return;
    }
    const remaining = config.taxProfiles.filter((p) => p.id !== id);
    setConfig((prev) => ({
      ...prev,
      taxProfiles: remaining,
      invoicing: {
        ...prev.invoicing,
        defaultTaxProfileId:
          prev.invoicing.defaultTaxProfileId === id ? remaining[0].id : prev.invoicing.defaultTaxProfileId
      }
    }));
    setActiveTaxProfileId(remaining[0].id);
    setIsSaved(false);
  };

  const tabs: { id: TabId; label: string; icon: typeof Percent }[] = [
    { id: 'general', label: 'General', icon: SlidersHorizontal },
    { id: 'taxes', label: 'Taxes & Invoicing', icon: Landmark },
    { id: 'charges', label: 'Company & Fuel Charges', icon: Percent },
    { id: 'costs', label: 'Operating Cost & Margin', icon: Coins }
  ];

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden font-sans">
      {/* HEADER BAR */}
      <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackToMonitor}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            title="Return to Monitor Map"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Back to Monitor</span>
          </button>

          <div className="h-4 w-px bg-slate-200" />

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">
                Billing, Tax & Cost
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight">
                Organization-wide charges applied to every quote, plus the cost basis used for margin.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onOpenSimulator && (
            <button
              type="button"
              onClick={onOpenSimulator}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <Calculator className="w-3.5 h-3.5 text-slate-500" />
              <span>Open Pricing Simulator</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-white transition-colors shadow-2xs ${
              isSaved ? 'bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Settings Saved</span>
              </>
            ) : (
              <span>Save Settings</span>
            )}
          </button>
        </div>
      </header>

      {/* SUB-NAVIGATION TABS */}
      <div className="h-12 bg-white border-b border-slate-200/90 px-6 flex items-center gap-2 shrink-0 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <div className="space-y-6">
            {/* ---------- GENERAL (ORGANIZATION DEFAULTS) ---------- */}
            {activeTab === 'general' && (
              <>
                <div className="rounded-xl border border-blue-200/70 bg-blue-50/60 px-4 py-3 flex items-start gap-3">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-slate-700">
                    <div className="font-semibold text-slate-900">These are organization defaults</div>
                    <p className="mt-0.5 text-slate-600">
                      They apply everywhere unless a Rate Card overrides them for its own customers.
                    </p>
                    <div className="mt-2 inline-flex items-center gap-2 text-[11px] font-medium">
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                        Organization default
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white">Rate Card override</span>
                    </div>
                  </div>
                </div>

                <div className={cardClass}>
                  <h2 className="text-sm font-semibold text-slate-900">Currency & Units</h2>
                  <p className="text-xs text-slate-500 mt-0.5 mb-4">
                    How distance, weight, and dimensions are captured and displayed across the organization.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Currency</label>
                      <Select
                        aria-label="Currency"
                        className="w-full"
                        value={config.invoicing.currency}
                        onValueChange={(v) => patch('invoicing', { currency: v as 'CAD' | 'USD' })}
                        options={[
                          { value: 'CAD', label: 'CAD — Canadian Dollar' },
                          { value: 'USD', label: 'USD — US Dollar' }
                        ]}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Distance Unit</label>
                      <Select
                        aria-label="Distance unit"
                        className="w-full"
                        value={config.general.distanceUnit}
                        onValueChange={(v) => patch('general', { distanceUnit: v as 'km' | 'mi' })}
                        options={[
                          { value: 'km', label: 'km — Kilometres' },
                          { value: 'mi', label: 'mi — Miles' }
                        ]}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Weight Unit</label>
                      <Select
                        aria-label="Weight unit"
                        className="w-full"
                        value={config.general.weightUnit}
                        onValueChange={(v) => patch('general', { weightUnit: v as 'kg' | 'lb' })}
                        options={[
                          { value: 'kg', label: 'kg — Kilograms' },
                          { value: 'lb', label: 'lb — Pounds' }
                        ]}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Dimension Unit</label>
                      <Select
                        aria-label="Dimension unit"
                        className="w-full"
                        value={config.general.dimensionUnit}
                        onValueChange={(v) => patch('general', { dimensionUnit: v as 'cm' | 'in' })}
                        options={[
                          { value: 'cm', label: 'cm — Centimetres' },
                          { value: 'in', label: 'in — Inches' }
                        ]}
                      />
                    </div>
                  </div>
                </div>

                <div className={cardClass}>
                  <h2 className="text-sm font-semibold text-slate-900">Pricing Defaults</h2>
                  <p className="text-xs text-slate-500 mt-0.5 mb-4">
                    Fallback values a Rate Card inherits when it does not set its own.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <NumberField
                      label="Default Fuel Surcharge"
                      value={config.fuelSurcharge.percent}
                      onChange={(v) => patch('fuelSurcharge', { percent: v })}
                      suffix="%"
                      step={0.1}
                      hint="Basis, taxability, and fuel-index pegging are set under Company & Fuel Charges."
                    />
                    <div>
                      <NumberField
                        label="Dimensional Divisor"
                        value={config.general.dimensionalDivisor}
                        onChange={(v) => patch('general', { dimensionalDivisor: v })}
                        suffix={`${config.general.dimensionUnit}³/${config.general.weightUnit}`}
                        step={1}
                        hint="L × W × H ÷ divisor = dimensional weight. 5000 is the courier standard."
                      />
                      <label className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.general.dimensionalPricingEnabled}
                          onChange={(e) => patch('general', { dimensionalPricingEnabled: e.target.checked })}
                          className={checkboxClass}
                        />
                        Charge on the greater of actual or dimensional weight
                      </label>
                    </div>
                    <NumberField
                      label="Included Stops"
                      value={config.general.defaultIncludedStops}
                      onChange={(v) => patch('general', { defaultIncludedStops: v })}
                      suffix="stops"
                      step={1}
                      hint="Typically 2 — one pickup and one drop-off."
                    />
                    <NumberField
                      label="Extra Stop Rate"
                      value={config.general.defaultExtraStopRate}
                      onChange={(v) => patch('general', { defaultExtraStopRate: v })}
                      prefix="$"
                      hint="Per stop beyond the included count. Rate Cards can override."
                    />
                    <NumberField
                      label="Default Wait-Free Allowance"
                      value={config.general.defaultWaitFreeMinutes}
                      onChange={(v) => patch('general', { defaultWaitFreeMinutes: v })}
                      suffix="min"
                      step={1}
                      hint="Waiting included in every stop before wait-time charges start."
                    />
                    <NumberField
                      label="Default Wait Increment"
                      value={config.general.defaultWaitIncrementMinutes}
                      onChange={(v) => patch('general', { defaultWaitIncrementMinutes: v })}
                      suffix="min"
                      step={1}
                      hint="Wait time beyond the allowance is billed in blocks of this size."
                    />
                    <div>
                      <label className={labelClass}>Rounding</label>
                      <Select
                        aria-label="Money rounding"
                        className="w-full"
                        value={config.rules.moneyRounding}
                        onValueChange={(v) => patch('rules', { moneyRounding: v as any })}
                        options={[
                          { value: 'none', label: 'Nearest cent' },
                          { value: 'nearest_05', label: 'Nearest $0.05' },
                          { value: 'nearest_25', label: 'Nearest $0.25' },
                          { value: 'nearest_1', label: 'Nearest $1.00' }
                        ]}
                      />
                      <p className={hintClass}>Applied to the final quote total.</p>
                    </div>
                  </div>
                </div>

                <div className={cardClass}>
                  <h2 className="text-sm font-semibold text-slate-900">Minimums & Distance Rounding</h2>
                  <p className="text-xs text-slate-500 mt-0.5 mb-4">
                    Floors stop short jobs being priced below what they cost to serve.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <NumberField
                      label="Minimum Charge per Job"
                      value={config.rules.minimumChargePerJob}
                      onChange={(v) => patch('rules', { minimumChargePerJob: v })}
                      prefix="$"
                      hint="Quotes below this are raised to the floor."
                    />
                    <NumberField
                      label="Minimum Billable Distance"
                      value={config.rules.minimumBillableKm}
                      onChange={(v) => patch('rules', { minimumBillableKm: v })}
                      suffix={config.general.distanceUnit}
                      step={0.5}
                    />
                    <div>
                      <label className={labelClass}>Distance Rounding</label>
                      <Select
                        aria-label="Distance rounding"
                        className="w-full"
                        value={String(config.rules.distanceRoundingKm)}
                        onValueChange={(v) => patch('rules', { distanceRoundingKm: Number(v) })}
                        options={[
                          { value: '0', label: 'No rounding' },
                          { value: '0.1', label: 'Up to nearest 0.1 km' },
                          { value: '0.5', label: 'Up to nearest 0.5 km' },
                          { value: '1', label: 'Up to nearest 1 km' }
                        ]}
                      />
                    </div>
                  </div>
                </div>

                <div className={cardClass}>
                  <h2 className="text-sm font-semibold text-slate-900">Dispatch</h2>
                  <p className="text-xs text-slate-500 mt-0.5 mb-4">
                    Assignment policy. Applies to new eligible assignments only and never changes the customer price.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <NumberField
                      label="Maximum Active Orders per Driver"
                      value={config.dispatch.maxActiveOrdersPerDriver}
                      onChange={(v) => patch('dispatch', { maxActiveOrdersPerDriver: Math.max(1, Math.round(v)) })}
                      suffix="orders"
                      step={1}
                      hint="Drivers at this count are ineligible for further AUTO assignment. The Auto/Manual mode switch lives in the sidebar."
                    />
                  </div>
                </div>
              </>
            )}

            {/* ---------- TAXES & INVOICING ---------- */}
            {activeTab === 'taxes' && (
              <>
                <div className={cardClass}>
                  <h2 className="text-sm font-semibold text-slate-900">Invoicing Basics</h2>
                  <p className="text-xs text-slate-500 mt-0.5 mb-4">
                    Tax registration and the default terms applied to new quotes.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Tax Registration Number</label>
                      <input
                        type="text"
                        value={config.invoicing.taxRegistrationNumber}
                        onChange={(e) => patch('invoicing', { taxRegistrationNumber: e.target.value })}
                        placeholder="e.g. 12345 6789 RT0001"
                        className={fieldClass}
                      />
                      <p className={hintClass}>Printed on every invoice. Required to charge GST/HST.</p>
                    </div>

                    <div>
                      <label className={labelClass}>Default Payment Terms</label>
                      <Select
                        aria-label="Default payment terms"
                        className="w-full"
                        value={config.invoicing.defaultPaymentTerms}
                        onValueChange={(v) => patch('invoicing', { defaultPaymentTerms: v as any })}
                        options={[
                          { value: 'COD', label: 'COD — Due on delivery' },
                          { value: 'NET15', label: 'Net 15 days' },
                          { value: 'NET30', label: 'Net 30 days' },
                          { value: 'NET45', label: 'Net 45 days' }
                        ]}
                      />
                    </div>

                    <NumberField
                      label="Quote Validity"
                      value={config.invoicing.quoteValidityDays}
                      onChange={(v) => patch('invoicing', { quoteValidityDays: v })}
                      suffix="days"
                      step={1}
                      hint="How long a generated quote stays honourable."
                    />

                    <NumberField
                      label="Late Payment Fee"
                      value={config.invoicing.latePaymentFeePercent}
                      onChange={(v) => patch('invoicing', { latePaymentFeePercent: v })}
                      suffix="% / mo"
                      step={0.1}
                    />

                    <div className="sm:col-span-2 flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <input
                        type="checkbox"
                        id="prices-include-tax"
                        checked={config.invoicing.pricesIncludeTax}
                        onChange={(e) => patch('invoicing', { pricesIncludeTax: e.target.checked })}
                        className={`mt-0.5 ${checkboxClass}`}
                      />
                      <label htmlFor="prices-include-tax" className="cursor-pointer">
                        <span className="block text-xs font-medium text-slate-800">
                          Quoted prices already include tax
                        </span>
                        <span className={hintClass}>
                          When on, tax is back-calculated out of the price rather than added on top.
                          Leave off for B2B freight, where prices are quoted before tax.
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className={cardClass}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">Tax Profiles</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        A profile bundles the rates for one jurisdiction. The organization default applies
                        unless a customer selects another profile or is tax exempt.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addProfile}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Profile</span>
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {config.taxProfiles.map((profile) => {
                      const selected = activeProfile?.id === profile.id;
                      const isDefault = config.invoicing.defaultTaxProfileId === profile.id;
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => setActiveTaxProfileId(profile.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                            selected
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          <span>{profile.name}</span>
                          {isDefault && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                selected ? 'bg-white/15 text-white' : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              default
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {activeProfile && (
                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto] gap-3 items-end">
                        <div>
                          <label className={labelClass}>Profile Name</label>
                          <input
                            type="text"
                            value={activeProfile.name}
                            onChange={(e) => patchProfile(activeProfile.id, { name: e.target.value })}
                            className={fieldClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Description</label>
                          <input
                            type="text"
                            value={activeProfile.description}
                            onChange={(e) => patchProfile(activeProfile.id, { description: e.target.value })}
                            className={fieldClass}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={config.invoicing.defaultTaxProfileId === activeProfile.id}
                            onClick={() => patch('invoicing', { defaultTaxProfileId: activeProfile.id })}
                            className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-default whitespace-nowrap"
                          >
                            Set as default
                          </button>
                          <button
                            type="button"
                            onClick={() => removeProfile(activeProfile.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Remove profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                        <p className="text-xs text-slate-500">
                          Rates stack. Each applies only to the charge groups you tick, so a freight-exempt
                          provincial tax can skip the transport line.
                        </p>
                        <button
                          type="button"
                          onClick={addTax}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-2xs shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Tax</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 space-y-3">
                    {(activeProfile?.taxes ?? []).map((tax) => (
                      <div
                        key={tax.id}
                        className={`rounded-lg border p-4 transition-colors ${
                          tax.active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50/60'
                        }`}
                      >
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex items-center gap-2.5 pb-2">
                            <input
                              type="checkbox"
                              checked={tax.active}
                              onChange={(e) => updateTax(tax.id, { active: e.target.checked })}
                              className={checkboxClass}
                              aria-label={`Enable ${tax.name}`}
                            />
                          </div>

                          <div className="flex-1 min-w-[140px]">
                            <label className={labelClass}>Tax Name</label>
                            <input
                              type="text"
                              value={tax.name}
                              onChange={(e) => updateTax(tax.id, { name: e.target.value })}
                              className={fieldClass}
                            />
                          </div>

                          <div className="w-28">
                            <label className={labelClass}>Rate</label>
                            <div className="relative">
                              <input
                                type="number"
                                step={0.1}
                                min={0}
                                value={tax.ratePercent}
                                onChange={(e) =>
                                  updateTax(tax.id, { ratePercent: Number(e.target.value) || 0 })
                                }
                                className={`${fieldClass} pr-7`}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                                %
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeTax(tax.id)}
                            className="p-2 mb-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title={`Remove ${tax.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="mt-3">
                          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                            Applies to
                          </span>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {CHARGE_GROUPS.map((group) => {
                              const on = tax.appliesTo.includes(group.value);
                              return (
                                <button
                                  key={group.value}
                                  type="button"
                                  onClick={() => toggleTaxGroup(tax, group.value)}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                                    on
                                      ? 'bg-slate-900 text-white border-slate-900'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                  }`}
                                >
                                  {group.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {tax.note && <p className={hintClass}>{tax.note}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ---------- COMPANY & FUEL CHARGES ---------- */}
            {activeTab === 'charges' && (
              <>
                <div className={cardClass}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">Company Service Charge</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        A dispatch/admin fee added to every job on top of the service price.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 shrink-0">
                      <input
                        type="checkbox"
                        checked={config.serviceCharge.enabled}
                        onChange={(e) => patch('serviceCharge', { enabled: e.target.checked })}
                        className={checkboxClass}
                      />
                      Enabled
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className={labelClass}>Label Shown to Customer</label>
                      <input
                        type="text"
                        value={config.serviceCharge.label}
                        onChange={(e) => patch('serviceCharge', { label: e.target.value })}
                        className={fieldClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Charge Method</label>
                      <Select
                        aria-label="Service charge method"
                        className="w-full"
                        value={config.serviceCharge.mode}
                        onValueChange={(v) => patch('serviceCharge', { mode: v as any })}
                        options={[
                          { value: 'percentage', label: 'Percentage of basis' },
                          { value: 'flat', label: 'Flat amount per job' },
                          { value: 'greater_of', label: 'Greater of percentage or flat' }
                        ]}
                      />
                    </div>

                    <NumberField
                      label="Percentage"
                      value={config.serviceCharge.percent}
                      onChange={(v) => patch('serviceCharge', { percent: v })}
                      suffix="%"
                      step={0.1}
                    />

                    <NumberField
                      label="Flat Amount"
                      value={config.serviceCharge.flatAmount}
                      onChange={(v) => patch('serviceCharge', { flatAmount: v })}
                      prefix="$"
                    />

                    <div className="sm:col-span-2">
                      <label className={labelClass}>Calculated On</label>
                      <Select
                        aria-label="Service charge basis"
                        className="w-full"
                        value={config.serviceCharge.basis}
                        onValueChange={(v) => patch('serviceCharge', { basis: v as any })}
                        options={[
                          { value: 'transport_only', label: 'Transport only (base fee + distance)' },
                          {
                            value: 'transport_and_accessorials',
                            label: 'Transport + accessorials'
                          }
                        ]}
                      />
                    </div>

                    <label className="sm:col-span-2 flex items-center gap-2.5 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={config.serviceCharge.taxable}
                        onChange={(e) => patch('serviceCharge', { taxable: e.target.checked })}
                        className={checkboxClass}
                      />
                      This charge is taxable
                    </label>
                  </div>
                </div>

                <div className={cardClass}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <Fuel className="w-4 h-4 text-slate-400" />
                        Fuel Surcharge
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Standard in freight. Peg it to pump price so it moves without re-quoting every
                        customer.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 shrink-0">
                      <input
                        type="checkbox"
                        checked={config.fuelSurcharge.enabled}
                        onChange={(e) => patch('fuelSurcharge', { enabled: e.target.checked })}
                        className={checkboxClass}
                      />
                      Enabled
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className={labelClass}>Label Shown to Customer</label>
                      <input
                        type="text"
                        value={config.fuelSurcharge.label}
                        onChange={(e) => patch('fuelSurcharge', { label: e.target.value })}
                        className={fieldClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Mode</label>
                      <Select
                        aria-label="Fuel surcharge mode"
                        className="w-full"
                        value={config.fuelSurcharge.mode}
                        onValueChange={(v) => patch('fuelSurcharge', { mode: v as any })}
                        options={[
                          { value: 'fixed_percent', label: 'Fixed percentage' },
                          { value: 'index_pegged', label: 'Pegged to fuel price' }
                        ]}
                      />
                    </div>

                    {config.fuelSurcharge.mode === 'fixed_percent' ? (
                      <div>
                        <label className={labelClass}>Surcharge</label>
                        <div className={`${fieldClass} flex items-center justify-between bg-slate-50 text-slate-600`}>
                          <span>{config.fuelSurcharge.percent}%</span>
                          <button
                            type="button"
                            onClick={() => setActiveTab('general')}
                            className="text-[11px] font-medium text-blue-600 hover:underline"
                          >
                            Edit in General
                          </button>
                        </div>
                        <p className={hintClass}>Uses the organization default fuel rate.</p>
                      </div>
                    ) : (
                      <>
                        <NumberField
                          label="Baseline Fuel Price"
                          value={config.fuelSurcharge.baselineFuelPrice}
                          onChange={(v) => patch('fuelSurcharge', { baselineFuelPrice: v })}
                          prefix="$"
                          suffix="/ L"
                          hint="Price at which the surcharge is zero."
                        />
                        <NumberField
                          label="Current Fuel Price"
                          value={config.fuelSurcharge.currentFuelPrice}
                          onChange={(v) => patch('fuelSurcharge', { currentFuelPrice: v })}
                          prefix="$"
                          suffix="/ L"
                        />
                        <NumberField
                          label="Surcharge per Cent Above Baseline"
                          value={config.fuelSurcharge.percentPerCentAboveBaseline}
                          onChange={(v) => patch('fuelSurcharge', { percentPerCentAboveBaseline: v })}
                          suffix="%"
                          step={0.05}
                          hint={`Currently resolving to ${resolveFuelPercent(config).toFixed(2)}%.`}
                        />
                      </>
                    )}

                    <div className="sm:col-span-2">
                      <label className={labelClass}>Calculated On</label>
                      <Select
                        aria-label="Fuel surcharge basis"
                        className="w-full"
                        value={config.fuelSurcharge.basis}
                        onValueChange={(v) => patch('fuelSurcharge', { basis: v as any })}
                        options={[
                          { value: 'transport_only', label: 'Transport only (base fee + distance)' },
                          {
                            value: 'transport_and_accessorials',
                            label: 'Transport + accessorials'
                          }
                        ]}
                      />
                    </div>

                    <label className="sm:col-span-2 flex items-center gap-2.5 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={config.fuelSurcharge.taxable}
                        onChange={(e) => patch('fuelSurcharge', { taxable: e.target.checked })}
                        className={checkboxClass}
                      />
                      This surcharge is taxable
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* ---------- OPERATING COST & MARGIN ---------- */}
            {activeTab === 'costs' && (
              <>
                <div className={cardClass}>
                  <h2 className="text-sm font-semibold text-slate-900">Cost Per Kilometre</h2>
                  <p className="text-xs text-slate-500 mt-0.5 mb-4">
                    What it costs you to run a kilometre — fuel, tyres, maintenance, depreciation.
                    A 5-tonne truck costs multiples of a van, so set it per vehicle class.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <NumberField
                      label="Default Cost / km"
                      value={config.operatingCost.defaultCostPerKm}
                      onChange={(v) => patch('operatingCost', { defaultCostPerKm: v })}
                      prefix="$"
                      hint="Used when a vehicle class has no specific rate."
                    />
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                      Per vehicle class
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                      {vehicles.map((vehicle) => (
                        <NumberField
                          key={vehicle.id}
                          label={vehicle.name}
                          value={
                            config.operatingCost.costPerKmByVehicleId[vehicle.id] ??
                            config.operatingCost.defaultCostPerKm
                          }
                          onChange={(v) =>
                            patch('operatingCost', {
                              costPerKmByVehicleId: {
                                ...config.operatingCost.costPerKmByVehicleId,
                                [vehicle.id]: v
                              }
                            })
                          }
                          prefix="$"
                          suffix="/ km"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className={cardClass}>
                  <h2 className="text-sm font-semibold text-slate-900">Labour & Handling Cost</h2>
                  <p className="text-xs text-slate-500 mt-0.5 mb-4">
                    Driver time is usually the largest cost on a short urban job — larger than fuel.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <NumberField
                      label="Driver Cost / hour"
                      value={config.operatingCost.driverCostPerHour}
                      onChange={(v) => patch('operatingCost', { driverCostPerHour: v })}
                      prefix="$"
                      hint="Fully loaded — wage plus payroll burden."
                    />
                    <NumberField
                      label="Average Time per Stop"
                      value={config.operatingCost.averageMinutesPerStop}
                      onChange={(v) => patch('operatingCost', { averageMinutesPerStop: v })}
                      suffix="min"
                      step={1}
                    />
                    <NumberField
                      label="Fixed Cost per Stop"
                      value={config.operatingCost.fixedCostPerStop}
                      onChange={(v) => patch('operatingCost', { fixedCostPerStop: v })}
                      prefix="$"
                      hint="Paperwork, scanning, POD capture."
                    />
                    <NumberField
                      label="Overhead Allocation"
                      value={config.operatingCost.overheadPercent}
                      onChange={(v) => patch('operatingCost', { overheadPercent: v })}
                      suffix="%"
                      step={0.5}
                      hint="Applied on top of direct cost."
                    />
                  </div>
                </div>

                <div className={cardClass}>
                  <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-slate-400" />
                    Margin Target
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 mb-4">
                    The simulator flags any quote that lands below this gross margin.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <NumberField
                      label="Target Gross Margin"
                      value={config.operatingCost.targetGrossMarginPercent}
                      onChange={(v) => patch('operatingCost', { targetGrossMarginPercent: v })}
                      suffix="%"
                      step={1}
                    />
                  </div>
                </div>
              </>
            )}

          </div>

          {/* ---------- LIVE WORKED EXAMPLE ---------- */}
          <aside className="bg-slate-900 text-white rounded-xl p-5 shadow-sm xl:sticky xl:top-0">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Worked Example
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              25 km · 45 min · 2 stops · 2 Tonne · 2 × 30 kg · 2 flights of stairs · 25 min wait
            </p>
            {preview.rateCard && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                {preview.rateCard.name} · {preview.method?.replace(/_/g, ' ').toLowerCase()}
              </p>
            )}

            <div className="text-3xl font-bold mt-3">
              ${preview.total.toFixed(2)}
              <span className="text-xs font-medium text-slate-400 ml-1.5">
                {config.invoicing.currency}
              </span>
            </div>

            {preview.errors.length > 0 && (
              <div className="mt-3 rounded-lg bg-rose-500/15 text-rose-200 px-3 py-2 text-[11px]">
                {preview.errors.map((e) => (
                  <div key={e.code}>{e.message}</div>
                ))}
              </div>
            )}

            <div className="mt-4 space-y-1.5 text-[11px] border-t border-white/10 pt-3">
              {preview.lines.map((line) => (
                <div key={line.key} className="flex justify-between text-slate-300">
                  <span className="truncate pr-2">{line.label}</span>
                  <span className="font-mono">{line.amount < 0 ? '−' : ''}${Math.abs(line.amount).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-white font-semibold pt-1.5 border-t border-white/10">
                <span>Subtotal</span>
                <span className="font-mono">${preview.subtotal.toFixed(2)}</span>
              </div>
              {preview.taxLines.map((line) => (
                <div key={line.key} className="flex justify-between text-slate-300">
                  <span className="truncate pr-2">{line.label}</span>
                  <span className="font-mono">${line.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-2">
                Cost & Margin
              </div>
              {preview.cost ? (
                <>
                  <div className="space-y-1.5 text-[11px]">
                    {preview.cost.costLines.map((line) => (
                      <div key={line.key} className="flex justify-between text-slate-300">
                        <span className="truncate pr-2">{line.label}</span>
                        <span className="font-mono">${line.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-slate-200 font-semibold pt-1.5 border-t border-white/10">
                      <span>Estimated cost</span>
                      <span className="font-mono">${preview.cost.estimatedCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-200 font-semibold">
                      <span>Gross profit</span>
                      <span className="font-mono">${preview.cost.grossProfit.toFixed(2)}</span>
                    </div>
                  </div>

                  <div
                    className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold ${
                      preview.cost.meetsTargetMargin
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {preview.cost.meetsTargetMargin ? (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>
                      {preview.cost.grossMarginPercent.toFixed(1)}% margin — target{' '}
                      {config.operatingCost.targetGrossMarginPercent}%
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-slate-400">Cost needs a priced distance.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
