# Dispatra web client specification

Updated: 2026-09-29. This is the current React/TypeScript client contract. [Implementation state](state.md) distinguishes browser demo behavior from API-backed behavior.

## 1. Scope and authority

The web client serves dispatchers, company administrators, shippers, and platform administrators. The FastAPI/PostgreSQL API owns identity, tenant scope, pricing, assignment, route feasibility, POD, invoices, and persistent operational records. The authenticated dispatcher route uses the manual API within the original Monitor, Pricing and form designs; `/prototype` is a separate local demonstration. Do not treat a local calculation, fixture, invoice preview, or simulated GPS point as an authoritative server result.

Use React, strict TypeScript, Vite, shadcn/ui, Inter, a light neutral theme, black primary actions, blue accent, and shared accessible controls. Keep the existing Dispatra brand and calm, compact visual style. The public landing page describes Dispatra as an AI-powered automatic dispatch system; its existing layout stays simple.

## 2. Routes and access

| Path | Purpose |
| --- | --- |
| `/` | Public website and workspace entry |
| `/admin`, `/admin/companies`, `/admin/companies/{id}`, `/admin/profile` | Platform owner administration: companies, company detail with dispatcher accounts, owner profile |
| `/{company-slug}/` | Dispatcher Monitor |
| `/{company-slug}/orders`, `/drivers`, `/vehicles`, `/shippers`, `/analytics`, `/pricing`, `/profile`, `/help` | Dispatcher pages |
| `/{company-slug}/shipper-portal` | Shipper account portal |
| `/{company-slug}/driver` | Driver portal |
| `/prototype` | Separate local demo entry |

`/{company-slug}/shippers` is the dispatcher directory, never the shipper portal. Dispatcher pages require the matching dispatcher API session; role-specific portals must not read dispatcher browser stores. Older `/platform`, `/{slug}/dispatch`, and `/{slug}/customer` account routes remain compatibility paths. Internal navigation preserves the slug, Back/Forward, direct loading, drafts, and unsaved-change confirmation.

## 3. Shared navigation and Monitor

Use one sidebar/account menu with direct Profile and Pricing access. A compact icon rail is available when collapsed; mobile navigation overlays the page with keyboard focus management. The `Auto dispatch` switch exposes exactly `AUTO` and `MANUAL`. MANUAL waits for dispatcher assignment and then optimizes. AUTO assignment remains disabled until automation is implemented. AI can recommend but cannot bypass hard constraints. Local simulation is not proof of backend assignment.

Monitor opens directly on the Vancouver Google map without an Earth intro or pre-animation. Use Google Maps JavaScript API through `@vis.gl/react-google-maps`, standard roadmap style, optional satellite/traffic/labels, custom nearby marker cards, and route lines from saved planned stops. Keep map controls and non-map alternatives usable. Preserve the map instance during internal page navigation and pause hidden polling. A missing key or failed map load gives a clear inline message.

Order, Quote, Shipper warehouse, Driver, Company, and portal address fields use Canadian Google Places suggestions with delayed search, a selected-address session token, minimal requested fields, outside dismissal, keyboard support, and manual text entry. Selecting an address retains formatted text, city, province, country, postal code and coordinates; editing the text clears stale selection metadata. Order/Quote stops retain selected coordinates. A driver's required address supplies the driver's service city; current local assignment compares it to the Order pickup city; the API enforces this for persisted orders.

## 4. Dispatcher directories and forms

- **Shippers:** New/Edit uses Shipper name for both Business and Individual; Business also requires Company name. Collect email, phone, one complete Warehouse Address, rate card, payment terms, optional discount, and instructions. Email is required for portal login and is also the quote/invoice address. There is no Contact name or Service Area input. The warehouse address is the default Order pickup and is preserved when the dispatcher manually changes that stop. Credit cards are added by the authenticated Shipper through Stripe Connect hosted setup. The company owns the Stripe customer and card; never collect raw card data in Dispatra or browser storage.
- **Drivers:** New/Edit requires name, phone, email, and address. Address city defines the service area; remove the old Service areas input. New drivers inherit the company maximum active Orders limit; an individual override can be edited in Driver Details. Employment is Employee or Owner-operator; only Owner-operators edit the two payout share percentages. Attached vehicle selection begins with Register new vehicle and returns to the same driver draft. Editing Duty saves the dispatcher-selected On/Off state through the API and reloads from the persisted duty session; it does not start location sharing. With no image, show the uppercase first letter of the name as the avatar.
- **Driver details:** End with all-time Activity & Earnings and app connectivity, app last seen, GPS captured, location permission, and current route. Show compact completed-Order and estimated-earnings cards; employee earnings are not fabricated. A completed Owner-operator Order freezes the applicable payout shares and estimate. This is an estimate, not a payment ledger.
- **Vehicles:** One fleet view and one Register/Edit form. Select a vehicle type, then edit vehicle-specific capacity and pricing. Cargo length, width, and height are required; Maximum stops is optional and a positive whole number. Equipment uses checkboxes. Keep one Vehicle description. Do not show Vehicle class name/description, Vehicle upgrade surcharge, Surcharge is fuel-eligible, or Requires commercial driver licence in the form; legacy stored values remain readable.

All create/edit/delete actions use shared dialogs and confirmations. List tables retain a visible Action column when they have actions. Open menus and dropdowns dismiss on outside click.

## 5. Orders, quotes, dates, and analytics

Orders list and Analytics use the same date menu: Today, Tomorrow, All dates, Date range. The Orders date filter sits with list filters; New Quote and New Order remain header actions. New is in the status selector, so there is no separate Unassigned control. Analytics date selection updates every KPI, chart, audit row, and CSV from dated records. Completed Orders show an Invoice cue and action until invoiced.

New Order chooses a saved Shipper. New Quote is for a prospect: it chooses an active Rate Card instead of a Shipper, offers Send Quote, and never creates an Order. Send Quote creates a persisted Quote and explicitly queues email delivery through the API. A PDF or mail-client action is only a local export or handoff when offered. Neither form shows manual Zone, Priority, or Residential controls; Residential is an Accessorial. Each package has Fragile and DG checkboxes. Package inputs share a single flexible row, display one decimal place, stay at least 50px wide, and scroll within the Packages container only when necessary. Compact fields are about 32px high. Multiple pickup/drop-off links use explicit From/To selectors.

Order lifecycle is `NEW → ASSIGNED → IN_PROGRESS → COMPLETED → INVOICED`, with `CANCELLED` separately. Pricing review, At risk, Late start, and Failed attempt are attention flags, not competing lifecycle states. An Order is the commercial and invoice unit; Routes contain multiple Orders. The details view shows saved charge lines, subtotal, tax, and total without a View calculation disclosure. Frozen pricing is not silently changed by assignment or directory edits.

## 6. Pricing and company profile

Profile tabs are Company, Security & Sessions, and Taxes & Preferences. Company starts with one logo, Company name, Contact full name, email, phone, role, and a single-line address; Save Company sits at the bottom. On authenticated company routes, account email and role come from the session and are read-only. Company details, taxes and preferences load/save through the versioned company-settings API, and password changes use the authentication API. There is no personal avatar editor. Taxes & Preferences contains an optional tax registration number, checkboxes labeled `Apply GST/HST to taxable charges` and `Apply provincial tax to taxable charges`, rates, and regional preferences. Disabled taxes do not charge. Company phone and billing email are not in General settings.

Pricing tabs are Rate Cards, Fuel Surcharge, Service Level, and Accessorials. A Rate Card is the base customer price; shipper discounts are set on the Shipper form. Service Level uses one fixed additional charge; Fuel Surcharge uses one editable percentage; Accessorials are configured separately. Service Level and Accessorial rows use a small confirmed delete icon in an Action column. Preserve historical saved terms and frozen quotes when retiring controls.

New Rate Cards support Base + Distance, Fixed, Zone to zone, and Hourly; existing Imported cards remain readable/editable. Base + Distance uses base fee plus distance beyond included distance, without a weight charge. Fixed uses its fixed amount. Zone uses one central pickup and destination-zone columns over From/To weight bands, with a 0–99 lb / Zone 1 / $20 starter rate, Add row, and a small delete icon per row. A missing zone/weight rate requires review. Hourly uses rounded billable time and its minimum. Each card's `How Pricing Work?` section first states its own freight formula in words, then the values used, then short equations for Subtotal, Tax, and Total, including the minimum. No unnecessary parenthetical charge categories appear in those equations.

The API target calculates and freezes a versioned PricingSnapshot and ChargeLines. At a high level: `subtotal = max(minimum, freight + service + vehicle + fuel + accessorials + adjustments − discounts)`; `tax = sum(each enabled taxable base × its rate)`; `total = subtotal + tax`. GST/HST and provincial tax are separate lines. Amounts use Decimal/cents in the API, and old snapshots stay unchanged. The dispatcher workspace uses the API pricing review for live Orders and Quotes; the local engine is confined to `/prototype`.

## 7. Client data, portals, and acceptance

Demo fixtures are explicit organization-owned database seeds, never an automatic browser-data import. Company routes use API records while `/prototype` keeps separate local fixtures. New Driver and Shipper submission uses the manual API to create a profile and least-privilege account in one transaction; email is the login ID and a generated initial password is revealed once. The Shipper portal creates Orders through the shared booking API and reads only its own profile, allowed Orders, delivery evidence and invoices; its order form offers an optional "Want specific driver?" choice (default No preference, names only) and names the Rate Card that prices the shipper's Orders only in the Live estimate (not among the form fields); that estimate lists only the card name (no version, resolution source or method) plus the company's GST/HST, provincial tax and fuel surcharge rates, each shown only when enabled in the dispatch account, and has no calculation disclosure (the dispatcher order and quote estimate use the same header, plus the road Distance and Duration the API used once priced; shippers never see distance or duration), while dispatchers see the requested driver on the order and first in the assignment menu; the Driver portal receives only operational projections. Platform administration manages dispatch companies: a searchable, status-filtered company list; a create-company dialog that also creates the first dispatcher; and a company detail page with name editing, confirmed suspend/activate, dispatcher accounts (login ID, name, status, created, last sign-in, active sessions) with add, edit, reset password, sign-out-sessions and activate/deactivate actions, and administration history. Destructive actions use `confirmDialog`; stale versions show a reload action. Generated passwords appear once in component state and never in browser storage, URLs or query keys. Owner URLs support direct loading, refresh and Back/Forward. The owner profile shows the login ID and password change. A dispatcher session at `/admin` sees only a sign-in prompt, and owner actions never appear in company workspaces; the API enforces this independently.

Use generated OpenAPI types and centralized TanStack Query transport for API-backed data. Preserve historical bookings, Rate Card versions, customer snapshots, and invoice amounts through migration. Completion requires focused domain and interaction tests, TypeScript/build checks, browser review for changed journeys, and real API integration tests for tenancy, pricing, dispatch, POD, and invoicing. A static screen is not proof of an integrated feature.

## 8. V1 entity compatibility

The API contract must preserve stable Order/stop/item identifiers, explicit pickup-to-delivery links, customer and payer snapshots, company units, frozen pricing/invoice history, and legacy records whose fields are hidden from the current simplified forms. The latest create/edit UI above is the V1 entry surface. Historical fields may remain readable but must not reappear as unexplained new-form inputs. A client-only `InvoicePreview` is never an issued Invoice, and simulated location is never live GPS.

## 9. Manual web execution

The Driver portal uses the API for explicit duty with location consent, assigned routes, stop execution, evidence and server-confirmed completion. Native background tracking, durable offline evidence queues and push remain a later phase.

Dispatcher and Shipper views expose stored delivery proof and issued invoice documents. Quotes remain separate persisted estimates with explicit queued email delivery. The Monitor assignment menu shows registered drivers with availability reasons; inactive, off-duty, vehicle-less and on-route drivers cannot be selected. The API enforces duty, feasibility and route locks. Order popup tabs stay within the card using compact, equal-width columns. AUTO remains visible but disabled until automation is implemented.

## Public entity IDs

Orders, Drivers, Shippers and Vehicles have server-issued public numbers in the format `D{company initial}{entity letter}-{random number}`. Entity letters are O, D, S and V respectively. The company initial is the first Latin letter in the company name, falling back to the slug. Numbers start with four digits and expand only after that company/entity exhausts its combinations. Generation is serialized per company and checked against archived and active numbers; database uniqueness remains enforced. UUIDs remain internal relation keys. Published numbers are stable across profile edits and company renames. Vehicles retain a separate editable Unit number. Existing operational records receive public numbers through migration; frozen invoices and commercial snapshots retain their saved historical text.

## Shipper portal navigation and payments

The sidebar contains Profile, Orders, Invoices, and Payment Methods, each with a direct URL beneath `/{company}/shipper-portal`. Profile contains contact details and password controls. Orders contains booking and delivery proof; Invoices contains issued documents. Payment Methods shows dispatcher-managed invoice terms and Stripe-sourced masked cards. Card setup requires explicit save-card consent and a configured connected account; Stripe return navigation does not prove completion. Saving a card does not collect payment or alter invoice terms.

Shipper pages reuse dispatcher typography, spacing, controls and tables. All four Shipper pages use the centered reading-width column. Profile uses Details/Security tabs; Payment Methods uses flat sections. Plain sections have no card wrapper, background, border or padding. Orders and Invoices have a single page heading and unboxed tables. New order opens the shared form dialog from the page header.
