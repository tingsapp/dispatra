import { Button } from '../ui/button';
import { Dialog, DialogHeader } from '../ui/Dialog';
import React, { useEffect, useState } from 'react';
import { AccessorialItem } from '../../types/simplePricing';
import { useEntityDialog } from '../entities/useEntityDialog';
import { normalizeAccessorial } from '../../lib/simplePricingStorage';

interface AccessorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (accessorial: AccessorialItem) => void;
  initialAccessorial?: AccessorialItem | null;
}

const fieldClass =
  'app-input';
const labelClass = 'app-label';
const hintClass = 'text-xs text-slate-500 mt-1';
const checkboxClass =
  'app-checkbox';

export const AccessorialModal: React.FC<AccessorialModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialAccessorial
}) => {
  useEntityDialog(isOpen, onClose);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [rate, setRate] = useState<number>(15);
  const [taxable, setTaxable] = useState(true);

  useEffect(() => {
    if (initialAccessorial) {
      setName(initialAccessorial.name);
      setCode(initialAccessorial.code);
      setDescription(initialAccessorial.description);
      setRate(initialAccessorial.rate);
      setTaxable(initialAccessorial.taxable);
    } else {
      setName('');
      setCode('');
      setDescription('');
      setRate(15);
      setTaxable(true);
    }
  }, [initialAccessorial, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!Number.isFinite(rate) || rate < 0) return;

    onSave(normalizeAccessorial({
      id: initialAccessorial?.id || `acc_${Date.now()}`,
      code: (code.trim() || name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')).slice(0, 24),
      name: name.trim(),
      description: description.trim(),
      calculationType: 'FLAT',
      rate,
      unitLabel: 'per order',
      freeAllowance: null,
      incrementMinutes: null,
      minimumCharge: null,
      maximumCharge: null,
      appliesAt: 'ORDER',
      fuelEligible: false,
      taxable,
      autoRule: 'NONE',
      active: initialAccessorial?.active ?? true
    }));
    onClose();
  };

  return (
    <Dialog size="form" onClose={onClose}>
      <DialogHeader onClose={onClose} closeLabel="Close Accessorial" title={initialAccessorial ? 'Edit Accessorial' : 'Add New Accessorial'} description="A fixed dollar charge, added once when selected on an order." />
        <form onSubmit={handleSubmit} className="app-dialog-body space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div className="min-w-0">
              <label className={labelClass}>
                Name <span className="text-rose-500">*</span>
              </label>
              <input aria-label="Accessorial name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Stair Carry"
                className={fieldClass}
              />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Rate <span className="text-rose-500">*</span></label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                <input aria-label="Accessorial rate" type="number" step="0.01" min="0" required
                  value={rate} onChange={e => setRate(parseFloat(e.target.value) || 0)}
                  className={`${fieldClass} pl-7`} />
              </div>
              <p className={hintClass}>Once per order.</p>
            </div>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea aria-label="Description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe when this charge should be selected."
              className={`${fieldClass} resize-none`}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={taxable} onChange={e => setTaxable(e.target.checked)} className={checkboxClass} />
            Taxable
          </label>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="submit">{initialAccessorial ? 'Save Changes' : 'Create Accessorial'}</Button>
          </div>
        </form>
    </Dialog>
  );
};
