# Dispatra Web Client Agent Instructions

Last updated: **2026-10-08**

Read `spec.md` and `state.md` before work. `spec.md` is normative; `state.md` is verified status.

## Fixed stack and priority

- Use React, strict TypeScript, shadcn/ui, Inter, light theme, black primary actions, blue accent, and Google Maps JavaScript API through `@vis.gl/react-google-maps` for the operational Monitor.
- The original dispatcher workspace currently uses company-scoped browser demo stores after API authentication. Preserve its existing visual components and layout when connecting operational records later. Keep `/prototype` isolated.
- Static models and statuses MUST mirror the intended FastAPI OpenAPI contract. Do not invent a second domain.

## Authority and architecture

- The FastAPI/PostgreSQL API owns tenant security, state transitions, pricing authority, dispatch feasibility, route optimization, POD acceptance.
- Use one shared mock/store layer and centralized pricing, dispatch, routing, and pricing modules. Pages and visual components must not duplicate business rules.
- Use small cohesive components and shared status/formatting/validation. Review components over roughly 250 lines and hooks/functions over roughly 50 lines for mixed responsibilities; do not split cohesive logic mechanically.
- Do not put API/business logic in visual primitives or use ad hoc fetch calls. When integration begins, use generated typed OpenAPI clients and TanStack Query or the approved existing server-state layer.

## Product rules

- Exactly `AUTO` and `MANUAL` dispatch. AUTO assigns eligible Ready Orders; MANUAL leaves them unassigned until dispatcher assignment. Both automatically optimize afterward.
- Order is the commercial/pricing unit. Routes contain multiple Orders and bind one driver and one vehicle. Multiple pickups/drop-offs, explicit precedence, intermediate capacity, and stable RouteStops are mandatory.
- Driver self-assignment, arbitrary route reorder, customer price changes from assignment, and silent active-route mutation are prohibited.
- Show customer price separately from operational route distance/internal cost. Display immutable PricingSnapshot/ChargeLine detail. Completed is the final successful Order status.

## UX rules

Preserve the Monitor decisions: full-height Vancouver map, one compact sidebar, no permanent map header, floating white top-right search/notifications, an Orders list date filter, bottom-right settings/zoom, hidden layer menu, active routes, contextual popovers, concise Needs Attention, and one account menu. Use shadcn primitives, accessible non-map alternatives, loading/empty/error states, and no permanent dense TMS dashboard. Confirmations go through `confirmDialog` from `src/components/ui/ConfirmDialog.tsx`, never `window.confirm`.

Expose a clear Manual/Auto switch. Follow the latest `spec.md` and verified `state.md` for current navigation and forms: Profile contains Company and Security; Settings (formerly Pricing, at `/{company}/settings`) contains Rate Cards, Service Level, Accessorials, Fuel Surcharge, Taxes, Vehicle Types, and Preferences; Vehicles contains one fleet view. Do not restore removed Organization Settings pages or controls. The latest client pricing, tax, zone, shipper, driver, and vehicle decisions are the V1 target for API contract reconciliation; retain old fields only to read historical records. Demo fixtures must become explicit company-owned database seed data during API integration, never a silent browser-to-database import. Driver and shipper creation must create the corresponding least-privilege account transactionally once the API supports those roles. The public website owns `/`, platform administration owns `/admin`, and company workspaces use their slug as the first path segment.

## Security and quality

Never expose provider secrets or treat hidden controls as authorization. Preserve tenant/customer boundaries in mock data and future API queries. Use typed props, semantic tokens, keyboard/focus support, non-color status cues, safe overlays, and no silent TODO/dead code. Update OpenAPI-facing models when the API contract changes.

## Testing and workflow

Read relevant code and tests, make the smallest complete slice, add focused component/domain/integration tests, run the available TypeScript/lint/build checks for code changes, and update `state.md` only when implementation evidence changes. For documentation-only work, inspect links/diff and do not claim runtime behavior. Record static scenarios and API integration gaps accurately.

## Company/customer access

Use the generated OpenAPI contract in `src/portal/schema.d.ts`, centralized `src/portal/api.ts` transport and TanStack Query for authenticated pages. The authenticated dispatcher workspace renders the original `App` prototype; company Profile is API backed. Shipper and Driver operational portals must not read dispatcher browser stores. Connect operations later with typed API records and commands while preserving the original UI. No public signup or forced initial password change. Customer writes are limited to allowed profile fields; tenant, role and customer identity come from the API session. Initial/reset credentials are transient and must not enter persisted browser state, logs or query keys. Keep company URLs separate from individual dispatchers. Regenerate contracts after API changes and exercise the account browser journey.

## Cross-project change impact

For every code or behavior change, use the `changes-detector` skill at `.agents/skills/changes-detector/SKILL.md`. Trace affected code and update connected parts across this project and the other Dispatra projects when the change reaches them.

## V1 financial scope

Keep order prices and Quotes. Completed is the final successful Order status. Do not add invoice generation, invoice documents, invoice email, an Invoiced status, payment terms, payment collection or receivables workflows. Historical invoice data is retained only in private migration archives.
