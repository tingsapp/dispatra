# Dispatra web client implementation state

Updated: 2026-09-28. [Specification](spec.md) defines the intended behavior. This file records the current client after the manual API UI rollback.

## Implemented

- Public website `/`, platform administration `/admin`, company dispatcher route `/{company}/`, Shipper account route `/{company}/shipper-portal`, reserved Driver route `/{company}/driver`, and separate `/prototype` demo.
- The authenticated dispatcher route renders the original `App` UI. Its Google Monitor, pricing Rate Cards, Orders, Drivers, Vehicles, Shippers and Analytics keep their pre-integration layout and local demo stores. A company slug scopes those browser stores. No operational browser records are imported into PostgreSQL.
- Company Profile loads and saves company details, logo, correspondence address, tax settings and regional units through the versioned API. Account email/role and password changes also use the API. The Sidebar uses authenticated company identity.
- Platform company/account administration and Shipper account Profile/password use the account API. The operational Shipper and Driver portals are not connected in the current client.
- The original Order/Quote, fleet, Zone matrix, date filter and map UI remain the browser demonstration. Their local calculations and invoices are previews, not authoritative API records.

## Integration boundary

The FastAPI/PostgreSQL manual service supports operational records and commands, but the dispatcher and role-specific operational screens must be connected to it using the existing visual components. Email delivery, Stripe, AUTO/AI work and native offline Driver operation remain separate phases. The separate database demo pricing/accounts are retained; they do not replace browser fixtures on this UI.

## Verification

The rollback restored the original `App` entry for authenticated dispatchers and removed the replacement manual client screens. On 2026-09-28, `npm run lint`, `npm test` (279 passed, 0 failed), and `npm run build` passed. Authenticated Chrome checks showed the original Monitor at `/demo/` and Rate Card layout at `/demo/pricing`. Google map tiles were blocked in that browser check, so live map loading was not verified there. Earlier API-connected manual browser results applied to the removed replacement screens and are not evidence that the restored UI is connected.
