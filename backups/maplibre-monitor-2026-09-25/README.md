# MapLibre Monitor backup

Snapshot of the last MapLibre Monitor map before the Google Maps migration (September 25, 2026). The Earth intro had already been removed at the user's request.

- `TorontoMap.tsx.txt`: map renderer, route lines, markers, camera/controller and screen projection.
- `mapScene.ts.txt`: Vancouver camera, OpenFreeMap street style and Esri satellite style.
- `map-styles.css`: MapLibre-specific styling extracted from `src/index.css`.

These files are a source backup (using `.txt` suffixes to keep it outside the active TypeScript build). To restore, copy the renderer and scene into `src/components`, restore the CSS rules, and replace the Google Maps package/configuration with the recorded MapLibre dependencies (`react-map-gl@^8.1.3` and `maplibre-gl@^6.7.0`).
