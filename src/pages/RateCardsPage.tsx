import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Calculator,
  FileText,
  Map,
  Users,
  Archive,
  AlertTriangle
} from 'lucide-react';
import {
  CustomerGroup,
  Discount,
  DiscountScope,
  DiscountType,
  PricingConfig,
  PricingMethod,
  RateCard,
  RateCardScope,
  RateCardStatus,
  Zone,
  ZoneRate
} from '../types/pricing';
import {
  createEmptyRateCard,
  loadPricingConfig,
  NO_DISCOUNT,
  resetPricingConfig,
  savePricingConfig
} from '../lib/pricingStorage';
import { loadSimplePricingConfig } from '../lib/simplePricingStorage';
import { loadBillingConfig } from '../lib/billingStorage';
import { loadCustomers } from '../lib/customerStorage';
import { resolveFuelPercent } from '../lib/billingEngine';
import { Select } from '../components/ui/Select';

interface RateCardsPageProps {
  onBackToMonitor: () => void;
  onOpenSimulator?: () => void;
  onNotification?: (msg: string) => void;
}

type TabId = 'cards' | 'zones' | 'groups';

const fieldClass =
  'w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400';
const labelClass = 'block text-xs font-medium text-slate-700 mb-1.5';
const hintClass = 'text-[11px] text-slate-500 mt-1';
const cardClass = 'bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs';
const checkboxClass =
  'w-4 h-4 rounded border-slate-300 accent-slate-900 focus:ring-2 focus:ring-slate-900/20 cursor-pointer';
const primaryBtn =
  'flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors';
const secondaryBtn =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs';

const METHOD_LABELS: Record<PricingMethod, string> = {
  BASE_PLUS_DISTANCE: 'Base + Distance',
  FIXED: 'Fixed per delivery',
  ZONE: 'Zone to zone',
  HOURLY: 'Hourly / dedicated',
  IMPORTED: 'Imported price'
};

const SCOPE_LABELS: Record<RateCardScope, string> = {
  ORGANIZATION: 'Organization',
  CUSTOMER_GROUP: 'Customer group',
  CUSTOMER: 'Customer'
};

const scopeBadge = (scope: RateCardScope) =>
  scope === 'CUSTOMER'
    ? 'bg-blue-50 text-blue-700 border-blue-200/70'
    : scope === 'CUSTOMER_GROUP'
    ? 'bg-violet-50 text-violet-700 border-violet-200/70'
    : 'bg-slate-100 text-slate-700 border-slate-200';

const statusBadge = (status: RateCardStatus) =>
  status === 'ACTIVE'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
    : status === 'DRAFT'
    ? 'bg-amber-50 text-amber-700 border-amber-200/70'
    : 'bg-slate-100 text-slate-500 border-slate-200';

/** Numeric input; always a number. */
const NumberField: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  hint?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, prefix, suffix, step = 0.01, hint, disabled }) => (
  <div>
    <label className={labelClass}>{label}</label>
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{prefix}</span>}
      <input
        type="number"
        step={step}
        min={0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={`${fieldClass} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-12' : ''}`}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{suffix}</span>}
    </div>
    {hint && <p className={hintClass}>{hint}</p>}
  </div>
);

/** Numeric input where blank means "inherit"; shows the inherited value as placeholder. */
const InheritField: React.FC<{
  label: string;
  value: number | null;
  inherited: number;
  inheritedFrom: string;
  onChange: (v: number | null) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}> = ({ label, value, inherited, inheritedFrom, onChange, prefix, suffix, step = 0.01 }) => (
  <div>
    <label className={labelClass}>{label}</label>
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{prefix}</span>}
      <input
        type="number"
        step={step}
        min={0}
        value={value ?? ''}
        placeholder={String(inherited)}
        onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0))}
        className={`${fieldClass} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-12' : ''} ${value === null ? 'italic' : ''}`}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{suffix}</span>}
    </div>
    <p className={hintClass}>
      {value === null ? `Inherits ${inherited}${suffix ? ` ${suffix}` : ''} from ${inheritedFrom}` : `Overrides ${inheritedFrom} (${inherited})`}
    </p>
  </div>
);

const DiscountEditor: React.FC<{ value: Discount; onChange: (d: Discount) => void }> = ({ value, onChange }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div>
      <label className={labelClass}>Discount Type</label>
      <Select
        aria-label="Discount type"
        className="w-full"
        value={value.type}
        onValueChange={(v) => onChange({ ...value, type: v as DiscountType })}
        options={[
          { value: 'NONE', label: 'None' },
          { value: 'PERCENT', label: 'Percentage' },
          { value: 'FIXED', label: 'Fixed amount' }
        ]}
      />
    </div>
    <NumberField
      label="Value"
      value={value.value}
      onChange={(v) => onChange({ ...value, value: v })}
      prefix={value.type === 'FIXED' ? '$' : undefined}
      suffix={value.type === 'PERCENT' ? '%' : undefined}
      disabled={value.type === 'NONE'}
      step={0.5}
    />
    <div>
      <label className={labelClass}>Applies To</label>
      <Select
        aria-label="Discount scope"
        className="w-full"
        disabled={value.type === 'NONE'}
        value={value.scope}
        onValueChange={(v) => onChange({ ...value, scope: v as DiscountScope })}
        options={[
          { value: 'TRANSPORT_ONLY', label: 'Transport only' },
          { value: 'SUBTOTAL', label: 'Whole subtotal' }
        ]}
      />
    </div>
  </div>
);

export const RateCardsPage: React.FC<RateCardsPageProps> = ({ onBackToMonitor, onOpenSimulator, onNotification }) => {
  const [config, setConfig] = useState<PricingConfig>(() => loadPricingConfig());
  const [activeTab, setActiveTab] = useState<TabId>('cards');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(() => loadPricingConfig().rateCards[0]?.id ?? null);
  const [draft, setDraft] = useState<RateCard | null>(() => loadPricingConfig().rateCards[0] ?? null);
  const [isSaved, setIsSaved] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const catalogue = useMemo(() => loadSimplePricingConfig(), []);
  const billing = useMemo(() => loadBillingConfig(), []);
  const customers = useMemo(() => loadCustomers(), []);
  const orgFuel = useMemo(() => resolveFuelPercent(billing), [billing]);

  const persist = (next: PricingConfig) => {
    setConfig(next);
    savePricingConfig(next);
  };

  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? '—';
  const groupName = (id: string | null) => config.customerGroups.find((g) => g.id === id)?.name ?? '—';
  const serviceName = (id: string | null) => catalogue.services.find((s) => s.id === id)?.name ?? 'All services';

  // ------------------------------------------------------------------ cards
  const selectCard = (card: RateCard) => {
    setSelectedCardId(card.id);
    setDraft({ ...card });
    setIsSaved(false);
  };

  const patchDraft = (changes: Partial<RateCard>) => {
    setDraft((prev) => (prev ? { ...prev, ...changes } : prev));
    setIsSaved(false);
  };

  const addCard = () => {
    const card = createEmptyRateCard({ name: 'New Rate Card', status: 'DRAFT' });
    persist({ ...config, rateCards: [card, ...config.rateCards] });
    selectCard(card);
    onNotification?.('Draft Rate Card created.');
  };

  const duplicateCard = () => {
    if (!draft) return;
    const copy = createEmptyRateCard({
      ...draft,
      id: `rc_${Date.now()}`,
      name: `${draft.name} (copy)`,
      code: draft.code ? `${draft.code}-COPY` : '',
      status: 'DRAFT',
      version: 1
    });
    persist({ ...config, rateCards: [copy, ...config.rateCards] });
    selectCard(copy);
    onNotification?.(`Duplicated "${draft.name}".`);
  };

  const saveCard = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      onNotification?.('Rate Card needs a name.');
      return;
    }
    if (draft.scope === 'CUSTOMER' && !draft.customerId) {
      onNotification?.('Choose the customer this card belongs to.');
      return;
    }
    if (draft.scope === 'CUSTOMER_GROUP' && !draft.customerGroupId) {
      onNotification?.('Choose the customer group this card belongs to.');
      return;
    }
    const exists = config.rateCards.some((c) => c.id === draft.id);
    // Every save is a new version so historical PricingSnapshots stay pinned.
    const saved: RateCard = {
      ...draft,
      customerId: draft.scope === 'CUSTOMER' ? draft.customerId : null,
      customerGroupId: draft.scope === 'CUSTOMER_GROUP' ? draft.customerGroupId : null,
      version: exists ? draft.version + 1 : 1,
      updatedAt: new Date().toISOString()
    };
    persist({
      ...config,
      rateCards: exists ? config.rateCards.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...config.rateCards]
    });
    setDraft(saved);
    setIsSaved(true);
    onNotification?.(`Saved "${saved.name}" (v${saved.version}).`);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const archiveCard = () => {
    if (!draft) return;
    const next = { ...draft, status: (draft.status === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED') as RateCardStatus };
    persist({ ...config, rateCards: config.rateCards.map((c) => (c.id === next.id ? next : c)) });
    setDraft(next);
    onNotification?.(next.status === 'ARCHIVED' ? `Archived "${next.name}".` : `Restored "${next.name}" as draft.`);
  };

  const deleteCard = () => {
    if (!draft) return;
    if (!confirm(`Delete "${draft.name}"? Orders already priced keep their snapshot.`)) return;
    const remaining = config.rateCards.filter((c) => c.id !== draft.id);
    persist({ ...config, rateCards: remaining });
    const next = remaining[0] ?? null;
    setSelectedCardId(next?.id ?? null);
    setDraft(next ? { ...next } : null);
    onNotification?.(`Deleted "${draft.name}".`);
  };

  const handleReset = () => {
    const defaults = resetPricingConfig();
    setConfig(defaults);
    const first = defaults.rateCards[0] ?? null;
    setSelectedCardId(first?.id ?? null);
    setDraft(first ? { ...first } : null);
    onNotification?.('Reset rate cards, zones, and groups to defaults.');
  };

  const visibleCards = useMemo(
    () => config.rateCards.filter((c) => showArchived || c.status !== 'ARCHIVED'),
    [config.rateCards, showArchived]
  );

  const setServiceOverride = (serviceId: string, key: 'baseFee' | 'includedKm' | 'kmRate' | 'multiplier', value: number | null) => {
    if (!draft) return;
    const current = draft.serviceOverrides[serviceId] ?? { baseFee: null, includedKm: null, kmRate: null, multiplier: null };
    const next = { ...current, [key]: value };
    const overrides = { ...draft.serviceOverrides };
    if (next.baseFee === null && next.includedKm === null && next.kmRate === null && next.multiplier === null) {
      delete overrides[serviceId];
    } else {
      overrides[serviceId] = next;
    }
    patchDraft({ serviceOverrides: overrides });
  };

  const setMapOverride = (map: 'vehicleSurchargeOverrides' | 'accessorialRateOverrides', id: string, value: number | null) => {
    if (!draft) return;
    const next = { ...draft[map] };
    if (value === null) delete next[id];
    else next[id] = value;
    patchDraft({ [map]: next } as Partial<RateCard>);
  };

  // ------------------------------------------------------------------ zones
  const addZone = () => {
    const zone: Zone = { id: `zone_${Date.now()}`, code: 'NEW', name: 'New Zone', description: '' };
    persist({ ...config, zones: [...config.zones, zone] });
  };
  const patchZone = (id: string, changes: Partial<Zone>) =>
    persist({ ...config, zones: config.zones.map((z) => (z.id === id ? { ...z, ...changes } : z)) });
  const deleteZone = (id: string) => {
    const zone = config.zones.find((z) => z.id === id);
    if (!zone || !confirm(`Delete zone "${zone.name}" and its rates?`)) return;
    persist({
      ...config,
      zones: config.zones.filter((z) => z.id !== id),
      zoneRates: config.zoneRates.filter((r) => r.originZoneId !== id && r.destinationZoneId !== id)
    });
  };
  const setZoneRate = (originZoneId: string, destinationZoneId: string, amount: number | null) => {
    const existing = config.zoneRates.find(
      (r) => r.originZoneId === originZoneId && r.destinationZoneId === destinationZoneId && !r.serviceId
    );
    let zoneRates: ZoneRate[];
    if (amount === null) {
      zoneRates = config.zoneRates.filter((r) => r !== existing);
    } else if (existing) {
      zoneRates = config.zoneRates.map((r) => (r === existing ? { ...r, amount } : r));
    } else {
      zoneRates = [...config.zoneRates, { id: `zr_${Date.now()}`, originZoneId, destinationZoneId, amount, serviceId: null }];
    }
    persist({ ...config, zoneRates });
  };
  const zoneRateFor = (o: string, d: string) =>
    config.zoneRates.find((r) => r.originZoneId === o && r.destinationZoneId === d && !r.serviceId)?.amount ?? null;

  // ----------------------------------------------------------------- groups
  const addGroup = () => {
    const group: CustomerGroup = {
      id: `grp_${Date.now()}`,
      name: 'New Group',
      description: '',
      rateCardId: null,
      discount: { ...NO_DISCOUNT }
    };
    persist({ ...config, customerGroups: [...config.customerGroups, group] });
  };
  const patchGroup = (id: string, changes: Partial<CustomerGroup>) =>
    persist({ ...config, customerGroups: config.customerGroups.map((g) => (g.id === id ? { ...g, ...changes } : g)) });
  const deleteGroup = (id: string) => {
    const group = config.customerGroups.find((g) => g.id === id);
    if (!group) return;
    const members = customers.filter((c) => c.customerGroupId === id).length;
    if (members > 0) {
      onNotification?.(`"${group.name}" still has ${members} customer${members === 1 ? '' : 's'}. Move them first.`);
      return;
    }
    if (!confirm(`Delete group "${group.name}"?`)) return;
    persist({ ...config, customerGroups: config.customerGroups.filter((g) => g.id !== id) });
  };

  const tabs: { id: TabId; label: string; icon: typeof FileText; count: number }[] = [
    { id: 'cards', label: 'Rate Cards', icon: FileText, count: config.rateCards.length },
    { id: 'zones', label: 'Zones', icon: Map, count: config.zones.length },
    { id: 'groups', label: 'Customer Groups', icon: Users, count: config.customerGroups.length }
  ];

  const isCalculated = draft?.pricingMethod === 'BASE_PLUS_DISTANCE' || (draft?.pricingMethod === 'ZONE' && draft.zoneNoMatchFallback === 'BASE_PLUS_DISTANCE');

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden font-sans">
      {/* HEADER BAR */}
      <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onBackToMonitor} className={secondaryBtn} title="Return to Monitor Map">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Back to Monitor</span>
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">Rate Cards & Zones</h1>
              <p className="text-[11px] text-slate-500 leading-tight">
                Commercial pricing rules. Customer card → group card → organization default.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onOpenSimulator && (
            <button type="button" onClick={onOpenSimulator} className={secondaryBtn}>
              <Calculator className="w-3.5 h-3.5 text-slate-500" />
              <span>Open Pricing Simulator</span>
            </button>
          )}
          <button type="button" onClick={handleReset} className={secondaryBtn}>
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className="h-12 bg-white border-b border-slate-200/90 px-6 flex items-center gap-2 shrink-0 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const on = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                on ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 rounded-full font-bold ${on ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* ============================ RATE CARDS ============================ */}
        {activeTab === 'cards' && (
          <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
            {/* List */}
            <div className="space-y-3 xl:sticky xl:top-0">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className={checkboxClass} />
                  Show archived
                </label>
                <button type="button" onClick={addCard} className={primaryBtn}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Card</span>
                </button>
              </div>
              <div className="space-y-2">
                {visibleCards.map((card) => {
                  const on = card.id === selectedCardId;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => selectCard(card)}
                      className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                        on ? 'border-slate-900 bg-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">{card.name}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {card.scope === 'CUSTOMER'
                              ? customerName(card.customerId)
                              : card.scope === 'CUSTOMER_GROUP'
                              ? groupName(card.customerGroupId)
                              : serviceName(card.serviceId)}
                          </div>
                        </div>
                        <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${statusBadge(card.status)}`}>
                          {card.status.toLowerCase()}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${scopeBadge(card.scope)}`}>
                          {SCOPE_LABELS[card.scope]}
                        </span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-white text-slate-600 border-slate-200">
                          {METHOD_LABELS[card.pricingMethod]}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-auto">v{card.version}</span>
                      </div>
                    </button>
                  );
                })}
                {!visibleCards.length && (
                  <p className="text-xs text-slate-500 p-3">No rate cards. Create one to start pricing.</p>
                )}
              </div>
            </div>

            {/* Editor */}
            {draft ? (
              <div className="space-y-5">
                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{draft.name || 'Untitled card'}</h2>
                    <p className="text-[11px] text-slate-500">
                      Version {draft.version} · updated {new Date(draft.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={duplicateCard} className={secondaryBtn}>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Duplicate</span>
                    </button>
                    <button type="button" onClick={archiveCard} className={secondaryBtn}>
                      <Archive className="w-3.5 h-3.5 text-slate-500" />
                      <span>{draft.status === 'ARCHIVED' ? 'Restore' : 'Archive'}</span>
                    </button>
                    <button type="button" onClick={deleteCard} className={`${secondaryBtn} text-rose-600 hover:bg-rose-50`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={saveCard}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-white transition-colors shadow-2xs ${
                        isSaved ? 'bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800'
                      }`}
                    >
                      {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
                      <span>{isSaved ? 'Saved' : 'Save Card'}</span>
                    </button>
                  </div>
                </div>

                {/* Identity & scope */}
                <div className={cardClass}>
                  <h3 className="text-sm font-semibold text-slate-900">Identity & Scope</h3>
                  <p className="text-xs text-slate-500 mt-0.5 mb-4">
                    Who this card prices, and when. Narrower scope wins; equal specificity needs a priority.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Name</label>
                      <input type="text" value={draft.name} onChange={(e) => patchDraft({ name: e.target.value })} className={fieldClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Code</label>
                      <input type="text" value={draft.code} onChange={(e) => patchDraft({ code: e.target.value.toUpperCase() })} className={`${fieldClass} font-mono`} />
                    </div>

                    <div>
                      <label className={labelClass}>Scope</label>
                      <Select
                        aria-label="Scope"
                        className="w-full"
                        value={draft.scope}
                        onValueChange={(v) => patchDraft({ scope: v as RateCardScope })}
                        options={(Object.keys(SCOPE_LABELS) as RateCardScope[]).map((s) => ({ value: s, label: SCOPE_LABELS[s] }))}
                      />
                    </div>
                    {draft.scope === 'CUSTOMER' && (
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Customer</label>
                        <Select
                          aria-label="Customer"
                          className="w-full"
                          value={draft.customerId ?? ''}
                          onValueChange={(v) => patchDraft({ customerId: v || null })}
                          options={[{ value: '', label: 'Choose a customer…' }, ...customers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))]}
                        />
                      </div>
                    )}
                    {draft.scope === 'CUSTOMER_GROUP' && (
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Customer Group</label>
                        <Select
                          aria-label="Customer group"
                          className="w-full"
                          value={draft.customerGroupId ?? ''}
                          onValueChange={(v) => patchDraft({ customerGroupId: v || null })}
                          options={[{ value: '', label: 'Choose a group…' }, ...config.customerGroups.map((g) => ({ value: g.id, label: g.name }))]}
                        />
                      </div>
                    )}
                    {draft.scope === 'ORGANIZATION' && (
                      <div className="sm:col-span-2 flex items-end">
                        <p className="text-[11px] text-slate-500 pb-2">
                          {draft.serviceId
                            ? 'Organization service-specific card — beats the organization default for that service.'
                            : 'Organization default — the last fallback for every order.'}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className={labelClass}>Service Restriction</label>
                      <Select
                        aria-label="Service restriction"
                        className="w-full"
                        value={draft.serviceId ?? ''}
                        onValueChange={(v) => patchDraft({ serviceId: v || null })}
                        options={[{ value: '', label: 'All services' }, ...catalogue.services.map((s) => ({ value: s.id, label: s.name }))]}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Vehicle Restriction</label>
                      <Select
                        aria-label="Vehicle restriction"
                        className="w-full"
                        value={draft.vehicleId ?? ''}
                        onValueChange={(v) => patchDraft({ vehicleId: v || null })}
                        options={[{ value: '', label: 'Any vehicle' }, ...catalogue.vehicles.map((v) => ({ value: v.id, label: v.name }))]}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Priority</label>
                      <input
                        type="number"
                        step={1}
                        value={draft.priority}
                        onChange={(e) => patchDraft({ priority: Number(e.target.value) || 0 })}
                        className={fieldClass}
                      />
                      <p className={hintClass}>Higher wins a tie at the same level.</p>
                    </div>

                    <div>
                      <label className={labelClass}>Effective From</label>
                      <input type="date" value={draft.effectiveFrom} onChange={(e) => patchDraft({ effectiveFrom: e.target.value })} className={fieldClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Effective To</label>
                      <input type="date" value={draft.effectiveTo ?? ''} onChange={(e) => patchDraft({ effectiveTo: e.target.value || null })} className={fieldClass} />
                      <p className={hintClass}>Blank = open-ended.</p>
                    </div>
                    <div>
                      <label className={labelClass}>Status</label>
                      <Select
                        aria-label="Status"
                        className="w-full"
                        value={draft.status}
                        onValueChange={(v) => patchDraft({ status: v as RateCardStatus })}
                        options={[
                          { value: 'ACTIVE', label: 'Active' },
                          { value: 'DRAFT', label: 'Draft' },
                          { value: 'ARCHIVED', label: 'Archived' }
                        ]}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Currency</label>
                      <Select
                        aria-label="Currency"
                        className="w-full"
                        value={draft.currency}
                        onValueChange={(v) => patchDraft({ currency: v as 'CAD' | 'USD' })}
                        options={[
                          { value: 'CAD', label: 'CAD' },
                          { value: 'USD', label: 'USD' }
                        ]}
                      />
                      {draft.currency !== billing.invoicing.currency && (
                        <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Organization bills in {billing.invoicing.currency}; orders will need attention.
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Notes</label>
                      <input type="text" value={draft.notes} onChange={(e) => patchDraft({ notes: e.target.value })} className={fieldClass} placeholder="Contract reference, negotiated terms…" />
                    </div>
                  </div>
                </div>

                {/* Pricing method */}
                <div className={cardClass}>
                  <h3 className="text-sm font-semibold text-slate-900">Pricing Method</h3>
                  <p className="text-xs text-slate-500 mt-0.5 mb-4">
                    How the freight amount is produced. Surcharges, accessorials, discounts, and tax wrap around it.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
                    {(Object.keys(METHOD_LABELS) as PricingMethod[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => patchDraft({ pricingMethod: m })}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                          draft.pricingMethod === m ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {METHOD_LABELS[m]}
                      </button>
                    ))}
                  </div>

                  {draft.pricingMethod === 'FIXED' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <NumberField label="Fixed Amount per Delivery" value={draft.fixedAmount} onChange={(v) => patchDraft({ fixedAmount: v })} prefix="$" />
                    </div>
                  )}

                  {draft.pricingMethod === 'HOURLY' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <NumberField label="Hourly Rate" value={draft.hourlyRate} onChange={(v) => patchDraft({ hourlyRate: v })} prefix="$" suffix="/ h" />
                      <NumberField label="Minimum Billable" value={draft.minimumBillableMinutes} onChange={(v) => patchDraft({ minimumBillableMinutes: v })} suffix="min" step={5} />
                      <NumberField label="Billing Increment" value={draft.billingIncrementMinutes} onChange={(v) => patchDraft({ billingIncrementMinutes: v })} suffix="min" step={5} hint="Estimated at booking; settled on actual hours at completion." />
                    </div>
                  )}

                  {draft.pricingMethod === 'ZONE' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className={labelClass}>When no zone rate matches</label>
                        <Select
                          aria-label="Zone no-match fallback"
                          className="w-full"
                          value={draft.zoneNoMatchFallback}
                          onValueChange={(v) => patchDraft({ zoneNoMatchFallback: v as RateCard['zoneNoMatchFallback'] })}
                          options={[
                            { value: 'NEEDS_ATTENTION', label: 'Flag the order — Needs Attention' },
                            { value: 'BASE_PLUS_DISTANCE', label: 'Fall back to base + distance' }
                          ]}
                        />
                        <p className={hintClass}>Rates live under the Zones tab. Each drop-off is priced from the first pickup's zone.</p>
                      </div>
                    </div>
                  )}

                  {draft.pricingMethod === 'IMPORTED' && (
                    <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                      Freight comes from the external system on each order. This card only decides which surcharges still apply.
                    </p>
                  )}

                  {draft.pricingMethod !== 'BASE_PLUS_DISTANCE' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200/80 mb-4">
                      {(
                        [
                          ['applyServiceMultiplier', 'Service multiplier'],
                          ['applyVehicleSurcharge', 'Vehicle surcharge'],
                          ['applyFuelSurcharge', 'Fuel surcharge'],
                          ['applyAccessorials', 'Accessorials']
                        ] as [keyof RateCard, string][]
                      ).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={!!draft[key]} onChange={(e) => patchDraft({ [key]: e.target.checked } as Partial<RateCard>)} className={checkboxClass} />
                          {label}
                        </label>
                      ))}
                    </div>
                  )}

                  {isCalculated && (
                    <>
                      {draft.pricingMethod === 'ZONE' && (
                        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-3">Fallback rates</p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <NumberField label="Base Fee" value={draft.baseFee} onChange={(v) => patchDraft({ baseFee: v })} prefix="$" hint="Fixed starting amount before variable charges." />
                        <NumberField label="Included Distance" value={draft.includedKm} onChange={(v) => patchDraft({ includedKm: v })} suffix="km" step={0.5} hint="Distance covered by the base fee. 0 charges every km." />
                        <NumberField label="Distance Rate" value={draft.kmRate} onChange={(v) => patchDraft({ kmRate: v })} prefix="$" suffix="/ km" />

                        <NumberField label="Included Minutes" value={draft.includedMinutes} onChange={(v) => patchDraft({ includedMinutes: v })} suffix="min" step={5} />
                        <NumberField label="Minute Rate" value={draft.minuteRate} onChange={(v) => patchDraft({ minuteRate: v })} prefix="$" suffix="/ min" hint="0 disables time pricing." />
                        <NumberField label="Minimum Freight" value={draft.minimumFreight} onChange={(v) => patchDraft({ minimumFreight: v })} prefix="$" hint="Floor before the service multiplier." />

                        <NumberField label="Included Weight" value={draft.includedWeightKg} onChange={(v) => patchDraft({ includedWeightKg: v })} suffix="kg" step={1} />
                        <NumberField label="Weight Rate" value={draft.weightRatePerKg} onChange={(v) => patchDraft({ weightRatePerKg: v })} prefix="$" suffix="/ kg" hint="On chargeable weight = max(actual, dimensional)." />
                        <div />

                        <NumberField label="Included Pieces" value={draft.includedPieces} onChange={(v) => patchDraft({ includedPieces: v })} step={1} />
                        <NumberField label="Piece Rate" value={draft.pieceRate} onChange={(v) => patchDraft({ pieceRate: v })} prefix="$" suffix="/ piece" />
                        <div />

                        <InheritField label="Included Stops" value={draft.includedStops} inherited={billing.general.defaultIncludedStops} inheritedFrom="organization" onChange={(v) => patchDraft({ includedStops: v })} suffix="stops" step={1} />
                        <InheritField label="Extra Stop Rate" value={draft.extraStopRate} inherited={billing.general.defaultExtraStopRate} inheritedFrom="organization" onChange={(v) => patchDraft({ extraStopRate: v })} prefix="$" />
                      </div>

                      {/* Per-service overrides */}
                      <div className="mt-5 pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-semibold text-slate-900">Per-service Rates</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
                          Blank inherits the card's base values (and the Service's default multiplier). Direct can carry a higher base fee, not only a multiplier.
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-[11px] text-slate-500 border-b border-slate-200">
                                <th className="text-left py-2 pr-3 font-medium">Service</th>
                                <th className="text-left py-2 px-2 font-medium">Base Fee</th>
                                <th className="text-left py-2 px-2 font-medium">Included km</th>
                                <th className="text-left py-2 px-2 font-medium">Rate / km</th>
                                <th className="text-left py-2 px-2 font-medium">Multiplier</th>
                              </tr>
                            </thead>
                            <tbody>
                              {catalogue.services.map((svc) => {
                                const o = draft.serviceOverrides[svc.id];
                                const cell = (key: 'baseFee' | 'includedKm' | 'kmRate' | 'multiplier', placeholder: number, step: number) => (
                                  <td className="py-1.5 px-2">
                                    <input
                                      type="number"
                                      min={0}
                                      step={step}
                                      value={o?.[key] ?? ''}
                                      placeholder={String(placeholder)}
                                      onChange={(e) => setServiceOverride(svc.id, key, e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0))}
                                      className={`${fieldClass} py-1.5 ${o?.[key] == null ? 'italic text-slate-500' : 'font-medium'}`}
                                    />
                                  </td>
                                );
                                return (
                                  <tr key={svc.id} className="border-b border-slate-100 last:border-0">
                                    <td className="py-1.5 pr-3">
                                      <div className="font-medium text-slate-900">{svc.name}</div>
                                      <div className="text-[10px] text-slate-400">{svc.active ? svc.code : `${svc.code} · inactive`}</div>
                                    </td>
                                    {cell('baseFee', draft.baseFee, 0.5)}
                                    {cell('includedKm', draft.includedKm, 0.5)}
                                    {cell('kmRate', draft.kmRate, 0.05)}
                                    {cell('multiplier', svc.defaultMultiplier, 0.05)}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Inherited defaults */}
                <div className={cardClass}>
                  <h3 className="text-sm font-semibold text-slate-900">Organization Default Overrides</h3>
                  <p className="text-xs text-slate-500 mt-0.5 mb-4">Blank inherits Billing, Tax & Cost → General. Zero is explicitly zero.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <InheritField label="Fuel Surcharge" value={draft.fuelPercent} inherited={orgFuel} inheritedFrom="organization" onChange={(v) => patchDraft({ fuelPercent: v })} suffix="%" step={0.1} />
                    <InheritField label="Dimensional Divisor" value={draft.dimensionalDivisor} inherited={billing.general.dimensionalDivisor} inheritedFrom="organization" onChange={(v) => patchDraft({ dimensionalDivisor: v })} step={1} />
                    <div>
                      <label className={labelClass}>Dimensional Pricing</label>
                      <Select
                        aria-label="Dimensional pricing"
                        className="w-full"
                        value={draft.dimensionalPricingEnabled === null ? 'inherit' : draft.dimensionalPricingEnabled ? 'on' : 'off'}
                        onValueChange={(v) => patchDraft({ dimensionalPricingEnabled: v === 'inherit' ? null : v === 'on' })}
                        options={[
                          { value: 'inherit', label: `Inherit (${billing.general.dimensionalPricingEnabled ? 'on' : 'off'})` },
                          { value: 'on', label: 'On — max(actual, dimensional)' },
                          { value: 'off', label: 'Off — actual weight only' }
                        ]}
                      />
                    </div>
                    <InheritField label="Wait-Free Allowance" value={draft.waitFreeMinutes} inherited={billing.general.defaultWaitFreeMinutes} inheritedFrom="organization" onChange={(v) => patchDraft({ waitFreeMinutes: v })} suffix="min" step={1} />
                    <InheritField label="Wait Increment" value={draft.waitIncrementMinutes} inherited={billing.general.defaultWaitIncrementMinutes} inheritedFrom="organization" onChange={(v) => patchDraft({ waitIncrementMinutes: v })} suffix="min" step={1} />
                  </div>
                </div>

                {/* Vehicle & accessorial overrides */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className={cardClass}>
                    <h3 className="text-sm font-semibold text-slate-900">Vehicle Surcharge Overrides</h3>
                    <p className="text-xs text-slate-500 mt-0.5 mb-3">Blank inherits the Vehicle Type default. Enter 0 to waive.</p>
                    <div className="space-y-2">
                      {catalogue.vehicles.map((v) => {
                        const override = draft.vehicleSurchargeOverrides[v.id];
                        return (
                          <div key={v.id} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-slate-900 truncate">{v.name}</div>
                              <div className="text-[10px] text-slate-400">default ${v.baseSurcharge.toFixed(2)}</div>
                            </div>
                            <div className="relative w-32">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">$</span>
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={override ?? ''}
                                placeholder={v.baseSurcharge.toFixed(2)}
                                onChange={(e) => setMapOverride('vehicleSurchargeOverrides', v.id, e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0))}
                                className={`${fieldClass} pl-7 ${override === undefined ? 'italic text-slate-500' : 'font-medium'}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className={cardClass}>
                    <h3 className="text-sm font-semibold text-slate-900">Accessorial Rate Overrides</h3>
                    <p className="text-xs text-slate-500 mt-0.5 mb-3">Blank inherits the Accessorial default rate. Enter 0 to include at no charge.</p>
                    <div className="space-y-2">
                      {catalogue.accessorials.map((a) => {
                        const override = draft.accessorialRateOverrides[a.id];
                        const pct = a.calculationType.startsWith('PERCENT');
                        return (
                          <div key={a.id} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-slate-900 truncate">{a.name}</div>
                              <div className="text-[10px] text-slate-400">
                                default {pct ? `${a.rate}%` : `$${a.rate.toFixed(2)}`} {a.unitLabel}
                              </div>
                            </div>
                            <div className="relative w-32">
                              {!pct && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">$</span>}
                              <input
                                type="number"
                                min={0}
                                step={0.05}
                                value={override ?? ''}
                                placeholder={pct ? String(a.rate) : a.rate.toFixed(2)}
                                onChange={(e) => setMapOverride('accessorialRateOverrides', a.id, e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0))}
                                className={`${fieldClass} ${pct ? 'pr-7' : 'pl-7'} ${override === undefined ? 'italic text-slate-500' : 'font-medium'}`}
                              />
                              {pct && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">%</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Discount */}
                <div className={cardClass}>
                  <h3 className="text-sm font-semibold text-slate-900">Contract Discount</h3>
                  <p className="text-xs text-slate-500 mt-0.5 mb-4">
                    Permanent negotiated discount. A customer-level discount beats this; one-off discounts belong on the Order.
                  </p>
                  <DiscountEditor value={draft.discount} onChange={(discount) => patchDraft({ discount })} />
                </div>
              </div>
            ) : (
              <div className={`${cardClass} text-center text-xs text-slate-500`}>Select a rate card or create a new one.</div>
            )}
          </div>
        )}

        {/* ============================== ZONES ============================== */}
        {activeTab === 'zones' && (
          <div className="space-y-5">
            <div className={cardClass}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Zones</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Service areas used by zone-to-zone Rate Cards. Stops are assigned a zone at order entry.</p>
                </div>
                <button type="button" onClick={addZone} className={primaryBtn}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Zone</span>
                </button>
              </div>
              <div className="space-y-2">
                {config.zones.map((z) => (
                  <div key={z.id} className="grid grid-cols-[90px_1fr_2fr_auto] gap-2 items-center">
                    <input type="text" value={z.code} onChange={(e) => patchZone(z.id, { code: e.target.value.toUpperCase().slice(0, 6) })} className={`${fieldClass} font-mono`} aria-label="Zone code" />
                    <input type="text" value={z.name} onChange={(e) => patchZone(z.id, { name: e.target.value })} className={fieldClass} aria-label="Zone name" />
                    <input type="text" value={z.description} onChange={(e) => patchZone(z.id, { description: e.target.value })} className={fieldClass} placeholder="Description" aria-label="Zone description" />
                    <button type="button" onClick={() => deleteZone(z.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete zone">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className={cardClass}>
              <h3 className="text-sm font-semibold text-slate-900">Zone Rate Matrix</h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-4">
                Origin (rows) → destination (columns). Blank means no rate; the Rate Card decides whether that flags the order or falls back.
              </p>
              <div className="overflow-x-auto">
                <table className="text-xs border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-white text-left py-2 pr-3 text-[11px] font-medium text-slate-500">From \ To</th>
                      {config.zones.map((z) => (
                        <th key={z.id} className="py-2 px-1 text-[11px] font-medium text-slate-700 text-center min-w-[88px]">
                          {z.code}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {config.zones.map((o) => (
                      <tr key={o.id}>
                        <td className="sticky left-0 bg-white py-1 pr-3 font-medium text-slate-900 whitespace-nowrap">
                          {o.name} <span className="text-[10px] text-slate-400 font-mono">{o.code}</span>
                        </td>
                        {config.zones.map((d) => {
                          const amount = zoneRateFor(o.id, d.id);
                          return (
                            <td key={d.id} className="py-1 px-1">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">$</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={amount ?? ''}
                                  placeholder="—"
                                  onChange={(e) => setZoneRate(o.id, d.id, e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0))}
                                  className={`${fieldClass} pl-5 pr-1 py-1.5 text-center ${amount === null ? 'bg-slate-50' : 'font-medium'}`}
                                  aria-label={`${o.name} to ${d.name}`}
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================== CUSTOMER GROUPS ========================== */}
        {activeTab === 'groups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Customer Groups</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  A group can point at a Rate Card and carry a discount. Customer-specific cards and discounts still win.
                </p>
              </div>
              <button type="button" onClick={addGroup} className={primaryBtn}>
                <Plus className="w-3.5 h-3.5" />
                <span>Add Group</span>
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {config.customerGroups.map((g) => {
                const members = customers.filter((c) => c.customerGroupId === g.id);
                const groupCards = config.rateCards.filter((c) => c.scope === 'CUSTOMER_GROUP' && c.status !== 'ARCHIVED');
                return (
                  <div key={g.id} className={cardClass}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Group Name</label>
                        <input type="text" value={g.name} onChange={(e) => patchGroup(g.id, { name: e.target.value })} className={fieldClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Group Rate Card</label>
                        <Select
                          aria-label="Group rate card"
                          className="w-full"
                          value={g.rateCardId ?? ''}
                          onValueChange={(v) => patchGroup(g.id, { rateCardId: v || null })}
                          options={[{ value: '', label: 'None — organization default' }, ...groupCards.map((c) => ({ value: c.id, label: c.name }))]}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Description</label>
                        <input type="text" value={g.description} onChange={(e) => patchGroup(g.id, { description: e.target.value })} className={fieldClass} />
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-2">Group discount</p>
                      <DiscountEditor value={g.discount} onChange={(discount) => patchGroup(g.id, { discount })} />
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-[11px] text-slate-500">
                        {members.length} member{members.length === 1 ? '' : 's'}
                        {members.length > 0 && <span className="text-slate-400"> · {members.slice(0, 3).map((m) => m.name).join(', ')}{members.length > 3 ? '…' : ''}</span>}
                      </div>
                      <button type="button" onClick={() => deleteGroup(g.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete group">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
