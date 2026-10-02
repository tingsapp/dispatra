import { hasDimensionalWeightSetting } from '../lib/dimensionalWeight';
import { zoneRateIssue } from '../lib/zoneWeightBands';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { companySlugForCurrentPath } from '../lib/pageRoutes';
import { allOperations, operations } from '../operations/api';
import { api } from '../portal/api';
import { companySettingsKey, useWorkspaceAccount } from '../portal/WorkspaceAccount';
import { apiPricingContext, rateFromUi, rateToUi } from '../operations/pricingAdapters';
import { loadBillingConfig } from '../lib/billingStorage';
import { loadSimplePricingConfig } from '../lib/simplePricingStorage';
import { loadCustomers } from '../lib/customerStorage';
import {
  createEmptyRateCard,
  loadPricingConfig,
  rateCardCode,
  savePricingConfig,
  zoneCode
} from '../lib/pricingStorage';
import {
  PricingConfig,
  RateCard,
  Zone
} from '../types/pricing';

import { RateCardList } from '../components/pricing/RateCardList';
import { RateCardEditor } from '../components/pricing/RateCardEditor';
import { Select } from '../components/ui/Select';
import { METHOD_LABELS, primaryBtn, secondaryBtn } from '../components/pricing/RateCardFields';
import { BillingSettingsForm } from '../components/settings/BillingSettingsForm';
import { CatalogueSection } from '../components/settings/CatalogueSection';
import { PricingTabs } from '../components/pricing/PricingTabs';
import { VehicleTypesSection } from '../components/settings/VehicleTypesSection';
import { PreferencesEditor, TaxEditor } from '../portal/CompanySettingsEditors';
import { SettingsLayout, SettingsPageProps } from '../components/settings/SettingsLayout';
import { DISCARD_CHANGES, useSettingsGuard } from '../components/settings/useSettingsGuard';
import { confirmDialog } from '../components/ui/ConfirmDialog';
export function RateCardsPage({ onNotification }: SettingsPageProps) {
  const slug = companySlugForCurrentPath();
  const workspace = useWorkspaceAccount();
  const queryClient = useQueryClient();
  const rateQuery = useQuery({ queryKey: ['operations', slug, 'rates'], queryFn: () => allOperations.rates(slug!), enabled: !!slug });
  const catalogQuery = useQuery({ queryKey: ['operations', slug, 'catalog'], queryFn: () => allOperations.catalog(slug!), enabled: !!slug });
  const shipperQuery = useQuery({ queryKey: ['operations', slug, 'shippers'], queryFn: () => allOperations.shippers(slug!), enabled: !!slug });
  const settingsQuery = useQuery({ queryKey: companySettingsKey(slug!), queryFn: () => api.companySettings(slug!), enabled: !!slug });
  const liveCtx = useMemo(() => settingsQuery.data && catalogQuery.data && rateQuery.data && shipperQuery.data
    ? apiPricingContext(settingsQuery.data, catalogQuery.data, rateQuery.data, shipperQuery.data) : null,
    [settingsQuery.data, catalogQuery.data, rateQuery.data, shipperQuery.data]);

  const [config, setConfig] = useState<PricingConfig>(() => slug ? { ...loadPricingConfig(), rateCards: [], zones: [], zoneRates: [] } : loadPricingConfig());
  useEffect(() => { if (liveCtx) { setConfig(liveCtx.pricing); setDraft(current => current && liveCtx.pricing.rateCards.find(card => card.id === current.id) || liveCtx.pricing.rateCards.find(card => card.status === 'ACTIVE') || null); } }, [liveCtx]);
  const [revision, setRevision] = useState(0);
  const [isNew, setIsNew] = useState(false);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [draft, setDraft] = useState<RateCard | null>(() => config.rateCards.find(card => card.status === 'ACTIVE') ?? null);
  const [isSaved, setIsSaved] = useState(false);
  const editorRef = useRef<HTMLElement>(null);
  const focusedCardId = useRef(draft?.id);
  useEffect(() => {
    if (draft && focusedCardId.current !== draft.id) {
      focusedCardId.current = draft.id;
      editorRef.current?.focus({ preventScroll: true });
    }
  }, [draft?.id]);

  const catalogue = liveCtx?.catalogue ?? loadSimplePricingConfig();
  const billing = liveCtx?.billing ?? loadBillingConfig();
  const customers = liveCtx?.customers ?? loadCustomers();

  const persist = (next: PricingConfig) => {
    setConfig(next);
    if (!slug) savePricingConfig(next);
  };
  const isDefault = (card: RateCard) => card.scope === 'ORGANIZATION';
  const stamp = (card: RateCard, changes: Partial<RateCard>): RateCard => ({ ...card, ...changes, version: card.version + 1, updatedAt: new Date().toISOString() });

  // ------------------------------------------------------------------ cards
  const selectCard = async (card: RateCard) => {
    if (card.id === draft?.id) return;
    if (dirty && !(await confirmDialog(DISCARD_CHANGES))) return;
    setIsNew(false);
    setDraft({ ...card });
    setIsSaved(false);
  };

  const patchDraft = (changes: Partial<RateCard>) => {
    setDraft((prev) => (prev ? { ...prev, ...changes } : prev));
    setIsSaved(false);
  };

  const addCard = async () => {
    if (dirty && !(await confirmDialog(DISCARD_CHANGES))) return;
    const card = createEmptyRateCard({ name: 'New Rate Card', currency: billing.invoicing.currency });
    setDraft(card);
    setIsNew(true);
    setIsSaved(false);
  };

  const saveCard = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      onNotification?.('Rate Card needs a name.');
      return;
    }
    if (draft.pricingMethod === 'ZONE' && config.zones.some(zone => !zone.name.trim() || !zone.postalCodes?.length)) {
      onNotification?.('Give every zone a name and at least one ZIP / postal code before saving its prices.');
      return;
    }
    if (draft.pricingMethod === 'ZONE') {
      const invalid = draft.zoneRates?.find(rate => zoneRateIssue(rate));
      if (invalid) {
        const origin = config.zones.find(zone => zone.id === invalid.originZoneId)?.name ?? 'Pickup';
        const destination = config.zones.find(zone => zone.id === invalid.destinationZoneId)?.name ?? 'Delivery';
        onNotification?.(`${origin} → ${destination}: ${zoneRateIssue(invalid)}`);
        return;
      }
    }
    if (hasDimensionalWeightSetting(draft.pricingMethod) && (!Number.isFinite(draft.dimensionalDivisor) || (draft.dimensionalDivisor ?? 0) <= 0)) {
      onNotification?.('Enter a dimensional divisor greater than zero.');
      return;
    }
    const exists = config.rateCards.some((c) => c.id === draft.id);
    // Every save is a new version so historical PricingSnapshots stay pinned.
    const saved: RateCard = {
      ...draft,
      code: draft.code || rateCardCode(draft.name),
      // The first card an organization saves becomes its Default.
      scope: !exists && !config.rateCards.some(card => card.status === 'ACTIVE') ? 'ORGANIZATION' : draft.scope,
      version: exists ? draft.version + 1 : 1,
      updatedAt: new Date().toISOString()
    };
    if (slug) {
      try {
        const previous = rateQuery.data?.find(row => row.id === draft.id);
        const result = previous
          ? await operations.updateRate(slug, previous, rateFromUi(saved, config.zones), saved.scope === 'ORGANIZATION')
          : await operations.createRate(slug, saved.code, rateFromUi(saved, config.zones), saved.scope === 'ORGANIZATION');
        await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'rates'] });
        setDraft(rateToUi(result)); setIsNew(false); setIsSaved(true);
        onNotification?.(`Saved "${result.data.name}" (v${result.version}).`);
      } catch (error) { onNotification?.(error instanceof Error ? error.message : 'Could not save rate card.'); }
      return;
    }
    persist({
      ...config,
      rateCards: exists ? config.rateCards.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...config.rateCards]
    });
    setDraft(saved);
    setIsNew(false);
    setIsSaved(true);
    onNotification?.(`Saved "${saved.name}" (v${saved.version}).`);
    setTimeout(() => setIsSaved(false), 2500);
  };



  const makeDefault = async (card: RateCard) => {
    if (slug) {
      const record = rateQuery.data?.find(row => row.id === card.id); if (!record) return;
      try { await operations.updateRate(slug, record, record.data, true); await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'rates'] }); onNotification?.(`"${card.name}" is now the Default rate card.`); }
      catch (error) { onNotification?.(error instanceof Error ? error.message : 'Could not set default rate card.'); }
      return;
    }
    const rateCards = config.rateCards.map(c => c.id === card.id ? stamp(c, { scope: 'ORGANIZATION' }) : isDefault(c) ? stamp(c, { scope: 'ORDER' }) : c);
    persist({ ...config, rateCards });
    if (draft?.id === card.id) setDraft(rateCards.find(c => c.id === card.id)!);
    onNotification?.(`"${card.name}" is now the Default rate card.`);
  };

  /** Cards are archived, never deleted: orders already priced keep their frozen snapshot of the card. */
  const archiveCard = async (card: RateCard) => {
    if (isDefault(card)) { onNotification?.('Set another card as Default before archiving this one.'); return; }
    const attached = customers.filter(c => c.rateCardId === card.id).length;
    const impact = attached ? `${attached} shipper${attached === 1 ? '' : 's'} attached to it will use the Default card for new orders.` : 'No shippers are attached to it.';
    if (!(await confirmDialog({ title: `Archive "${card.name}"?`, message: `It leaves the list and every selector; orders already priced with it are unchanged. ${impact}`, confirmLabel: 'Archive card', tone: 'danger' }))) return;
    if (slug) {
      const record = rateQuery.data?.find(row => row.id === card.id); if (!record) return;
      try { await operations.archiveRate(slug, record); await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'rates'] }); onNotification?.(`Archived "${card.name}".`); }
      catch (error) { onNotification?.(error instanceof Error ? error.message : 'Could not archive rate card.'); }
      return;
    }
    const rateCards = config.rateCards.map(c => c.id === card.id ? stamp(c, { status: 'ARCHIVED' }) : c);
    persist({ ...config, rateCards });
    if (draft?.id === card.id) { setIsNew(false); setDraft(rateCards.find(c => c.status === 'ACTIVE') ?? null); }
    onNotification?.(`Archived "${card.name}". ${impact}`);
  };

  const visibleCards = useMemo(
    // Imported cards (external price only) always sit at the end of the list; the others keep their order.
    () => config.rateCards.filter(c => c.status === 'ACTIVE' && (!methodFilter || c.pricingMethod === methodFilter) && c.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => Number(a.pricingMethod === 'IMPORTED') - Number(b.pricingMethod === 'IMPORTED')),
    [config.rateCards, search, methodFilter]
  );

  // ------------------------------------------------------------------ zones
  const addZone = () => {
    const zone: Zone = { id: `zone_${crypto.randomUUID()}`, code: zoneCode('New Zone'), name: 'New Zone', postalCodes: [] };
    persist({ ...config, zones: [...config.zones, zone] });
    return zone.id;
  };
  const patchZone = (id: string, changes: Partial<Zone>) =>
    persist({ ...config, zones: config.zones.map((z) => (z.id === id ? { ...z, ...changes } : z)) });
  const deleteZone = async (id: string) => {
    const zone = config.zones.find(z => z.id === id);
    if (!zone || !(await confirmDialog({ title: `Remove zone "${zone.name}"?`, message: 'This removes the zone and its prices from every active zone-based card. Previously priced orders stay unchanged.', confirmLabel: 'Remove zone', tone: 'danger' }))) return false;
    const keepRate = (rate: { originZoneId: string; destinationZoneId: string }) => rate.originZoneId !== id && rate.destinationZoneId !== id;
    const rateCards = config.rateCards.map(card => card.status === 'ACTIVE' && card.zoneRates?.some(rate => !keepRate(rate))
      ? stamp(card, { zoneRates: card.zoneRates.filter(keepRate) }) : card);
    persist({ ...config, zones: config.zones.filter(z => z.id !== id), zoneRates: config.zoneRates.filter(keepRate), rateCards });
    setDraft(current => {
      if (!current) return current;
      const saved = rateCards.find(card => card.id === current.id);
      return { ...current, zoneRates: current.zoneRates?.filter(keepRate), version: saved?.version ?? current.version, updatedAt: saved?.updatedAt ?? current.updatedAt };
    });
    return true;
  };
  const savedCard = config.rateCards.find(card => card.id === draft?.id);
  const dirty = !!draft && (isNew || JSON.stringify(draft) !== JSON.stringify(savedCard));
  useSettingsGuard(dirty);
  const closeEditor = async () => {
    if (dirty && !(await confirmDialog(DISCARD_CHANGES))) return;
    setDraft(config.rateCards.find(card => card.status === 'ACTIVE') ?? null);
    setIsNew(false);
  };
  const refreshDefaults = (message: string) => { setRevision(value => value + 1); onNotification?.(message); };
  const zoneActions = { addZone, patchZone, deleteZone };
  const methodFilterControl = <Select aria-label="Filter pricing method" value={methodFilter} onValueChange={setMethodFilter} options={[{ value: '', label: 'All pricing methods' }, ...Object.entries(METHOD_LABELS).map(([value, label]) => ({ value, label }))]} />;
  if (slug && !liveCtx) return <SettingsLayout><p role={rateQuery.error || catalogQuery.error || shipperQuery.error || settingsQuery.error ? 'alert' : 'status'} className="text-sm text-slate-500">{rateQuery.error || catalogQuery.error || shipperQuery.error || settingsQuery.error ? 'Could not load pricing data.' : 'Loading pricing…'}</p></SettingsLayout>;
  return <SettingsLayout>
    <PricingTabs tabs={[
      { id: 'cards', label: 'Rate Cards', content: <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
        <RateCardList cards={visibleCards} selectedId={draft?.id} search={search} onSearch={setSearch} onAdd={addCard} onSelect={selectCard} isDefault={isDefault} />
        {draft ? <section ref={editorRef} tabIndex={-1} className="min-w-0 space-y-5 focus:outline-none" aria-label="Rate card editor">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="app-section-title text-slate-900">{isNew ? 'New rate card' : draft.name}{!isNew && isDefault(draft) && <span className="ml-2 align-middle text-xs font-medium px-1.5 py-0.5 rounded border bg-slate-100 text-slate-700 border-slate-200">Default</span>}</h2><p className="text-xs text-slate-500">{isNew ? 'Choose a method and enter your rates.' : `Version ${draft.version} · updated ${new Date(draft.updatedAt).toLocaleDateString()}`}{dirty ? ' · Unsaved changes' : ''}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              {!isNew && !isDefault(draft) && draft.pricingMethod !== 'IMPORTED' && <button type="button" onClick={() => makeDefault(draft)} className={secondaryBtn}>Set as default</button>}
              {methodFilterControl}
            </div>
          </div>
          <RateCardEditor key={draft.id} {...{ draft, isNew, config, catalogue, billing, patchDraft, zoneActions }} />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isNew && <button type="button" onClick={closeEditor} className={secondaryBtn}>Cancel</button>}
            {!isNew && !isDefault(draft) && <button type="button" onClick={() => archiveCard(draft)} className={`${secondaryBtn} text-rose-700`}>Archive</button>}
            <button type="button" onClick={saveCard} className={primaryBtn}>{isSaved && !dirty ? 'Saved' : 'Save Card'}</button>
          </div>
        </section> : <div className="space-y-5"><div className="flex justify-end">{methodFilterControl}</div><div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Select a rate card or add one to set your prices.</div></div>}
      </div>
      },
      { id: 'services', label: 'Service Level', content: <CatalogueSection section="services" onNotification={onNotification} onChanged={() => setRevision(value => value + 1)} /> },
      { id: 'accessorials', label: 'Accessorials', content: <CatalogueSection section="accessorials" onNotification={onNotification} onChanged={() => setRevision(value => value + 1)} /> },
      { id: 'fuel', label: 'Fuel Surcharge', content: <BillingSettingsForm section="fuel" onNotification={refreshDefaults} /> },
      { id: 'taxes', label: 'Taxes', content: workspace ? <TaxEditor /> : <BillingSettingsForm section="taxes" onNotification={refreshDefaults} /> },
      { id: 'vehicle-types', label: 'Vehicle Types', content: <VehicleTypesSection onNotification={onNotification} onChanged={() => setRevision(value => value + 1)} /> },
      { id: 'preferences', label: 'Preferences', content: workspace ? <PreferencesEditor /> : <BillingSettingsForm section="preferences" onNotification={refreshDefaults} /> },
    ]} />
  </SettingsLayout>;
}
