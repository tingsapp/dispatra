// Pure, typed calculation engine for Dispatra delivery quotes and rate cards.
// Implements deterministic calculation hierarchy, decimal-safe rounding,
// and comprehensive feasibility checks.

import {
  QuoteCalculationRequest,
  QuoteCalculationResult,
  QuoteLineItem,
  RateCard,
  OrganizationPricingSettings,
  SimulatorItem,
  SimulatorStop
} from '../types/pricing';

/** Decimal-safe money rounding helper */
export function roundCurrency(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/** Pure calculation function */
export function calculateDeliveryQuote(
  request: QuoteCalculationRequest,
  settings: OrganizationPricingSettings
): QuoteCalculationResult {
  const lineItems: QuoteLineItem[] = [];
  const calculationOrderBreakdown: string[] = [];
  const manualReviewReasons: string[] = [];

  // 1. Check for manual locked price (Highest priority rule)
  if (request.manualLockedPrice !== undefined && request.manualLockedPrice > 0) {
    const lockedAmount = roundCurrency(request.manualLockedPrice);
    lineItems.push({
      code: 'MANUAL_OVERRIDE',
      name: 'Contracted / Locked Manual Price',
      category: 'base_transport',
      description: 'Preserved agreed pricing (manual quote or imported manifest agreement)',
      amount: lockedAmount
    });

    const taxAmount = roundCurrency(lockedAmount * 0.05); // 5% GST
    const total = roundCurrency(lockedAmount + taxAmount);

    calculationOrderBreakdown.push('Rule 1: Preserved locked manual price without formula re-calculation.');
    calculationOrderBreakdown.push(`Rule 2: Applied standard 5% GST ($${taxAmount.toFixed(2)}).`);

    return {
      isManualReviewRequired: false,
      manualReviewReasons: [],
      rateCardUsed: {
        id: 'manual_lock',
        name: 'Manual / Locked Quote Agreement',
        version: 'Manual v1.0',
        isCustomerSpecific: true
      },
      lineItems,
      subtotal: lockedAmount,
      appliedDiscounts: 0,
      minimumChargeAdjustment: 0,
      fuelSurchargeAmount: 0,
      taxAmount,
      total,
      currency: settings.defaultCurrency,
      calculationOrderBreakdown,
      isLockedManualPrice: true
    };
  }

  // 2. Select appropriate Rate Card
  let selectedRateCard: RateCard | undefined;
  let isCustomerSpecific = false;
  let customerDiscountPct = 0;

  if (request.customerId) {
    const customerAgreement = settings.customerAgreements.find(
      (c) => c.customerId === request.customerId
    );
    if (customerAgreement) {
      isCustomerSpecific = true;
      customerDiscountPct = customerAgreement.discountPercentage;
      selectedRateCard = settings.rateCards.find(
        (r) => r.id === customerAgreement.activeRateCardId
      );
    }
  }

  if (!selectedRateCard && request.rateCardId) {
    selectedRateCard = settings.rateCards.find((r) => r.id === request.rateCardId);
  }

  if (!selectedRateCard) {
    selectedRateCard =
      settings.rateCards.find((r) => r.isOrganizationDefault && r.status === 'published') ||
      settings.rateCards[0];
  }

  if (!selectedRateCard) {
    return {
      isManualReviewRequired: true,
      manualReviewReasons: ['No active rate card found for organization or customer.'],
      rateCardUsed: {
        id: 'none',
        name: 'Unassigned',
        version: '0.0',
        isCustomerSpecific: false
      },
      lineItems: [],
      subtotal: 0,
      appliedDiscounts: 0,
      minimumChargeAdjustment: 0,
      fuelSurchargeAmount: 0,
      taxAmount: 0,
      total: 0,
      currency: settings.defaultCurrency,
      calculationOrderBreakdown: ['Error: Missing rate card configuration.'],
      isLockedManualPrice: false
    };
  }

  calculationOrderBreakdown.push(
    `1. Selected Rate Card: "${selectedRateCard.name}" (v${selectedRateCard.version}${
      isCustomerSpecific ? ' - Customer Specific Agreement' : ' - Organization Default'
    })`
  );

  // 3. Service Speed & Vehicle Constraints
  const serviceSpeed = settings.serviceSpeeds.find((s) => s.id === request.serviceSpeedId) || settings.serviceSpeeds[0];
  const handlingLevel = settings.handlingLevels.find((h) => h.id === request.handlingLevelId) || settings.handlingLevels[0];
  const vehicle = settings.vehicleTypes.find((v) => v.vehicleId === request.selectedVehicleId) || settings.vehicleTypes[0];

  calculationOrderBreakdown.push(
    `2. Parameters: Service "${serviceSpeed.name}" (${serviceSpeed.exclusiveVehicle ? 'Exclusive Vehicle' : 'Consolidated Batch'}), Handling "${handlingLevel.name}", Vehicle "${vehicle.name}"`
  );

  // 4. Calculate Cargo Weight and Volumetric Weight
  let totalActualWeightKg = 0;
  let totalDimWeightKg = 0;
  let totalVolumeCbm = 0;
  let hasFragileItem = false;
  let hasPalletItem = false;
  let oversizedCount = 0;

  request.items.forEach((item) => {
    const itemWeight = item.weightKg * item.quantity;
    totalActualWeightKg += itemWeight;

    const itemVolumeCm3 = item.lengthCm * item.widthCm * item.heightCm;
    const itemVolumeCbm = (itemVolumeCm3 / 1_000_000) * item.quantity;
    totalVolumeCbm += itemVolumeCbm;

    // Dim weight: cm3 / 5000
    const itemDimKg = (itemVolumeCm3 / settings.itemsAndLoad.dimWeightDivisor) * item.quantity;
    totalDimWeightKg += itemDimKg;

    if (item.isFragile) hasFragileItem = true;
    if (item.isPallet) hasPalletItem = true;
    if (
      item.lengthCm > settings.itemsAndLoad.oversizedDimensionThresholdCm ||
      item.widthCm > settings.itemsAndLoad.oversizedDimensionThresholdCm ||
      item.heightCm > settings.itemsAndLoad.oversizedDimensionThresholdCm
    ) {
      oversizedCount += item.quantity;
    }

    // Check single item weight feasibility
    if (item.weightKg > settings.itemsAndLoad.maxSingleItemWeightKg) {
      manualReviewReasons.push(
        `Heavy piece alert: "${item.description}" (${item.weightKg} kg) exceeds single-item safety threshold (${settings.itemsAndLoad.maxSingleItemWeightKg} kg). Specialist machinery or double crew review required.`
      );
    }
  });

  // Feasibility Check: Vehicle Payload and Volume
  if (totalActualWeightKg > vehicle.maxPayloadKg) {
    manualReviewReasons.push(
      `Cannot quote automated: Total shipment weight (${totalActualWeightKg.toFixed(
        1
      )} kg) exceeds vehicle payload limit (${vehicle.maxPayloadKg} kg) for ${vehicle.name}. Please select a larger vehicle.`
    );
  }

  if (totalVolumeCbm > vehicle.maxVolumeCbm) {
    manualReviewReasons.push(
      `Cannot quote automated: Total cargo volume (${totalVolumeCbm.toFixed(
        2
      )} m³) exceeds vehicle capacity (${vehicle.maxVolumeCbm} m³) for ${vehicle.name}.`
    );
  }

  // Billable weight determination
  let billableWeightKg = totalActualWeightKg;
  if (settings.itemsAndLoad.dimWeightRule === 'greater_of_actual_or_dim') {
    billableWeightKg = Math.max(totalActualWeightKg, totalDimWeightKg);
    calculationOrderBreakdown.push(
      `3. Weight Calculation: Actual = ${totalActualWeightKg.toFixed(1)} kg, Dimensional = ${totalDimWeightKg.toFixed(
        1
      )} kg -> Billable Weight = ${billableWeightKg.toFixed(1)} kg (Greater of actual or dim).`
    );
  } else {
    calculationOrderBreakdown.push(
      `3. Weight Calculation: Billable = ${billableWeightKg.toFixed(1)} kg (Actual weight rule).`
    );
  }

  // 5. Base & Transport Fare Calculation
  let transportTotal = 0;
  const baseFare = selectedRateCard.baseFee * vehicle.baseRateMultiplier;
  lineItems.push({
    code: 'BASE_TRANSPORT',
    name: `Base Dispatch Fee (${selectedRateCard.name})`,
    category: 'base_transport',
    description: `Includes first ${selectedRateCard.baseFeeIncludesKm} km of travel (Vehicle: ${vehicle.name})`,
    amount: roundCurrency(baseFare)
  });
  transportTotal += baseFare;

  // Road distance charges
  const billableDistanceKm = Math.max(0, request.distanceKm - selectedRateCard.baseFeeIncludesKm);
  if (billableDistanceKm > 0) {
    const distanceCost = billableDistanceKm * selectedRateCard.additionalKmRate;
    lineItems.push({
      code: 'DISTANCE_KM',
      name: `Distance Surcharge (${billableDistanceKm.toFixed(1)} km)`,
      category: 'base_transport',
      description: `${billableDistanceKm.toFixed(1)} km beyond ${selectedRateCard.baseFeeIncludesKm} km included @ $${selectedRateCard.additionalKmRate.toFixed(2)}/km`,
      amount: roundCurrency(distanceCost)
    });
    transportTotal += distanceCost;
  }

  // Flat vehicle adjustment (if applicable)
  if (vehicle.flatFeeAdjustment > 0) {
    lineItems.push({
      code: 'VEHICLE_CLASS_FEE',
      name: `Vehicle Class Surcharge (${vehicle.name})`,
      category: 'base_transport',
      description: 'Standard vehicle class surcharge',
      amount: roundCurrency(vehicle.flatFeeAdjustment)
    });
    transportTotal += vehicle.flatFeeAdjustment;
  }

  calculationOrderBreakdown.push(
    `4. Base & Transport Total: $${roundCurrency(transportTotal).toFixed(2)}`
  );

  // 6. Dedicated Trip vs Individual Delivery & Multiple Pickups
  if (request.pricingMode === 'dedicated_trip') {
    lineItems.push({
      code: 'TRIP_DEDICATED',
      name: 'Dedicated Multi-Stop Route Mode',
      category: 'base_transport',
      description: 'Route billed as dedicated trip; single shared dispatch origin fee applied once',
      amount: 0
    });
    calculationOrderBreakdown.push(
      '5. Route Policy: Dedicated trip with single shared pickup dispatch origin.'
    );
  }

  // 7. Handling Level Premiums
  let handlingTotal = 0;
  if (handlingLevel.premiumValue > 0) {
    let premiumAmount = 0;
    if (handlingLevel.premiumType === 'fixed') {
      premiumAmount = handlingLevel.premiumValue;
    } else {
      premiumAmount = transportTotal * (handlingLevel.premiumValue / 100);
    }
    premiumAmount = roundCurrency(premiumAmount);
    lineItems.push({
      code: 'HANDLING_LEVEL',
      name: `Service Handling: ${handlingLevel.name}`,
      category: 'handling',
      description: handlingLevel.description,
      amount: premiumAmount
    });
    handlingTotal += premiumAmount;
    calculationOrderBreakdown.push(
      `6. Handling Premium (${handlingLevel.name}): $${premiumAmount.toFixed(2)}`
    );
  }

  // 8. Access & Stop-Specific Handling (Stairs, Elevators, Long Carries, Waiting)
  let accessorialsTotal = 0;

  request.stops.forEach((stop, index) => {
    const stopLabel = `${stop.stopType === 'pickup' ? 'Pickup' : 'Drop-off'} Stop #${index + 1} (${stop.address})`;

    // Stairs evaluation:
    // Only charge for stairs if the handling level allows it (Curbside does NOT allow stair charges!)
    if (handlingLevel.stairEligible) {
      let flightsToCharge = 0;

      if (!stop.elevatorAvailable) {
        // No elevator -> actual stairs used
        flightsToCharge = Math.max(0, stop.stairFlights - settings.accessHandling.stairFreeFlightAllowance);
      } else if (!stop.itemFitsElevator && stop.stairFlights > 0) {
        // Elevator exists, BUT item does not fit -> MUST take stairs!
        flightsToCharge = Math.max(0, stop.stairFlights - settings.accessHandling.stairFreeFlightAllowance);
        calculationOrderBreakdown.push(
          `7. Access rule applied at Stop #${index + 1}: Cargo oversized for elevator -> redirected to ${flightsToCharge} flights of stairs.`
        );
      }

      if (flightsToCharge > 0) {
        const stairCost = roundCurrency(flightsToCharge * settings.accessHandling.stairFlightRate);
        lineItems.push({
          code: 'STAIR_HANDLING',
          name: `Stair Carry (${flightsToCharge} flights)`,
          category: 'accessorial',
          description: `${stopLabel}: ${flightsToCharge} flights @ $${settings.accessHandling.stairFlightRate.toFixed(2)}/flight`,
          amount: stairCost
        });
        accessorialsTotal += stairCost;
      }
    } else if (stop.stairFlights > 0) {
      calculationOrderBreakdown.push(
        `Note: Stop #${index + 1} noted ${stop.stairFlights} stairs, but Curbside handling rule excludes upstairs work and associated charges.`
      );
    }

    // Long carry distance
    if (stop.carryDistanceMeters > settings.accessHandling.longCarryDistanceThresholdMeters) {
      lineItems.push({
        code: 'LONG_CARRY',
        name: `Long Carry Distance (${stop.carryDistanceMeters}m)`,
        category: 'accessorial',
        description: `${stopLabel}: Beyond ${settings.accessHandling.longCarryDistanceThresholdMeters}m threshold`,
        amount: roundCurrency(settings.accessHandling.longCarryFee)
      });
      accessorialsTotal += settings.accessHandling.longCarryFee;
    }

    // Loading dock credit
    if (stop.hasLoadingDock && settings.accessHandling.dockAccessDiscount > 0) {
      lineItems.push({
        code: 'DOCK_CREDIT',
        name: 'Loading Dock Access Allowance',
        category: 'discount',
        description: `${stopLabel}: Commercial freight dock available`,
        amount: -roundCurrency(settings.accessHandling.dockAccessDiscount)
      });
      accessorialsTotal -= settings.accessHandling.dockAccessDiscount;
    }

    // On-site waiting time (if recorded in simulation)
    if (stop.actualWaitMinutes && stop.actualWaitMinutes > settings.accessHandling.freeWaitTimeMinutes) {
      const billableMinutes = stop.actualWaitMinutes - settings.accessHandling.freeWaitTimeMinutes;
      const waitingCost = roundCurrency(
        (billableMinutes / 60) * settings.accessHandling.detentionRatePerHour
      );
      lineItems.push({
        code: 'DETENTION_WAIT',
        name: `Detention Time (${billableMinutes} min billable)`,
        category: 'accessorial',
        description: `${stopLabel}: ${stop.actualWaitMinutes}m total with ${settings.accessHandling.freeWaitTimeMinutes}m free allowance`,
        amount: waitingCost
      });
      accessorialsTotal += waitingCost;
    }
  });

  // 9. Equipment & Crew Requirements
  let equipmentTotal = 0;
  if (request.crewType === 'two_person') {
    lineItems.push({
      code: 'CREW_TWO_PERSON',
      name: 'Two-Person Crew Requirement',
      category: 'equipment_crew',
      description: 'Dedicated driver and helper for heavy/bulky handling',
      amount: roundCurrency(settings.crewEquipment.twoPersonCrew.flatFee)
    });
    equipmentTotal += settings.crewEquipment.twoPersonCrew.flatFee;
  }

  if (request.requiresTailLift) {
    lineItems.push({
      code: 'EQUIP_TAIL_LIFT',
      name: 'Hydraulic Tail Lift Equipment',
      category: 'equipment_crew',
      description: 'Tailgate lift for dockless pallet loading',
      amount: roundCurrency(settings.crewEquipment.tailLiftSurcharge)
    });
    equipmentTotal += settings.crewEquipment.tailLiftSurcharge;
  }

  if (request.requiresPalletJack) {
    lineItems.push({
      code: 'EQUIP_PALLET_JACK',
      name: 'Onboard Pallet Jack',
      category: 'equipment_crew',
      description: 'Heavy duty pallet jack in vehicle',
      amount: roundCurrency(settings.crewEquipment.palletJackSurcharge)
    });
    equipmentTotal += settings.crewEquipment.palletJackSurcharge;
  }

  // 10. Item Specific Extras (Oversized, Fragile, Pallets)
  if (oversizedCount > 0) {
    const fee = roundCurrency(oversizedCount * settings.itemsAndLoad.oversizedItemFee);
    lineItems.push({
      code: 'ITEM_OVERSIZED',
      name: `Oversized Freight (${oversizedCount} items)`,
      category: 'accessorial',
      description: `Dimensions exceed ${settings.itemsAndLoad.oversizedDimensionThresholdCm} cm threshold`,
      amount: fee
    });
    accessorialsTotal += fee;
  }

  if (hasFragileItem) {
    lineItems.push({
      code: 'ITEM_FRAGILE',
      name: 'Fragile Handling & Blanket Wrap',
      category: 'accessorial',
      description: 'Padded tie-downs and non-stackable placement',
      amount: roundCurrency(settings.itemsAndLoad.fragileHandlingFee)
    });
    accessorialsTotal += settings.itemsAndLoad.fragileHandlingFee;
  }

  // 11. Scheduling & Windows
  let schedulingTotal = 0;
  if (request.isNarrowWindow) {
    lineItems.push({
      code: 'SCHED_NARROW_WINDOW',
      name: 'Guaranteed Narrow Window (1-hour slot)',
      category: 'surcharge',
      description: 'Priority route locking for time-sensitive appointment',
      amount: roundCurrency(settings.schedulingExceptions.narrowWindowFee)
    });
    schedulingTotal += settings.schedulingExceptions.narrowWindowFee;
  }

  if (request.isAfterHours) {
    const afterHoursCost = roundCurrency(
      transportTotal * (settings.schedulingExceptions.afterHoursFeePercent / 100)
    );
    lineItems.push({
      code: 'SCHED_AFTER_HOURS',
      name: `After-Hours Dispatch (+${settings.schedulingExceptions.afterHoursFeePercent}%)`,
      category: 'surcharge',
      description: 'Pickup or delivery between 20:00 and 06:00',
      amount: afterHoursCost
    });
    schedulingTotal += afterHoursCost;
  }

  if (request.isWeekend) {
    const weekendCost = roundCurrency(
      transportTotal * (settings.schedulingExceptions.weekendFeePercent / 100)
    );
    lineItems.push({
      code: 'SCHED_WEEKEND',
      name: `Weekend Dispatch (+${settings.schedulingExceptions.weekendFeePercent}%)`,
      category: 'surcharge',
      description: 'Saturday/Sunday delivery surcharge',
      amount: weekendCost
    });
    schedulingTotal += weekendCost;
  }

  // 12. Pre-Discount Subtotal
  let netSubtotal = transportTotal + handlingTotal + accessorialsTotal + equipmentTotal + schedulingTotal;

  // 13. Customer Agreement Discount
  let totalDiscount = 0;
  if (customerDiscountPct > 0) {
    totalDiscount = roundCurrency(netSubtotal * (customerDiscountPct / 100));
    lineItems.push({
      code: 'CUSTOMER_DISCOUNT',
      name: `Negotiated Customer Discount (${customerDiscountPct}%)`,
      category: 'discount',
      description: 'Applied per enterprise master service agreement',
      amount: -totalDiscount
    });
    netSubtotal -= totalDiscount;
    calculationOrderBreakdown.push(
      `8. Applied Customer Agreement Discount (${customerDiscountPct}%): -$${totalDiscount.toFixed(2)}`
    );
  }

  // 14. Minimum Charge Rule Enforcement
  let minimumChargeAdjustment = 0;
  if (netSubtotal < selectedRateCard.minimumCharge) {
    minimumChargeAdjustment = roundCurrency(selectedRateCard.minimumCharge - netSubtotal);
    lineItems.push({
      code: 'MINIMUM_CHARGE_ADJ',
      name: 'Minimum Trip Charge Floor',
      category: 'surcharge',
      description: `Adjusted to meet rate card minimum floor of $${selectedRateCard.minimumCharge.toFixed(2)}`,
      amount: minimumChargeAdjustment
    });
    netSubtotal = selectedRateCard.minimumCharge;
    calculationOrderBreakdown.push(
      `9. Minimum Charge Floor Rule: Base evaluated to lower than $${selectedRateCard.minimumCharge.toFixed(
        2
      )}. Adjusted upward by +$${minimumChargeAdjustment.toFixed(2)}.`
    );
  }

  // 15. Fuel Surcharge
  let fuelSurchargeAmount = 0;
  if (selectedRateCard.fuelSurchargeEnabled && selectedRateCard.fuelSurchargePercentage > 0) {
    let fuelBasis = transportTotal;
    if (selectedRateCard.fuelSurchargeBasis === 'transport_and_handling') {
      fuelBasis = transportTotal + handlingTotal;
    } else if (selectedRateCard.fuelSurchargeBasis === 'net_subtotal') {
      fuelBasis = netSubtotal;
    }

    fuelSurchargeAmount = roundCurrency(
      fuelBasis * (selectedRateCard.fuelSurchargePercentage / 100)
    );

    lineItems.push({
      code: 'FUEL_SURCHARGE',
      name: `Fuel Index Surcharge (${selectedRateCard.fuelSurchargePercentage}%)`,
      category: 'surcharge',
      description: `Weekly diesel index applied to ${selectedRateCard.fuelSurchargeBasis.replace(/_/g, ' ')}`,
      amount: fuelSurchargeAmount
    });
    calculationOrderBreakdown.push(
      `10. Fuel Surcharge (${selectedRateCard.fuelSurchargePercentage}% on $${fuelBasis.toFixed(2)}): +$${fuelSurchargeAmount.toFixed(2)}`
    );
  }

  // 16. Total Before Tax and Taxes
  const subtotalWithFuel = roundCurrency(netSubtotal + fuelSurchargeAmount);
  // Canadian GST (5% in British Columbia)
  const taxAmount = roundCurrency(subtotalWithFuel * 0.05);
  lineItems.push({
    code: 'TAX_GST',
    name: 'Goods & Services Tax (GST 5%)',
    category: 'tax',
    description: 'Statutory 5% GST for freight transport services (BC)',
    amount: taxAmount
  });

  const total = roundCurrency(subtotalWithFuel + taxAmount);
  calculationOrderBreakdown.push(
    `11. Subtotal = $${subtotalWithFuel.toFixed(2)}, GST (5%) = $${taxAmount.toFixed(2)} -> Total = $${total.toFixed(2)} ${settings.defaultCurrency}`
  );

  return {
    isManualReviewRequired: manualReviewReasons.length > 0,
    manualReviewReasons,
    rateCardUsed: {
      id: selectedRateCard.id,
      name: selectedRateCard.name,
      version: selectedRateCard.version,
      isCustomerSpecific
    },
    lineItems,
    subtotal: subtotalWithFuel,
    appliedDiscounts: totalDiscount,
    minimumChargeAdjustment,
    fuelSurchargeAmount,
    taxAmount,
    total,
    currency: settings.defaultCurrency,
    calculationOrderBreakdown,
    isLockedManualPrice: false
  };
}
