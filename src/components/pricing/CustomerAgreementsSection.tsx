import React, { useState } from 'react';
import {
  Briefcase,
  Percent,
  CheckCircle2,
  Shield,
  Layers,
  ArrowDown,
  Plus,
  Trash2
} from 'lucide-react';
import { OrganizationPricingSettings, CustomerAgreement } from '../../types/pricing';

interface CustomerAgreementsProps {
  settings: OrganizationPricingSettings;
  onUpdateSettings: (updater: (prev: OrganizationPricingSettings) => OrganizationPricingSettings) => void;
  onNotification: (msg: string) => void;
}

export const CustomerAgreementsSection: React.FC<CustomerAgreementsProps> = ({
  settings,
  onUpdateSettings,
  onNotification
}) => {
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newDiscount, setNewDiscount] = useState(5);

  const handleAddCustomer = () => {
    if (!newCustomerName.trim()) return;
    const newAgreement: CustomerAgreement = {
      customerId: `cust_${Date.now()}`,
      customerName: newCustomerName.trim(),
      contactEmail: `billing@${newCustomerName.toLowerCase().replace(/\s+/g, '')}.ca`,
      activeRateCardId: settings.rateCards[0].id,
      discountPercentage: newDiscount,
      paymentTerms: 'NET30',
      quoteValidityDays: 30,
      requiresPO: false
    };

    onUpdateSettings((prev) => ({
      ...prev,
      customerAgreements: [...prev.customerAgreements, newAgreement]
    }));
    setNewCustomerName('');
    onNotification(`Created contract agreement for ${newAgreement.customerName}.`);
  };

  const handleRemoveCustomer = (customerId: string) => {
    onUpdateSettings((prev) => ({
      ...prev,
      customerAgreements: prev.customerAgreements.filter((c) => c.customerId !== customerId)
    }));
    onNotification('Removed customer agreement.');
  };

  const updateCustomer = (customerId: string, field: keyof CustomerAgreement, value: any) => {
    onUpdateSettings((prev) => ({
      ...prev,
      customerAgreements: prev.customerAgreements.map((c) =>
        c.customerId === customerId ? { ...c, [field]: value } : c
      )
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-blue-600" />
          Customer Agreements & Calculation Rule Precedence
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Attach custom negotiated rate cards or percentage discounts to specific enterprise customer accounts, and inspect the deterministic calculation hierarchy.
        </p>
      </div>

      {/* Deterministic Rule Hierarchy Flowchart / Card */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Layers className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Deterministic Quoting Precedence Hierarchy
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-1">
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-1 relative">
            <span className="text-[10px] font-mono font-bold text-blue-600 uppercase">Priority 1</span>
            <span className="font-semibold text-blue-950 block">Locked Manual Price</span>
            <p className="text-[11px] text-blue-800 leading-tight">
              Explicit manual quote or imported contract price is preserved without automated overwrite.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Priority 2</span>
            <span className="font-semibold text-slate-900 block">Customer Rate Card</span>
            <p className="text-[11px] text-slate-600 leading-tight">
              Uses account-specific rate card and negotiated discount percentage from agreement.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Priority 3</span>
            <span className="font-semibold text-slate-900 block">Organization Default</span>
            <p className="text-[11px] text-slate-600 leading-tight">
              Falls back to active organization default rate card for the requested service speed.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1">
            <span className="text-[10px] font-mono font-bold text-amber-600 uppercase">Priority 4</span>
            <span className="font-semibold text-amber-950 block">Manual Review Required</span>
            <p className="text-[11px] text-amber-800 leading-tight">
              If cargo exceeds safety envelope or no valid rate exists, flags for dispatcher review.
            </p>
          </div>
        </div>
      </div>

      {/* Customer Agreements Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Active Enterprise Accounts ({settings.customerAgreements.length})
          </span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="New customer name..."
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-900"
            />
            <button
              type="button"
              onClick={handleAddCustomer}
              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Customer
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {settings.customerAgreements.map((agreement) => (
            <div key={agreement.customerId} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">{agreement.customerName}</h4>
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-100 text-slate-600 border border-slate-200">
                    {agreement.paymentTerms}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                    {agreement.discountPercentage}% Discount
                  </span>
                </div>
                <p className="text-xs text-slate-500">{agreement.contactEmail}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Assigned Rate Card</label>
                  <select
                    value={agreement.activeRateCardId}
                    onChange={(e) => updateCustomer(agreement.customerId, 'activeRateCardId', e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                  >
                    {settings.rateCards.map((rc) => (
                      <option key={rc.id} value={rc.id}>
                        {rc.name} (v{rc.version})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Contract Discount (%)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="50"
                      value={agreement.discountPercentage}
                      onChange={(e) =>
                        updateCustomer(agreement.customerId, 'discountPercentage', parseFloat(e.target.value) || 0)
                      }
                      className="w-16 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded-lg bg-white text-slate-900"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveCustomer(agreement.customerId)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-50 transition-colors self-end"
                  title="Remove agreement"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
