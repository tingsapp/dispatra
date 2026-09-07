import React from 'react';
import { Settings as SettingsIcon, Plus, Minus, Map as MapIcon, Globe, Activity, Tag } from 'lucide-react';
import { MapLayerConfig } from '../types';

interface MapControlsProps {
  layerConfig: MapLayerConfig;
  setLayerConfig: React.Dispatch<React.SetStateAction<MapLayerConfig>>;
  showSettingsPopover: boolean;
  setShowSettingsPopover: React.Dispatch<React.SetStateAction<boolean>>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onActionNotification: (msg: string) => void;
}

export const MapControls: React.FC<MapControlsProps> = ({
  layerConfig,
  setLayerConfig,
  showSettingsPopover,
  setShowSettingsPopover,
  onZoomIn,
  onZoomOut,
  onActionNotification
}) => {
  return (
    <div className="absolute bottom-6 right-6 z-30 flex flex-col items-end gap-3 pointer-events-auto select-none">
      {/* Settings Popover - opens to the LEFT of the settings button with arrow pointing right */}
      {showSettingsPopover && (
        <div
          className="absolute right-14 bottom-14 w-44 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/90 p-2 z-40 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Directional arrow pointing right directly toward the settings button */}
          <div className="absolute -right-2 bottom-4 w-0 h-0 border-y-[6px] border-y-transparent border-l-[8px] border-l-white drop-shadow-[1px_0_1px_rgba(0,0,0,0.06)] pointer-events-none" />

          <div className="space-y-1 text-xs">
            {/* Map Mode */}
            <button
              onClick={() => {
                setLayerConfig((prev) => ({ ...prev, mode: 'map' }));
                onActionNotification('Switched to Standard Map view');
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors text-left ${
                layerConfig.mode === 'map'
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <MapIcon className="w-4 h-4" />
              <span>Map</span>
            </button>

            {/* Satellite Mode */}
            <button
              onClick={() => {
                setLayerConfig((prev) => ({ ...prev, mode: 'satellite' }));
                onActionNotification('Switched to Satellite imagery view');
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors text-left ${
                layerConfig.mode === 'satellite'
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Satellite</span>
            </button>

            <div className="h-px bg-slate-100 my-1 mx-2" />

            {/* Traffic Toggle */}
            <div className="flex items-center justify-between px-3 py-2 text-slate-700">
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-slate-500" />
                <span className="font-medium">Traffic</span>
              </div>
              <button
                onClick={() => {
                  setLayerConfig((prev) => ({ ...prev, traffic: !prev.traffic }));
                  onActionNotification(`Traffic layer ${layerConfig.traffic ? 'disabled' : 'enabled'}`);
                }}
                className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors ${
                  layerConfig.traffic ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`bg-white w-3.5 h-3.5 rounded-full shadow-sm transform transition-transform ${
                    layerConfig.traffic ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Labels Toggle */}
            <div className="flex items-center justify-between px-3 py-2 text-slate-700">
              <div className="flex items-center gap-2.5">
                <Tag className="w-4 h-4 text-slate-500" />
                <span className="font-medium">Labels</span>
              </div>
              <button
                onClick={() => {
                  setLayerConfig((prev) => ({ ...prev, labels: !prev.labels }));
                  onActionNotification(`Map labels ${layerConfig.labels ? 'hidden' : 'visible'}`);
                }}
                className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors ${
                  layerConfig.labels ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`bg-white w-3.5 h-3.5 rounded-full shadow-sm transform transition-transform ${
                    layerConfig.labels ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons (Settings, Zoom In, Zoom Out) */}
      <div className="flex flex-col gap-2">
        {/* Settings button */}
        <button
          onClick={() => setShowSettingsPopover((prev) => !prev)}
          className={`w-10 h-10 rounded-xl bg-white shadow-md shadow-slate-900/5 border flex items-center justify-center transition-all ${
            showSettingsPopover
              ? 'border-blue-400 text-blue-600 ring-2 ring-blue-100'
              : 'border-slate-200/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
          }`}
          title="Map Layer Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        {/* Zoom In & Zoom Out Group */}
        <div className="bg-white rounded-xl shadow-md shadow-slate-900/5 border border-slate-200/90 overflow-hidden flex flex-col">
          <button
            onClick={onZoomIn}
            className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100"
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={onZoomOut}
            className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors"
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Map Scale indicator (5 km) */}
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 mt-1 mr-1">
        <span>5 km</span>
        <div className="w-16 h-1 border-b-2 border-l-2 border-r-2 border-slate-600" />
      </div>
    </div>
  );
};
