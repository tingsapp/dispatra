/** Shared operational fields. Optional properties support older browser records. */
export interface AuditFields { organizationId?: string; branchId?: string | null; createdAt?: string; updatedAt?: string; externalReference?: string; }
export interface Communications { sms: boolean; email: boolean; tracking: boolean; }
export interface SavedAddress { id: string; type: 'PICKUP' | 'DELIVERY' | 'BILLING' | 'DEPOT'; label: string; address: string; contactName?: string; phone?: string; instructions?: string; }
export interface AvailabilityPeriod { id: string; start: string; end: string; available: boolean; notes?: string; }
export interface DriverOperations extends AuditFields {
  /** Optional driver limit; older records inherit the company dispatch default. */
  maxActiveOrders?: number;
  driverNumber?: string; accountStatus?: 'ACTIVE' | 'INACTIVE'; dutyStatus?: 'ON_DUTY' | 'OFF_DUTY'; workStatus?: 'AVAILABLE' | 'BUSY' | 'ON_BREAK';
  /** EMPLOYEE drives a company vehicle; CONTRACTOR is an owner-operator driving their own (still a Vehicles record). Never affects shipper price. */
  employmentType?: 'EMPLOYEE' | 'CONTRACTOR' | 'TEMPORARY'; homeDepotId?: string; serviceAreaIds?: string[]; skills?: string[];
  /** Contact address; optional in older saved driver records, required when saving the form. */
  address?: string;
  addressCoordinates?: import('../components/ui/AddressAutocomplete').SelectedAddress;
  vehicleTypeQualifications?: string[]; currentVehicleId?: string | null; shiftEnd?: string; maximumWorkMinutes?: number;
  preferredStartLocation?: string; availabilitySchedule?: AvailabilityPeriod[]; appLastSeenAt?: string | null; locationCapturedAt?: string | null;
  locationPermissionStatus?: 'GRANTED' | 'DENIED' | 'UNKNOWN'; notes?: string;
}
export interface VehicleOperations extends AuditFields {
  recordStatus?: 'ACTIVE' | 'INACTIVE'; availability?: 'AVAILABLE' | 'IN_USE' | 'UNAVAILABLE'; vehicleTypeId?: string;
  plateProvince?: string; maxStops?: number; cargoLengthCm?: number; cargoWidthCm?: number; cargoHeightCm?: number; cargoVolumeM3?: number;
  equipment?: string[]; serviceAreaIds?: string[]; homeDepotId?: string; unavailableFrom?: string; unavailableUntil?: string;
  unavailableReason?: string; currentRouteId?: string;
}
export interface CustomerOperations extends AuditFields {
  customerType?: 'BUSINESS' | 'INDIVIDUAL'; legalName?: string; addresses?: SavedAddress[]; currency?: string;
  defaultServiceId?: string;
  defaultWindowStart?: string; defaultWindowEnd?: string; instructions?: string; communicationPreferences?: Communications;
  tags?: string[]; permittedBranchIds?: string[]; metadata?: Record<string, unknown>;
}
/** Where an order is in its life. Exceptions (pricing problems, risk, failed attempts) are attention flags layered on top, never statuses. */
export type OrderLifecycle = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export const ORDER_LIFECYCLES: OrderLifecycle[] = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const ORDER_LIFECYCLE_LABELS: Record<OrderLifecycle, string> = { NEW: 'New', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
/** Retired statuses from older saved records collapse onto the five current ones. */
const LEGACY_LIFECYCLES: Record<string, OrderLifecycle> = { INVOICED: 'COMPLETED', DRAFT: 'NEW', SUBMITTED: 'NEW', PRICED: 'NEW', READY_FOR_DISPATCH: 'NEW', NEEDS_ATTENTION: 'NEW', IN_EXECUTION: 'IN_PROGRESS', BILLING_FINALIZATION: 'COMPLETED', FAILED: 'CANCELLED' };
export const normalizeLifecycle = (value?: string | null): OrderLifecycle | undefined => value ? (ORDER_LIFECYCLES as string[]).includes(value) ? value as OrderLifecycle : LEGACY_LIFECYCLES[value] : undefined;
export type OrderAttentionFlag = 'PRICING' | 'AT_RISK' | 'LATE_START' | 'FAILED_ATTEMPT';
export const ORDER_ATTENTION_LABELS: Record<OrderAttentionFlag, string> = { PRICING: 'Pricing needs review', AT_RISK: 'At risk', LATE_START: 'Late start', FAILED_ATTEMPT: 'Failed attempt' };
export interface OrderOperations extends AuditFields {
  lifecycleStatus?: OrderLifecycle; completedAt?: string; priority?: 'NORMAL' | 'HIGH' | 'URGENT'; orderType?: 'DELIVERY' | 'PICKUP' | 'RETURN' | 'TRANSFER' | 'SERVICE_CALL';
  billingCustomerId?: string | null; customerSnapshot?: { id: string | null; name: string; phone: string; email: string; billingEmail: string; legalName?: string; address?: string };
  billingCustomerSnapshot?: OrderOperations['customerSnapshot']; referenceNumbers?: string; commodityDescription?: string;
  requiredSkills?: string[]; requiredEquipment?: string[]; serviceAreaId?: string; tags?: string[]; dispatcherNotes?: string;
  notificationPreferences?: Communications; version?: number; cancellationReason?: string; cancelledAt?: string; metadata?: Record<string, unknown>;
}
export interface StopOperations {
  countryCode?: string; city?: string; provinceCode?: string; postalCode?: string;
  contactName?: string; contactPhone?: string; contactEmail?: string; normalizedAddress?: string; latitude?: number | null; longitude?: number | null;
  windowStart?: string; windowEnd?: string; instructions?: string; accessRequirements?: string; referenceNumber?: string;
  podRequirement?: 'NONE' | 'PHOTO' | 'SIGNATURE' | 'PHOTO_AND_SIGNATURE'; stopStatus?: 'PENDING' | 'ARRIVED' | 'COMPLETED' | 'FAILED';
  plannedArrival?: string; plannedDeparture?: string; actualArrival?: string; actualDeparture?: string;
}
export interface ItemOperations {
  description?: string; handlingUnit?: 'ITEM' | 'BOX' | 'PALLET' | 'TOTE' | 'PACKAGE'; barcode?: string;
  fragile?: boolean; stackable?: boolean; requiresTwoPeople?: boolean; handlingTags?: string[]; pickupStopId?: string; deliveryStopId?: string;
}
