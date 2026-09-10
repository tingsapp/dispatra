import React, { useState } from 'react';
import { ArrowLeft, Sliders, RotateCcw, Calculator, Sparkles } from 'lucide-react';
import { loadSimplePricingConfig, resetSimplePricingConfig } from '../lib/simplePricingStorage';
import { SimplePricingConfig } from '../types/simplePricing';
import { SimpleSimulator } from '../components/pricing/SimpleSimulator';

interface PricingSimulatorPageProps {
  onBackToMonitor: () => void;
  onNavigateToServices?: () => void;
  onNotification?: (msg: string) => void;
}

export const PricingSimulatorPage: React.FC<PricingSimulatorPageProps> = ({
  onBackToMonitor,
  onNavigateToServices,
  onNotification
}) => {
  const [config, setConfig] = useState<SimplePricingConfig>(() => loadSimplePricingConfig());
  const [resetKey, setResetKey] = useState<number>(0);

  const handleResetRates = () => {
    const defaults = resetSimplePricingConfig();
    setConfig(defaults);
    setResetKey((prev) => prev + 1);
    onNotification?.('Reset pricing rates, vehicles, and accessorials to default values');
  };

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden font-sans select-none">
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
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight flex items-center gap-2">
                Pricing Simulator
                <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full border border-slate-200">
                  Live Calculator
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight">
                Simulate quote calculations by vehicle class, delivery speed, trip distance, and extra accessorials.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onNavigateToServices && (
            <button
              type="button"
              onClick={onNavigateToServices}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <span>Services & Accessorials</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetRates}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            title="Reset rates to standard defaults"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </header>

      {/* MAIN SIMULATOR WORKSPACE */}
      <main className="flex-1 overflow-y-auto p-6">
        <SimpleSimulator
          key={resetKey}
          services={config.services}
          vehicles={config.vehicles}
          accessorials={config.accessorials}
        />
      </main>
    </div>
  );
};
