# Dispatra Web Client Specification

> Normative React/TypeScript dispatcher and organization web application contract. `MUST`, `MUST NOT`, `SHOULD`, and `MAY` are intentional.
> Last updated: 2026-09-14

## 1. Purpose and authority

The web client serves organization admins, dispatchers, and the limited customer-facing tracking projection. It provides Monitor, Orders, Routes, Drivers, Vehicles, Customers, Reports, Organization Settings, Profile, Help, and invoice views. The FastAPI/PostgreSQL API owns authorization, state transitions, pricing, dispatch, route feasibility, POD acceptance, and invoice truth. The client MUST NOT invent or bypass those rules.

Dispatra V1 is a simple English-only local-delivery system for British Columbia, Canada. The fixed stack is React, TypeScript strict mode, Vite, shadcn/ui, and `react-map-gl` with `maplibre-gl`. The UI is Clean, Calm, Precise: light theme, Inter, black primary actions, blue secondary/accent, semantic status colors, restrained overlays, and accessible non-map alternatives.

The client must support both final API-connected behavior and the current static/local-data phase. Static domain models MUST mirror intended API schemas so the transition does not rewrite the UI.

## 2. Shared domain contract

Use Order as the commercial/pricing/invoice unit. An optional DeliveryJob is an operational child, never a competing lifecycle. A Route belongs to one driver and one vehicle and may contain multiple Orders. A RouteStop is a stable-ID pickup or drop-off visit; repeated addresses remain separate. V1 supports all pickup/drop-off cardinalities and interleaved sequences, provided linked pickup precedes delivery and capacity is valid at each leg.

Order lifecycle is `DRAFT -> SUBMITTED -> PRICED -> READY_FOR_DISPATCH -> ASSIGNED -> IN_EXECUTION -> COMPLETED -> BILLING_FINALIZATION -> INVOICED`, with `CANCELLED`, `FAILED`, and `NEEDS_ATTENTION` as exception states. Do not create dozens of client-only statuses. Route, stop, assignment, pricing, and invoice statuses are separate.

Exactly two organization dispatch modes exist: `AUTO` and `MANUAL`. AUTO assigns feasible READY Orders and automatically optimizes. MANUAL leaves READY Orders unassigned until a dispatcher chooses Driver/Vehicle, then the backend validates and automatically optimizes. AI may recommend in Manual but MUST NOT assign. Neither mode may rewrite locked/in-progress routes automatically. Drivers cannot self-assign. `max_active_orders_per_driver` lives in Organization Settings -> Billing, Tax & Cost -> General (Dispatch card); the pricing engine MUST NOT read it and it never changes customer price.

The client displays customer price from API PricingSnapshot/ChargeLines and may use the same centralized local pricing module for static scenarios. Customer price is independent of driver, deadhead, workload, merged route distance, dispatcher choice, and later optimization. Show priced order distance separately from operational route distance and deadhead. Invoice lines come from finalized ChargeLines; normal completion generates an idempotent Invoice and sends it to the customer's billing email.

## 3. Static-domain architecture

Until API integration, centralize local data and behavior in a small domain layer, conceptually:

```text
src/domain/       models, statuses, validation
src/mock/         centralized static store and scenarios
src/pricing/      rate resolution and calculatePricing
src/dispatch/     eligibility and evaluateAssignment
src/routing/      optimizeRoute simulation and validation
src/billing/      finalized pricing and invoice simulation
```

Required shared functions resemble `resolveRateCard(order, context)`, `calculatePricing(order, context)`, `evaluateAssignment(order, drivers, vehicles, routes, settings)`, and `optimizeRoute(routeInput)`. Pages and visual components consume results; they MUST NOT duplicate formulas, state machines, or dispatch decisions. Static scenarios MUST include:

1. Base + Distance order; 2. Direct multi-stop; 3. customer-specific Zone; 4. Fixed with dimensional weight; 5. Hourly actual-duration settlement; 6. Imported price; 7. zone no-match Needs Attention; 8. Rate Card conflict Needs Attention; 9. missing distance price unavailable; 10. driver at maximum ineligible in AUTO; 11. multi-pickup/multi-drop optimized Route; 12. intermediate capacity overload; 13. completion -> finalized price -> Invoice -> Sent; 14. invoice send failure; 15. locked price unchanged after reassignment; 16. operational distance changes while customer price stays unchanged.

Demo monetary values MUST be labelled static/demo values, not industry defaults.

## 4. Monitor

Monitor is the primary operational screen. It uses a full-height Vancouver, British Columbia map rendered with `react-map-gl` and `maplibre-gl`. There is no separate permanent top header over the map. Keep one compact sidebar and active routes visible. Floating top-right controls are search, notifications, and date, on white backgrounds. Bottom-right controls are map settings and zoom; Map/Satellite/Traffic/Labels options stay hidden until the settings menu opens. Use contextual popovers/dialogs close to the source. Keep account/profile in one account menu.

Show concise Active Routes/Orders, Available Drivers, and Needs Attention surfaces. Driver and Order markers have semantic tooltips/popovers; selected route/driver detail is on demand. Needs Attention rows state what happened, why it matters, and the recommended action. Examples include pricing unavailable/conflict, no eligible driver, maximum count, infeasible/capacity/precedence route, stale location, failed pickup, missing POD, missing billing data, and invoice email failure.

Expose a prominent switch labelled `Dispatch Manual [switch] Auto`; visually distinguish the active state, confirm changes, and show feedback. Static behavior is AUTO ready Order -> simulated assignment -> optimized Route, or MANUAL ready Order -> unassigned -> dispatcher Assign Driver -> optimized Route. API behavior is authoritative after integration.

## 5. Organization Settings and pricing

The September 12 user-approved rules in [pricing-rules.md](pricing-rules.md) govern calculation order and explicit contract controls. Base + Distance never charges routine time; hourly contracts explicitly define their clock and inclusions. Minimum freight is applied after the service multiplier, and minimum order subtotal after discounts/manual adjustments, both excluding tax. Fuel uses eligible lines only. Discount inheritance is Customer → Rate Card → Group, where INHERIT continues and NONE stops. Zone prices may be contractual and use explicit pickup-to-delivery movements. Imported final agreed totals are preserved with explicit tax treatment. Margin is an estimate/warning, not a price adjustment. Existing quoted terms and finalized amounts remain frozen.

Reach settings through Account menu -> Organization Settings. Use sections General, Pricing, Services, Vehicles, Customers/Groups, and Taxes; the Auto/Manual dispatch switch stays in the sidebar footer. Keep pricing manageable: General; Rate Cards; Zones; Accessorials; Discounts/Tax relationships.

Dispatch policy is limited to `dispatch_mode` (sidebar switch), `max_active_orders_per_driver` (General tab), location stale threshold when exposed, and only required route/assignment policy fields. Do not expose dozens of AI weighting knobs.

Pricing settings support currency, distance/weight/dimension units, fuel default, dimensional pricing/divisor, waiting allowance/increment, included stops, extra-stop default, and tax profile. Rate Cards support name, scope/customer/group, method, service, optional vehicle, effective dates, priority, method-specific values, minimum, multiplier, fuel override, dimensional settings, included weight/pieces/stops, and waiting settings. Zones support list, simple origin/destination matrix, and no-match fallback. Accessorials support code/name, calculation type, rate/unit, allowance/increment, min/max, fuel eligibility, taxable, active, and simple auto rule. Vehicle pricing supports surcharge and fuel eligibility. Customer pricing supports specific card, group, discount, tax profile/exemption.

The API Rate Card precedence is explicit override/import, customer-specific, group, organization service-specific, then organization default, with most-specific combination within a level and conflict Needs Attention. The client MUST show resolved card, method, pricing status, ChargeLines, subtotal, tax, total, and `View calculation`. `null` inherits; numeric zero means explicitly zero.

Within the customer and group levels, an eligible card explicitly selected on that profile takes precedence over other matching cards, regardless of their specificity or priority. Ineligible or missing selections fall back to eligible matches under the normal rules; customer-level matches still precede group selections, and an explicit Order override remains first. Tax-inclusive accessorial unit rates and per-stop limits retain precision until the completed charge is rounded. Manual per-minute accessorials expose an entered minute quantity in the Order form; only the `WAITING_RECORDED` rule is omitted from manual selection.

Following the user's decision to remove routine time billing, browser-stored Base + Distance and Zone cards automatically retire obsolete minute rates and included minutes on load/save, with a single version increment. Historical fields do not block or alter new calculations. Existing unfinished estimates blocked by `LEGACY_TIME_PRICING` are retried on load using current settings; successful quotes, final snapshots, completed orders and invoice-bearing orders remain unchanged. Hourly contract rates and waiting accessorials retain their existing behaviour.

## 6. Order pricing workflows

The standalone Pricing Simulator page was removed at the user’s request. Order creation and pricing previews MUST use the centralized local pricing function. Inputs include Customer, Service, Vehicle, pickup/drop-off Stops, priced distance/duration, Packages, weight/dimensions/pieces, wait, and Accessorials. Output includes resolved Rate Card, method, individual ChargeLines, fuel base, discount, tax, total, and pricing errors. Pages MUST NOT duplicate the pricing calculation.

Dispatcher-created and customer-created Orders share the domain model. Dispatcher Order creation collects source, Customer/contact, reference/PO, Service, schedule/window, one or more pickups/drop-offs, package/item quantity/weight/dimensions/declared value, required vehicle, accessorials, location/general instructions. Show live estimate, resolved card, status, breakdown, subtotal/tax/total, calculation details, and authorized override with reason. Do not make dispatcher choose every pricing constant.

Customer details show identity/contact/billing email, useful addresses, active/completed Orders, pricing relationship, card/group, discount, tax profile/exemption, and invoices without becoming a large CRM. Order details show all linked stops/jobs/items, pricing snapshot/version, ChargeLines, assignment, route, POD, completion, and Invoice status.

## 7. Routes, drivers, vehicles, invoices

Route details show driver, vehicle, status, optimized stop order, Orders, pickup/drop-off type, ETAs/windows, distance, duration, load/capacity progression, optimization status, and exceptions. Explain that operational route distance is not customer priced order distance. Allow pre-start assignment/reassignment, reoptimization, lock/unlock, and cancellation only when API validation permits. Manual reorder always revalidates through API. Never insert silently into an executing Route.

Driver details show identity, On Duty/Off Duty, availability, current vehicle/Route, assigned Orders count and maximum, next work, last GPS timestamp/freshness, progress, and operational history. Never expose customer pricing. Vehicle details show type, availability, current driver/Route, capacities, equipment, and status.

After completion/finalization, Invoice detail/preview displays invoice number, Customer/billing details, Order, finalized ChargeLines, subtotal, discount, adjustments, tax, total, generated date, and sent status. Static prototype may simulate email sending; API-connected behavior sends the finalized Invoice through backend workflow. Resending uses the existing invoice and never recalculates or duplicates it.

## 8. Customer tracking and privacy

The optional public page `/track/:token` consumes only a token-scoped API projection for one Order/customer. It may show organization, delivery status, ETA/window, limited final-leg location, destination summary, and completion. It MUST NOT show other customers, route manifests, driver contact, internal notes, unrestricted history, or cross-customer invoices/tracking. Use private/no-store responses, token expiry/revocation, freshness/stale status, and minimal PII.

All client roles use backend authorization. Never put provider secrets in browser code. Tenant isolation, TLS, secure uploads, least privilege, audit, safe cached data, minimal push PII, and immutable historical pricing/invoices are mandatory. V1 is English-only.

## 9. UI quality and testing

All date selection uses the shared shadcn/ui Calendar + Popover picker, including Monitor, rate-card effective dates and Order service windows. Native date/datetime pickers are not used. Date-only values remain YYYY-MM-DD; service windows retain organization wall time with a separate 24-hour time control. Optional dates can be cleared.

Use shadcn/ui primitives and Lucide icons. Prefer small cohesive components, shared status mappings, formatting, validation, and tokens. Use loading/empty/error states for every data surface. Use accessible labels, keyboard focus, non-color status cues, tooltips for unfamiliar icons, responsive popovers/sheets, and non-map alternatives. Avoid oversized TMS dashboards, neon/AI styling, excessive permanent panels/charts, nested cards, and giant components.

Until API integration, test static pricing/scenarios, Rate Card resolution, Order forms/details, AUTO/MANUAL simulation, Needs Attention, route view, customer/driver/vehicle views, settings, and invoice preview. After integration, test generated-client contracts, optimistic/pending/conflict states, idempotency, tenant permissions, Monitor/resync, and route/order/invoice journeys.

## 10. Client implementation sequence

1. Finish Organization Settings and pricing configuration with static data.
2. Finish Order create/edit/details using the shared static pricing engine.
3. Finish Customer details required by Orders, pricing, and billing.
4. Finish Monitor AUTO/MANUAL behavior and pricing/dispatch Needs Attention.
5. Finish Routes and optimized multi-order presentation.
6. Finish Driver/Vehicle operational screens.
7. Finish Billing/Invoice preview and sent states.
8. Exercise complete static end-to-end scenarios.
9. The user-approved company/customer account milestone in §12 begins API integration now. Connect operational modules incrementally using generated OpenAPI contracts, preserving their existing behavior and data.

Do not redesign the existing client from scratch; extend and normalize it where it already satisfies these requirements.

## 11. V1 entity property audit — September 14

The frontend commercial type is `Order`; `Job` remains a compatibility alias for existing Monitor fields. `lifecycleStatus` uses §2's contract, while the legacy Monitor risk badges remain an independent projection. Branch/organization/audit/integration fields are represented without branch-management UI. Existing saved records remain readable; do not fabricate missing capacity, GPS timestamps, contacts, or multi-stop item allocations.

Order create/edit must persist ordered stable-ID stops, per-stop recipient contacts/windows/service duration/access/instructions/POD requirements and reference, item handling units and explicit pickup/delivery links, references, priority/type, commodity, skills/equipment/service area, billing customer, internal notes and communications. Reorder/delete must retain IDs and reject broken precedence or item links. Source and external references remain separate. Pricing stays in PricingSnapshot, including currency, method, totals, overrides with reasons, imports and frozen calculation context. Customer and billing snapshots remain fixed unless the selected account changes during an allowed edit. Editing execution/completion/finalized orders is blocked. The UI shows saved windows and all stops in both Orders and Monitor detail views.

Customer profiles remain lightweight: business/person identity, legal/display name, saved locations, contact/billing email, existing pricing relationship, payment terms, service/window/instruction defaults, communications, tags and external reference. Order history/counts use linked Orders. Payers may differ from ordering customers; invoice previews use the frozen payer's billing email and terms. English is V1's language, and monetary currency follows organization pricing.

Driver account, duty and workload are independent. Duty changes do not invent route progress or GPS samples. Persist driver number, contact/licence, employment, skills/service areas, qualified vehicle types, shift bounds, maximum work minutes, availability periods, depot/start location, current vehicle, notes and reference. Derive connectivity from app timestamps (prototype display: online through 2 minutes, stale through 15, offline afterward; absent/invalid/future timestamps are unknown), separately from GPS capture and permission state. Vehicle ownership must be consistent with driver selection; do not release an in-use asset through a profile change.

Vehicles expose record status, availability/reason/period, normalized catalogue type, number, plate/province, make/model/year, payload, volume, cargo dimensions, pallet capacity, equipment, service area, depot, reference, notes and current assignment. Maintenance, fuel and inspection modules are outside this V1 slice. Legacy values remain stored for compatibility.

Local assignment validates entered driver/asset constraints and per-stop load progression for explicitly linked items. Unknown dimensions/capacity remain unknown; passing these checks is not proof of combined-route feasibility. API route optimization, combined-order constraints, live GPS, POD capture, communication delivery and authoritative invoicing remain future integrations.


## 12. Company and customer access milestone


The platform owner provisions dispatch companies. A permanent organization UUID owns company records; a unique company slug identifies /{company}/dispatch and /{company}/customer. /platform is the owner portal. One shared PostgreSQL database uses organization constraints, application authorization and row-level security. Dedicated databases are deferred.

Dispatchers create customer records and login credentials; no public registration or invitation acceptance flow exists. First login does not force a password change. Customers may change their password voluntarily, and complete contact name, email, phone and address. Business identity, status and commercial settings remain dispatcher-controlled. Passwords are hashed; generated initial/reset credentials are shown only in the creating browser and must not be stored in browser persistence or API response logs.

Milestone acceptance: owner creates company and first dispatcher; dispatcher creates customer access and copies login details; customer signs in, edits own profile, and optionally changes password. Changes persist in PostgreSQL. Cross-company/customer access, role escalation, replay conflicts and unauthorized profile fields are rejected. Password reset revokes old sessions.

This milestone adds authenticated account pages alongside the existing local dispatch prototype. Orders/pricing/driver/vehicle integrations, subscriptions, email delivery and customer bookings remain later milestones. Existing browser-only customer records are not silently imported into an arbitrary company. Future migration must preserve their full commercial/default fields and require an explicit organization mapping.
