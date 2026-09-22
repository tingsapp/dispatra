import React from 'react';
import { FloatingPanel } from './ui/FloatingPanel';
import { MenuItem, MenuList, MenuSeparator } from './ui/Menu';
import { Switch } from './ui/Switch';
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
  return <div className="absolute bottom-6 right-6 z-30 flex flex-col items-end gap-3 pointer-events-auto select-none">
    <div className="flex flex-col gap-2">
      <FloatingPanel open={showSettingsPopover} onOpenChange={setShowSettingsPopover}
        side="left" align="end" label="Map settings" size="compact" trigger={
          <button type="button" className="app-metric app-map-icon" title="Map Layer Settings">
            <SettingsIcon className="w-4 h-4" />
          </button>
        }>
        <MenuList>
          <MenuItem icon={MapIcon} selected={layerConfig.mode === 'map'} aria-pressed={layerConfig.mode === 'map'}
            onClick={() => { setLayerConfig(prev => ({ ...prev, mode: 'map' })); onActionNotification('Switched to Standard Map view'); }}>Map</MenuItem>
          <MenuItem icon={Globe} selected={layerConfig.mode === 'satellite'} aria-pressed={layerConfig.mode === 'satellite'}
            onClick={() => { setLayerConfig(prev => ({ ...prev, mode: 'satellite' })); onActionNotification('Switched to Satellite imagery view'); }}>Satellite</MenuItem>
          <MenuSeparator />
          {[{ key: 'traffic' as const, label: 'Traffic', icon: Activity }, { key: 'labels' as const, label: 'Labels', icon: Tag }].map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-slate-700">
              <span className="flex items-center gap-3"><Icon size={18} />{label}</span>
              <Switch aria-label={label} checked={layerConfig[key]} onCheckedChange={checked => {
                setLayerConfig(prev => ({ ...prev, [key]: checked }));
                onActionNotification(`${label} layer ${checked ? 'enabled' : 'disabled'}`);
              }} />
            </div>
          ))}
        </MenuList>
      </FloatingPanel>
      <div className="w-11 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
        <button type="button" onClick={onZoomIn} className="w-full h-11 p-0 grid place-items-center text-slate-700 hover:bg-slate-50 transition-colors" title="Zoom In"><Plus size={18} /></button>
        <button type="button" onClick={onZoomOut} className="w-full h-11 p-0 grid place-items-center text-slate-700 hover:bg-slate-50 transition-colors" title="Zoom Out"><Minus size={18} /></button>
      </div>
    </div>
    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-1 mr-1">
      <span>5 km</span><div className="w-16 h-1 border-b-2 border-l-2 border-r-2 border-slate-600" />
    </div>
  </div>;
};
