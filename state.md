# Dispatra Web Client Implementation State

Last updated: **2026-09-14**

Read [spec.md](spec.md) for target behavior and [AGENTS.md](AGENTS.md) for working rules. This file distinguishes observed prototype behavior from planned functionality.

## Current stage

Mixed implementation: the company/customer account milestone uses the FastAPI/PostgreSQL API; the existing Monitor and operational/pricing surfaces remain a local-data prototype. Company/customer routes never mount the prototype or import its browser stores.

## Fixed decisions

React/TypeScript, shadcn/ui direction, `react-map-gl`/`maplibre-gl`, light Clean/Calm/Precise UI, Vancouver map center, FastAPI/PostgreSQL authority, Order/Route/RouteStop vocabulary, AUTO/MANUAL dispatch, centralized API-authoritative pricing, multiple pickups/drop-offs, automatic optimization, POD, and Invoice workflow are target contracts. Existing prototype behavior is not production evidence.

## Implemented

- September 12 pricing revision: shared engine v2 removes routine time billing and automatically retires obsolete saved Base + Distance/Zone minute-rate fields; normal price is independent of travel duration. Hourly contracts define clock boundaries, handling/wait inclusion and actual settlement.
- Waiting uses an explicit `WAITING_RECORDED` trigger, per-stop allowance/rounding/limits by default, and card → accessorial → organization inheritance. Duplicate automatic waiting rules are configuration errors; hourly included waiting is suppressed.
- Fuel uses eligible charge lines; the unused basis selector is removed. Admin / Dispatch Fee has contract applicability. Minimum freight follows the multiplier; the net order minimum follows discounts/adjustments and supports override/waiver. Discount `INHERIT` and `NONE` are distinct, with legacy stored NONE migrated to preserve former inheritance.
- Monetary bases normalize inclusive tax before percentage charges/discounts/minimums; estimated revenue excludes tax. Cost estimates respect zero overrides, distinguish total-service versus driving-only duration, identify handling defaults, and flag incomplete estimates. Unit editors preserve canonical km/kg/cm, including dimensional divisors and distance/weight rates. Currency is read-only pending an explicit monetary-rate migration.
- Organization zone directory/default rates and contract-specific matrices support service-specific prices, explicit organization fallback, and unique supplying-pickup → delivery movements. Missing movement links or rates require attention or the card's explicit Base + Distance fallback.
- Imported freight permits selected modifiers; final agreed totals require tax treatment and bypass modifiers/rounding. Snapshots retain original imports, input facts, rate-card versions, expiry and frozen pricing context. Local order persistence and completion use quoted terms; non-hourly agreed prices and already-final snapshots remain unchanged.
- Booking cutoffs use organization wall time. Shared static assignment validation covers quote expiry, driver availability, maximum active orders, exclusive work, requested vehicle-type weight/volume and liftgate checks. It is used by Orders and the existing recommendation action. Finalization provides a local invoice preview using finalized lines, due dates, billing email and tax registration.

- The default fuel surcharge percentage is edited only in Billing, Tax & Cost → Company & Fuel Charges → Fuel Surcharge; General no longer repeats the field. Rate Card overrides remain available.
- `src/App.tsx` and `src/data/mockData.ts` provide local drivers/jobs/exceptions, Monitor counters, selected entities, on-demand overlays, and simulated recommendation interactions.
- `src/components/TorontoMap.tsx` renders a MapLibre map through `react-map-gl/maplibre`, route/marker layers, and local simulated telemetry. The filename is legacy; the center is Vancouver.
- Monitor chrome exists through Sidebar, TopMetrics, DateControl, MapControls, DriverPopover, JobDetailPopover, and DetailModalDialog.
- Pricing module (static, localStorage-backed): `src/types/pricing.ts` (RateCard, Zone/ZoneRate, CustomerGroup, PricingOrderInput, ChargeLine, PricingSnapshot) and `src/lib/pricingEngine.ts` (`resolveRateCard`, `calculatePricing`, `estimateInternalCost`) implement the five pricing methods (Base + Distance, Fixed, Zone, Hourly, Imported), customer → group → org-service → org-default resolution with conflict/no-match/missing-distance Needs Attention errors, dimensional weight, load/piece/stop charges (routine time pricing removed), service multiplier, vehicle surcharge, fuel-eligible base, accessorial calc types with allowances/increments/min/max/auto rules, contractual and one-off discounts, tax profiles with customer exemption, and an internal-cost/margin estimate. `RateCardsPage` (Rate Cards, Zones, Customer Groups), `PricingServicesPage` (Services with default multipliers, Vehicles with fuel eligibility, Accessorials), `BillingSettingsPage` (org defaults, tax profiles, fuel, operating cost), and Order entry use the shared pricing configuration and engine. `billingEngine.ts` holds only shared helpers.
- `CustomersPage`/`customerStorage.ts` provide local customer directory CRUD-like flows. Profile, Help/Support, and local profile storage also exist.
- `package.json` provides Vite dev/build and TypeScript lint scripts; declared React, TypeScript, MapLibre, `react-map-gl`, Lucide, Tailwind, and Motion dependencies are observed, not proof of production readiness.

## Partially implemented

The static prototype has Monitor/settings/pricing/customer interactions. Orders (`JobsPage`, still typed as the legacy `Job`) now carry `pricingInput` + a frozen `pricing` PricingSnapshot: creation uses the shared `OrderPricingForm` + `calculatePricing`, details show the snapshot via `PriceBreakdown` with Re-price (estimate only) and Finalize (settles permitted hourly clock actuals and locks), mock orders are enriched at load (`lib/orderPricing.ts`), and unpriced orders surface in Needs Attention. Job/Route/Invoice models remain unnormalized (no Order entity, local invoice preview only, no authoritative Invoice issuance). Mock assignment/recommendation actions validate the available static constraints and persist local order state; no backend assignment is issued.

## Specified but not implemented

API integration and tenant authorization for the existing operational dispatcher modules; a normalized Order/Route/RouteStop model (orders are still the legacy `Job` shape with pricing attached); customer-portal Order creation; automatic assignment/optimization and complete route hard constraints; multi-order route optimization/load progression; full Routes, Drivers, Vehicles, Reports, Needs Attention, POD, billing/invoice and tracking workflows; server state/realtime/resync; browser end-to-end tests; and complete operational scenario coverage.

## Known gaps / blockers

The account portal now uses TanStack Query and an OpenAPI-generated typed transport. No operational websocket or general React Router integration is established; the small account route set is explicitly matched. Map rendering is static/demo and does not prove production routing, GPS, traffic, or satellite capability. Existing filenames and legacy terminology must not define the domain. No API runtime or browser end-to-end checks were run for this revision.

## Immediate next priorities

1. Finish Organization Settings and pricing configuration using centralized static state.
2. Finish Order create/edit/details with the shared static pricing engine.
3. Finish Customer details required by Orders/pricing/billing.
4. Finish Monitor AUTO/MANUAL behavior and pricing/dispatch Needs Attention.
5. Finish multi-order Routes and optimized route presentation.
6. Finish Driver/Vehicle operational screens.
7. Finish Billing/Invoice preview and sent states.
8. Exercise all required static end-to-end scenarios.
9. Continue API integration after the company/customer account milestone, with explicit organization mapping and preservation of existing operational data.

## Testing status

The client package declares `npm run lint` and `npm run build`; TypeScript, production build, and the pricing acceptance suite are the required checks for the September 12 revision. `npm test` runs the Node/tsx acceptance suite. No browser end-to-end suite is established. Existing prototype validation must be extended with pricing, dispatch, route, settings, form, Needs Attention, and invoice scenarios.

## September 12 validation and remaining limits

`npm test` passes 39 acceptance and rendering tests. `npm run lint` and `npm run build` pass (Vite retains its bundle-size advisory). The pricing acceptance suite covers zero overrides, unit roundtrips, inclusive tax/margin, waiting inheritance and duplicate protection, hourly settlement, minimum/discount ordering, contract zone matrices and multiple pickups, imports, fuel, duration independence, incomplete costs, shared engine output, frozen terms/final snapshots, timezone cutoff, assignment constraints, invoice preview, and server rendering of edited components. See `tests/pricing.test.ts`.

Follow-up review fixes: tax-inclusive accessorial unit rates and per-stop limits preserve precision until the charge is rounded; eligible customer/group profile card selections win within their level, with normal fallback for missing/ineligible selections; and manual per-minute accessorials appear with a minute input in the Order form while automatic waiting stays separate. Eight added regression tests cover these corrections, exclusive/exempt pricing, contract overrides, selection eligibility/precedence/conflicts, and rendered manual-minute entry. Five of the new tests failed before the fixes; all 35 pass afterward. The production build was verified in an isolated copy of the updated source. Interactive browser QA remains unavailable because the browser could not verify its administrator-enforced access policy.

No connected browser was available for interactive/visual QA. Automatic dispatch/optimization, execution-aware route locking, actual assigned-vehicle/equipment binding and intermediate route capacity, machine-evaluated delivery promises, POD, authoritative invoice issuance/email, late-fee assessment and API integration remain unimplemented. Adjacent UI copy identifies these limits; these are not claims of a production-complete dispatch or invoicing workflow. Currency migration is deliberately disabled, rather than relabeling stored amounts.

## Saved legacy time-charge recovery

Following the user report, pricing storage schema 3 retires obsolete routine minute rates/included minutes from saved Base + Distance and Zone cards, increments affected card versions once, and preserves all other rates, overrides, discounts and hourly contracts. The pricing engine ignores historical routine-time fields instead of emitting the migration blocker. Order loading retries unfinished estimate failures carrying LEGACY_TIME_PRICING; successful quotes, final snapshots, completed orders and invoice-bearing records remain untouched. Recovery is persisted by the existing Order save workflow. Refreshing the app loads the migration and repaired estimates without clearing browser data.

Validation: 39 tests pass, including four new migration/recovery/rendering tests and two updated time-pricing tests that failed before the fix. TypeScript and an isolated production build pass; the existing bundle-size advisory remains. Browser-local data migration is covered with serialized storage fixtures; interactive browser verification remains blocked by the administrator-policy check described above.

## September 14: Pricing Simulator removed

Removed the standalone Pricing Simulator page, its components, desktop/mobile navigation entries, and links from Rate Cards, Services and Billing settings. Order entry retains its live estimate and shared pricing engine. Removed simulator-only stage controls and updated help text and project documentation. Validation: all 39 pricing/rendering tests pass, TypeScript passes, and the production build succeeds in an isolated copy (existing bundle-size advisory remains).

September 14 sidebar copy update: removed the automatic-assignment/route-feasibility prototype notice from the side menu at the user’s request. TypeScript and production build checks pass.

September 14 organization-menu update: swapped Billing, Tax & Cost with Rate Cards & Zones in the desktop and mobile account submenus. Order is Services & Accessorials, Billing, Tax & Cost, then Rate Cards & Zones. TypeScript and production build checks pass.

September 14 contract dropdown update: Admin / Dispatch Fee uses the same shared Select component and label styling as Dimensional Pricing. Inherit, apply and waive values retain their existing behavior. All 39 tests, TypeScript and production build checks pass.

## September 14: Shared shadcn/ui date pickers

Replaced native rate-card effective-date inputs and the Order service-window datetime input with the shared shadcn/ui Calendar + Radix Popover picker. Monitor now uses the same calendar with real month navigation and current Today/Tomorrow shortcuts instead of a fixed December 2024 grid. Monitor date selection remains local UI state. Date-only serialization avoids UTC conversion; service windows preserve organization wall time, including existing ISO instant values. Time controls use custom hour/minute dropdowns, including the service booking cutoff. Optional values can be cleared. Calendar popovers are portalled above drawers and support keyboard navigation, Escape/outside dismissal and focus return.

Added shared Calendar, Button, Popover, DatePicker, DateTimePicker and TimePicker components, date-value helpers, dependency lockfile and upstream source notice. The new components use Dispatra’s existing slate/white styling. Seven interaction/date regression tests cover selection, month navigation, clearing, keyboard/focus, form submission protection, timezone/date roundtrips, service times, shortcuts and Monitor integration. All 46 tests, TypeScript and the production build pass in an isolated copy. The existing bundle-size advisory remains. Visual browser QA could not run because no connected browser was available.

September 14 Route & Schedule layout fix: shortened the duration label to “Estimated duration” so its input aligns with adjacent fields. The cost/planning explanation remains in the section helper text. TypeScript and production build checks pass.

## September 14: Orders, Drivers, Customers and Vehicles property fixes

Implemented the frontend audit against the current Desktop client. Shared `domain/operations.ts` extends the existing local models; `Order` is now the commercial interface and `Job` its Monitor compatibility alias. Audit, branch-ready and future integration fields are typed but branch management remains hidden. No backend contract/runtime was generated or replaced.

- Orders: create/edit/save, lifecycle display/filter separate from risk, searchable references/recipients/tags, CSV with all stops and safe escaping; stable stop reorder/removal, contact/window/service/access/POD/reference fields, item description/unit/handling and pickup/delivery relationships; booking/billing snapshots, payer selection, priority/type, commodity, requirements, communications and internal notes. Existing central pricing and frozen snapshots are preserved; manual card overrides require reasons. Locked/final/executing orders cannot be edited, and versions protect an open edit from stale local records. Monitor popover/details now show the full saved stop list rather than hard-coded two-stop details.
- Drivers: create/edit, number/contact/licence, independent account/duty/work states, skills/areas, qualifications, shifts/availability periods, depot/start point, maximum minutes and notes. Browser persistence now survives reload. Connectivity is derived separately from GPS timestamps; missing timestamps are shown as unknown. Duty toggles no longer fabricate on-route progress. Driver-to-vehicle selection updates the fleet owner and prevents duplicate/in-use asset release.
- Customers: saved locations/contacts, business/person/legal name, payment terms, default service/window/instructions, communication preferences, tags/reference and existing pricing relationship; linked order history/counts. Snapshot contacts remain historical; frozen invoice preview uses the selected payer's email/terms. Save failures are surfaced.
- Vehicles: create/edit, normalized type, plate province/year, separate status/availability, volume and dimensions alongside payload/pallet constraints, equipment/areas/depot and unavailable period/reason. Removed decorative fuel/odometer/maintenance controls from these workflows; legacy data remains intact. Empty saved fleets stay empty.
- Shared validation checks IDs, duplicates, numeric values, contacts, windows, movement dependencies, overrides and entered dispatch requirements. Single-order intermediate weight/volume/pallet load and upright item fit are checked. Multi-order route optimization remains unimplemented.

Validation: TypeScript, production build and 64 tests pass (39 pricing, 7 date, 14 entity/domain/storage and 4 form interaction tests). Browser review covered Orders, new order layout, independent lifecycle/risk badges, driver editor layout and keyboard dismissal, vehicle capacity/editor layout, and customer saved-location/defaults layout. Legacy Preferred customers migrate to Active with a Preferred classification tag. Vite retains its existing large-bundle advisory. Saved data migration is tested with serialized fixtures; no customer browser storage was cleared.

Limits: This remains a local-data frontend. Stop planned/actual timestamps, normalized address/coordinates, metadata and audit fields are model-ready; telemetry/execution providers supply them later. Temperature/qualification-expiry/branch management remain deferred. No real notifications, POD collection, authoritative invoices, API integration or combined-route feasibility is claimed. Unknown legacy values and ambiguous multi-stop allocations are left unset for review, rather than guessed.

September 14 Order Details border fix: the Order Details box now uses the same light slate border as adjacent sections, and horizontal item dividers use the matching subtle slate separator color. TypeScript and production build checks pass.

September 14 Order Details dismissal: clicking the backdrop closes the details drawer. Clicks within the drawer keep it open; existing close controls and Escape handling remain available. TypeScript, entity-form interaction tests and the production build pass.


## September 14: Company/customer account milestone

Added `/platform`, `/{company}/dispatch`, and `/{company}/customer` account surfaces, with optional `/login` and company `/settings` routes. Platform owners provision companies and initial dispatcher credentials. Dispatchers create customer records and access credentials, copy transient login details, and reset passwords. Customer login has no signup or forced password-change gate; customers complete contact name/email/phone/address and optionally change their password in Account settings.

The account UI uses shadcn Button, shared accessible form controls, loading/error/empty states, TanStack Query, generated OpenAPI schema types and centralized transport. Authenticated responses are never persisted to browser storage. Profile updates use versions and stable retry keys; customer identity/role/company are server-controlled. Logout clears the account cache. Initial/reset credentials are only in component/mutation memory, with no persisted plaintext. The dispatcher list reads back profile changes made by the customer.

The existing local dispatch prototype remains at `/` and `/prototype`. It is not mounted on authenticated tenant/customer routes. Its full customer editor and saved browser data are preserved. The new company dispatch route currently covers account management only; integrating the existing operational screens and full customer field set is future work. Customer order viewing/booking, tracking, POD/invoices and native driver changes are not part of this milestone.

Added React type definitions and corrected the existing map attribution option/test event type that they exposed. Compatible Express/body-parser/qs dependency patches resolve the three reported npm advisories. The portal is split from the large map/prototype bundle.

Verification: actual PostgreSQL API isolation/account tests and a real Chromium owner → dispatcher → customer journey. Desktop/mobile customer screenshots were reviewed. TypeScript, the existing 64 tests and production build pass; the existing large prototype-bundle advisory remains. The 16 API tests and deployment limitations are recorded in [milestone verification](../api/MILESTONE.md). No production deployment or external email sending occurred.
