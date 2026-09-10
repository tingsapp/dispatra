import React, { useState, useEffect } from 'react';
import { X, DollarSign, Layers } from 'lucide-react';
import { AccessorialItem, AccessorialPricingType } from '../../types/simplePricing';

interface AccessorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (accessorial: AccessorialItem) => void;
  initialAccessorial?: AccessorialItem | null;
}

export const AccessorialModal: React.FC<AccessorialModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialAccessorial
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(15);
  const [pricingType, setPricingType] = useState<AccessorialPricingType>('flat');
  const [unitLabel, setUnitLabel] = useState('flat fee');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (initialAccessorial) {
      setName(initialAccessorial.name);
      setDescription(initialAccessorial.description);
      setPrice(initialAccessorial.price);
      setPricingType(initialAccessorial.pricingType);
      setUnitLabel(initialAccessorial.unitLabel);
      setActive(initialAccessorial.active);
    } else {
      setName('');
      setDescription('');
      setPrice(15);
      setPricingType('flat');
      setUnitLabel('flat fee');
      setActive(true);
    }
  }, [initialAccessorial, isOpen]);

  if (!isOpen) return null;

  const handlePricingTypeChange = (type: AccessorialPricingType) => {
    setPricingType(type);
    if (type === 'flat') {
      setUnitLabel('flat fee');
    } else if (unitLabel === 'flat fee') {
      setUnitLabel('per flight');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const accessorial: AccessorialItem = {
      id: initialAccessorial?.id || `acc_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      price: Math.max(0, Number(price) || 0),
      pricingType,
      unitLabel: unitLabel.trim() || (pricingType === 'flat' ? 'flat fee' : 'per unit'),
      active
    };

    onSave(accessorial);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {initialAccessorial ? 'Edit Accessorial' : 'Add New Accessorial'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Add extra charges such as stairs, two-person crew, wait time, or liftgate.
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
              Accessorial Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Stair Carry, Two-Person Crew, Liftgate"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Pricing Structure
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handlePricingTypeChange('flat')}
                className={`py-2 px-3 text-xs font-medium rounded-lg border text-left transition-colors flex items-center justify-between ${
                  pricingType === 'flat'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span>Flat Fee</span>
                <span className="text-[11px] opacity-75">One-time per job</span>
              </button>

              <button
                type="button"
                onClick={() => handlePricingTypeChange('per_unit')}
                className={`py-2 px-3 text-xs font-medium rounded-lg border text-left transition-colors flex items-center justify-between ${
                  pricingType === 'per_unit'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span>Per Unit / Variable</span>
                <span className="text-[11px] opacity-75">Multiplied by qty</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Rate / Price ($) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">$</span>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  required
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm pl-6 pr-2 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Billing Unit Label
              </label>
              <input
                type="text"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder={pricingType === 'flat' ? 'flat fee' : 'e.g., per flight, per min'}
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description / Application Conditions
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Billed per flight of stairs navigated at pickup or delivery site."
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="accessorialActive"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-slate-900 focus:ring-2 focus:ring-slate-900/20 cursor-pointer"
            />
            <label htmlFor="accessorialActive" className="text-xs font-medium text-slate-700 cursor-pointer">
              Accessorial is active and billable
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
              {initialAccessorial ? 'Save Changes' : 'Create Accessorial'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
