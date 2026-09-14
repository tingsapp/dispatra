# Dispatra web client

The existing dispatch prototype remains at `/` and `/prototype`. Authenticated company/customer account pages use the FastAPI/PostgreSQL service described in [API setup](../api/README.md).

```sh
npm ci
npm run dev
```

Vite serves port 3000 and proxies `/api` to `http://127.0.0.1:8000`. Set `API_PROXY_TARGET` if the API uses another port. Use a same-origin reverse proxy and HTTPS for deployment; configure the API's exact `WEB_ORIGINS` and secure cookies.

- `/platform`: platform owner login and company provisioning.
- `/{company}/dispatch`: dispatcher login, customer creation and credential reset.
- `/{company}/customer`: customer login and own profile completion.
- `/{company}/customer/settings`: optional password change.

Company URLs currently expose the account-access milestone. The existing browser-only customer/order/pricing data is preserved, but is not silently imported into a company's database. There is no public signup or forced first-login password change. Customer order viewing/booking and operational dispatcher integration follow in later milestones.

```sh
npm run lint
npm test
npm run build
```

After API schema changes, run `python -m app.export_openapi` in the API environment and `npm run generate:api` here. The account client uses generated types, `openapi-fetch` and TanStack Query; it does not persist authenticated data or passwords in localStorage.

For the real browser journey, run the API and this client against a disposable database with a bootstrapped test owner. Set `E2E_ORIGIN` (default `http://127.0.0.1:3001`), `E2E_OWNER_LOGIN` and `E2E_OWNER_PASSWORD`, then run `npm run test:portal`. It creates test companies and customers. Chrome must be installed; `E2E_BROWSER_CHANNEL` selects another supported channel. Optional `E2E_SCREENSHOT_DIR` captures only completed profile screens, not credentials.
