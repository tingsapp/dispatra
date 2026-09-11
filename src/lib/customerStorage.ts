import { Discount } from '../types/pricing';

export interface Customer {
  id: string;
  code: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  accountType: 'Enterprise' | 'Scheduled Contract' | 'Express / On-Demand' | 'Standard Freight';
  status: 'Active' | 'Preferred' | 'On Hold';
  defaultRequirements: string[];
  /** Invoices are emailed here; falls back to `email`. */
  billingEmail: string;
  // ---- Pricing relationship (see types/pricing.ts) ----
  /** Customer-specific Rate Card. `null` = inherit from group / organization. */
  rateCardId: string | null;
  customerGroupId: string | null;
  /** Negotiated discount at customer level; beats card and group discounts. */
  discount: Discount;
  /** `null` = organization default tax profile. */
  taxProfileId: string | null;
  taxExempt: boolean;
  totalShipments: number;
  activeJobsCount: number;
  notes?: string;
  createdAt: string;
}

/** Defaults merged over stored records so older saves pick up new fields. */
export const EMPTY_PRICING_RELATIONSHIP: Pick<
  Customer,
  'billingEmail' | 'rateCardId' | 'customerGroupId' | 'discount' | 'taxProfileId' | 'taxExempt'
> = {
  billingEmail: '',
  rateCardId: null,
  customerGroupId: null,
  discount: { type: 'NONE', value: 0, scope: 'TRANSPORT_ONLY' },
  taxProfileId: null,
  taxExempt: false
};

export const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    code: 'CUST-1049',
    name: 'Pacific Fresh Logistics',
    contactName: 'Elena Rostova',
    email: 'erostova@pacificfresh.ca',
    phone: '+1 (604) 555-8392',
    address: '1420 Derwent Way, Annacis Island',
    city: 'Delta, BC',
    accountType: 'Enterprise',
    status: 'Preferred',
    defaultRequirements: ['Reefer / Cold Chain', 'Liftgate Required', 'Dock Access'],
    billingEmail: 'ap@pacificfresh.ca',
    rateCardId: 'rc_pacific_fresh',
    customerGroupId: null,
    discount: { type: 'NONE', value: 0, scope: 'TRANSPORT_ONLY' },
    taxProfileId: null,
    taxExempt: false,
    totalShipments: 148,
    activeJobsCount: 2,
    notes: 'Standing refrigerated route Mon-Fri 06:00. High-priority perishables.',
    createdAt: '2025-08-15'
  },
  {
    id: 'cust-2',
    code: 'CUST-2031',
    name: 'Nordic Bio Health Supplies',
    contactName: 'Marcus Lindholm',
    email: 'ops@nordicbiohealth.com',
    phone: '+1 (604) 555-4911',
    address: '2985 Virtual Way, Suite 310',
    city: 'Vancouver, BC',
    accountType: 'Scheduled Contract',
    status: 'Active',
    defaultRequirements: ['Temperature Controlled', 'Signature Required', 'Inside Delivery'],
    billingEmail: '',
    rateCardId: 'rc_nordic_direct',
    customerGroupId: 'grp_medical',
    discount: { type: 'NONE', value: 0, scope: 'TRANSPORT_ONLY' },
    taxProfileId: null,
    taxExempt: false,
    totalShipments: 89,
    activeJobsCount: 1,
    notes: 'Security check required at loading bay before access.',
    createdAt: '2025-10-02'
  },
  {
    id: 'cust-3',
    code: 'CUST-0842',
    name: 'Metro Retailers Group',
    contactName: 'Samantha Chen',
    email: 'dispatch-inbound@metrogroup.ca',
    phone: '+1 (604) 555-2304',
    address: '8833 Glenlyon Parkway',
    city: 'Burnaby, BC',
    accountType: 'Enterprise',
    status: 'Preferred',
    defaultRequirements: ['Liftgate Required', 'Pallet Jack', 'Appointment Needed'],
    billingEmail: '',
    rateCardId: null,
    customerGroupId: 'grp_preferred_retail',
    discount: { type: 'NONE', value: 0, scope: 'TRANSPORT_ONLY' },
    taxProfileId: null,
    taxExempt: false,
    totalShipments: 312,
    activeJobsCount: 3,
    notes: 'Receiving hours strict: 07:30 - 15:30. Bay 4-7.',
    createdAt: '2025-05-19'
  },
  {
    id: 'cust-4',
    code: 'CUST-3910',
    name: 'West Coast Cold Storage',
    contactName: 'David K. Thorne',
    email: 'dthorne@wccoldstorage.ca',
    phone: '+1 (604) 555-7762',
    address: '11688 Mitchell Road',
    city: 'Richmond, BC',
    accountType: 'Scheduled Contract',
    status: 'Active',
    defaultRequirements: ['Heavy Cargo (5T)', 'Reefer / Cold Chain', 'Dock Access'],
    billingEmail: '',
    rateCardId: null,
    customerGroupId: null,
    discount: { type: 'NONE', value: 0, scope: 'TRANSPORT_ONLY' },
    taxProfileId: null,
    taxExempt: false,
    totalShipments: 204,
    activeJobsCount: 1,
    notes: 'Origin pickup point for southern distributor routes.',
    createdAt: '2025-09-11'
  },
  {
    id: 'cust-5',
    code: 'CUST-4421',
    name: 'Apex Construction Materials',
    contactName: 'Gordon Vance',
    email: 'logistics@apexmaterials.com',
    phone: '+1 (778) 555-6209',
    address: '19250 96th Ave',
    city: 'Surrey, BC',
    accountType: 'Standard Freight',
    status: 'Active',
    defaultRequirements: ['Flatbed / Heavy Lift', 'Jobsite Access', 'Tailgate Assist'],
    billingEmail: '',
    rateCardId: null,
    customerGroupId: null,
    discount: { type: 'NONE', value: 0, scope: 'TRANSPORT_ONLY' },
    taxProfileId: null,
    taxExempt: false,
    totalShipments: 67,
    activeJobsCount: 0,
    notes: 'Requires PPE for drivers on active building lots.',
    createdAt: '2025-11-20'
  },
  {
    id: 'cust-6',
    code: 'CUST-5192',
    name: 'Harbor Marine Outfitting',
    contactName: 'Rachel Boyd',
    email: 'orders@harbormarine.ca',
    phone: '+1 (604) 555-1188',
    address: '220 Waterfront Road East',
    city: 'Vancouver, BC',
    accountType: 'Express / On-Demand',
    status: 'Active',
    defaultRequirements: ['Dock Access', 'High Value Proof-of-Delivery'],
    billingEmail: '',
    rateCardId: null,
    customerGroupId: null,
    discount: { type: 'NONE', value: 0, scope: 'TRANSPORT_ONLY' },
    taxProfileId: null,
    taxExempt: false,
    totalShipments: 43,
    activeJobsCount: 1,
    notes: 'Port pass or government ID required at security gate.',
    createdAt: '2026-01-08'
  },
  {
    id: 'cust-7',
    code: 'CUST-6014',
    name: 'Cascade Medical Laboratories',
    contactName: 'Dr. Arthur Sterling',
    email: 'dispatch@cascademedlabs.org',
    phone: '+1 (604) 555-3420',
    address: '750 West Broadway, Unit 900',
    city: 'Vancouver, BC',
    accountType: 'Scheduled Contract',
    status: 'Preferred',
    defaultRequirements: ['Medical Courier', 'Chain of Custody', 'Strict Temperature'],
    billingEmail: '',
    rateCardId: null,
    customerGroupId: 'grp_medical',
    discount: { type: 'NONE', value: 0, scope: 'TRANSPORT_ONLY' },
    taxProfileId: null,
    taxExempt: true,
    totalShipments: 122,
    activeJobsCount: 0,
    notes: 'Direct handover to lab technician on 9th floor.',
    createdAt: '2025-07-28'
  },
  {
    id: 'cust-8',
    code: 'CUST-7290',
    name: 'Olympic Peninsula Food Services',
    contactName: 'Tariq Al-Mansoor',
    email: 'supply@olympicfoodservices.ca',
    phone: '+1 (778) 555-9014',
    address: '13551 Crestwood Place',
    city: 'Richmond, BC',
    accountType: 'Standard Freight',
    status: 'On Hold',
    defaultRequirements: ['Liftgate Required', 'Commercial Loading Bay'],
    billingEmail: '',
    rateCardId: null,
    customerGroupId: null,
    discount: { type: 'NONE', value: 0, scope: 'TRANSPORT_ONLY' },
    taxProfileId: null,
    taxExempt: false,
    totalShipments: 28,
    activeJobsCount: 0,
    notes: 'Credit audit pending. Cash on delivery or prepay required.',
    createdAt: '2026-02-14'
  }
];

export const CUSTOMERS_STORAGE_KEY = 'dispatra_customers_v2';

export function loadCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((c: Partial<Customer>) => ({ ...EMPTY_PRICING_RELATIONSHIP, ...c }) as Customer);
      }
    }
  } catch (err) {
    console.warn('Could not load customers from localStorage:', err);
  }
  return DEFAULT_CUSTOMERS;
}

export function saveCustomers(customers: Customer[]): void {
  try {
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));
  } catch (err) {
    console.warn('Could not save customers to localStorage:', err);
  }
}
