import React, { useState, useEffect } from 'react';
import { X, Clock } from 'lucide-react';
import { DeliveryService } from '../../types/simplePricing';

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
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [defaultMultiplier, setDefaultMultiplier] = useState<number>(1);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [bookingCutoffTime, setBookingCutoffTime] = useState('');
  const [exclusiveVehicle, setExclusiveVehicle] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (initialService) {
      setName(initialService.name);
      setCode(initialService.code);
      setDescription(initialService.description);
      setDefaultMultiplier(initialService.defaultMultiplier);
      setEstimatedTime(initialService.estimatedTime || '');
      setBookingCutoffTime(initialService.bookingCutoffTime || '');
      setExclusiveVehicle(initialService.exclusiveVehicle);
      setActive(initialService.active);
    } else {
      setName('');
      setCode('');
      setDescription('');
      setDefaultMultiplier(1);
      setEstimatedTime('Same-Day');
      setBookingCutoffTime('14:00');
      setExclusiveVehicle(false);
      setActive(true);
    }
  }, [initialService, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const service: DeliveryService = {
      id: initialService?.id || `srv_${Date.now()}`,
      code: (code.trim() || name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')).slice(0, 24),
      name: name.trim(),
      description: description.trim(),
      defaultMultiplier: Math.max(0, Number(defaultMultiplier) || 1),
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
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {initialService ? 'Edit Delivery Service' : 'Add New Delivery Service'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Service speed and its default price multiplier. Base fees and km rates live on Rate Cards.
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>
                Service Name <span className="text-rose-500">*</span>
              </label>
              <input
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
              <input
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
              <label className={labelClass}>
                Default Multiplier <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">×</span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  required
                  value={defaultMultiplier}
                  onChange={(e) => setDefaultMultiplier(parseFloat(e.target.value) || 0)}
                  className={`${fieldClass} pl-6`}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Applied to freight. 1.00 = standard; Direct is typically highest. Rate Cards can override.
              </p>
            </div>

            <div>
              <label className={labelClass}>Booking Cut-off</label>
              <input
                type="time"
                value={bookingCutoffTime}
                onChange={(e) => setBookingCutoffTime(e.target.value)}
                className={fieldClass}
              />
              <p className="text-[11px] text-slate-500 mt-1">Latest booking time for same-day fulfilment.</p>
            </div>
          </div>

          <div>
            <label className={labelClass}>Delivery Promise</label>
            <div className="relative">
              <Clock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
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
            <textarea
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
