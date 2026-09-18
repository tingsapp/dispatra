import {
AlertTriangle,
Building2,
Edit2,
ExternalLink,
Filter,
MapPin,
Package,
Phone,
Plus,
Trash2,
X
} from 'lucide-react';
import React,{ useMemo,useState } from 'react';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { PageHeader } from '../components/layout/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { validateCustomer } from '../domain/validation';
import { confirmDialog } from '../components/ui/ConfirmDialog';
import { Customer,EMPTY_PRICING_RELATIONSHIP,loadCustomers,saveCustomers } from '../lib/customerStorage';
import { loadPricingConfig } from '../lib/pricingStorage';
import { Job } from '../types';

interface CustomersPageProps {
  jobs?: Job[];
  onBackToMonitor: () => void;
  onNotification?: (msg: string) => void;
  onSelectJob?: (jobNumber: string) => void;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({
  jobs = [],
  onBackToMonitor,
  onNotification,
  onSelectJob
}) => {
  const [customers, setCustomers] = useState<Customer[]>(() => loadCustomers());
  // Pricing lookups for the relationship section — read-only here, edited under Organization Settings.
  const [pricing] = useState(() => loadPricingConfig());
  const customerCards = useMemo(() => pricing.rateCards.filter((c) => c.status === 'ACTIVE'), [pricing.rateCards]);
  const defaultCard = pricing.rateCards.find(c => c.status === 'ACTIVE' && c.scope === 'ORGANIZATION');
  const defaultCardName = defaultCard?.name ?? 'Default';
  // A deleted card no longer names the customer's pricing; the Default applies.
  const cardName = (id: string | null) => customerCards.find((c) => c.id === id)?.name ?? null;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Customer['status']>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerForView, setSelectedCustomerForView] = useState<Customer | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    code: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: 'Vancouver, BC',
    accountType: 'Enterprise',
    status: 'Active',
    defaultRequirements: [],
    notes: '',
    ...EMPTY_PRICING_RELATIONSHIP
  });

  // Filtering
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) || [...(c.tags ?? []), ...(c.addresses ?? []).map(a => a.address)].join(' ').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [customers, searchQuery, statusFilter]);

  const activeOrderCount = (id: string) => jobs.filter(j => j.customerId === id && j.status !== 'completed').length;
  const persistCustomers = (next: Customer[]) => { try { saveCustomers(next); setCustomers(next); return true; } catch { onNotification?.('Customer changes could not be saved in this browser.'); return false; } };

  // Statistics
  const stats = useMemo(() => {
    const total = customers.length;
    const activeWithJobs = customers.filter((c) => activeOrderCount(c.id) > 0).length;
    const totalActiveJobs = customers.reduce((sum, c) => sum + activeOrderCount(c.id), 0);
    const onHold = customers.filter((c) => c.status === 'On Hold').length;
    return { total, activeWithJobs, totalActiveJobs, onHold };
  }, [customers, jobs]);

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      customerType: 'BUSINESS',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      city: 'Vancouver, BC',
      accountType: 'Standard Freight',
      status: 'Active',
      defaultRequirements: [],
      notes: '',
      ...EMPTY_PRICING_RELATIONSHIP
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({ ...c });
    setIsModalOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      onNotification?.('Customer company name is required.');
      return;
    }

    // The account code is assigned in the background; the API will own it later.
    const code = formData.code || editingCustomer?.code || `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
    const errors = validateCustomer({ ...formData, code }, customers, editingCustomer?.id);
    if (errors.length) { onNotification?.(errors.join(" ")); return; }
    if (editingCustomer) {
      // Update
      const updated = customers.map((c) =>
        c.id === editingCustomer.id
          ? ({
              ...c,
              ...formData,
              updatedAt: new Date().toISOString(),
              name: formData.name!.trim(),
              code
            } as Customer)
          : c
      );
      if (!persistCustomers(updated)) return;
      onNotification?.(`Updated customer "${formData.name}".`);
    } else {
      // Add
      const newCustomer: Customer = {
        ...formData,
        updatedAt: new Date().toISOString(),
        id: `cust-${Date.now()}`,
        code,
        name: formData.name!.trim(),
        contactName: formData.contactName || '',
        email: formData.email || '',
        phone: formData.phone || '',
        address: formData.address || '',
        city: formData.city || 'Vancouver, BC',
        accountType: formData.accountType as any || 'Standard Freight',
        status: formData.status as any || 'Active',
        defaultRequirements: formData.defaultRequirements || [],
        billingEmail: formData.billingEmail || '',
        rateCardId: formData.rateCardId ?? defaultCard?.id ?? null,
        discount: EMPTY_PRICING_RELATIONSHIP.discount,
        taxProfileId: formData.taxProfileId ?? null,
        taxExempt: !!formData.taxExempt,
        totalShipments: 0,
        activeJobsCount: 0,
        notes: formData.notes || '',
        createdAt: new Date().toISOString().split('T')[0]
      };
      const updated = [newCustomer, ...customers];
      if (!persistCustomers(updated)) return;
      onNotification?.(`Added customer account "${newCustomer.name}".`);
    }

    setIsModalOpen(false);
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    const linked = jobs.filter(j => j.customerId === id).length;
    if (!(await confirmDialog({ title: `Delete customer "${name}"?`, message: linked ? `${linked} order${linked === 1 ? '' : 's'} reference this customer; they keep their saved details but lose the link. This cannot be undone.` : 'This removes the customer account and its saved details. This cannot be undone.', confirmLabel: 'Delete customer', tone: 'danger' }))) return;
    const updated = customers.filter((c) => c.id !== id);
    if (!persistCustomers(updated)) return;
    if (selectedCustomerForView?.id === id) {
      setSelectedCustomerForView(null);
    }
    onNotification?.(`Removed customer "${name}".`);
  };

  useEntityDialog(!!selectedCustomerForView || isModalOpen, () => { setSelectedCustomerForView(null); setIsModalOpen(false); });

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden font-sans">
      {/* HEADER BAR */}
      <PageHeader title="Customers" description="Customer accounts, contacts and the rate card each one is priced on." onBackToMonitor={onBackToMonitor} actions={<>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Customer</span>
          </button>
      </>} />

      {/* BODY CONTENT */}
      <div className="page-content flex-1 overflow-y-auto py-6 space-y-6">
        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Total Customers</span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="mt-1 text-[11px] text-slate-500">Service-purchasing accounts</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Active in Dispatch</span>
              <Package className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-600">
              {stats.activeWithJobs}{' '}
              <span className="text-xs font-medium text-slate-400">
                ({stats.totalActiveJobs} active orders)
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Orders linked to these accounts</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>On Hold</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">{stats.onHold}</div>
            <div className="mt-1 text-[11px] text-slate-500">Requires audit or prepayment</div>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search customers by name, contact, address, or email..."
          />

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as any)}
              align="end"
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'Active', label: 'Active' },
                { value: 'On Hold', label: 'On Hold' }, { value: 'Inactive', label: 'Inactive' }
              ]}
            />
          </div>
        </div>

        {/* CUSTOMERS TABLE */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-600 tracking-wide uppercase">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4">Rate Card</th>
                  <th className="py-3 px-4 text-center">Active Orders</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium">No customers found matching your criteria</p>
                      <p className="text-[11px] mt-1 text-slate-400">Try adjusting your search query or filters</p>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setSelectedCustomerForView(customer)}
                    >
                      {/* Customer Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200/70 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {customer.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {customer.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {customer.customerType === 'INDIVIDUAL' ? 'Individual' : 'Business'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{customer.contactName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {customer.phone}
                          </span>
                        </div>
                      </td>

                      {/* Address */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 flex items-start gap-1.5 max-w-xs truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="truncate">{customer.address}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 pl-5">{customer.city}</div>
                      </td>

                      {/* Rate card */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {cardName(customer.rateCardId) ?? `${defaultCardName} (Default)`}
                        </span>
                      </td>

                      {/* Active Orders */}
                      <td className="py-3.5 px-4 text-center">
                        {activeOrderCount(customer.id) > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                            {activeOrderCount(customer.id)} active
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                            customer.status === 'Preferred'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : customer.status === 'Active'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {customer.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(customer)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                            title="Edit customer account"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Delete customer account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CUSTOMER DETAILS SLIDE-OVER DRAWER */}
      {selectedCustomerForView && (
        <div data-entity-dialog
          className="fixed inset-0 bg-slate-900/40 z-50 flex justify-end animate-in fade-in duration-150"
          onClick={() => setSelectedCustomerForView(null)}
        >
          <div
            className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/70 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                    {selectedCustomerForView.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 leading-tight">
                      {selectedCustomerForView.name}
                    </h3>
                    <p className="text-xs font-mono text-slate-500">
                      {selectedCustomerForView.code}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomerForView(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status & Tier Badges */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    selectedCustomerForView.status === 'Preferred'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : selectedCustomerForView.status === 'Active'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {selectedCustomerForView.status}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  {selectedCustomerForView.customerType === 'INDIVIDUAL' ? 'Individual' : 'Business'}
                </span>
              </div>

              <div className="p-4 border rounded-xl text-xs space-y-2"><h4 className="font-semibold">Order history</h4>{jobs.filter(j => j.customerId === selectedCustomerForView.id).length === 0 && <p className="text-slate-500">No linked orders yet.</p>}{jobs.filter(j => j.customerId === selectedCustomerForView.id).map(j => <button key={j.id} className="block text-blue-700 text-left" onClick={() => onSelectJob?.(j.jobNumber)}>{j.jobNumber} · {j.statusLabel} · {j.invoicePreview ? 'Invoice preview available' : 'No invoice'}</button>)}</div>
              {/* Contact Information */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                  Contact Information
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Primary Contact:</span>
                    <span className="font-semibold text-slate-900">
                      {selectedCustomerForView.contactName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Phone:</span>
                    <a
                      href={`tel:${selectedCustomerForView.phone}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {selectedCustomerForView.phone}
                    </a>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Email:</span>
                    <a
                      href={`mailto:${selectedCustomerForView.email}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {selectedCustomerForView.email}
                    </a>
                  </div>
                  <div className="pt-2 border-t border-slate-200/70">
                    <div className="text-slate-400 mb-1">Primary Facility Address:</div>
                    <div className="font-medium text-slate-800">
                      {selectedCustomerForView.address}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      {selectedCustomerForView.city}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing relationship */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                  Pricing Relationship
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Rate Card:</span>
                    <span className="font-semibold text-slate-900">
                      {cardName(selectedCustomerForView.rateCardId) ?? `Default (${defaultCardName})`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Billing Email:</span>
                    <span className="font-medium text-slate-900 truncate max-w-[60%]">
                      {selectedCustomerForView.billingEmail || selectedCustomerForView.email}
                    </span>
                  </div>
                </div>
              </div>

              {/* Operational Dispatch Notes */}
              {selectedCustomerForView.notes && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                    Dispatch & Receiving Notes
                  </h4>
                  <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-lg text-xs text-amber-900">
                    {selectedCustomerForView.notes}
                  </div>
                </div>
              )}

              {/* History stats */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
                  <div className="text-[10px] uppercase font-semibold text-slate-400">
                    Total Volume
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {jobs.filter(j => j.customerId === selectedCustomerForView.id).length} orders
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
                  <div className="text-[10px] uppercase font-semibold text-slate-400">
                    Active On Road
                  </div>
                  <div className="text-lg font-bold text-blue-600 mt-0.5">
                    {jobs.filter(j => j.customerId === selectedCustomerForView.id && j.status !== 'completed').length} orders
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  handleOpenEditModal(selectedCustomerForView);
                  setSelectedCustomerForView(null);
                }}
                className="flex-1 py-2 px-3 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                <span>Edit Account</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onBackToMonitor();
                  onNotification?.(`Returning to Monitor filtered by ${selectedCustomerForView.name}`);
                }}
                className="flex-1 py-2 px-3 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View on Map</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT CUSTOMER MODAL */}
      {isModalOpen && (
        <div data-entity-dialog className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingCustomer ? 'Edit Customer Profile' : 'Add New Customer Account'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Company / Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pacific Fresh Logistics"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Customer Type</label>
                  <Select
                    aria-label="Customer type"
                    className="w-full"
                    value={formData.customerType ?? 'BUSINESS'}
                    onValueChange={(v) => setFormData({ ...formData, customerType: v as Customer['customerType'] })}
                    options={[{ value: 'BUSINESS', label: 'Business' }, { value: 'INDIVIDUAL', label: 'Individual' }]}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Elena Rostova"
                    value={formData.contactName || ''}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (604) 555-0100"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Work Email
                  </label>
                  <input
                    type="email"
                    placeholder="logistics@company.ca"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Delivery / Warehouse Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1420 Derwent Way, Annacis Island"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    City / Service Area
                  </label>
                  <input
                    type="text"
                    placeholder="Vancouver, BC"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                </div>

                {editingCustomer && <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Status
                  </label>
                  <Select
                    aria-label="Customer status"
                    className="w-full"
                    value={formData.status || 'Active'}
                    onValueChange={(v) => setFormData({ ...formData, status: v as any })}
                    options={[
                      { value: 'Active', label: 'Active' },
                            { value: 'On Hold', label: 'On Hold' }, { value: 'Inactive', label: 'Inactive' }
                    ]}
                  />
                </div>}
              </div>

              {/* Pricing relationship */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-3">
                <div>
                  <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                    Pricing Relationship
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Sets this customer's prices. New orders start on it; dispatch can change it per order.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Customer Rate Card</label>
                    <Select
                      aria-label="Customer rate card"
                      className="w-full"
                      value={formData.rateCardId ?? defaultCard?.id ?? ''}
                      onValueChange={(v) => setFormData({ ...formData, rateCardId: v || null })}
                      options={customerCards.map((c) => ({ value: c.id, label: c.id === defaultCard?.id ? `${c.name} (Default)` : c.name }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Billing Email</label>
                    <input
                      type="email"
                      placeholder="Defaults to the email above"
                      value={formData.billingEmail || ''}
                      onChange={(e) => setFormData({ ...formData, billingEmail: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Where invoices and quotes are sent.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Dispatch & Receiving Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Gate instructions, required paperwork, security clearance..."
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-2xs transition-colors"
                >
                  {editingCustomer ? 'Save Changes' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
