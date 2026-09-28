# Dispatra web client specification

Updated: 2026-09-27. This is the current React/TypeScript client contract. [Implementation state](state.md) distinguishes browser demo behavior from API-backed behavior.

## 1. Scope and authority

The web client serves dispatchers, company administrators, shippers, and platform administrators. The FastAPI/PostgreSQL API owns identity, tenant scope, pricing, assignment, route feasibility, POD, invoices, and persistent operational records. The authenticated dispatcher route currently renders the original company-scoped browser demo; `/prototype` is separate. Connect manual operations to the API while preserving the existing Monitor, Pricing and form designs. Do not treat a local calculation, fixture, invoice preview, or simulated GPS point as an authoritative server result.

Use React, strict TypeScript, Vite, shadcn/ui, Inter, a light neutral theme, black primary actions, blue accent, and shared accessible controls. Keep the existing Dispatra brand and calm, compact visual style. The public landing page describes Dispatra as an AI-powered automatic dispatch system; its existing layout stays simple.

## 2. Routes and access

| Path | Purpose |
| --- | --- |
| `/` | Public website and workspace entry |
| `/admin` | Platform owner administration |
| `/{company-slug}/` | Dispatcher Monitor |
| `/{company-slug}/orders`, `/drivers`, `/vehicles`, `/shippers`, `/analytics`, `/pricing`, `/profile`, `/help` | Dispatcher pages |
| `/{company-slug}/shipper-portal` | Shipper account portal |
| `/{company-slug}/driver` | Driver portal |
| `/prototype` | Separate local demo entry |

`/{company-slug}/shippers` is the dispatcher directory, never the shipper portal. Dispatcher pages require the matching dispatcher API session; role-specific portals must not read dispatcher browser stores. Older `/platform`, `/{slug}/dispatch`, and `/{slug}/customer` account routes remain compatibility paths. Internal navigation preserves the slug, Back/Forward, direct loading, drafts, and unsaved-change confirmation.

## 3. Shared navigation and Monitor

Use one sidebar/account menu with direct Profile and Pricing access. A compact icon rail is available when collapsed; mobile navigation overlays the page with keyboard focus management. The `Auto dispatch` switch exposes exactly `AUTO` and `MANUAL`. In the API target, AUTO assigns eligible priced Orders and optimizes; MANUAL waits for dispatcher assignment and then optimizes. AI can recommend but cannot bypass hard constraints. Local simulation is not proof of backend assignment.

Monitor opens directly on the Vancouver Google map without an Earth intro or pre-animation. Use Google Maps JavaScript API through `@vis.gl/react-google-maps`, standard roadmap style, optional satellite/traffic/labels, custom nearby marker cards, and route lines from saved planned stops. Keep map controls and non-map alternatives usable. Preserve the map instance during internal page navigation and pause hidden polling. A missing key or failed map load gives a clear inline message.

Order, Quote, Shipper warehouse, Driver, Company, and portal address fields use Canadian Google Places suggestions with delayed search, a selected-address session token, minimal requested fields, outside dismissal, keyboard support, and manual text entry. Order/Quote stops retain selected coordinates. A driver's required address supplies the driver's service city; current local assignment compares it to the Order pickup city; the API enforces this for persisted orders.

## 4. Dispatcher directories and forms

- **Shippers:** New/Edit uses Shipper name for both Business and Individual; Business also requires Company name. Collect email, phone, one complete Warehouse Address, rate card, payment terms, optional discount, and instructions. Email is required for portal login and is also the quote/invoice address. There is no Contact name or Service Area input. The warehouse address is the default Order pickup and is preserved when the dispatcher manually changes that stop. Show Credit card status and a disabled Add credit card action until authenticated Stripe setup exists; never collect raw card data in browser storage.
- **Drivers:** New/Edit requires name, phone, email, and address. Address city defines the service area; remove the old Service areas input. New drivers inherit the company maximum active Orders limit; an individual override can be edited in Driver Details. Employment is Employee or Owner-operator; only Owner-operators edit the two payout share percentages. Attached vehicle selection begins with Register new vehicle and returns to the same driver draft. With no image, show the uppercase first letter of the name as the avatar.
- **Driver details:** End with all-time Activity & Earnings and app connectivity, app last seen, GPS captured, location permission, and current route. Show compact completed-Order and estimated-earnings cards; employee earnings are not fabricated. A completed Owner-operator Order freezes the applicable payout shares and estimate. This is an estimate, not a payment ledger.
- **Vehicles:** One fleet view and one Register/Edit form. Select a vehicle type, then edit vehicle-specific capacity and pricing. Cargo length, width, and height are required; Maximum stops is optional and a positive whole number. Equipment uses checkboxes. Keep one Vehicle description. Do not show Vehicle class name/description, Vehicle upgrade surcharge, Surcharge is fuel-eligible, or Requires commercial driver licence in the form; legacy stored values remain readable.

All create/edit/delete actions use shared dialogs and confirmations. List tables retain a visible Action column when they have actions. Open menus and dropdowns dismiss on outside click.

## 5. Orders, quotes, dates, and analytics

Orders list and Analytics use the same date menu: Today, Tomorrow, All dates, Date range. The Orders date filter sits with list filters; New Quote and New Order remain header actions. New is in the status selector, so there is no separate Unassigned control. Analytics date selection updates every KPI, chart, audit row, and CSV from dated records. Completed Orders show an Invoice cue and action until invoiced.

New Order chooses a saved Shipper. New Quote is for a prospect: it chooses an active Rate Card instead of a Shipper, offers Send Quote, and never creates an Order. Send Quote offers PDF download or a mail-client handoff; it is not an email provider. Neither form shows manual Zone, Priority, or Residential controls; Residential is an Accessorial. Each package has Fragile and DG checkboxes. Package inputs share a single flexible row, display one decimal place, stay at least 50px wide, and scroll within the Packages container only when necessary. Compact fields are about 32px high. Multiple pickup/drop-off links use explicit From/To selectors.

Order lifecycle is `NEW → ASSIGNED → IN_PROGRESS → COMPLETED → INVOICED`, with `CANCELLED` separately. Pricing review, At risk, Late start, and Failed attempt are attention flags, not competing lifecycle states. An Order is the commercial and invoice unit; Routes contain multiple Orders. The details view shows saved charge lines, subtotal, tax, and total without a View calculation disclosure. Frozen pricing is not silently changed by assignment or directory edits.

## 6. Pricing and company profile

Profile tabs are Company, Security & Sessions, and Taxes & Preferences. Company starts with one logo, Company name, Contact full name, email, phone, role, and a single-line address; Save Company sits at the bottom. On authenticated company routes, account email and role come from the session and are read-only. Company details, taxes and preferences load/save through the versioned company-settings API, and password changes use the authentication API. There is no personal avatar editor. Taxes & Preferences contains an optional tax registration number, checkboxes labeled `Apply GST/HST to taxable charges` and `Apply provincial tax to taxable charges`, rates, and regional preferences. Disabled taxes do not charge. Company phone and billing email are not in General settings.

Pricing tabs are Rate Cards, Fuel Surcharge, Service Level, and Accessorials. A Rate Card is the base customer price; shipper discounts are set on the Shipper form. Service Level uses one fixed additional charge; Fuel Surcharge uses one editable percentage; Accessorials are configured separately. Service Level and Accessorial rows use a small confirmed delete icon in an Action column. Preserve historical saved terms and frozen quotes when retiring controls.

New Rate Cards support Base + Distance, Fixed, Zone to zone, and Hourly; existing Imported cards remain readable/editable. Base + Distance uses base fee plus distance beyond included distance, without a weight charge. Fixed uses its fixed amount. Zone uses one central pickup and destination-zone columns over From/To weight bands, with a 0–99 lb / Zone 1 / $20 starter rate, Add row, and a small delete icon per row. A missing zone/weight rate requires review. Hourly uses rounded billable time and its minimum. Each card's `How Pricing Work?` section first states its own freight formula in words, then the values used, then short equations for Subtotal, Tax, and Total, including the minimum. No unnecessary parenthetical charge categories appear in those equations.

The API target calculates and freezes a versioned PricingSnapshot and ChargeLines. At a high level: `subtotal = max(minimum, freight + service + vehicle + fuel + accessorials + adjustments − discounts)`; `tax = sum(each enabled taxable base × its rate)`; `total = subtotal + tax`. GST/HST and provincial tax are separate lines. Amounts use Decimal/cents in the API, and old snapshots stay unchanged. The current local engine remains a preview on the dispatcher workspace until operational API connection.

## 7. Client data, portals, and acceptance

Demo fixtures become explicit organization-owned database seeds during API integration, never an automatic browser-data import. Company routes scope browser demonstration records temporarily; database demo records remain separate and are not imported implicitly. When the existing forms are connected, new Driver and Shipper submission must use the manual API to create profile and least-privilege account in one transaction; email is the login ID and a generated initial password is revealed once. The connected shipper portal will create Orders through the shared booking API and read only its own profile, allowed Orders, delivery evidence and invoices; the connected driver portal will receive only operational projections. Platform administration manages dispatch companies.

Use generated OpenAPI types and centralized TanStack Query transport for API-backed data. Preserve historical bookings, Rate Card versions, customer snapshots, and invoice amounts through migration. Completion requires focused domain and interaction tests, TypeScript/build checks, browser review for changed journeys, and real API integration tests for tenancy, pricing, dispatch, POD, and invoicing. A static screen is not proof of an integrated feature.

## 8. V1 entity compatibility

The API contract must preserve stable Order/stop/item identifiers, explicit pickup-to-delivery links, customer and payer snapshots, company units, frozen pricing/invoice history, and legacy records whose fields are hidden from the current simplified forms. The latest create/edit UI above is the V1 entry surface. Historical fields may remain readable but must not reappear as unexplained new-form inputs. A client-only `InvoicePreview` is never an issued Invoice, and simulated location is never live GPS.

## 8. Manual web execution

The Driver portal is reserved in the current client. Its planned workflow includes explicit duty with location consent, assigned routes, stop execution, evidence and server-confirmed completion. Native background tracking, durable offline evidence queues and push remain a later phase.

Dispatcher and Shipper views expose stored delivery proof and issued invoice documents. Quotes remain separate persisted estimates with PDF download/mail-client handoff. Manual assignment offers only active directory records and lets the API enforce duty, feasibility and route locks. AUTO remains visible but disabled until automation is implemented.
