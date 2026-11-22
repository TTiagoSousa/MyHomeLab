import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { ThemeProvider } from './Contexts/ThemeContext.tsx';
import { NavigationProvider } from './Contexts/Navs_Context.tsx';
import { AuthProvider } from './Contexts/Auth_Context.tsx';
import { AlertProvider } from './Contexts/Alert_Context.tsx';
import { i18nReady } from './i18n';

const STALE_CHUNK_RELOAD_KEY = 'myhomelab.staleChunkReloadAt';
const STALE_CHUNK_RELOAD_GAP_MS = 10_000;

const lastStaleChunkReload = () => {
  try {
    return Number(sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY)) || 0;
  } catch {
    return 0;
  }
};

window.addEventListener('vite:preloadError', (event) => {
  if (Date.now() - lastStaleChunkReload() < STALE_CHUNK_RELOAD_GAP_MS) return;
  try {
    sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

const renderApp = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <ThemeProvider>
          <AlertProvider>
            <NavigationProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </NavigationProvider>
          </AlertProvider>
        </ThemeProvider>
      </BrowserRouter>
    </StrictMode>,
  );

i18nReady.then(renderApp, renderApp);
