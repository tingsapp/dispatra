import React, { useState, useEffect } from 'react';
import { X, DollarSign, Clock, Navigation } from 'lucide-react';
import { DeliveryService } from '../../types/simplePricing';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (service: DeliveryService) => void;
  initialService?: DeliveryService | null;
}

export const ServiceModal: React.FC<ServiceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialService
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState<number>(20);
  const [includedKm, setIncludedKm] = useState<number>(5);
  const [perKmPrice, setPerKmPrice] = useState<number>(1.5);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (initialService) {
      setName(initialService.name);
      setDescription(initialService.description);
      setBasePrice(initialService.basePrice);
      setIncludedKm(initialService.includedKm);
      setPerKmPrice(initialService.perKmPrice);
      setEstimatedTime(initialService.estimatedTime || '');
      setActive(initialService.active);
    } else {
      setName('');
      setDescription('');
      setBasePrice(25);
      setIncludedKm(5);
      setPerKmPrice(1.5);
      setEstimatedTime('Same-Day');
      setActive(true);
    }
  }, [initialService, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const service: DeliveryService = {
      id: initialService?.id || `srv_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      basePrice: Math.max(0, Number(basePrice) || 0),
      includedKm: Math.max(0, Number(includedKm) || 0),
      perKmPrice: Math.max(0, Number(perKmPrice) || 0),
      estimatedTime: estimatedTime.trim() || undefined,
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
              Define the service speed, base fee, and distance rates.
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
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Service Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Rush Delivery (2-Hour)"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Base Fee ($) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">$</span>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  required
                  value={basePrice}
                  onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm pl-6 pr-2 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Included Km
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={includedKm}
                  onChange={(e) => setIncludedKm(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
                <span className="absolute right-2.5 top-2.5 text-xs text-slate-400">km</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Rate / Km ($) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">$</span>
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  required
                  value={perKmPrice}
                  onChange={(e) => setPerKmPrice(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm pl-6 pr-2 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Estimated Delivery Time
            </label>
            <div className="relative">
              <Clock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(e.target.value)}
                placeholder="e.g., Under 2 Hours, Same-Day by 5 PM"
                className="w-full text-sm pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief details about vehicle exclusivity or dispatch window..."
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
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
