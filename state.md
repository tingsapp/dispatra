# Dispatra Web Client Implementation State

Last updated: **2026-09-11**

Read [spec.md](spec.md) for target behavior and [AGENTS.md](AGENTS.md) for working rules. This file distinguishes observed prototype behavior from planned functionality.

## Current stage

Interactive static-data prototype. The Monitor and several organization-management/pricing surfaces exist locally; no API integration is implemented.

## Fixed decisions

React/TypeScript, shadcn/ui direction, `react-map-gl`/`maplibre-gl`, light Clean/Calm/Precise UI, Vancouver map center, FastAPI/PostgreSQL authority, Order/Route/RouteStop vocabulary, AUTO/MANUAL dispatch, centralized API-authoritative pricing, multiple pickups/drop-offs, automatic optimization, POD, and Invoice workflow are target contracts. Existing prototype behavior is not production evidence.

## Implemented

- `src/App.tsx` and `src/data/mockData.ts` provide local drivers/jobs/exceptions, Monitor counters, selected entities, on-demand overlays, and simulated recommendation interactions.
- `src/components/TorontoMap.tsx` renders a MapLibre map through `react-map-gl/maplibre`, route/marker layers, and local simulated telemetry. The filename is legacy; the center is Vancouver.
- Monitor chrome exists through Sidebar, TopMetrics, DateControl, MapControls, DriverPopover, JobDetailPopover, and DetailModalDialog.
- Pricing module (static, localStorage-backed): `src/types/pricing.ts` (RateCard, Zone/ZoneRate, CustomerGroup, PricingOrderInput, ChargeLine, PricingSnapshot) and `src/lib/pricingEngine.ts` (`resolveRateCard`, `calculatePricing`, `estimateInternalCost`) implement the five pricing methods (Base + Distance, Fixed, Zone, Hourly, Imported), customer → group → org-service → org-default resolution with conflict/no-match/missing-distance Needs Attention errors, dimensional weight, time/load/piece/stop charges, service multiplier, vehicle surcharge, fuel-eligible base, accessorial calc types with allowances/increments/min/max/auto rules, contractual and one-off discounts, tax profiles with customer exemption, and an internal-cost/margin estimate. `RateCardsPage` (Rate Cards, Zones, Customer Groups), `PricingServicesPage` (Services with default multipliers, Vehicles with fuel eligibility, Accessorials), `BillingSettingsPage` (org defaults, tax profiles, fuel, operating cost), and `SimpleSimulator` all consume the engine; `SimpleSimulator` is the reference caller for the future Order form. `billingEngine.ts` holds only shared helpers.
- `CustomersPage`/`customerStorage.ts` provide local customer directory CRUD-like flows. Profile, Help/Support, and local profile storage also exist.
- `package.json` provides Vite dev/build and TypeScript lint scripts; declared React, TypeScript, MapLibre, `react-map-gl`, Lucide, Tailwind, and Motion dependencies are observed, not proof of production readiness.

## Partially implemented

The static prototype has Monitor/settings/pricing/customer interactions. Pricing configuration and the pricing engine follow the spec's RateCard/Accessorial/PricingSnapshot/ChargeLine model, but there is no Order entity yet: `JobsPage` still uses the legacy `Job` mock and does not call `calculatePricing`, so snapshots are not persisted on anything. Dispatch, route, and Invoice models remain unnormalized. Mock assignment/recommendation actions update React state only.

## Specified but not implemented

Authenticated API client/OpenAPI generation; FastAPI integration; tenant authorization; Order model with persisted PricingSnapshot/ChargeLines; Customer/Dispatcher Order creation with multi-stop data calling the shared pricing engine; AUTO/MANUAL assignment simulation with max active orders and hard constraints; multi-order route optimization/load progression; full Routes, Drivers, Vehicles, Reports, Needs Attention, POD, billing/invoice and tracking workflows; server state/realtime/resync; durable tests; and complete static scenario coverage.

## Known gaps / blockers

No React Router, TanStack Query, shadcn component installation, API client, websocket, or test script is established in `package.json`; they remain target architecture. Map rendering is static/demo and does not prove production routing, GPS, traffic, or satellite capability. Existing filenames and legacy terminology must not define the domain. No runtime API or end-to-end checks were run for this documentation update.

## Immediate next priorities

1. Finish Organization Settings and pricing configuration using centralized static state.
2. Finish Order create/edit/details with the shared static pricing engine.
3. Finish Customer details required by Orders/pricing/billing.
4. Finish Monitor AUTO/MANUAL behavior and pricing/dispatch Needs Attention.
5. Finish multi-order Routes and optimized route presentation.
6. Finish Driver/Vehicle operational screens.
7. Finish Billing/Invoice preview and sent states.
8. Exercise all required static end-to-end scenarios.
9. Connect to FastAPI only after static domain behavior is stable.

## Testing status

The client package declares `npm run lint` and `npm run build`; no command was run for this documentation-only task. No client test runner or end-to-end suite was found in the inspected package. Existing prototype validation must be extended with pricing, dispatch, route, settings, form, Needs Attention, and invoice scenarios.
