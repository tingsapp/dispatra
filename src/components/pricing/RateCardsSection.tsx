import React, { useState } from 'react';
import {
  CreditCard,
  Copy,
  Archive,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowRight,
  TrendingUp,
  FileCheck,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { OrganizationPricingSettings, RateCard, BasePricingMethod } from '../../types/pricing';

interface RateCardsSectionProps {
  settings: OrganizationPricingSettings;
  onUpdateSettings: (updater: (prev: OrganizationPricingSettings) => OrganizationPricingSettings) => void;
  onNotification: (msg: string) => void;
}

export const RateCardsSection: React.FC<RateCardsSectionProps> = ({
  settings,
  onUpdateSettings,
  onNotification
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string>(
    settings.rateCards.find((r) => r.isOrganizationDefault)?.id || settings.rateCards[0].id
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const activeCard = settings.rateCards.find((r) => r.id === selectedCardId) || settings.rateCards[0];

  const updateActiveCard = (field: keyof RateCard, value: any) => {
    onUpdateSettings((prev) => ({
      ...prev,
      rateCards: prev.rateCards.map((rc) =>
        rc.id === activeCard.id ? { ...rc, [field]: value } : rc
      )
    }));
  };

  const handleDuplicateCard = () => {
    const newCard: RateCard = {
      ...activeCard,
      id: `rc_copy_${Date.now()}`,
      name: `${activeCard.name} (Copy)`,
      version: `${(parseFloat(activeCard.version) + 0.1).toFixed(1)}`,
      status: 'draft',
      isOrganizationDefault: false,
      effectiveFrom: new Date().toISOString().split('T')[0]
    };
    onUpdateSettings((prev) => ({
      ...prev,
      rateCards: [...prev.rateCards, newCard]
    }));
    setSelectedCardId(newCard.id);
    onNotification(`Duplicated rate card as draft v${newCard.version}.`);
  };

  const handlePublishCard = () => {
    const nextVer = (parseFloat(activeCard.version) + 0.1).toFixed(1);
    updateActiveCard('status', 'published');
    updateActiveCard('version', nextVer);
    onNotification(`Published rate card "${activeCard.name}" as active v${nextVer}.`);
  };

  const handleArchiveCard = () => {
    if (activeCard.isOrganizationDefault) {
      onNotification('Cannot archive the organization default rate card.');
      return;
    }
    updateActiveCard('status', 'archived');
    onNotification(`Archived rate card "${activeCard.name}".`);
  };

  return (
    <div className="space-y-6">
      {/* Top Selector and Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-600" />
            Rate Cards & Transport Pricing
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure base dispatch charges, distance mileage, travel basis, minimum floor charges, and fuel indexation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Rate Card Selector */}
          <select
            value={selectedCardId}
            onChange={(e) => setSelectedCardId(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg shadow-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-800"
          >
            {settings.rateCards.map((rc) => (
              <option key={rc.id} value={rc.id}>
                {rc.name} (v{rc.version} - {rc.status}) {rc.isOrganizationDefault ? '★ Default' : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleDuplicateCard}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg shadow-xs hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            Duplicate
          </button>

          {activeCard.status === 'draft' ? (
            <button
              type="button"
              onClick={handlePublishCard}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg shadow-xs hover:bg-blue-700 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Publish Rate Card
            </button>
          ) : (
            <span className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Published Active
            </span>
          )}

          {!activeCard.isOrganizationDefault && activeCard.status !== 'archived' && (
            <button
              type="button"
              onClick={handleArchiveCard}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:text-red-600 hover:border-red-200 flex items-center gap-1.5"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </button>
          )}
        </div>
      </div>

      {/* Main Rate Card Editor Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-6">
        {/* Header Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Rate Card Name</label>
            <input
              type="text"
              value={activeCard.name}
              onChange={(e) => updateActiveCard('name', e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Base Pricing Method</label>
            <select
              value={activeCard.pricingMethod}
              onChange={(e) => updateActiveCard('pricingMethod', e.target.value as BasePricingMethod)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 text-slate-900 bg-white"
            >
              <option value="distance_based">Base Fee + Road Distance (per km)</option>
              <option value="whole_trip">Whole-Trip Route Basis</option>
              <option value="hourly">Hourly Rate Basis</option>
              <option value="fixed_delivery">Flat Fee per Delivery</option>
              <option value="zone_to_zone">Zone-to-Zone Matrix</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Currency & Effective Date</label>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1.5 text-xs font-mono font-medium rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                {activeCard.currency}
              </span>
              <input
                type="date"
                value={activeCard.effectiveFrom}
                onChange={(e) => updateActiveCard('effectiveFrom', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Primary Pricing Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Base Dispatch Fee
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-mono">$</span>
              <input
                type="number"
                step="0.50"
                min="0"
                value={activeCard.baseFee}
                onChange={(e) => updateActiveCard('baseFee', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-sm font-semibold border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 text-slate-900 bg-white text-right font-mono"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Starting charge per dispatched job</p>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Included Distance (km)
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.5"
                min="0"
                value={activeCard.baseFeeIncludesKm}
                onChange={(e) => updateActiveCard('baseFeeIncludesKm', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-sm font-semibold border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 text-slate-900 bg-white text-right font-mono"
              />
              <span className="text-xs text-slate-500 font-medium">km</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">First {activeCard.baseFeeIncludesKm} km included in base</p>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Additional Rate per Km
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-mono">$</span>
              <input
                type="number"
                step="0.05"
                min="0"
                value={activeCard.additionalKmRate}
                onChange={(e) => updateActiveCard('additionalKmRate', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-sm font-semibold border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 text-slate-900 bg-white text-right font-mono"
              />
              <span className="text-xs text-slate-500 font-medium">/km</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Rate applied after included distance</p>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Minimum Charge Floor
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-mono">$</span>
              <input
                type="number"
                step="1.00"
                min="0"
                value={activeCard.minimumCharge}
                onChange={(e) => updateActiveCard('minimumCharge', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-sm font-semibold border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 text-slate-900 bg-white text-right font-mono"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Absolute minimum invoice floor</p>
          </div>
        </div>

        {/* Fuel Surcharge Section */}
        <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-semibold text-slate-900">Weekly Variable Fuel Indexation</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={activeCard.fuelSurchargeEnabled}
                onChange={(e) => updateActiveCard('fuelSurchargeEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>

          {activeCard.fuelSurchargeEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Fuel Index Percentage (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={activeCard.fuelSurchargePercentage}
                    onChange={(e) =>
                      updateActiveCard('fuelSurchargePercentage', parseFloat(e.target.value) || 0)
                    }
                    className="w-28 px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-right font-mono text-slate-900"
                  />
                  <span className="text-xs font-semibold text-slate-700">%</span>
                  <span className="text-[11px] text-slate-500">(Adjusts with BC Diesel Index)</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Calculation Basis
                </label>
                <select
                  value={activeCard.fuelSurchargeBasis}
                  onChange={(e) => updateActiveCard('fuelSurchargeBasis', e.target.value as any)}
                  className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                >
                  <option value="transport_only">Transportation Fare Only (Base + Distance)</option>
                  <option value="transport_and_handling">Transport + Handling Level Total</option>
                  <option value="net_subtotal">Full Net Subtotal Before Taxes</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Advanced Settings (Distance basis, return travel, hourly rounding) */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Route & Travel Parameters</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Route Distance Basis
                  </label>
                  <select
                    value={activeCard.distanceBasis}
                    onChange={(e) => updateActiveCard('distanceBasis', e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                  >
                    <option value="individual_delivery">Individual Delivery Journey</option>
                    <option value="whole_trip">Dedicated Whole Multi-Stop Trip</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Approach Travel (Depot to Pickup)
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="approachTravel"
                      checked={activeCard.includeApproachTravel}
                      onChange={(e) => updateActiveCard('includeApproachTravel', e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <label htmlFor="approachTravel" className="text-xs text-slate-600">
                      Include deadhead approach in billable km
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Return to Depot Travel
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="returnDepot"
                      checked={activeCard.includeReturnDepotTravel}
                      onChange={(e) => updateActiveCard('includeReturnDepotTravel', e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <label htmlFor="returnDepot" className="text-xs text-slate-600">
                      Bill return travel back to origin depot
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
