import React, { useState } from 'react';
import {
  Zap,
  Clock,
  Shield,
  Plus,
  Edit2,
  Check,
  AlertCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { OrganizationPricingSettings, ServiceSpeed, HandlingLevel } from '../../types/pricing';

interface ServicesSectionProps {
  settings: OrganizationPricingSettings;
  onUpdateSettings: (updater: (prev: OrganizationPricingSettings) => OrganizationPricingSettings) => void;
  onNotification: (msg: string) => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({
  settings,
  onUpdateSettings,
  onNotification
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'speeds' | 'handling'>('speeds');
  const [editingSpeedId, setEditingSpeedId] = useState<string | null>(null);

  const toggleSpeedActive = (speedId: string) => {
    onUpdateSettings((prev) => ({
      ...prev,
      serviceSpeeds: prev.serviceSpeeds.map((s) =>
        s.id === speedId ? { ...s, active: !s.active } : s
      )
    }));
    onNotification('Service speed availability updated.');
  };

  const toggleExclusiveVehicle = (speedId: string) => {
    onUpdateSettings((prev) => ({
      ...prev,
      serviceSpeeds: prev.serviceSpeeds.map((s) =>
        s.id === speedId ? { ...s, exclusiveVehicle: !s.exclusiveVehicle } : s
      )
    }));
    onNotification('Direct exclusive vehicle dispatch rule updated.');
  };

  const updateHandlingValue = (levelId: string, value: number) => {
    onUpdateSettings((prev) => ({
      ...prev,
      handlingLevels: prev.handlingLevels.map((h) =>
        h.id === levelId ? { ...h, premiumValue: Math.max(0, value) } : h
      )
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Explanation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-600" />
            Service Speeds & Handling Levels
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Service speed controls transit urgency and routing exclusivity; handling level controls cargo custody, physical placement, and stair eligibility.
          </p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 shadow-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('speeds')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeSubTab === 'speeds'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Service Speeds ({settings.serviceSpeeds.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('handling')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeSubTab === 'handling'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Handling Levels ({settings.handlingLevels.length})
          </button>
        </div>
      </div>

      {/* SERVICE SPEEDS SUBTAB */}
      {activeSubTab === 'speeds' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settings.serviceSpeeds.map((speed) => (
              <div
                key={speed.id}
                className={`p-4 rounded-xl border transition-all ${
                  speed.active
                    ? 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                    : 'bg-slate-50/70 border-slate-200/60 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{speed.name}</h3>
                      <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        {speed.code}
                      </span>
                      {speed.exclusiveVehicle && (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Exclusive Vehicle
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{speed.description}</p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={speed.active}
                      onChange={() => toggleSpeedActive(speed.id)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                  </label>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Booking Cutoff</span>
                    <span className="font-medium text-slate-700">{speed.bookingCutoffTime} PST</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Transit Window</span>
                    <span className="font-medium text-slate-700">
                      {speed.deadlineRule.durationHours}h from {speed.deadlineRule.startsAt}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Active Days</span>
                    <span className="font-medium text-slate-700">
                      {speed.operatingHours.days.slice(0, 5).join(', ')}
                    </span>
                  </div>
                </div>

                {/* Exclusive Vehicle Rule for Direct */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span>Exclusive Vehicle (No unrelated stops)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleExclusiveVehicle(speed.id)}
                    className={`text-xs font-medium px-2 py-0.5 rounded transition-colors ${
                      speed.exclusiveVehicle
                        ? 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                        : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    {speed.exclusiveVehicle ? 'Enforced' : 'Allow Batching'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HANDLING LEVELS SUBTAB */}
      {activeSubTab === 'handling' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Handling Tier & Custody Definition
              </span>
              <span className="text-xs text-slate-400">
                Currency: {settings.defaultCurrency}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {settings.handlingLevels.map((level) => (
                <div key={level.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-lg">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">{level.name}</h4>
                      {level.stairEligible ? (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Stair Carry Eligible
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                          Curbside / No Upstairs
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{level.description}</p>
                    <p className="text-[11px] text-slate-400">
                      Applies to: <span className="font-mono text-slate-600">{level.appliesTo.replace(/_/g, ' ')}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-end">
                      <label className="text-[11px] text-slate-400 font-medium mb-1">
                        Handling Surcharge ({level.premiumType === 'percentage' ? '%' : settings.defaultCurrency})
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">
                          {level.premiumType === 'percentage' ? '+' : '$'}
                        </span>
                        <input
                          type="number"
                          step={level.premiumType === 'percentage' ? '1' : '0.50'}
                          min="0"
                          value={level.premiumValue}
                          onChange={(e) => updateHandlingValue(level.id, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2.5 py-1 text-xs text-right border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono text-slate-900"
                        />
                        {level.premiumType === 'percentage' && (
                          <span className="text-xs text-slate-500">%</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
