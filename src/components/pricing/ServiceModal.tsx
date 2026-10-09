import { loadBillingConfig } from '../../lib/billingStorage';
import { Button } from '../ui/button';
import { Dialog, DialogHeader } from '../ui/Dialog';
import React, { useEffect, useState } from 'react';
import { DeliveryService } from '../../types/simplePricing';
import { useEntityDialog } from '../entities/useEntityDialog';
import { fieldClass, labelClass } from '../settings/BillingFields';

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
  useEntityDialog(isOpen, onClose);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [charge, setCharge] = useState('0');
  const currency = loadBillingConfig().quoteSettings.currency;

  useEffect(() => {
    if (initialService) {
      setName(initialService.name);
      setDescription(initialService.description);
      setCharge(initialService.additionalCharge == null ? '' : String(initialService.additionalCharge));
    } else {
      setName('');
      setDescription('');
      setCharge('0');
    }
  }, [initialService, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const additionalCharge = Number(charge);
    if (!name.trim() || !charge.trim() || !Number.isFinite(additionalCharge) || additionalCharge < 0 || Math.abs(additionalCharge * 100 - Math.round(additionalCharge * 100)) > 0.000001) return;

    const service: DeliveryService = {
      ...initialService,
      id: initialService?.id || `srv_${Date.now()}`,
      code: initialService?.code || name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 24),
      name: name.trim(),
      description: description.trim(),
      additionalCharge,
      defaultMultiplier: initialService?.defaultMultiplier ?? 1,
      exclusiveVehicle: initialService?.exclusiveVehicle ?? false,
      active: initialService?.active ?? true
    };

    onSave(service);
    onClose();
  };

  return (
    <Dialog size="form" onClose={onClose}>
      <DialogHeader onClose={onClose} closeLabel="Close service form" title={initialService ? 'Edit Delivery Service' : 'Add New Delivery Service'} description="Service details and a fixed charge per order." />
        <form onSubmit={handleSubmit} className="app-dialog-body space-y-5">
          <div>
            <label htmlFor="service-name" className={labelClass}>Service Name <span className="text-rose-500">*</span></label>
            <input id="service-name" aria-label="Service name" type="text" required value={name} onChange={event => setName(event.target.value)} placeholder="e.g., Rush Delivery" className={fieldClass} />
          </div>

          <div>
            <label htmlFor="service-charge" className={labelClass}>Additional charge ({currency})</label>
            <input id="service-charge" type="number" min="0" step="0.01" required value={charge} onChange={event => setCharge(event.target.value)} aria-describedby="service-charge-help" placeholder="Set charge" className={fieldClass} />
            <p id="service-charge-help" className="text-xs text-slate-500 mt-1">Added once per order to every rate card. Enter 0 for no additional charge.</p>
            {initialService && initialService.additionalCharge == null && <p role="status" className="text-xs text-amber-700 mt-1">Set a fixed amount to replace the previous multiplier before pricing new orders.</p>}
          </div>

          <div>
            <label htmlFor="service-description" className={labelClass}>Description</label>
            <textarea id="service-description" aria-label="Description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe this service..."
              className={`${fieldClass} resize-none`}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="submit"
              className="app-action app-primary px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-full shadow-xs transition-colors"
            >
              {initialService ? 'Save Changes' : 'Create Service'}
            </Button>
          </div>
        </form>
    </Dialog>
  );
};
