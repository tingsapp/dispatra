import { ListSummary } from '../components/layout/ListSummary';
import { Button } from '../components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../components/ui/Dialog';
import { DiscountEditor } from '../components/pricing/RateCardFields';
import { FormSection, ReadFields } from '../components/entities/Fields';
import {
Truck,
Package,
CirclePause,
Building2,
Edit2,
ExternalLink,
Plus,
Trash2
} from 'lucide-react';
import React,{ useMemo,useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { companySlugForCurrentPath } from '../lib/pageRoutes';
import { allOperations, operations } from '../operations/api';
import { customerToShipper, shipperToCustomer } from '../operations/adapters';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { PageHeader } from '../components/layout/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { AddressAutocomplete, type SelectedAddress } from '../components/ui/AddressAutocomplete';
import { Select } from '../components/ui/Select';
import { validateCustomer } from '../domain/validation';
import { confirmDialog } from '../components/ui/ConfirmDialog';
import { Customer,EMPTY_PRICING_RELATIONSHIP,loadCustomers,normalizeCustomer,saveCustomers } from '../lib/customerStorage';
import { Switch } from '../components/ui/Switch';
import { loadPricingConfig } from '../lib/pricingStorage';
import { Job } from '../types';
import { ContactInput } from '../components/ui/ContactInput';
import { formatPhone } from '../lib/phone';

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
  const slug = companySlugForCurrentPath();
  const queryClient = useQueryClient();
  const shipperQuery = useQuery({ queryKey: ['operations', slug, 'shippers'], queryFn: () => allOperations.shippers(slug!), enabled: !!slug });
  const ratesQuery = useQuery({ queryKey: ['operations', slug, 'rates'], queryFn: () => allOperations.rates(slug!), enabled: !!slug });
  const [localCustomers, setCustomers] = useState<Customer[]>(() => slug ? [] : loadCustomers());
  const customers = slug ? (shipperQuery.data ?? []).map(shipperToCustomer) : localCustomers;
  const [warehouseCoordinates, setWarehouseCoordinates] = useState<SelectedAddress | undefined>();
  const [initialCredential, setInitialCredential] = useState<{ name: string; email: string; password: string } | null>(null);
  // Pricing lookups for the relationship section — read-only here, edited under Organization Settings.
  const [pricing] = useState(() => loadPricingConfig());
  const customerCards = slug ? (ratesQuery.data ?? []).filter(c => c.active).map(c => ({ id: c.id, name: c.data.name })) : pricing.rateCards.filter(c => c.status === 'ACTIVE');
  // Imported cards price only orders that carry an external price, so they cannot be attached to a shipper yet.
  const importedCardIds = new Set(slug ? (ratesQuery.data ?? []).filter(c => c.data.method === 'IMPORTED').map(c => c.id) : pricing.rateCards.filter(c => c.pricingMethod === 'IMPORTED').map(c => c.id));
  const defaultCard = slug ? customerCards.find(c => c.id === ratesQuery.data?.find(r => r.active && r.is_default)?.id) : pricing.rateCards.find(c => c.status === 'ACTIVE' && c.scope === 'ORGANIZATION');
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
    city: '',
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
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) || [...(c.tags ?? []), ...(c.addresses ?? []).map(a => a.address)].join(' ').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [customers, searchQuery, statusFilter]);

  const activeOrderCount = (id: string) => jobs.filter(j => j.customerId === id && j.status !== 'completed').length;
  const persistCustomers = (next: Customer[]) => { try { const normalized = next.map(normalizeCustomer); saveCustomers(normalized); setCustomers(normalized); return true; } catch { onNotification?.('Shipper changes could not be saved in this browser.'); return false; } };

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
    setWarehouseCoordinates(undefined);
    setFormData({
      name: '',
      customerType: 'BUSINESS',
      legalName: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
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
    setWarehouseCoordinates(undefined);
    setFormData({ ...c, city: '' });
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      onNotification?.('Shipper name is required.');
      return;
    }

    const legalName = formData.customerType === 'INDIVIDUAL' ? formData.name.trim() : formData.legalName?.trim() ?? '';
    if (formData.customerType !== 'INDIVIDUAL' && !legalName) { onNotification?.('Company name is required.'); return; }
    if (slug) {
      try {
        const previous = editingCustomer ? shipperQuery.data?.find(row => row.id === editingCustomer.id) : undefined;
        const input = customerToShipper({ ...formData, legalName }, previous, warehouseCoordinates);
        const saved = previous
          ? await operations.updateShipper(slug, previous, input, formData.status === 'On Hold' ? 'ON_HOLD' : formData.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE')
          : await operations.createShipper(slug, input);
        await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'shippers'] });
        setIsModalOpen(false);
        if (saved.initial_password) setInitialCredential({ name: saved.name, email: saved.email, password: saved.initial_password });
        else onNotification?.(`Saved shipper "${saved.name}".`);
      } catch (error) { onNotification?.(error instanceof Error ? error.message : 'Could not save shipper.'); }
      return;
    }

    // The account code is assigned in the background; the API will own it later.
    const code = formData.code || editingCustomer?.code || `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
    const contactName = formData.customerType === 'INDIVIDUAL' ? formData.name.trim()
      : editingCustomer?.contactName && editingCustomer.contactName !== editingCustomer.name ? editingCustomer.contactName : formData.name.trim();
    const errors = validateCustomer({ ...formData, code }, customers, editingCustomer?.id);
    if (errors.length) { onNotification?.(errors.join(" ").replace(/Customer/g, "Shipper")); return; }
    if (editingCustomer) {
      // Update
      const updated = customers.map((c) =>
        c.id === editingCustomer.id
          ? ({
              ...c,
              ...formData,
              updatedAt: new Date().toISOString(),
              name: formData.name!.trim(),
              legalName,
              contactName,
              code
            } as Customer)
          : c
      );
      if (!persistCustomers(updated)) return;
      onNotification?.(`Updated shipper "${formData.name}".`);
    } else {
      // Add
      const newCustomer: Customer = {
        ...formData,
        updatedAt: new Date().toISOString(),
        id: `cust-${Date.now()}`,
        code,
        name: formData.name!.trim(),
        legalName,
        contactName,
        email: formData.email || '',
        phone: formData.phone || '',
        address: formData.address || '',
        city: '',
        accountType: formData.accountType as any || 'Standard Freight',
        status: formData.status as any || 'Active',
        defaultRequirements: formData.defaultRequirements || [],
        billingEmail: '',
        rateCardId: formData.rateCardId ?? defaultCard?.id ?? null,
        discount: formData.discount ?? EMPTY_PRICING_RELATIONSHIP.discount,
        taxProfileId: formData.taxProfileId ?? null,
        taxExempt: !!formData.taxExempt,
        totalShipments: 0,
        activeJobsCount: 0,
        notes: formData.notes || '',
        createdAt: new Date().toISOString().split('T')[0]
      };
      const updated = [newCustomer, ...customers];
      if (!persistCustomers(updated)) return;
      onNotification?.(`Added shipper "${newCustomer.name}".`);
    }

    setIsModalOpen(false);
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    const linked = jobs.filter(j => j.customerId === id).length;
    if (!(await confirmDialog({ title: `Delete shipper "${name}"?`, message: linked ? `${linked} order${linked === 1 ? '' : 's'} reference this shipper; they keep their saved details but lose the link. This cannot be undone.` : 'This removes the shipper account and its saved details. This cannot be undone.', confirmLabel: 'Delete shipper', tone: 'danger' }))) return;
    if (slug) {
      const record = shipperQuery.data?.find(row => row.id === id);
      if (!record) return;
      try { await operations.archiveShipper(slug, record); await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'shippers'] }); setSelectedCustomerForView(null); onNotification?.(`Removed shipper "${name}".`); }
      catch (error) { onNotification?.(error instanceof Error ? error.message : 'Could not remove shipper.'); }
      return;
    }
    const updated = customers.filter((c) => c.id !== id);
    if (!persistCustomers(updated)) return;
    if (selectedCustomerForView?.id === id) {
      setSelectedCustomerForView(null);
    }
    onNotification?.(`Removed shipper "${name}".`);
  };

  useEntityDialog(!!selectedCustomerForView || isModalOpen, () => { setSelectedCustomerForView(null); setIsModalOpen(false); });

  return (
    <div className="app-page app-list-page h-full w-full flex flex-col overflow-hidden font-sans">
      {/* HEADER BAR */}
      <PageHeader title="Shippers" description="Shipper accounts, contacts and the rate card each one is priced on." actions={<>
          <Button
            type="button"
            onClick={handleOpenAddModal}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Shipper</span>
          </Button>
      </>} />

      {/* BODY CONTENT */}
      <div className="page-content flex-1 overflow-y-auto py-6 space-y-6">
        {slug && shipperQuery.isPending && <p role="status" className="text-sm text-slate-500">Loading shippers…</p>}
        {slug && shipperQuery.error && <p role="alert" className="text-sm text-rose-700">{shipperQuery.error.message}</p>}
        <ListSummary label="Shippers summary" items={[
          { label: 'Total', value: stats.total, icon: Building2 },
          { label: 'With active orders', value: stats.activeWithJobs, icon: Truck },
          { label: 'Active orders', value: stats.totalActiveJobs, icon: Package },
          { label: 'On hold', value: stats.onHold, icon: CirclePause },
        ]} />

        {/* SEARCH & FILTERS BAR */}
        <div className="app-list-toolbar">
          <SearchInput className="app-list-search"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search shippers by name, contact, address, or email..."
          />

          <div className="app-list-filters">
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as any)}
              align="end"
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'Active', label: 'Active' },
                { value: 'On Hold', label: 'On hold' }, { value: 'Inactive', label: 'Inactive' }
              ]}
            />
          </div>
        </div>

        {/* SHIPPERS TABLE */}
        <div className="app-table-shell overflow-hidden">
          <div className="overflow-x-auto">
            <table aria-label="Shippers" className="app-table w-full text-left">
              <thead>
                <tr>
                  <th scope="col">Shipper</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Address</th>
                  <th scope="col">Rate card</th>
                  <th scope="col" className="text-center">Active orders</th>
                  <th scope="col" className="text-center">Status</th>
                  <th scope="col" className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium">No shippers found matching your criteria</p>
                      <p className="text-xs mt-1 text-slate-400">Try adjusting your search query or filters</p>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedCustomerForView(customer)}
                    >
                      {/* Customer Name & Code */}
                      <td>
                        <div className="flex items-center gap-3">
                          <div aria-hidden="true" className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-medium text-xs flex items-center justify-center shrink-0">
                            {customer.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <button type="button" className="text-left font-medium text-slate-900 hover:underline" onClick={event => { event.stopPropagation(); setSelectedCustomerForView(customer); }}>
                              {customer.name}
                            </button>
                            <div className="text-xs text-slate-500">
                              {customer.customerType === 'INDIVIDUAL' ? 'Individual' : customer.legalName && customer.legalName !== customer.name ? customer.legalName : 'Business'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td>
                        {customer.contactName && customer.contactName !== customer.name && <div className="font-medium text-slate-900">{customer.contactName}</div>}
                        <div className="text-xs text-slate-500 whitespace-nowrap mt-0.5">{formatPhone(customer.phone)}</div>
                      </td>

                      {/* Address */}
                      <td>
                        <span className="block max-w-xs truncate" title={customer.address}>{customer.address}</span>
                      </td>

                      {/* Rate card */}
                      <td>
                        {cardName(customer.rateCardId) ?? `${defaultCardName} (Default)`}
                      </td>

                      {/* Active Orders */}
                      <td className="text-center tabular-nums">
                        {activeOrderCount(customer.id) > 0 ? activeOrderCount(customer.id) : <span className="text-slate-400">—</span>}
                      </td>

                      {/* Status */}
                      <td className="text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            customer.status === 'Preferred'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : customer.status === 'Active'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : customer.status === 'On Hold'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {customer.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(customer)}
                            className="app-icon-button"
                            title="Edit shipper account"
                            aria-label={`Edit ${customer.name}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                            className="app-icon-button"
                            title="Delete shipper account"
                            aria-label={`Delete ${customer.name}`}
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

      {/* SHIPPER DETAILS DIALOG */}
      {selectedCustomerForView && (
        <Dialog size="md" onClose={() => setSelectedCustomerForView(null)}>
          <DialogHeader onClose={() => setSelectedCustomerForView(null)}
            leading={<div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-medium text-sm flex items-center justify-center shrink-0">{selectedCustomerForView.name.substring(0, 2).toUpperCase()}</div>}
            title={selectedCustomerForView.name} description={<span className="font-mono">{selectedCustomerForView.code}</span>} />
          <DialogBody className="app-sections">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                selectedCustomerForView.status === 'Preferred'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : selectedCustomerForView.status === 'Active'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : selectedCustomerForView.status === 'On Hold'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {selectedCustomerForView.status}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                {selectedCustomerForView.customerType === 'INDIVIDUAL' ? 'Individual' : 'Business'}
              </span>
            </div>

            <section className="space-y-3" aria-label="Order history">
              <h4 className="app-section-title">Order history</h4>
              {jobs.filter(j => j.customerId === selectedCustomerForView.id).length === 0 && <p className="text-sm text-slate-500">No linked orders yet.</p>}
              <div className="flex flex-col items-start gap-2">
                {jobs.filter(j => j.customerId === selectedCustomerForView.id).map(j => (
                  <Button key={j.id} type="button" variant="link" className="h-auto justify-start whitespace-normal p-0 text-left" onClick={() => onSelectJob?.(j.jobNumber)}>
                    {j.jobNumber} · {j.statusLabel}
                  </Button>
                ))}
              </div>
            </section>

            <section className="space-y-3" aria-label="Contact information">
              <h4 className="app-section-title">Contact information</h4>
              <ReadFields values={{
                ...(selectedCustomerForView.customerType !== 'INDIVIDUAL' && selectedCustomerForView.legalName ? { 'Company name': selectedCustomerForView.legalName } : {}),
                ...(selectedCustomerForView.contactName && selectedCustomerForView.contactName !== selectedCustomerForView.name ? { 'Primary contact': selectedCustomerForView.contactName } : {}),
                Phone: <a href={`tel:${selectedCustomerForView.phone}`} className="hover:underline">{formatPhone(selectedCustomerForView.phone)}</a>,
                Email: <a href={`mailto:${selectedCustomerForView.email}`} className="hover:underline">{selectedCustomerForView.email}</a>,
                'Primary facility address': selectedCustomerForView.address,
              }} />
            </section>

            <section className="space-y-3" aria-label="Pricing relationship">
              <h4 className="app-section-title">Pricing relationship</h4>
              <ReadFields values={{ 'Rate card': cardName(selectedCustomerForView.rateCardId) ?? `Default (${defaultCardName})` }} />
            </section>

            {selectedCustomerForView.notes && (
              <section className="space-y-3" aria-label="Dispatch & receiving notes">
                <h4 className="app-section-title">Dispatch & receiving notes</h4>
                <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{selectedCustomerForView.notes}</p>
              </section>
            )}

            <ListSummary label="Shipper order summary" items={[
              { label: 'Total volume', value: `${jobs.filter(j => j.customerId === selectedCustomerForView.id).length} orders`, icon: Package },
              { label: 'Active on road', value: `${activeOrderCount(selectedCustomerForView.id)} orders`, icon: Truck },
            ]} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { handleOpenEditModal(selectedCustomerForView); setSelectedCustomerForView(null); }}><Edit2 /> Edit Account</Button>
            <Button type="button" onClick={() => { onBackToMonitor(); onNotification?.(`Returning to Monitor filtered by ${selectedCustomerForView.name}`); }}><ExternalLink /> View on Map</Button>
          </DialogFooter>
        </Dialog>
      )}

      {initialCredential && <Dialog size="md" onClose={() => setInitialCredential(null)}><DialogHeader title="Shipper account created" onClose={() => setInitialCredential(null)} /><DialogBody className="space-y-3 text-sm"><p>Give these login details to {initialCredential.name}. The password is shown only once.</p><p><strong>Email:</strong> {initialCredential.email}</p><p><strong>Initial password:</strong> <code>{initialCredential.password}</code></p></DialogBody><DialogFooter><Button type="button" onClick={() => setInitialCredential(null)}>Done</Button></DialogFooter></Dialog>}

      {/* ADD / EDIT SHIPPER MODAL */}
      {isModalOpen && (
        <Dialog size="form" onClose={() => setIsModalOpen(false)}>
          <DialogHeader onClose={() => setIsModalOpen(false)} title={editingCustomer ? 'Edit Shipper' : 'New Shipper'} />
          <DialogBody>
            <form id="shipper-form" onSubmit={handleSaveCustomer} className="space-y-6">
              <FormSection title="Shipper">
                <label className="block"><span className="app-label">Shipper name</span><input type="text" required placeholder="e.g. Alex Morgan" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="app-input w-full" /></label>
                <div><span className="app-label">Shipper type</span><Select aria-label="Shipper type" className="w-full" value={formData.customerType ?? 'BUSINESS'} onValueChange={(v) => setFormData({ ...formData, customerType: v as Customer['customerType'] })} options={[{ value: 'BUSINESS', label: 'Business' }, { value: 'INDIVIDUAL', label: 'Individual' }]} /></div>
                {formData.customerType !== 'INDIVIDUAL' && <label className="block sm:col-span-2"><span className="app-label">Company name</span><input type="text" required placeholder="e.g. Pacific Fresh Logistics" value={formData.legalName || ''} onChange={(e) => setFormData({ ...formData, legalName: e.target.value })} className="app-input w-full" /></label>}
                <label className="block"><span className="app-label">Phone</span><ContactInput type="tel" placeholder="(604) 555-0100" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="app-input w-full" /></label>
                <label className="block"><span className="app-label">Email</span><ContactInput type="email" placeholder="logistics@company.ca" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="app-input w-full" required /><span className="mt-1 block text-xs text-slate-500">Used for portal login, quotes and delivery updates.</span></label>
                <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2"><Switch aria-label="Email order updates" checked={formData.communicationPreferences?.email ?? true} onCheckedChange={email => setFormData({ ...formData, communicationPreferences: { sms: false, tracking: true, ...formData.communicationPreferences, email } })} /> Email order updates to this Shipper</label>
                {editingCustomer && <div><span className="app-label">Status</span><Select aria-label="Shipper status" className="w-full" value={formData.status || 'Active'} onValueChange={(v) => setFormData({ ...formData, status: v as Customer['status'] })} options={[{ value: 'Active', label: 'Active' }, { value: 'On Hold', label: 'On Hold' }, { value: 'Inactive', label: 'Inactive' }]} /></div>}
              </FormSection>

              <FormSection title="Location">
                <div className="sm:col-span-2"><label htmlFor="shipper-warehouse-address" className="app-label">Warehouse Address</label><AddressAutocomplete id="shipper-warehouse-address" aria-label="Warehouse Address" placeholder="e.g. 1420 Derwent Way, Delta, BC V3M 6M7" value={formData.address || ''} includeCoordinates onChange={(address, selected) => { setFormData(current => ({ ...current, address })); setWarehouseCoordinates(selected); }} className="app-input w-full" /><span className="mt-1 block text-xs text-slate-500">Include street, city, province and postal code. Used as the default pickup address.</span></div>
              </FormSection>

              <FormSection title="Billing">
                <div><span className="app-label">Shipper rate card</span><Select aria-label="Shipper rate card" className="w-full" value={formData.rateCardId ?? defaultCard?.id ?? ''} onValueChange={(v) => setFormData({ ...formData, rateCardId: v || null })} options={customerCards.filter(c => !importedCardIds.has(c.id) || c.id === formData.rateCardId).map((c) => ({ value: c.id, label: c.id === defaultCard?.id ? `${c.name} (Default)` : c.name }))} /><span className="mt-1 block text-xs text-slate-500">New orders start on it; dispatch can change it per order.</span></div>
              </FormSection>

              <section aria-label="Discount" className="space-y-3">
                <h4 className="app-section-title">Discount</h4>
                <DiscountEditor value={formData.discount ?? EMPTY_PRICING_RELATIONSHIP.discount} onChange={discount => setFormData({ ...formData, discount })} />
              </section>

              <section className="space-y-3">
                <h4 className="app-section-title">Instructions</h4>
                <label className="block"><span className="app-label">Dispatch & Receiving Instructions</span><textarea rows={3} placeholder="Gate instructions, required paperwork, security clearance..." value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="app-input w-full" /></label>
              </section>
            </form>
          </DialogBody>
          <DialogFooter><Button type="submit" form="shipper-form">{editingCustomer ? 'Save Changes' : 'Create Shipper'}</Button></DialogFooter>
        </Dialog>
      )}
    </div>
  );
};
