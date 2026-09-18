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

import { PricingDirectories } from '../components/pricing/PricingDirectories';
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
export function RateCardsPage({ onBackToMonitor, onNotification, onNavigateSettings }: SettingsPageProps) {
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
      editorRef.current?.focus();
      editorRef.current?.scrollIntoView({ block: 'start' });
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
    const impact = attached ? `${attached} customer${attached === 1 ? '' : 's'} attached to it will use the Default card for new orders.` : 'No customers are attached to it.';
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
    const zone: Zone = { id: `zone_${Date.now()}`, code: zoneCode('New Zone'), name: 'New Zone', description: '' };
    persist({ ...config, zones: [...config.zones, zone] });
  };
  const patchZone = (id: string, changes: Partial<Zone>) =>
    persist({ ...config, zones: config.zones.map((z) => (z.id === id ? { ...z, ...changes } : z)) });
  const deleteZone = async (id: string) => {
    const zone = config.zones.find((z) => z.id === id);
    if (!zone || !(await confirmDialog({ title: `Delete zone "${zone.name}"?`, message: 'Its row and column disappear from every zone price grid, including prices already entered on rate cards.', confirmLabel: 'Delete zone', tone: 'danger' }))) return;
    persist({
      ...config,
      zones: config.zones.filter((z) => z.id !== id),
      zoneRates: config.zoneRates.filter((r) => r.originZoneId !== id && r.destinationZoneId !== id)
    });
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
  const directories = { config, persist, addZone, patchZone, deleteZone };
  const methodFilterControl = <Select aria-label="Filter pricing method" value={methodFilter} onValueChange={setMethodFilter} options={[{ value: '', label: 'All pricing methods' }, ...Object.entries(METHOD_LABELS).filter(([value]) => value !== 'IMPORTED').map(([value, label]) => ({ value, label }))]} />;
  return <SettingsLayout area="pricing" onBackToMonitor={onBackToMonitor} onNavigateSettings={onNavigateSettings}>
    <PricingTabs tabs={[
      { id: 'cards', label: 'Rate Cards', content: <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
        <RateCardList cards={visibleCards} selectedId={draft?.id} search={search} onSearch={setSearch} onAdd={addCard} onSelect={selectCard} isDefault={isDefault} />
        {draft ? <section ref={editorRef} tabIndex={-1} className="min-w-0 space-y-5 focus:outline-none" aria-label="Rate card editor">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-sm font-semibold text-slate-900">{isNew ? 'New rate card' : draft.name}{!isNew && isDefault(draft) && <span className="ml-2 align-middle text-[10px] font-medium px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200/70">Default</span>}</h2><p className="text-[11px] text-slate-500">{isNew ? 'Choose a method and enter your rates.' : `Version ${draft.version} · updated ${new Date(draft.updatedAt).toLocaleDateString()}`}{dirty ? ' · Unsaved changes' : ''}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              {!isNew && !isDefault(draft) && <button type="button" onClick={() => makeDefault(draft)} className={secondaryBtn}>Set as default</button>}
              {methodFilterControl}
            </div>
          </div>
          <RateCardEditor key={draft.id} {...{ draft, isNew, config, catalogue, billing, patchDraft }} />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isNew && <button type="button" onClick={closeEditor} className={secondaryBtn}>Cancel</button>}
            {!isNew && !isDefault(draft) && <button type="button" onClick={() => archiveCard(draft)} className={`${secondaryBtn} text-rose-700`}>Archive</button>}
            <button type="button" onClick={saveCard} className={primaryBtn}>{isSaved && !dirty ? 'Saved' : 'Save Card'}</button>
          </div>
        </section> : <div className="space-y-5"><div className="flex justify-end">{methodFilterControl}</div><div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Select a rate card or add one to set your prices.</div></div>}
      </div>
      },
      { id: 'zones', label: 'Zones', content: <PricingDirectories {...directories} /> },
      { id: 'accessorials', label: 'Accessorials', content: <CatalogueSection section="accessorials" onNotification={onNotification} onChanged={() => setRevision(value => value + 1)} /> },
      { id: 'extras', label: 'Extras', content: <BillingSettingsForm section="extras" onNotification={refreshDefaults} /> },
      { id: 'costs', label: 'Vehicle & Labour Costs', content: <BillingSettingsForm section="costs" onNotification={refreshDefaults} /> },
    ]} />
  </SettingsLayout>;
}
