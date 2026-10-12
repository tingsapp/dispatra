import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './Root.tsx';
import './index.css';
import { installRuntimeDiagnostics } from './portal/runtimeDiagnostics';

const stopDiagnostics = installRuntimeDiagnostics(window);
if (import.meta.hot) import.meta.hot.dispose(stopDiagnostics);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
