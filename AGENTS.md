# Dispatra Web Client Agent Instructions

## Stack and authority

- React, strict TypeScript, shadcn/ui, Inter, light theme, black primary actions, blue accent; Google Maps JavaScript API through `@vis.gl/react-google-maps` for the Monitor.
- The FastAPI/PostgreSQL API owns tenant security, state transitions, pricing, dispatch feasibility, route optimization and POD acceptance. Client models and statuses mirror the generated OpenAPI contract (`src/portal/schema.d.ts`); never invent a second domain or client-only statuses. Regenerate it after API changes.
- Server state goes through `src/portal/api.ts` / `src/operations/` and TanStack Query; no ad hoc fetch calls and no API/business logic in visual primitives. Pages and components must not duplicate pricing, dispatch or routing rules.
- Keep `/prototype` isolated: its browser stores never feed the dispatcher workspace or the Shipper/Driver portals.
- Small cohesive components with shared status/formatting/validation; review components over ~250 lines and hooks/functions over ~50 lines for mixed responsibilities without splitting cohesive logic mechanically.

## Product rules

- Exactly `AUTO` and `MANUAL` dispatch. AUTO assigns eligible Ready Orders; MANUAL waits for dispatcher assignment. Both optimize afterward.
- Order is the commercial/pricing unit. Routes hold multiple Orders and bind one driver and one vehicle; multiple pickups/drop-offs, explicit precedence, intermediate capacity and stable RouteStops are mandatory.
- No driver self-assignment, arbitrary route reorder, price changes from assignment or silent active-route mutation.
- Show customer price separately from route distance/internal cost; display immutable PricingSnapshot/ChargeLine detail.
- Completed is the final successful Order status. V1 keeps prices and Quotes but has no invoices, Invoiced status, payment terms, payment collection or receivables.
- Creating a Driver or Shipper creates the matching least-privilege account; public trial signup creates only a company and its dispatcher. No forced initial password change. Initial/reset credentials never enter persisted browser state, logs or query keys.
- URLs: `/` public site, `/admin` platform administration, `/{slug}/…` company workspace (company URLs, not per-dispatcher), `/{slug}/shipper` and `/{slug}/driver` role portals.

## UX rules

Preserve the Monitor: full-height Vancouver map, one compact sidebar, no permanent map header, floating white top-right search/notifications, Orders list date filter, bottom-right settings/zoom, hidden layer menu, active routes, contextual popovers, concise Needs Attention, one account menu, clear Manual/Auto switch; no dense TMS dashboard. Profile holds Company and Security; Settings (`/{slug}/settings`) holds Rate Cards, Service Level, Accessorials, Extra time, Fuel Surcharge, Taxes, Vehicle Types, Package Types and Preferences; Vehicles is one fleet view. Don't restore removed Organization Settings pages. Confirmations use `confirmDialog` (`src/components/ui/ConfirmDialog.tsx`), never `window.confirm`. Provide loading/empty/error states, keyboard/focus support, non-color status cues and accessible non-map alternatives.

## Security

Never expose provider secrets or treat hidden controls as authorization. Tenant, role and customer identity come from the API session; customer writes are limited to allowed profile fields.

## Testing

Read relevant code and tests, make the smallest complete slice, add focused tests, and run `npm run lint`, the relevant tests and `npm run build` for code changes. For documentation-only work, check links and the diff; don't claim runtime behavior.
