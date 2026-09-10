# Dispatra Web Client — implementation state

> Updated: **2026-09-08**. Source inspection and a subsequent street-map replacement are recorded below. This remains a static-data prototype; the map change does not implement backend dispatch.

Read [spec.md](spec.md) for target behavior and [AGENTS.md](AGENTS.md) for implementation instructions. Requirements and planned components below are not implementation-complete claims.

## Observed implementation

**Stage: interactive Monitor prototype backed by local mock data. Actual app directory: `client/`.**

| Evidence | What exists | Limit |
|---|---|---|
| `src/App.tsx`, `src/data/mockData.ts`, `src/types.ts` | Local drivers/jobs/exceptions, counters, selected entities, on-demand overlays and simulated recommendation approval | Mutations only update React state; not backend dispatch, AI execution or durable assignment |
| `src/components/TorontoMap.tsx` | MapLibre via `react-map-gl/maplibre`, source/layer rendering and markers, Vancouver centre despite legacy filename, simulated movement/telemetry | Not real driver GPS or production optimization; visible data does not establish route feasibility |
| Map style references | OpenFreeMap Liberty street map using OpenStreetMap data; existing ArcGIS satellite mode retained with source attribution | No street-map key/account needed; production routing, provider compatibility and service guarantees remain separate decisions |
| `Sidebar`, `TopMetrics`, `DateControl`, `MapControls`, `DriverPopover`, `JobDetailPopover`, `DetailModalDialog` | Monitor chrome, contextual interactions, and Organization Settings | Navigation changes local selected tab/toasts; dedicated CRUD/planning/report/settings pages are prototype views |
| `PricingServicesPage`, `PricingSimulatorPage`, `SimpleSimulator`, `VehicleModal`, `ServiceModal`, `AccessorialModal`, `simplePricingStorage.ts` | Dynamic Services & Accessorials configuration (Delivery Services, Vehicle Types & Capacities 1-5 Tonnes, and Accessorial charges) and dedicated standalone Pricing Simulator page | Submenu in Organization Settings includes "Services & Accessorials" and "Pricing Simulator"; simulator operates on its own dedicated full page with instant quote calculations and cargo limit verification |
| `CustomersPage`, `customerStorage.ts` | Customers Directory under Vehicles in main navigation | Shipper & recipient accounts management, SLA tiers, address & accessorial requirements, active dispatch volume, and add/edit customer workflows with local persistence |
| `ProfilePage`, `HelpSupportPage`, `profileStorage.ts` | Dedicated clean Profile page (personal/hub details, dispatch/monitor preferences, security & sessions) and Help & Support page (status banner, operational guides, keyboard shortcuts, escalation ticket form) | Changeable logo support with drag-and-drop, direct file upload ("Upload logo"), Organization ID field and badge, reflected live in sidebar and persisted to local storage |
| `package.json` | React 19, Vite 6, TypeScript ~5.8, Tailwind 4, Lucide, Motion, MapLibre and other prototype dependencies; build/dev/type-check scripts | React Router, TanStack Query and shadcn primitives are target architecture, not demonstrated installed/implemented here; no test script declared |

No authenticated API client, generated contracts, live WebSocket/snapshot integration, persisted dispatch, CSV intake, real optimizer, public tracking endpoint/page or production AI behavior was established. Existing mock data and simulated telemetry must remain labelled prototype/demo when reused.

## Street-map replacement — 2026-09-08

- Replaced CARTO Voyager with [OpenFreeMap Liberty](https://openfreemap.org/quick_start/), a free OpenStreetMap-based street map that requires no key/account. The MapLibre renderer, static datasets, route/traffic overlays, markers, animation, selection/popovers and map controls are unchanged.
- Retained the existing satellite mode and added its imagery-source attribution; the free OpenFreeMap choice applies to the street basemap.
- Verified in an isolated copy using the installed dependencies: `npm run lint` (TypeScript) passed; `npm run build` passed with a bundle-size warning; fetched the Liberty style successfully and validated it against the installed MapLibre style schema with zero errors.
- Browser interaction/visual checks could not run because Codex's browser security-policy check was unavailable. No claim of visual verification or production integration is made.

## Preserved design direction

- Full-height map, one compact left sidebar, no conventional Monitor header, white floating summary cards.
- Main navigation Monitor/Jobs/Drivers/Vehicles/Reports; route planning through Jobs/Monitor surfaces, Settings through account flow.
- Date upper-right, map controls lower-right with options opening left, active routes visible.
- One selected-driver detail, on-demand children, at most one anchor arrow per overlay, no extra arrow on terminal recommendation.
- Light/Inter/black primary/blue accent; target shadcn primitives, central tokens and accessible non-map alternatives.

## Next implementation slices

1. **M0:** reconcile mock UI types with API-owned enums/commands and pin generated contract version; benchmark licensed map/routing combination with API.
2. **M1:** introduce router/query/auth foundations and reusable shadcn/token primitives while preserving Monitor layout. Keep prototype actions clearly separate from server-confirmed operations.
3. **M2:** connect one real job/route/driver journey and gap-safe snapshot/realtime; add pending/conflict/freshness states.
4. **M3:** complete Jobs/intake and route proposal/review/publish with unplanned-job reasons, resource readiness and version checks.
5. **M4–M6:** custody/attempt review, public projection, expiry-aware agent proposals, meaningful component/journey/accessibility/load checks and measured pilot release.

## Technical choices still to settle

- Versioned generated client/event consumption and session strategy with API.
- Map display/data rights and supported traffic/satellite/routing capabilities; do not replace MapLibre solely because an old draft said Mapbox.
- Test runner/critical journey setup, accessibility checks and real data envelope.
- Which placeholder/prototype dependencies to retain when production features are built; no dependency changes were made in this task.

## Shared decisions carried forward

- BC, English, company-managed ordinary local delivery; one operating origin; individual delivery Jobs grouped into optimized Routes; no self-claim/offer/accept/reject flow.
- FastAPI + PostgreSQL/PostGIS target; React web in `client/`; React Native driver; separate app doc sets and versioned API/event contracts.
- Job `DRAFT | READY | ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED | FAILED`; Route `DRAFT | PUBLISHED | IN_PROGRESS | FINISHED | CANCELLED`; Assignment `ACTIVE | SUPERSEDED | CLOSED`; Exception `OPEN | ACKNOWLEDGED | RESOLVED`. API owns schemas; these are alignment notes, not another implementation.
- Planning is separate from job lifecycle. Published revisions/assignment generations and operation IDs guard conflicts. Job driver derives from route assignment.
- Actual loading, attempts, custody/return and physical handover are required. Route finish and successful delivery are distinct.
- End Duty always stops local GPS immediately, including offline/active work. Routine GPS defaults to 90 days with scoped holds. Signature/name in person; photo only for permitted safe unattended delivery.
- Durable backend workers/outbox and deterministic notification policies support bounded agent exception/explanation/summary workflows. Assisted is the proposed pilot default; explicit policy controls Automatic initial publication.
- Preserve Clean/Calm/Precise light Inter black/blue design and on-demand Monitor overlays. No branch UI, custom fields builder, payment/invoicing/payroll/warehouse/compliance suite.

## Open pilot gates

1. Actual drivers/jobs/vehicles, units, service windows/durations and geography.
2. Unattended permission, reattempt/return rules, route endpoint and escalation contact. Return-to-origin is a proposed default requiring validation.
3. Workforce/data-flow privacy scope, justified GPS policy, POD/contact/audit retention, supported handsets and secure local recovery policy.
4. Provider combination/licensing/benchmark, budget, support and recovery expectations. Current demo map data is not a production contract decision.

These gates do not block ordinary foundation work. Proposed performance targets in the API spec are unmeasured and are not SLAs.

## Verification and maintenance

- The earlier requirements revision checked the nine documents only. The subsequent map change and its build/style validation are recorded above; backend/device/production workflows remain unverified.
- Subsequent implementation updates must name the changed capability and actual command/device/test result. Mark failures and unrun checks explicitly; do not turn a spec checklist into completed status.
- Milestones: M0 contracts/spikes → M1 foundations → M2 complete thin journey → M3 daily planning → M4 resilience → M5 bounded automation → M6 measured pilot release. None is complete across all apps on the evidence reviewed here.
