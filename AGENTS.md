# Dispatra Web Client Agent Instructions

Last updated: **2026-09-11**

Read `spec.md` and `state.md` before work. `spec.md` is normative; `state.md` is verified status.

## Fixed stack and priority

- Use React, strict TypeScript, shadcn/ui, Inter, light theme, black primary actions, blue accent, and `react-map-gl`/`maplibre-gl`.
- Current priority is completing the existing static-data client design and domain behavior before API integration.
- Static models and statuses MUST mirror the intended FastAPI OpenAPI contract. Do not invent a second domain.

## Authority and architecture

- The FastAPI/PostgreSQL API owns tenant security, state transitions, pricing authority, dispatch feasibility, route optimization, POD acceptance, and invoices.
- Use one shared mock/store layer and centralized pricing, dispatch, routing, and billing modules. Pages and visual components must not duplicate business rules.
- Use small cohesive components and shared status/formatting/validation. Review components over roughly 250 lines and hooks/functions over roughly 50 lines for mixed responsibilities; do not split cohesive logic mechanically.
- Do not put API/business logic in visual primitives or use ad hoc fetch calls. When integration begins, use generated typed OpenAPI clients and TanStack Query or the approved existing server-state layer.

## Product rules

- Exactly `AUTO` and `MANUAL` dispatch. AUTO assigns eligible Ready Orders; MANUAL leaves them unassigned until dispatcher assignment. Both automatically optimize afterward.
- Order is the commercial/pricing/invoice unit. Routes contain multiple Orders and bind one driver and one vehicle. Multiple pickups/drop-offs, explicit precedence, intermediate capacity, and stable RouteStops are mandatory.
- Driver self-assignment, arbitrary route reorder, customer price changes from assignment, and silent active-route mutation are prohibited.
- Show customer price separately from operational route distance/internal cost. Display immutable PricingSnapshot/ChargeLine detail and idempotent Invoice status after completion.

## UX rules

Preserve the Monitor decisions: full-height Vancouver map, one compact sidebar, no permanent map header, floating white top-right search/notifications/date, bottom-right settings/zoom, hidden layer menu, active routes, contextual popovers, concise Needs Attention, and one account menu. Use shadcn primitives, accessible non-map alternatives, loading/empty/error states, and no permanent dense TMS dashboard.

Expose a clear Manual/Auto switch and simulate both modes in static data. Settings must include the max-active-orders dispatch policy (General tab) and pricing subsections. The Price Simulator and Order form must call the same centralized local pricing function.

## Security and quality

Never expose provider secrets or treat hidden controls as authorization. Preserve tenant/customer boundaries in mock data and future API queries. Use typed props, semantic tokens, keyboard/focus support, non-color status cues, safe overlays, and no silent TODO/dead code. Update OpenAPI-facing models when the API contract changes.

## Testing and workflow

Read relevant code and tests, make the smallest complete slice, add focused component/domain/integration tests, run the available TypeScript/lint/build checks for code changes, and update `state.md` only when implementation evidence changes. For documentation-only work, inspect links/diff and do not claim runtime behavior. Record static scenarios and API integration gaps accurately.
