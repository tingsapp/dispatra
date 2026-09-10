import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  Sparkles,
  ShieldCheck,
  Package,
  Layers,
  Filter
} from 'lucide-react';
import { Customer, loadCustomers, saveCustomers } from '../lib/customerStorage';

interface CustomersPageProps {
  onBackToMonitor: () => void;
  onNotification?: (msg: string) => void;
  onSelectJob?: (jobNumber: string) => void;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({
  onBackToMonitor,
  onNotification,
  onSelectJob
}) => {
  const [customers, setCustomers] = useState<Customer[]>(() => loadCustomers());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Customer['status']>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

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
    notes: ''
  });

  const availableRequirements = [
    'Reefer / Cold Chain',
    'Liftgate Required',
    'Dock Access',
    'Inside Delivery',
    'Signature Required',
    'Pallet Jack',
    'Temperature Controlled',
    'High Value Proof-of-Delivery',
    'Flatbed / Heavy Lift'
  ];

  // Filtering
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
      const matchesType = typeFilter === 'ALL' || c.accountType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [customers, searchQuery, statusFilter, typeFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = customers.length;
    const activeWithJobs = customers.filter((c) => c.activeJobsCount > 0).length;
    const totalActiveJobs = customers.reduce((sum, c) => sum + c.activeJobsCount, 0);
    const preferred = customers.filter((c) => c.status === 'Preferred').length;
    const onHold = customers.filter((c) => c.status === 'On Hold').length;
    return { total, activeWithJobs, totalActiveJobs, preferred, onHold };
  }, [customers]);

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    const nextNum = Math.floor(1000 + Math.random() * 9000);
    setFormData({
      name: '',
      code: `CUST-${nextNum}`,
      contactName: '',
      email: '',
      phone: '',
      address: '',
      city: 'Vancouver, BC',
      accountType: 'Scheduled Contract',
      status: 'Active',
      defaultRequirements: ['Liftgate Required', 'Dock Access'],
      notes: ''
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

    if (editingCustomer) {
      // Update
      const updated = customers.map((c) =>
        c.id === editingCustomer.id
          ? ({
              ...c,
              ...formData,
              name: formData.name!.trim(),
              code: formData.code || c.code
            } as Customer)
          : c
      );
      setCustomers(updated);
      saveCustomers(updated);
      onNotification?.(`Updated customer "${formData.name}".`);
    } else {
      // Add
      const newCustomer: Customer = {
        id: `cust-${Date.now()}`,
        code: formData.code || `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
        name: formData.name!.trim(),
        contactName: formData.contactName || 'Dispatch Contact',
        email: formData.email || 'info@client.ca',
        phone: formData.phone || '+1 (604) 555-0100',
        address: formData.address || 'Metro Vancouver Hub',
        city: formData.city || 'Vancouver, BC',
        accountType: formData.accountType as any || 'Standard Freight',
        status: formData.status as any || 'Active',
        defaultRequirements: formData.defaultRequirements || [],
        totalShipments: 0,
        activeJobsCount: 0,
        notes: formData.notes || '',
        createdAt: new Date().toISOString().split('T')[0]
      };
      const updated = [newCustomer, ...customers];
      setCustomers(updated);
      saveCustomers(updated);
      onNotification?.(`Added customer account "${newCustomer.name}".`);
    }

    setIsModalOpen(false);
  };

  const handleDeleteCustomer = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete customer "${name}"?`)) {
      const updated = customers.filter((c) => c.id !== id);
      setCustomers(updated);
      saveCustomers(updated);
      if (selectedCustomerForView?.id === id) {
        setSelectedCustomerForView(null);
      }
      onNotification?.(`Removed customer "${name}".`);
    }
  };

  const toggleRequirement = (req: string) => {
    setFormData((prev) => {
      const current = prev.defaultRequirements || [];
      if (current.includes(req)) {
        return { ...prev, defaultRequirements: current.filter((r) => r !== req) };
      } else {
        return { ...prev, defaultRequirements: [...current, req] };
      }
    });
  };

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden font-sans">
      {/* HEADER BAR */}
      <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToMonitor}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            title="Return to Monitor Map"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Back to Monitor</span>
          </button>

          <div className="h-4 w-px bg-slate-200" />

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">
                Customers Directory
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight">
                Commercial shipper accounts, origin/delivery addresses, accessorial requirements & dispatch profiles
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Customer</span>
          </button>
        </div>
      </header>

      {/* BODY CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Total Customers</span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="mt-1 text-[11px] text-slate-500">Registered shippers & recipients</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Active in Dispatch</span>
              <Package className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-600">
              {stats.activeWithJobs}{' '}
              <span className="text-xs font-medium text-slate-400">
                ({stats.totalActiveJobs} active jobs)
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Live consignments on the road</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Preferred / SLA</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{stats.preferred}</div>
            <div className="mt-1 text-[11px] text-slate-500">High-priority contracted accounts</div>
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
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search customers by company, code, contact name, address, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-500 font-medium">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-slate-400"
              >
                <option value="ALL">All Account Types</option>
                <option value="Enterprise">Enterprise</option>
                <option value="Scheduled Contract">Scheduled Contract</option>
                <option value="Express / On-Demand">Express / On-Demand</option>
                <option value="Standard Freight">Standard Freight</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-slate-400"
              >
                <option value="ALL">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Preferred">Preferred</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
          </div>
        </div>

        {/* CUSTOMERS TABLE */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-600 tracking-wide uppercase">
                  <th className="py-3 px-4">Customer / Code</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Address / Service Area</th>
                  <th className="py-3 px-4">Contract Tier & Accessorials</th>
                  <th className="py-3 px-4 text-center">Active Jobs</th>
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
                            <div className="text-[11px] font-mono text-slate-400">
                              {customer.code}
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

                      {/* Tier & Accessorials */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {customer.accountType}
                          </span>
                          {customer.defaultRequirements.slice(0, 2).map((req) => (
                            <span
                              key={req}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200/60"
                            >
                              {req}
                            </span>
                          ))}
                          {customer.defaultRequirements.length > 2 && (
                            <span className="text-[10px] text-slate-400">
                              +{customer.defaultRequirements.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Active Jobs */}
                      <td className="py-3.5 px-4 text-center">
                        {customer.activeJobsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                            {customer.activeJobsCount} active
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
        <div
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
                  {selectedCustomerForView.accountType}
                </span>
              </div>

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

              {/* Default Accessorials & SLAs */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                  Required Accessorials & Protocol
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCustomerForView.defaultRequirements.map((req) => (
                    <span
                      key={req}
                      className="px-2.5 py-1 text-xs rounded-lg font-medium bg-blue-50 text-blue-700 border border-blue-200/80 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3 text-blue-500" />
                      {req}
                    </span>
                  ))}
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
                    {selectedCustomerForView.totalShipments} shipments
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
                  <div className="text-[10px] uppercase font-semibold text-slate-400">
                    Active On Road
                  </div>
                  <div className="text-lg font-bold text-blue-600 mt-0.5">
                    {selectedCustomerForView.activeJobsCount} loads
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
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
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
                <div className="col-span-2">
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Account / Code
                  </label>
                  <input
                    type="text"
                    placeholder="CUST-1000"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Primary Contact Name
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

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Account Tier
                  </label>
                  <select
                    value={formData.accountType || 'Enterprise'}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-slate-400"
                  >
                    <option value="Enterprise">Enterprise</option>
                    <option value="Scheduled Contract">Scheduled Contract</option>
                    <option value="Express / On-Demand">Express / On-Demand</option>
                    <option value="Standard Freight">Standard Freight</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status || 'Active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-slate-400"
                  >
                    <option value="Active">Active</option>
                    <option value="Preferred">Preferred</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>
              </div>

              {/* Default Accessorial Requirements */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Default Accessorials / Requirements
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableRequirements.map((req) => {
                    const isSelected = formData.defaultRequirements?.includes(req);
                    return (
                      <button
                        type="button"
                        key={req}
                        onClick={() => toggleRequirement(req)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 font-medium'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {req}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Dispatch & Receiving Instructions (Optional)
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
