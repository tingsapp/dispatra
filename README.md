# Dispatra web client

The public website is `/`, with a prefixed workspace identifier and Start trial leading to `/signup?company={slug}` for a 30-day trial. Existing users sign in at `/login`. Choose Dispatcher, Shipper or Driver, then enter email and password; the API finds the company. `/dispatch`, `/shipper` and `/driver` preselect the corresponding role. Email and nonblank phone are unique within each role across companies, and can be shared across different roles. The dispatcher workspace, including Monitor, Orders and Pricing settings, is available at `/{company}/` after API login. Company workspaces use the FastAPI/PostgreSQL API for operational records. `/prototype` provides a separate local demonstration with its own `/prototype/login`.

```sh
npm ci
npm run dev
```

Vite serves port 3000 and proxies `/api` to `http://127.0.0.1:8000`. Set `API_PROXY_TARGET` to use a different API port. See [API setup](../api/README.md).

The explicitly seeded local `demo` company has `dispatcher@example.com`, `shipper@example.com`, and `driver@example.com`, initially using `123456`. The dispatcher workspace is `/demo/`; Shippers book and track orders at `/demo/shipper`; Drivers manage duty and execute assigned deliveries at `/demo/driver`. Old `/demo/shipper-portal`, `/demo/customer` and `/demo/dispatch` links redirect to these paths. Platform administration is at `/admin`. Company Profile, pricing settings and account security use the API. API demo data is separate from browser fixtures and is not silently imported.

Every signed-in workspace follows the API `/sync` feed and refetches only changed records (about every 15 seconds by default); the open Monitor also refreshes driver locations every 30 seconds. Notifications appear in the Monitor bell and in the Shipper and Driver portal headers. Completed is the final successful Order status; completion preserves saved pricing and POD. V1 has no invoicing. The [API email worker](../api/README.md#quote-and-delivery-update-email) delivers explicit Quotes and configured delivery updates.

## Google map and addresses

Put a browser-restricted `VITE_GOOGLE_MAPS_API_KEY` in `.env.local`; enable Maps JavaScript API, Places API (New), and Geocoding API. Never commit keys. Without a key, the Monitor shows a setup message. Address fields accept manual entry. Canadian address suggestions use a debounce, session token, and selected-place fields; geocoding by the selected place ID fills in missing address details when needed. Map/Places/Geocoding usage can incur provider charges. The previous MapLibre map is saved in [`backups/maplibre-monitor-2026-09-25`](backups/maplibre-monitor-2026-09-25/README.md).

## Checks

```sh
npm run lint
npm test
npm run build
```

After an API schema change, run `python -m app.export_openapi` in the API environment and `npm run generate:api` here. Account browser checks are `npm run test:admin`, `npm run test:company-profile`, and `npm run test:shipper-portal`.

For the full manual browser journey, use a disposable `*_test` database migrated and seeded with `app.demo`, a restricted API runtime role, `ROUTING_PROVIDER=demo`, and no email worker. Start Vite with `DISABLE_HMR=true` and `API_PROXY_TARGET` pointing to that API. Then run:

```sh
E2E_ORIGIN=http://127.0.0.1:3001 E2E_DISPOSABLE=true node tests/manualWorkflow.e2e.mjs
```

This creates test orders through both booking forms, assigns through the dispatcher UI, executes signature delivery through the driver UI, checks Completed status, unchanged pricing and Shipper delivery proof, and observes Monitor updates. Places and GPS use deterministic fixtures; the API and PostgreSQL are real. It does not submit email or verify a recipient inbox.

Shared login browser acceptance: run `npm run test:login` against a disposable API database, with `E2E_ORIGIN`, `E2E_OWNER_LOGIN` and `E2E_OWNER_PASSWORD` set. It creates test accounts, checks all three roles sharing contacts, validates duplicate/tenant rejection, and signs each role out.

Trial signup browser acceptance: run `E2E_DISPOSABLE=true npm run test:signup` with `E2E_ORIGIN` pointing to a local disposable API. Set `E2E_VERIFICATION_CODE_URL` to a local test-mail capture endpoint that accepts an `email` query and returns the verification code. It checks homepage navigation, prefilled identifiers, password confirmation, account creation and email verification before workspace access, 30-day dates, login/logout, credential privacy and 390px/320px layouts.
