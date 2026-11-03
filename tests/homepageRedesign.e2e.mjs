// Keep the established homepage command focused on the current five-scene UI.
process.env.BROWSERS ||= 'chromium';
await import('./homeAgentCompatibility.e2e.mjs');
