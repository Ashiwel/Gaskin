import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import App from './App.tsx';
import { restoreAISettings } from './ui/Settings';
import { registerPWA, pwaSupport } from './storage';

restoreAISettings();

// Installable and offline only when served over http(s) as a top-level page. Inside the claude.ai
// artifact frame (sandboxed) and from a USB stick (file://) this does nothing.
try {
  if (pwaSupport().ok) void registerPWA().catch(() => false);
} catch {
  /* never block start-up */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
