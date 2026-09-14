/** Shared operational fields. Optional properties support older browser records. */
export interface AuditFields { organizationId?: string; branchId?: string | null; createdAt?: string; updatedAt?: string; externalReference?: string; }
export interface Communications { sms: boolean; email: boolean; tracking: boolean; }
export interface SavedAddress { id: string; type: 'PICKUP' | 'DELIVERY' | 'BILLING' | 'DEPOT'; label: string; address: string; contactName?: string; phone?: string; instructions?: string; }
export interface AvailabilityPeriod { id: string; start: string; end: string; available: boolean; notes?: string; }
export interface DriverOperations extends AuditFields {
  driverNumber?: string; accountStatus?: 'ACTIVE' | 'INACTIVE'; dutyStatus?: 'ON_DUTY' | 'OFF_DUTY'; workStatus?: 'AVAILABLE' | 'BUSY' | 'ON_BREAK';
  employmentType?: 'EMPLOYEE' | 'CONTRACTOR' | 'TEMPORARY'; homeDepotId?: string; serviceAreaIds?: string[]; skills?: string[];
  vehicleTypeQualifications?: string[]; currentVehicleId?: string | null; shiftEnd?: string; maximumWorkMinutes?: number;
  preferredStartLocation?: string; availabilitySchedule?: AvailabilityPeriod[]; appLastSeenAt?: string | null; locationCapturedAt?: string | null;
  locationPermissionStatus?: 'GRANTED' | 'DENIED' | 'UNKNOWN'; notes?: string;
}
export interface VehicleOperations extends AuditFields {
  recordStatus?: 'ACTIVE' | 'INACTIVE'; availability?: 'AVAILABLE' | 'IN_USE' | 'UNAVAILABLE'; vehicleTypeId?: string;
  plateProvince?: string; cargoLengthCm?: number; cargoWidthCm?: number; cargoHeightCm?: number; cargoVolumeM3?: number;
  equipment?: string[]; serviceAreaIds?: string[]; homeDepotId?: string; unavailableFrom?: string; unavailableUntil?: string;
  unavailableReason?: string; currentRouteId?: string;
}
export interface CustomerOperations extends AuditFields {
  customerType?: 'BUSINESS' | 'INDIVIDUAL'; legalName?: string; addresses?: SavedAddress[]; currency?: string;
  paymentTerms?: 'INHERIT' | 'COD' | 'NET7' | 'NET15' | 'NET30' | 'NET60'; defaultServiceId?: string;
  defaultWindowStart?: string; defaultWindowEnd?: string; instructions?: string; communicationPreferences?: Communications;
  tags?: string[]; permittedBranchIds?: string[]; metadata?: Record<string, unknown>;
}
export type OrderLifecycle = 'DRAFT' | 'SUBMITTED' | 'PRICED' | 'READY_FOR_DISPATCH' | 'ASSIGNED' | 'IN_EXECUTION' | 'COMPLETED' | 'BILLING_FINALIZATION' | 'INVOICED' | 'CANCELLED' | 'FAILED' | 'NEEDS_ATTENTION';
export interface OrderOperations extends AuditFields {
  lifecycleStatus?: OrderLifecycle; priority?: 'NORMAL' | 'HIGH' | 'URGENT'; orderType?: 'DELIVERY' | 'PICKUP' | 'RETURN' | 'TRANSFER' | 'SERVICE_CALL';
  billingCustomerId?: string | null; customerSnapshot?: { id: string | null; name: string; phone: string; email: string; billingEmail: string; legalName?: string; address?: string; paymentTerms?: string };
  billingCustomerSnapshot?: OrderOperations['customerSnapshot']; referenceNumbers?: string; commodityDescription?: string;
  requiredSkills?: string[]; requiredEquipment?: string[]; serviceAreaId?: string; tags?: string[]; dispatcherNotes?: string;
  notificationPreferences?: Communications; version?: number; cancellationReason?: string; cancelledAt?: string; metadata?: Record<string, unknown>;
}
export interface StopOperations {
  contactName?: string; contactPhone?: string; contactEmail?: string; normalizedAddress?: string; latitude?: number | null; longitude?: number | null;
  windowStart?: string; windowEnd?: string; instructions?: string; accessRequirements?: string; referenceNumber?: string;
  podRequirement?: 'NONE' | 'PHOTO' | 'SIGNATURE' | 'PHOTO_AND_SIGNATURE'; stopStatus?: 'PENDING' | 'ARRIVED' | 'COMPLETED' | 'FAILED';
  plannedArrival?: string; plannedDeparture?: string; actualArrival?: string; actualDeparture?: string;
}
export interface ItemOperations {
  description?: string; handlingUnit?: 'ITEM' | 'BOX' | 'PALLET' | 'TOTE' | 'PACKAGE'; barcode?: string;
  fragile?: boolean; stackable?: boolean; requiresTwoPeople?: boolean; handlingTags?: string[]; pickupStopId?: string; deliveryStopId?: string;
}
