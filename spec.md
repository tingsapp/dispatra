# Dispatra Web Client Specification

> Normative React/TypeScript dispatcher and organization web application contract. `MUST`, `MUST NOT`, `SHOULD`, and `MAY` are intentional.
> Last updated: 2026-09-11

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

Reach settings through Account menu -> Organization Settings. Use sections General, Pricing, Services, Vehicles, Customers/Groups, and Taxes; the Auto/Manual dispatch switch stays in the sidebar footer. Keep pricing manageable: General; Rate Cards; Zones; Accessorials; Discounts/Tax relationships; Price Simulator.

Dispatch policy is limited to `dispatch_mode` (sidebar switch), `max_active_orders_per_driver` (General tab), location stale threshold when exposed, and only required route/assignment policy fields. Do not expose dozens of AI weighting knobs.

Pricing settings support currency, distance/weight/dimension units, fuel default, dimensional pricing/divisor, waiting allowance/increment, included stops, extra-stop default, and tax profile. Rate Cards support name, scope/customer/group, method, service, optional vehicle, effective dates, priority, method-specific values, minimum, multiplier, fuel override, dimensional settings, included weight/pieces/stops, and waiting settings. Zones support list, simple origin/destination matrix, and no-match fallback. Accessorials support code/name, calculation type, rate/unit, allowance/increment, min/max, fuel eligibility, taxable, active, and simple auto rule. Vehicle pricing supports surcharge and fuel eligibility. Customer pricing supports specific card, group, discount, tax profile/exemption.

The API Rate Card precedence is explicit override/import, customer-specific, group, organization service-specific, then organization default, with most-specific combination within a level and conflict Needs Attention. The client MUST show resolved card, method, pricing status, ChargeLines, subtotal, tax, total, and `View calculation`. `null` inherits; numeric zero means explicitly zero.

## 6. Price Simulator and Order workflows

The Price Simulator MUST call the same local pricing function used by Order creation. Inputs include Customer, Service, Vehicle, pickup/drop-off Stops, priced distance/duration, Packages, weight/dimensions/pieces, wait, and Accessorials. Output includes resolved Rate Card, method, individual ChargeLines, fuel base, discount, tax, total, and pricing errors. It MUST NOT become a separate calculation.

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
9. Only when static design/domain behavior is stable, connect to FastAPI using generated typed OpenAPI contracts and the approved server-state data layer.

Do not redesign the existing client from scratch; extend and normalize it where it already satisfies these requirements.
