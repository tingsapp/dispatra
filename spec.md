# Dispatra Web Client Specification

> **Normative implementation specification.** `MUST`, `MUST NOT`, `SHOULD`, and `MAY` are intentional.  
> This document is the source of truth for the React dispatcher/admin application.

## Document control

- Revision: **2026-09-08 — research reconciliation**.
- Basis: the earlier Dispatra Requirements Guide, the requirements research of 2026-09-08, and inspection of these three local apps.
- This file defines target behavior; [state.md](state.md) records observed implementation. A specified endpoint, component or test is not evidence that it exists.
- Confirmed product choices are in the baseline. Newly specified safeguards are requirements of this revision. Values labelled **proposed pilot default/target** remain configurable assumptions requiring validation, not measured performance or customer promises.
- The API specification owns domain states, command/event schemas and server permissions. Web and driver specs own their respective interactions. Publish versioned OpenAPI/event contracts and generated clients; do not maintain independent handwritten transport enums.
- This revision supersedes conflicting earlier draft behavior, especially blocking End Duty, blanket GPS deletion, independently assigning a job's driver, and treating an agent SDK as durable job execution.

## 0. Product baseline

Dispatra V1 is an AI-powered dispatch system for small and mid-sized **local delivery / last-mile businesses in British Columbia, Canada** operating their own drivers.

Primary model:

- one pickup/origin;
- one or more delivery jobs/drop-offs;
- each drop-off is an individual delivery job;
- Dispatra groups jobs into optimized routes;
- one company driver is directly assigned to each route;
- no driver self-assignment;
- route optimization is required;
- monitor is map-first and exception-first;
- customer SMS/email notifications are required; lightweight tracking is a V1 target subject to the restricted public projection and privacy acceptance checks;
- multi-branch must be architecture-ready but is not exposed in V1.

Scope and operating rules:

- V1 serves company-managed, industry-neutral ordinary local delivery; it is dispatch software, not a general TMS or marketplace.
- No V1 invoicing/payments, payroll, warehouse, qualification/compliance suite, custom-field builder or branch-management UI.
- One active operating origin in the V1 UI; each route has one common origin. An origin is not a branch.
- Direct assignment has no offers, acceptance/rejection timers or self-claiming. Device acknowledgement is delivery telemetry, not driver consent to an offer.
- Future work can be planned against shifts while a driver is Off Duty. Immediate automatic dispatch requires current readiness; route start is an explicit driver action.
- Unattended delivery requires both permission for that job and a safe place. Refusal, unsafe drop or inaccessible premises follows the failed-attempt/issue path.

Fixed visual direction:

- **Clean**
- **Calm**
- **Precise**
- light theme;
- Inter font;
- black primary actions;
- blue secondary/accent;
- shadcn/ui components and styling conventions.

---

# 1. Web application purpose

The React application is used by:

- Organization Admin;
- Dispatcher.

Primary surfaces:

- Monitor;
- Jobs;
- Routes;
- Drivers;
- Vehicles;
- Reports;
- Settings;
- Profile;
- public customer tracking page.

The web application MUST NOT own authoritative dispatch rules.

---

# 2. Stack

Required:

- React;
- TypeScript strict mode;
- Vite;
- React Router;
- TanStack Query;
- shadcn/ui;
- Tailwind CSS as used by shadcn/ui;
- Lucide icons;
- MapLibre GL / Mapbox GL JS or the display SDK chosen by the provider benchmark; the current static-data prototype uses MapLibre with OpenFreeMap Liberty for its street map (user-requested replacement, 2026-09-08), with no API key required. Keep route/marker interactions when changing the basemap; production routing/provider rights remain a separate decision;
- WebSocket client;
- versioned generated API types/client from the canonical FastAPI OpenAPI contract, plus versioned event schemas.

State rules:

- server state → TanStack Query;
- transient component state → React state;
- cross-feature ephemeral client state → lightweight store only if justified;
- do not duplicate server entities in a global store;
- do not put authoritative business rules in frontend state.

---

# 3. Design system foundations

## 3.1 Brand personality

The interface must feel:

- Clean
- Calm
- Precise

Avoid:

- neon AI aesthetics;
- gradients used decoratively;
- dashboard clutter;
- permanent dense panels;
- visual noise;
- overuse of cards;
- animations that do not communicate state.

## 3.2 Theme

Default: light.

Dark mode is not required in V1.

## 3.3 Font

Use **Inter**.

Fallback: system sans-serif.

## 3.4 Color system

Use semantic CSS variables/tokens.

Recommended starting palette:

```text
background            white
foreground            near black
card                   white
card-foreground        near black
primary                black
primary-foreground     white
secondary              very light neutral
secondary-foreground   near black
accent                 blue
accent-foreground      white
muted                  very light gray
muted-foreground       medium gray
border                 light gray
success                green
warning                amber
destructive            red
```

Exact hex values MUST live in one theme file and may be refined after final logo selection.

Feature components MUST NOT hardcode arbitrary colors.

## 3.5 Typography

Use restrained operational scale.

Recommended:

- 12 px / xs → metadata;
- 14 px / sm → most controls and secondary text;
- 16 px / base → body/important values;
- 18 px / lg → dialog/card headings;
- 20–24 px → page headings where necessary.

Do not use marketing-size headings inside Monitor.

## 3.6 Spacing

Use 4 px base rhythm.

Typical:

- 4 px micro-gap;
- 8 px tight control gap;
- 12 px related group gap;
- 16 px standard component/card padding;
- 20–24 px section spacing.

## 3.7 Radius

Recommended:

- input/button: 8 px;
- popover/dialog/card: 10–12 px;
- badge/chip: rounded/pill only where semantically appropriate.

## 3.8 Border/shadow

Borders: light neutral.

Floating map overlays MAY use subtle shadow.

No dramatic shadows.

## 3.9 Motion

Use motion only for:

- popover/dialog transition;
- loading;
- brief visual transitions between fresh real driver samples (never extrapolate stale movement);
- route focus;
- toast.

Typical duration: 120–220 ms.

Respect reduced-motion preference.

---

# 4. shadcn/ui policy

Use shadcn/ui primitives wherever an equivalent exists.

Required primitives:

- Button
- Input
- Textarea
- Label
- Checkbox
- RadioGroup
- Select
- Command
- Popover
- Dialog
- AlertDialog
- DropdownMenu
- Tooltip
- Tabs
- Badge
- Avatar
- Calendar
- Table
- ScrollArea
- Separator
- Skeleton
- Card
- Sonner/Toast
- Sheet only where explicitly justified

Do not recreate basic controls from scratch.

---

# 5. Primitive component rules

## 5.1 Button

Use shadcn Button.

Variants:

- `default` → black primary;
- `secondary`;
- `outline`;
- `ghost`;
- `destructive`;
- `link` sparingly;
- icon sizes.

Rules:

- one dominant primary action per decision area;
- irreversible actions require AlertDialog;
- loading state disables repeated submission;
- icon-only button requires Tooltip + `aria-label`;
- disabled state must remain readable;
- minimum visible height around 36–40 px depending size.

## 5.2 Input

Use shadcn Input.

States:

- default;
- focus;
- disabled;
- read-only;
- invalid.

Rules:

- visible Label unless search semantics make a visually hidden label more appropriate;
- error text directly below;
- placeholder is not a label;
- numeric fields define units.

## 5.3 Textarea

Use for instructions/notes.

Auto-grow MAY be used with sensible maximum.

## 5.4 Select

Use for small bounded choices.

For searchable lists like driver selection, use Command + Popover combobox.

## 5.5 Checkbox

Independent multi-select only.

## 5.6 RadioGroup

Mutually exclusive selection.

## 5.7 Badge

Semantic variants:

- `success`
- `warning`
- `destructive`
- `neutral`
- `active`

Must include text, not color alone.

## 5.8 Avatar

Use for user/driver identity.

Fallback initials if no image.

## 5.9 Tooltip

Use for:

- icon-only actions;
- uncommon map controls;
- truncated controls.

Do not use explanatory black tooltips as permanent documentation in production UI.

## 5.10 Popover

Primary contextual overlay on Monitor.

Rules:

- opens close to trigger;
- collision-aware;
- closing parent closes child;
- exactly zero or one source-direction arrow;
- arrow exists only to show trigger relationship;
- no decorative arrows;
- nested overlays maintain obvious hierarchy without stacked modal focus traps;
- return focus to the trigger; on narrow viewports reuse the same content in a sheet;
- production overlays begin closed and open on demand; an all-open view is a demo/test fixture only.

## 5.11 Dialog

Use for focused modal workflows that should interrupt context.

Avoid modal dialogs on Monitor if anchored popover is more appropriate.

## 5.12 AlertDialog

Use for:

- cancel job;
- cancel route;
- deactivate driver/vehicle;
- destructive settings action.

## 5.13 Tabs

Use when one entity has several compact information categories.

Do not create tabs with only one meaningful item.

## 5.14 Table

Use shadcn Table.

Every table MUST define:

- loading skeleton;
- empty state;
- error state;
- row actions;
- server pagination;
- sorting;
- responsive overflow.

---

# 6. Application shell

## 6.1 Authenticated layout

```text
┌──────────────┬──────────────────────────────────┐
│ Sidebar      │ Main page / full-height map      │
│              │                                  │
└──────────────┴──────────────────────────────────┘
```

## 6.2 Sidebar

V1 main items:

- Monitor
- Jobs
- Drivers
- Vehicles
- Reports

Preserve the current compact sidebar. Route planning/detail remains a full feature accessed through Jobs/Monitor actions (and may have its own URL); do not add a separate top-level Routes item by default. Organization Settings is reached from the account popover. The older draft top-level Routes/Settings list is superseded by this navigation baseline.

Bottom account trigger:

- avatar;
- name;
- role.

Account trigger opens an anchored popover, not an expanding sidebar section.

Active navigation item:

- restrained selected state;
- blue or neutral accent;
- no loud full-row color block.

V1 does not show Branches.

## 6.3 Page toolbar

Non-Monitor pages MAY have a compact page header containing:

- page title;
- search/filter;
- primary action.

Monitor MUST NOT use a conventional full-width header above map.

---

# 7. Monitor page

Monitor is the primary operational screen.

## 7.1 Layout

Requirements:

- map fills full available content height and width;
- sidebar is the only permanent side chrome;
- map remains visible behind overlays;
- no page header band;
- floating white summary cards;
- controls positioned over map;
- interaction remains smooth.

## 7.2 Initial visible information

Keep first glance minimal.

Show:

- Active Routes/Jobs count;
- Available Drivers count;
- Needs Attention count;
- date control;
- map;
- active routes;
- relevant driver/job markers;
- map controls.

Do not permanently show:

- full driver detail;
- full job detail;
- full AI activity feed;
- large analytics panels.

## 7.3 MonitorStatCard

Small white card.

Props:

- label;
- count/value;
- optional semantic indicator;
- onClick.

States:

- loading;
- default;
- warning/critical.

Cards:

- Active
- Available Drivers
- Needs Attention

Needs Attention may use red badge/icon but remain visually restrained.

## 7.4 DateControl

Top-right.

Composed from:

- Button
- Popover
- Calendar

Displays:

- calendar icon;
- selected date;
- chevron down.

Popover opens below.

V1:

- Today;
- Tomorrow;
- custom single date.

## 7.5 MapControls

Bottom-right vertical group:

- settings/layers;
- zoom in;
- zoom out.

Use icon Buttons.

Settings popover opens left.

## 7.6 MapOptionsPopover

Options:

- Map/Base;
- Satellite;
- Traffic;
- Labels.

Use Radio/Checkbox depending exclusivity.

One arrow pointing toward settings trigger if visual arrow is used.

## 7.7 Map layer model

Order:

1. basemap;
2. optional traffic;
3. route lines;
4. pickup;
5. drop-off/job markers;
6. driver layers;
7. selected entity highlight;
8. context overlays.

## 7.8 Driver map layer

Large data sets MUST use the chosen map SDK’s source/style layers (MapLibre in the existing prototype).

Do not render hundreds of DOM markers.

Driver status representation:

- on duty + available → green;
- active/busy → blue;
- stale → amber;
- exception/critical → red;
- off duty → gray or hidden by default.

Selected driver:

- halo/outline;
- may use richer DOM marker.

## 7.9 DriverDetailPopover

Trigger: driver marker.

Fields:

- Avatar;
- name;
- duty/work status;
- vehicle;
- current route;
- next stop;
- ETA;
- last location timestamp/freshness;
- Call;
- Message if messaging enabled;
- overflow.

Rules:

- only one selected-driver popover;
- no duplicate D14/compact duplicate;
- exactly one source arrow if used;
- arrow points to marker;
- stale GPS must be visible textually.

Overflow actions:

- View Driver;
- View Route;
- View duty/availability and report an issue; no remote restart of Off Duty GPS;
- Reassign Route before start;
- Report/View Issue.

## 7.10 Job marker

Represents one drop-off job.

State styles:

- Ready/unplanned;
- In proposed plan (planning badge, not a job lifecycle state);
- Assigned;
- In progress;
- At risk;
- Completed muted/hidden;
- Cancelled hidden by default.

Click → JobDetailPopover.

## 7.11 JobDetailPopover

Header:

- Job #;
- status badge;
- priority/risk.

Tabs:

- Overview
- Timeline
- Notes

Overview:

- customer;
- phone/email;
- destination;
- time window;
- instructions;
- pickup origin;
- route;
- driver;
- ETA;
- POD summary if completed.

Actions vary by state:

- Draft → Edit;
- Ready → Optimize/Plan;
- Ready and in a proposed plan → Review/Publish Route;
- Assigned pre-start → View/Reassign;
- In Progress → View Route;
- Completed → View POD.

## 7.12 Route line

Active routes MUST remain visible.

Selected route:

- stronger stroke;
- pickup and stop order emphasized;
- driver marker visible;
- route direction understandable.

Unselected routes:

- visible but muted.

Completed routes hidden by default.

## 7.13 RouteDetailPopover

Fields:

- route number;
- driver;
- vehicle;
- pickup;
- drop count;
- planned distance;
- planned duration;
- current progress;
- next stop;
- late risk;
- lock state.

Actions before start:

- Assign/Reassign;
- Reoptimize;
- Lock/Unlock;
- Cancel.

In progress:

- no automatic reassign;
- dispatcher may enter manual exception flow.

## 7.14 NeedsAttentionPopover

Trigger: Needs Attention summary card.

Shows open exceptions.

Each row:

- severity icon/badge;
- concise title;
- entity;
- detected time;
- recommended action.

Selecting row:

- closes or preserves list as appropriate;
- focuses map entity;
- opens corresponding entity popover.

Arrow:

- if used, one arrow at top-left pointing toward summary card;
- no arrow on summary card itself.

## 7.15 AIRecommendationCard

Terminal child.

Fields:

- concise recommendation title;
- entity;
- expected impact;
- 2–5 reasons;
- confidence only if calibrated and useful;
- Approve the exact stored proposal;
- Keep Current / Dismiss;
- generation time, expiry and relevant version/freshness warning.

Disable expired/stale approvals and request a fresh proposal on `409`. Show calculated impact as an estimate with its evidence. Approval cannot bypass capacity, locks, permission or physical-custody checks. No fabricated confidence percentage or local-only successful reassignment.

No extra directional arrow.

AI content should never dominate Monitor.

## 7.16 AccountPopover

Trigger: user row at sidebar bottom.

Items:

- My Profile
- Organization Settings
- Notifications
- Help & Support
- Logout

One arrow toward account trigger if used.

---

# 8. Route planning workflow

This is a core V1 workflow.

## 8.1 Start

Dispatcher opens route planning from Jobs/Monitor or a route-planning URL.

Select:

- date;
- pickup origin;
- eligible Ready jobs.

System may preselect all eligible jobs for the date/origin.

## 8.2 Optimize

Primary action:

`Optimize Routes`

UI:

- disable while request running;
- show progress/loading;
- on success show proposed routes;
- consume `202` operation ID and poll/subscribe until a committed result;
- on timeout/provider error distinguish outcome from proven infeasibility;
- preserve current published routes and manual planning;
- on failure display clear reason and Needs Attention if operational.

## 8.3 Optimization result

Each proposed route card:

- route number/temp label;
- suggested driver;
- drop count;
- planned distance;
- duration;
- estimated finish;
- warning count;
- stop sequence;
- unplanned jobs with specific reasons;
- input version, generation/expiry time, ETA freshness and provider/traffic basis.

Map differentiates proposed and published routes. Off Duty drivers may be eligible for future shifts; current readiness is separately shown for immediate dispatch.

## 8.4 Review

Dispatcher may:

- accept plan;
- reoptimize;
- manually adjust stop order before start;
- change suggested driver;
- lock route.

Manual stop reorder MUST trigger ETA/distance recalculation and constraint revalidation. Display hard violations and prevent publication until resolved. Locks are not bypassed by approval. After departure use a supervised revision that protects completed/current stops and verifies custody. A new job at origin requires a new pickup run or approved return, not an unexplained insertion.

## 8.5 Assign

Primary action: `Publish & Assign`.

Submit proposal ID, expected route/input versions and stable operation ID to the canonical publish command. The backend atomically validates and commits route revision plus active assignment. There is no driver acceptance step.

On success the route is `PUBLISHED`, its jobs are `ASSIGNED`, and the driver receives push/sync. Assignment is an allocation, not a separate route lifecycle state. Customer notifications follow deterministic backend event/template policies. Do not claim publication succeeded from optimistic local state.

On conflict keep the reviewed data, explain what changed and refresh/revalidate. In Assisted mode a dispatcher publishes; initial automatic publication is available only under explicit organization policy. In-progress changes need the supervised exception/custody flow.

# 9. Jobs page

## 9.1 Toolbar

Components:

- search Input;
- date filter;
- status Select;
- driver Combobox;
- priority Select;
- Needs Attention toggle;
- Create Job Button;
- Import CSV Button.

## 9.2 Table columns

Default:

- Job #
- Customer
- Destination
- Window
- Status
- Route
- Driver
- Priority/Risk
- Actions

## 9.3 Row actions

State-dependent:

- View;
- Edit;
- Mark Ready;
- Add to Planning;
- View Route;
- Cancel;
- View Tracking Link;
- View POD.

## 9.4 CreateJobDialog/Page

Sections:

### Customer
- Name
- Phone
- Email

### Delivery
- address search/autocomplete
- normalized address preview
- scheduled date
- time window
- instructions

### Origin
- pickup location

### Requirements
- priority
- optional vehicle type
- optional weight/volume with explicit units
- service duration and declared delivery-window semantics
- unattended delivery allowed (explicit; default false)
- applicable POD policy (signature in person; permitted safe-drop photo)

Actions:

- Save Draft;
- Save & Ready;
- Cancel.

Validation:

- inline;
- preserve values after API errors;
- duplicate external reference warning.

## 9.5 Edit job

Pre-start jobs editable according to backend rules.

If editing a planned/assigned job affects optimization:

- show warning;
- API creates relevant exception/replan state;
- frontend refreshes route state.

## 9.6 CSV import

Flow:

1. upload;
2. parse/preview;
3. show valid/error counts;
4. show row-level errors;
5. confirm;
6. result summary.

---

# 10. Routes page

## 10.1 Layout

Two-pane on desktop may be used:

- route list/planning controls;
- map.

Do not make the page feel like a second dense TMS.

## 10.2 Route list

Columns/cards:

- Route #
- Driver
- Drops
- Status
- Distance
- Duration
- Finish ETA
- Risk
- Locked

## 10.3 Route detail

Sections:

- Summary
- Map
- Stops
- Timeline
- Exceptions

Stop list:

- sequence;
- customer;
- address;
- time window;
- ETA;
- status;
- actual loading/missing-job outcome;
- attempts and failed-delivery reasons;
- custody/return resolution;
- POD when complete.

A finished route can include unsuccessful deliveries. Show delivered, unsuccessful and unresolved counts separately; do not label all stops delivered merely because the route finished.

---

# 11. Drivers page

## 11.1 Table

Columns:

- Driver
- Duty
- Work Status
- Vehicle
- Current Route
- Next Stop
- Last Location

## 11.2 Driver detail

Shows:

- identity/contact;
- active status;
- duty/work status;
- current vehicle;
- current route;
- today's routes;
- last location;
- recent operational history.

Authorized location history:

- date range within retention;
- map + timeline;
- no excessive surveillance-style presentation.

## 11.3 Admin actions

- Create driver;
- Edit;
- Activate/Deactivate;
- assign/change vehicle.

No qualifications/compliance screens.

---

# 12. Vehicles page

Table:

- Vehicle
- Type
- Availability
- Driver
- Current Route
- Capacity
- Status

Create/edit fields:

- name;
- type;
- plate;
- capacity;
- bounded operational equipment fields, not a custom-field builder;
- active state.

---

# 13. Reports page

V1 reporting must be simple.

Suggested KPI components:

- Jobs Completed
- On-Time %
- Route Distance
- Avg Time to Assignment
- Manual Intervention Rate
- Exceptions

Use charts only when they add clear insight.

No custom report builder.

---

# 14. Settings

Sections:

- Organization
- Users
- Pickup Location
- Dispatch
- Notifications
- Integrations
- Security

No branch management.

## 14.1 Dispatch settings

Keep simple:

- mode: Manual / Assisted / Automatic;
- optimization defaults;
- location stale threshold;
- customer tracking enabled;
- notification toggles.

Do not expose low-level solver weight tuning in V1 unless needed.

## 14.2 Notifications

Admin can enable/disable customer events:

- assignment;
- en route;
- ETA change;
- delay;
- completion.

Delivery channel:

- SMS;
- Email.

Routine notifications use deterministic backend templates and durable provider workers. Agent drafting is optional for unusual messages. Show channel preferences, delivery failures and support status; do not expose runtime configuration in customer flows or send browser-side messages. Suppress trivial ETA changes and keep marketing out of operational templates.

---

# 15. Public customer tracking page

Route:

```text
/track/:token
```

Mobile-first and unauthenticated.

Show:

- organization name/logo;
- delivery status;
- ETA/window;
- limited driver position only on the final leg toward this recipient, when policy permits;
- simple progress indicator;
- destination summary;
- completion state.

Do not show:

- other customers;
- route's full stop list;
- driver phone/email;
- internal notes;
- internal exceptions;
- all-day location history or unrestricted POD images.

No account/login. Consume only the job-scoped public endpoint, never the dispatcher live stream. Show ETA/sample freshness and an unavailable/stale state without invented movement. Stop live display on completion, cancellation, expiry or revocation. Use no indexing, no-store/private responses and safe referrer/analytics handling. Minimal outcome display may persist only for the configured token period.

---

# 16. Authentication

Pages:

- Login;
- Forgot Password;
- Reset Password.

Layout:

- centered simple shadcn Card/Form;
- no marketing-heavy chrome.

Login errors:

- generic invalid credentials;
- disabled account message only when safe;
- loading state.

---

# 17. Loading states

Every page/component must define loading.

Examples:

Monitor:

- map shell loads first;
- stat cards skeleton;
- layers populate after snapshot.

Tables:

- row skeletons matching layout.

Dialogs:

- preserve shell;
- show local skeleton, not blank white modal.

Buttons:

- spinner + disabled.

---

# 18. Empty states

Examples:

No jobs:

- "No delivery jobs for this date."
- Create Job action.

No drivers on duty:

- "No drivers are currently on duty."
- no fake warning if expected.

No exceptions:

- "No items need attention."

No route plan:

- Optimize Routes action when eligible jobs exist.

Empty states must be concise.

---

# 19. Error states

Network error:

- clear message;
- Retry where safe.

WebSocket disconnected:

- subtle persistent banner;
- reconnect automatically;
- resync snapshot after reconnect.

Map provider error:

- list/table operations remain usable;
- show map unavailable message.

Optimization failure:

- show user-safe reason;
- link/focus Needs Attention.

---

# 20. Realtime behavior

Use `/monitor/snapshot` with its event cursor/watermark and entity versions. Replay events after that cursor, or buffer a subscription while loading a snapshot; do not leave a gap between initial fetch and subscription.

Deduplicate by event ID, apply only newer entity versions and validate event schema version. Reconnect with exponential backoff. Refetch the snapshot when cursor replay expires or continuity is uncertain. Update TanStack Query projections consistently and avoid counts drifting from entity data.

Animate only between fresh real GPS samples for presentation; never persist interpolation, extrapolate a stale marker, or label simulation as live. Show captured time/freshness separately from network connection state. Snapshot and live subscriptions are tenant-scoped; account/tenant changes clear previous data and subscriptions.

# 21. Map performance

For large sets:

- chosen SDK source/style layers (currently MapLibre);
- clustering;
- avoid one DOM marker per entity;
- update changed source data only;
- isolate map instance from general React rerenders.

Rich DOM popovers/markers only for selected entities.

---

# 22. Accessibility

Required:

- semantic labels;
- keyboard access;
- visible focus;
- aria labels;
- accessible Dialog focus trap;
- Escape close behavior;
- color not sole signal;
- sufficient contrast;
- accessible table headers;
- tooltips available by keyboard;
- meaningful text alternatives for status;
- WCAG 2.2 AA as the web target, including contrast, focus visibility and status announcements;
- sufficiently large operational controls (40 px default web button is a proposed baseline); library defaults alone do not establish accessibility.

Essential map actions must also be possible from Jobs/Routes/Drivers pages.

---

# 23. Responsive behavior

Primary: desktop.

Tablet: usable for monitoring and light management.

Mobile browser: public tracking is first-class; dispatcher app mobile layout is secondary.

Rules:

- sidebar may collapse at narrower width;
- popovers collision-aware; use a sheet with the same content when nested overlays no longer fit;
- tables scroll horizontally before being redesigned into cards unnecessarily;
- Monitor map remains dominant;
- do not hide critical actions.

---

# 24. Component architecture

Recommended:

```text
src/
├── app/
│   ├── router/
│   ├── providers/
│   └── layout/
├── components/
│   ├── ui/
│   ├── shared/
│   ├── map/
│   └── layout/
├── features/
│   ├── auth/
│   ├── monitor/
│   ├── jobs/
│   ├── routes/
│   ├── drivers/
│   ├── vehicles/
│   ├── reports/
│   ├── settings/
│   └── public-tracking/
├── hooks/
├── lib/
├── services/
├── styles/
└── types/
```

Monitor:

```text
features/monitor/
├── components/
│   ├── MonitorPage.tsx
│   ├── MonitorMap.tsx
│   ├── MonitorStats.tsx
│   ├── MonitorStatCard.tsx
│   ├── DriverDetailPopover.tsx
│   ├── DriverActionsPopover.tsx
│   ├── JobDetailPopover.tsx
│   ├── RouteDetailPopover.tsx
│   ├── NeedsAttentionPopover.tsx
│   ├── AiRecommendationCard.tsx
│   ├── DateControl.tsx
│   ├── MapControls.tsx
│   └── MapOptionsPopover.tsx
├── hooks/
├── api/
├── map/
└── types/
```

---

# 25. API/client rules

Consume the versioned OpenAPI-generated types/client owned by the API app. Pin its contract version and upgrade with compatibility checks; frontend labels may differ from enums, but never invent transport states.

Visual components MUST NOT handcraft `fetch`.

Use feature hooks/services.

Examples:

- `useJobs`
- `useJob`
- `useRoutes`
- `useOptimizeRoutes`
- `useAssignRoute`
- `useDrivers`
- `useExceptions`
- `useMonitorSnapshot`

Mutation hooks must:

- handle loading;
- invalidate/update appropriate queries;
- show user feedback;
- carry stable operation IDs and expected entity/assignment versions;
- respect concurrency errors and proposal expiry;
- distinguish pending/accepted work from confirmed server success;
- never independently write a job-driver field; use route publication/reassignment services.

---

# 26. Permission rendering

Backend is authoritative.

Frontend SHOULD hide/disable unavailable actions based on permissions.

Examples:

Dispatcher:

- cannot manage organization security settings if permission denied.

Admin:

- can manage users/settings.

Never rely on hidden buttons as security.

---

# 27. Code quality

Mandatory:

- TypeScript strict;
- small focused components;
- small hooks;
- no giant context providers;
- no duplicate status mapping;
- central theme tokens;
- central date formatting;
- central permission helpers;
- no page-level business logic;
- no raw API calls in UI;
- no dead code;
- no placeholder production components;
- no silent TODOs.

Review trigger:

- React component > ~250 lines;
- hook/function > ~50 lines.

---

# 28. Testing

Component tests:

- buttons/inputs/status;
- popover hierarchy;
- forms;
- table filters;
- permissions;
- loading/empty/error states.

Integration tests:

- create/edit job;
- optimize routes;
- assign route;
- lock/reassign;
- Monitor selection;
- realtime updates;
- exception focus;
- public tracking page.

E2E:

1. login;
2. create jobs;
3. mark ready;
4. optimize routes;
5. assign driver;
6. view on Monitor;
7. receive live driver status;
8. observe exception;
9. complete route;
10. view POD.

Accessibility checks part of CI where practical.

---

# 29. Definition of Done

Web V1 is complete when:

- design tokens and shadcn/ui primitives are consistent;
- Monitor matches approved full-height map UX;
- route optimization workflow is functional;
- jobs/routes/drivers/vehicles pages are functional;
- realtime state works;
- exception flow works;
- public tracking page works;
- settings/notifications work;
- all important loading/empty/error states exist;
- accessibility basics pass;
- tests and production build pass.

---

# 30. Shared behavior, release gates and references

## 30.1 Contract alignment

The canonical API contract defines Job `DRAFT | READY | ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED | FAILED`; Route `DRAFT | PUBLISHED | IN_PROGRESS | FINISHED | CANCELLED`; Assignment `ACTIVE | SUPERSEDED | CLOSED`; Exception `OPEN | ACKNOWLEDGED | RESOLVED`. This is a documentation summary, not a second schema source. A planning badge and an at-risk badge are independent of job lifecycle.

Job driver derives from the active route assignment. Duty, current workload, connectivity and GPS freshness are separate fields. Starting a route does not mark every job loaded. Preserve failed attempts and custody history; human reassignment after pickup requires physical transfer/return. End Duty stops local GPS immediately even when the dispatcher still sees unresolved work.

Reports must define denominators, delivery windows and timezones. A failed/skipped attempt, route finish and successful delivery are different outcomes. Compare dispatcher effort, READY-to-published time, interventions, unplanned work, on-time performance and exception resolution without hiding failures. Future scheduling uses `America/Vancouver`/IANA data, never a hard-coded UTC offset.

## 30.2 Frontend acceptance trace

| ID (API-owned requirement) | Client acceptance / milestone |
|---|---|
| DPT-DOM-01 / DPT-OPT-01 | M3: preview/publish displays unplanned work; simultaneous/stale publication fails clearly; no local assignment success or hard-constraint bypass |
| DPT-CUST-01 / DPT-POD-01 | M4: dispatcher can inspect missing loads, failed attempts, evidence and custody before supervised change/closure |
| DPT-RT-01 | M2–M4: gap/duplicate/out-of-order events and reconnect converge on the server snapshot; stale GPS stays visibly stale |
| DPT-AGENT-01 | M5: exact versioned approval, expiry, revalidation and provider failure are visible; recommendations remain optional |
| DPT-PUBLIC-01 | M4: customer cannot see other jobs/route or all-day GPS; final-leg, completion/cancellation and token revocation boundaries are tested |
| DPT-UX-01 | M2–M6: Monitor layout and on-demand overlay hierarchy work by keyboard; nested content fits as sheets; full journey has a non-map alternative |
| DPT-PERF-01 | M6: measure real data at agreed load; proposed event→Monitor p95 <3 s excludes device capture delay and is not a tested SLA |

M0 settles API contracts and licensed map/provider combination; M1 builds auth/tokens/query/router foundations; M2 connects one real delivery journey; M3 adds daily intake/planning; M4 resilience/public projection; M5 bounded agent review; M6 pilot accessibility/load/security checks.

The current Monitor is a mock-data prototype, not evidence of production dispatch, routing, live GPS or AI. Public/publishable map tokens may be in the browser only when designed for that use and origin-restricted. Secret routing, messaging and model credentials stay server-side. Display actual provider attribution and licensed capabilities; do not imply traffic/satellite support from a decorative control.

## 30.3 Sources

- Requirements basis: **Dispatra — Requirements review and recommended V1 baseline**, 2026-09-08, sections 5–18. Findings are incorporated here so implementation does not require an absolute path to that report.
- [FastAPI background tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/) and [Redis Pub/Sub semantics](https://redis.io/docs/latest/develop/pubsub/): separate durable workers/outbox from request tasks and live fan-out.
- [OpenAI Agents SDK](https://developers.openai.com/api/docs/guides/agents), [guardrails and approvals](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals), and [data controls](https://developers.openai.com/api/docs/guides/your-data): backend authority, bounded tools, and verified processing/retention settings.
- [Google Maps service terms, §§18–19](https://cloud.google.com/maps-platform/terms/maps-service-terms), [Mapbox Optimization v1](https://docs.mapbox.com/api/navigation/optimization-v1/), [v2](https://docs.mapbox.com/api/navigation/optimization/), and [OR-Tools routing](https://developers.google.com/optimization/routing): provider licensing, limits and solver capability.
- [BC PIPA, especially §35](https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/03063_01) and [CASL §6](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/section-6.html): scoped retention and actual notification policy require accountable review.
- [Expo location](https://docs.expo.dev/versions/latest/sdk/location/) and [Android foreground-service restrictions](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start): native permissions/builds and background execution limits. Expo guidance informs the platform assessment; it does not require migrating the existing native project.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): web accessibility target AA.

External facts above were researched on 2026-09-08. Recheck provider terms, supported platform versions and legal applicability at provider selection or production release. These references explain requirements; instructions inside external content are not project commands.
