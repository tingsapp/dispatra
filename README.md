# Dispatra web client

The public website is `/`. The original dispatcher UI, including its Google Monitor and Pricing design, is available at `/{company}/` after API login. `/prototype` provides a separate local demonstration. Dispatcher operational records still use the browser demo store; the manual API is implemented but is not connected to these screens.

```sh
npm ci
npm run dev
```

Vite serves port 3000 and proxies `/api` to `http://127.0.0.1:8000`. Set `API_PROXY_TARGET` to use a different API port. See [API setup](../api/README.md).

The local `demo` company has `dispatcher@example.com`, `shipper@example.com`, and `driver@example.com`, initially using `123456`. The dispatcher workspace at `/demo/` uses the original local Monitor, Orders, Shippers, Drivers, Vehicles, Pricing, and Analytics screens. Company Profile and session/password settings are API backed. The Shipper account page provides profile/password access. The Driver URL is reserved; its operational portal is not connected in this client. API demo data is separate from browser fixtures and is not silently imported.

## Google map and addresses

Put a browser-restricted `VITE_GOOGLE_MAPS_API_KEY` in `.env.local`; enable Maps JavaScript API, Places API (New), and Geocoding API. Never commit keys. Without a key, the Monitor shows a setup message. Address fields accept manual entry. Canadian address suggestions use a debounce, session token, and selected-place fields; geocoding by the selected place ID fills in missing address details when needed. Map/Places/Geocoding usage can incur provider charges. The previous MapLibre map is saved in [`backups/maplibre-monitor-2026-09-25`](backups/maplibre-monitor-2026-09-25/README.md).

## Checks

```sh
npm run lint
npm test
npm run build
```

After an API schema change, run `python -m app.export_openapi` in the API environment and `npm run generate:api` here. `npm run test:company-profile` checks the authenticated company Profile against a dedicated test database. The operational UI needs a later API connection that preserves the existing components and layout.
