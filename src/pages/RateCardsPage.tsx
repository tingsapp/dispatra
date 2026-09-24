import { hasDimensionalWeightSetting } from '../lib/dimensionalWeight';
import { sortWeightBands, zoneRateIssue } from '../lib/zoneWeightBands';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { SettingsLayout, SettingsPageProps } from '../components/settings/SettingsLayout';
import { DISCARD_CHANGES, useSettingsGuard } from '../components/settings/useSettingsGuard';
import { confirmDialog } from '../components/ui/ConfirmDialog';
export function RateCardsPage({ onNotification }: SettingsPageProps) {
  const [config, setConfig] = useState<PricingConfig>(() => loadPricingConfig());
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

  const catalogue = useMemo(() => loadSimplePricingConfig(), [revision]);
  const billing = useMemo(() => loadBillingConfig(), [revision]);
  const customers = useMemo(() => loadCustomers(), []);

  const persist = (next: PricingConfig) => {
    setConfig(next);
    savePricingConfig(next);
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

  const saveCard = () => {
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
      zoneRates: draft.zoneRates?.map(rate => rate.weightBands ? { ...rate, weightBands: sortWeightBands(rate.weightBands) } : rate),
      code: draft.code || rateCardCode(draft.name),
      // The first card an organization saves becomes its Default.
      scope: !exists && !config.rateCards.some(card => card.status === 'ACTIVE') ? 'ORGANIZATION' : draft.scope,
      version: exists ? draft.version + 1 : 1,
      updatedAt: new Date().toISOString()
    };
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



  const makeDefault = (card: RateCard) => {
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
    const rateCards = config.rateCards.map(c => c.id === card.id ? stamp(c, { status: 'ARCHIVED' }) : c);
    persist({ ...config, rateCards });
    if (draft?.id === card.id) { setIsNew(false); setDraft(rateCards.find(c => c.status === 'ACTIVE') ?? null); }
    onNotification?.(`Archived "${card.name}". ${impact}`);
  };

  const visibleCards = useMemo(
    () => config.rateCards.filter(c => c.status === 'ACTIVE' && (!methodFilter || c.pricingMethod === methodFilter) && c.name.toLowerCase().includes(search.toLowerCase())),
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
  const methodFilterControl = <Select aria-label="Filter pricing method" value={methodFilter} onValueChange={setMethodFilter} options={[{ value: '', label: 'All pricing methods' }, ...Object.entries(METHOD_LABELS).filter(([value]) => value !== 'IMPORTED').map(([value, label]) => ({ value, label }))]} />;
  return <SettingsLayout>
    <PricingTabs tabs={[
      { id: 'cards', label: 'Rate Cards', content: <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
        <RateCardList cards={visibleCards} selectedId={draft?.id} search={search} onSearch={setSearch} onAdd={addCard} onSelect={selectCard} isDefault={isDefault} />
        {draft ? <section ref={editorRef} tabIndex={-1} className="min-w-0 space-y-5 focus:outline-none" aria-label="Rate card editor">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="app-section-title text-slate-900">{isNew ? 'New rate card' : draft.name}{!isNew && isDefault(draft) && <span className="ml-2 align-middle text-xs font-medium px-1.5 py-0.5 rounded border bg-slate-100 text-slate-700 border-slate-200">Default</span>}</h2><p className="text-xs text-slate-500">{isNew ? 'Choose a method and enter your rates.' : `Version ${draft.version} · updated ${new Date(draft.updatedAt).toLocaleDateString()}`}{dirty ? ' · Unsaved changes' : ''}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              {!isNew && !isDefault(draft) && <button type="button" onClick={() => makeDefault(draft)} className={secondaryBtn}>Set as default</button>}
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
      { id: 'fuel', label: 'Fuel Surcharge', content: <BillingSettingsForm section="fuel" onNotification={refreshDefaults} /> },
      { id: 'services', label: 'Service Level', content: <CatalogueSection section="services" onNotification={onNotification} onChanged={() => setRevision(value => value + 1)} /> },
      { id: 'accessorials', label: 'Accessorials', content: <CatalogueSection section="accessorials" onNotification={onNotification} onChanged={() => setRevision(value => value + 1)} /> },
    ]} />
  </SettingsLayout>;
}
