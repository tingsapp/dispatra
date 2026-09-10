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
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-y-auto select-none">
      {/* TOP HEADER */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToMonitor}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Monitor</span>
            </button>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-slate-700" />
                  <span>Pricing Simulator</span>
                </h1>
                <span className="text-[11px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200/60">
                  Live Calculator
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulate quote calculations by selecting vehicle class, delivery speed, trip distance, and extra accessorials.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToServices && (
              <button
                type="button"
                onClick={onNavigateToServices}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Services & Accessorials Settings</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetRates}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              title="Reset rates to standard defaults"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN SIMULATOR WORKSPACE */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
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
