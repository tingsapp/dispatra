import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './Root.tsx';
import './index.css';
import { installRuntimeDiagnostics } from './portal/runtimeDiagnostics';
import { installStaleReleaseReload } from './lib/staleRelease';

const stopDiagnostics = installRuntimeDiagnostics(window);
const stopStaleReload = installStaleReleaseReload(window);
if (import.meta.hot) import.meta.hot.dispose(() => { stopDiagnostics(); stopStaleReload(); });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
