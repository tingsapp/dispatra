import { Clock, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { DeliveryService } from '../../types/simplePricing';
import { useEntityDialog } from '../entities/useEntityDialog';
import { TimePicker } from '../ui/TimePicker';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (service: DeliveryService) => void;
  initialService?: DeliveryService | null;
}

const fieldClass =
  'w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400';
const labelClass = 'block text-xs font-medium text-slate-700 mb-1';

export const ServiceModal: React.FC<ServiceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialService
}) => {
  useEntityDialog(isOpen, onClose);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [multiplier, setMultiplier] = useState('1');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [bookingCutoffTime, setBookingCutoffTime] = useState('');
  const [exclusiveVehicle, setExclusiveVehicle] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (initialService) {
      setName(initialService.name);
      setCode(initialService.code);
      setDescription(initialService.description);
      setMultiplier(String(initialService.defaultMultiplier ?? 1));
      setEstimatedTime(initialService.estimatedTime || '');
      setBookingCutoffTime(initialService.bookingCutoffTime || '');
      setExclusiveVehicle(initialService.exclusiveVehicle);
      setActive(initialService.active);
    } else {
      setName('');
      setCode('');
      setDescription('');
      setMultiplier('1');
      setEstimatedTime('Same-Day');
      setBookingCutoffTime('14:00');
      setExclusiveVehicle(false);
      setActive(true);
    }
  }, [initialService, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const defaultMultiplier = Number(multiplier);
    if (!name.trim() || !multiplier.trim() || !Number.isFinite(defaultMultiplier) || defaultMultiplier < 0) return;

    const service: DeliveryService = {
      id: initialService?.id || `srv_${Date.now()}`,
      code: (code.trim() || name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')).slice(0, 24),
      name: name.trim(),
      description: description.trim(),
      defaultMultiplier,
      estimatedTime: estimatedTime.trim() || undefined,
      bookingCutoffTime: bookingCutoffTime.trim() || undefined,
      exclusiveVehicle,
      active
    };

    onSave(service);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div data-entity-dialog className="bg-white max-h-[90vh] overflow-y-auto rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {initialService ? 'Edit Delivery Service' : 'Add New Delivery Service'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Delivery promise, booking requirements and default price multiplier.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="px-6 pt-3 text-xs text-slate-500">Booking cutoffs use the organization timezone for same-day bookings. Delivery promises are descriptive until route feasibility is connected. Exclusive service prevents sharing active work in assignment validation.</p>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>
                Service Name <span className="text-rose-500">*</span>
              </label>
              <input aria-label="Service name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Rush Delivery (2-Hour)"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Code</label>
              <input aria-label="Code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="RUSH_2H"
                className={`${fieldClass} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Booking Cut-off</label>
              <TimePicker
                aria-label="Booking cutoff"
                value={bookingCutoffTime}
                onValueChange={setBookingCutoffTime}
                clearable
              />
              <p className="text-[11px] text-slate-500 mt-1">Latest booking time for same-day fulfilment.</p>
            </div>
          </div>

          <div>
            <label htmlFor="service-multiplier" className={labelClass}>Default price multiplier</label>
            <input id="service-multiplier" type="number" min="0" step="any" required value={multiplier} onChange={event => setMultiplier(event.target.value)} className={fieldClass} />
            <p className="text-[11px] text-slate-500 mt-1">1× keeps freight unchanged; 1.5× increases it by 50%. Applied to the freight of every rate card.</p>
          </div>

          <div>
            <label className={labelClass}>Delivery Promise</label>
            <div className="relative">
              <Clock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input aria-label="Delivery promise"
                type="text"
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(e.target.value)}
                placeholder="e.g., Under 2 Hours, Same-Day by 5 PM"
                className={`${fieldClass} pl-8`}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea aria-label="Description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief details about the dispatch window or promise..."
              className={`${fieldClass} resize-none`}
            />
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="serviceExclusive"
                checked={exclusiveVehicle}
                onChange={(e) => setExclusiveVehicle(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 accent-slate-900 focus:ring-2 focus:ring-slate-900/20 cursor-pointer"
              />
              <label htmlFor="serviceExclusive" className="text-xs font-medium text-slate-700 cursor-pointer">
                Exclusive vehicle — no unrelated stops, batching disabled (Direct)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="serviceActive"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 accent-slate-900 focus:ring-2 focus:ring-slate-900/20 cursor-pointer"
              />
              <label htmlFor="serviceActive" className="text-xs font-medium text-slate-700 cursor-pointer">
                Service is active and available for booking
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
            >
              {initialService ? 'Save Changes' : 'Create Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
