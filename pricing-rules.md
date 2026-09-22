# Adopted pricing requirements — September 12, 2026

Current UI (September 21): Pricing tabs are Rate Cards, Fuel Charge, Service Level and Accessorials. Fuel Charge has one nonnegative percentage input; 0 disables it. New settings start at 28.5%, the September 2026 Novex courier benchmark. Existing percentages and quoted terms are preserved, except that the old unversioned active 8% default now migrates to 28.5% (future explicitly saved 8% values remain valid); live indexed settings migrate to their effective percentage. Fuel-price rules below apply only to historical frozen contexts. Zone cards expose their own dimensional divisor; Distance, Fixed and Hourly do not expose or require one. Distance has no Included Weight or Weight Rate fields. Its base freight is Base Fee + max(0, billable distance − Included Distance) × Distance Rate; stored weight terms and divisors cannot affect new quotes or explicit repricing. New contexts freeze distanceWeightMode NONE; historical contexts preserve legacy weight rules and saved amounts. Package weight and dimensions remain available for operational capacity. Zone bands use the greater of actual and dimensional weight separately for each pickup-to-delivery movement, including package quantities. The matrix stores maximum weight limits; the engine performs the comparison automatically. There is no opt-out checkbox. New contexts record METHOD_SPECIFIC; frozen MAX and legacy contexts retain their prior calculations. Active legacy opt-outs normalize to enabled without changing divisors. Frozen historical quotes retain their original dimensional settings at settlement. Service Fee and Extra Stops are retired from new pricing; their legacy calculations below apply only to frozen historical contexts. The Vehicle & Labour Costs tab is removed, with stored estimates preserved. Current Accessorials are fixed dollar charges added once per order only when selected. Their form contains Name, Rate, Description and Taxable; percentage, automatic/per-stop rules, allowances, limits and fuel eligibility below apply only to frozen historical contexts. Existing numeric rates become dollar amounts; names, taxability and status are retained.


Service Level now uses a fixed additional charge once per order, in company currency, across all four current methods. Editable starting amounts are Standard 0, Rush 20, Direct 35 and Economy 0. The charge is taxable transport, fuel-eligible and included in transport discounts using existing calculation order. New quotes record FIXED service pricing; multiplier rules below apply only to historical frozen contexts. Imported final agreed totals still bypass modifiers. No multiplier-to-dollar arithmetic conversion is performed: known built-in services receive the approved starting amounts only when missing, while custom nonneutral legacy services require an explicit amount.

User-supplied requirements for the pricing revision. Implementation evidence and known limitations are recorded in [state.md](state.md).

**Preserve calculation rules and make contract overrides explicit.** The September 18 interface decision supersedes the earlier navigation: four settings destinations (Company, Services & Dispatch, Pricing, Billing), a flat rate-card list with one Default card, one method per card, and a single flat rate-card form (name, rates, method terms and Minimum Charge). Every card applies to every service, vehicle and customer; dispatch attaches a card to each customer and the order pre-selects it. Contract overrides below remain calculation rules with V1 background values; they are not exposed in the rate-card editor and stored cards are normalised to them on load. Time should support dispatch planning and cost estimates; customer time charges should apply only to waiting or an explicitly hourly contract.

The following is the final recommended specification. Business rules below are proposed defaults; they are not changes already made to the app.

# Dispatra — Organization Settings and Pricing Fix Recommendations

## 1. General and pricing defaults

Keep these organization-wide settings:

- Billing currency.
- Display units for distance, weight and dimensions.
- Maximum active orders per driver.
- Dimensional pricing and divisor.
- Included stops and extra-stop rate.
- Default waiting allowance and billing increment.


Money is automatically rounded to the nearest cent and billable distance to 0.01 km. These are system rules, not editable organization preferences. Unit conversions retain their precision; waiting/hourly billing increments and minimums remain separate contract terms.

**Fix unit conversion.** Store calculations consistently in kilometres, kilograms and centimetres. Convert values when displaying or accepting miles, pounds and inches. Changing units must preserve the underlying distance, weight or dimensional-weight calculation.

Show dimensional divisors with their complete unit, such as `cm³/kg`. Remove the suggestion that one divisor is universal.

Currency changes must not silently relabel existing monetary rates. Require compatible rate-card currency; currency conversion remains outside this feature.

## 2. Remove routine time charges from Base + Distance

The normal **Base + Distance** method should contain:

- Base fee.
- Included distance and distance rate.
- No weight allowance, per-weight charge or dimensional divisor in V1 (September 21 simplification).
- Included pieces and extra-piece rate.
- Included stops and extra-stop rate.
- Minimum freight.

Remove **Included time** and **Minute rate** from this method.

Continue using time for:

- Travel estimates and ETAs.
- Pickup and delivery windows.
- Loading and unloading duration.
- Driver availability and route feasibility.
- Internal labour-cost estimates.

A traffic delay or slower driver must not automatically increase a distance-based, zone-based or fixed customer price.

The subsequent decision to remove routine time billing authorizes automatic retirement of obsolete time fields from saved Base + Distance and Zone cards. Existing successful quotes and finalized prices remain frozen; unfinished estimates blocked only by the old migration requirement can be calculated again. Hourly contracts and waiting charges remain separate.

## 3. Keep hourly pricing separate and optional

Retain **Hourly** only for contracts that explicitly sell time.

Each hourly contract must define:

- Hourly rate.
- Minimum billable duration.
- Billing increment.
- When the billable clock starts and stops.
- Whether loading, unloading and waiting are included.
- Whether completion settles the price using actual duration.

Recommended default: bill the agreed service period, including handling and waiting. Disable a separate waiting charge covering the same minutes.

Services such as **4 Hour** describe a delivery promise. They do not automatically select hourly billing.

## 4. Correct waiting and accessorial behaviour

Keep waiting as an accessorial with an explicit **Waiting recorded** automatic trigger.

**Do not automatically apply waiting minutes to every per-minute accessorial.** Other per-minute charges must receive their own quantity or trigger.

For waiting, support:

- Free allowance.
- Billing increment.
- Rate per minute.
- Per-stop or per-order allowance.
- Minimum and maximum charge.
- Taxability and fuel eligibility.

Recommended default: calculate allowance and rounding separately at each stop, then sum the charges.

Make inheritance explicit. For waiting allowance and increment, use:

**Explicit rate-card override → accessorial default → organization default.**

Use `Inherit` for an absent override. A numeric zero means explicitly zero.

Every automatically generated accessorial should show why it was applied.

## 5. Separate fees from estimated profit

Rename:

- **Company Service Charge → Admin / Dispatch Fee**
- **Gross Profit → Estimated Profit**

Keep the Admin / Dispatch Fee as a customer charge with:

- Enabled/disabled.
- Customer-facing label.
- Flat, percentage, or greater of both.
- Amount and percentage.
- Precisely defined calculation basis.
- Taxability.
- Rate-card applicability override.

The fee is revenue; it does not represent the company’s actual profit.

Per the September 17 user decision, remove the margin target from settings, calculations and order displays. Estimated profit and margin remain informational, without target comparisons, warnings or target-based colours.

If cost-based selling is needed later, add it as a separate rate-card method.

## 6. Fix internal costs and tax-inclusive margin

Calculate:

**Estimated profit = revenue excluding tax − estimated internal cost**

**Estimated margin = estimated profit ÷ revenue excluding tax × 100**

Handle zero revenue explicitly.

Internal cost settings should retain:

- Default vehicle cost per distance.
- Vehicle-type cost overrides.
- Driver cost per hour.
- Average handling minutes per stop.
- Fixed handling cost per stop.
- Overhead percentage.

Respect zero vehicle-cost overrides.

Separate driving, handling and waiting time. When total duration already includes handling or waiting, do not add those minutes again.

Define the fixed handling cost as an additional expense if hourly labour is also counted; otherwise the same labour could be included twice.

Show whether the cost estimate uses defaults, estimated time or actual time. Missing cost inputs should produce an incomplete estimate, not an apparently reliable profit figure.

## 7. Use one clear fuel rule

Keep fuel calculated from **fuel-eligible charge lines**.

Remove the ineffective **Transport only / Transport + accessorials** selector. Replace it with explanatory text and a preview of eligible charges.

Retain:

- Enabled/disabled.
- Customer-facing label.
- Fixed percentage or fuel-price-based percentage.
- Default percentage and fuel-price inputs.
- Rate-card percentage override.
- Vehicle/accessorial fuel eligibility.
- Taxability.

Recommended default:

- Freight and its service adjustment are fuel eligible.
- Vehicle surcharges and accessorials follow their eligibility settings.
- Admin fees, tax and fuel itself are excluded.

Show the fuel base and percentage in the calculation details. Explain that fuel is calculated before the subsequent contract discount.

## 8. Clarify minimums and discounts

Keep two separate minimums:

- **Minimum freight:** protects the freight amount after its service multiplier, before additional charges and discounts.
- **Minimum order subtotal:** protects the final subtotal excluding tax.

Recommended default: apply the order minimum after contract discounts and permitted manual adjustments.

Example: a $100 order minimum with a 20% discount still produces a $100 subtotal excluding tax.

Each rate card owns its Minimum Charge; 0 disables it. New cards start at 0, and existing inherited amounts migrate onto their cards. General has no minimum controls or active minimum-distance floor. Do not make a discount implicitly waive a card minimum.

Discount controls live only on the Shipper creation/edit form and offer No discount, Percentage (0–100), or Fixed amount. The shipper discount applies across selected rate cards; new shippers start with no discount. Apply one discount to freight, service multiplier, freight minimum and vehicle surcharge, excluding fuel, Accessorials, service fee and tax.

Existing effective card discounts migrate once to shippers using the attached card or Default. Current pricing ignores the retained historical card discount field. Frozen quotes, including hourly settlement, retain the discount source and values captured at quote time.

Define the discount scope by named charge groups. Show the discount and any minimum adjustment separately.

## 9. Give rate cards their own zone prices

Keep the **zone directory** organization-wide.

Keep an optional organization default matrix, but allow each zone rate card to:

- Inherit the organization matrix.
- Define its own negotiated matrix.
- Explicitly choose whether missing contract entries may fall back to organization rates.

Each matrix entry should identify:

- Origin zone.
- Destination zone.
- Price. (Service pricing comes from the service multiplier, not per-service zone rows.)

Expose service-specific entries in the editor if the engine supports them.

For multiple pickups, link each delivery to its supplying pickup or pickups. Recommended charging unit: one defined pickup-to-delivery movement, aggregating packages on that movement.

Do not derive customer zone charges from the driver’s optimized route or assume every delivery originates at the first pickup.

If movement relationships or required prices are missing, show **Needs Attention** or use the contract’s explicit fallback.

## 10. Define imported-price treatment

Replace ambiguous imported-price handling with two explicit modes:

**Imported freight amount**

The imported amount becomes freight. The contract explicitly controls additional charges, discounts, minimums and tax treatment.

**Imported final agreed total**

Preserve the agreed customer total. Require its tax treatment or supplied tax breakdown. Do not automatically add fees, fuel, discounts or minimum adjustments.

For imported freight, include controls for:

- Vehicle surcharge.
- Accessorials.
- Fuel surcharge.
- Admin / Dispatch Fee.
- Contract discount.
- Rate-card minimum charge.

Any service-multiplier control shown for imported pricing must actually affect the calculation as documented.

Always preserve the external source, reference and original imported amount.

## 11. Connect operational and invoicing settings

Enforce operational settings in their relevant workflows:

| Setting | Required behaviour |
|---|---|
| Booking cutoff | Validate booking time using the organization’s timezone and service rules. |
| Delivery promise | Evaluate whether the requested delivery can meet the promise. |
| Exclusive vehicle | Prevent incompatible batching and assignments. |
| Maximum active orders | Apply during automatic and manual assignment validation. |
| Vehicle capacity and equipment | Validate against the order and route requirements. |

Connect invoicing settings to:

- Invoice due dates.
- Quote expiry.
- Tax registration display.
- Applicable tax profiles and exemptions.
- Finalized charge lines.

Late-payment fees need a defined assessment rule before automatic application. Until then, clearly identify the field as configuration only.

Hide unfinished controls or explain their current limitation beside the setting.

## 12. Preserve a consistent calculation sequence

For standard pricing, use this sequence:

1. Resolve the applicable rate card and inherited settings.
2. Validate required order facts and currency.
3. Calculate freight using the chosen method.
4. Apply the permitted service multiplier and freight minimum.
5. Add vehicle surcharges and accessorials.
6. Calculate fuel on eligible charges.
7. Calculate the permitted Admin / Dispatch Fee.
8. Apply the resolved contract discount and permitted manual adjustments.
9. Enforce the applicable order minimum.
10. Calculate or extract tax, then apply final rounding.
11. Calculate internal cost and estimated margin separately.

For tax-inclusive pricing, normalize monetary bases consistently so minimums, discounts and profit use their documented tax treatment.

Imported final agreed totals follow their preservation rule.

Order entry and pricing previews must use the centralized engine. The standalone Pricing Simulator was removed at the user’s request. Saved quotes and finalized orders must retain their pricing snapshot, rate-card version and calculation details.

Reassignment, route merging and optimization must preserve the agreed customer price.

## 13. Implementation order and acceptance checks

**First: fix calculation correctness**

Tax-inclusive margin, zero overrides, unit conversion, automatic waiting, ineffective fuel controls and misleading labels.

**Second: implement the commercial rules**

Remove normal time charging, establish minimum and discount behaviour, define imported-price modes, add admin-fee applicability and clarify hourly contracts.

**Third: update zone and movement models**

Add contract-specific matrices, explicit inheritance and pickup-to-delivery relationships.

**Fourth: enforce workflows and verify the complete journey**

Connect operational constraints, quote validity and invoicing settings.

Before completion, verify at least these scenarios:

- A zero cost override remains zero.
- Changing display units preserves equivalent prices.
- Included tax is excluded from estimated revenue.
- Waiting is charged once under the selected policy.
- Contract discounts and minimums follow the agreed order.
- “No discount” blocks inheritance.
- Different contracts can price the same zone pair differently.
- Multiple pickups use the correct commercial movements.
- Imported final totals remain unchanged.
- Traffic and reassignment preserve non-hourly customer prices.
- Order entry and the shared pricing engine return identical results.
- Finalized prices remain unchanged when settings are edited later.
