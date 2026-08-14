// Safe global monkeypatch for performance.measure to prevent React 19 / Chrome DataCloneError crash
if (typeof window !== 'undefined' && window.performance && typeof window.performance.measure === 'function') {
  const originalMeasure = window.performance.measure;
  window.performance.measure = function (name: string, startMarkOrOptions?: any, endMark?: any): any {
    try {
      // In modern browsers, when React 19 passes a Fiber object as the second argument,
      // the browser interprets it as an options object and tries to structure-clone it.
      // This throws a DataCloneError because the Fiber has circular references.
      if (typeof startMarkOrOptions === 'object' && startMarkOrOptions !== null) {
        return originalMeasure.call(window.performance, name);
      }
      return originalMeasure.call(window.performance, name, startMarkOrOptions, endMark);
    } catch (e) {
      try {
        return originalMeasure.call(window.performance, name);
      } catch (_) {
        return { name, entryType: 'measure', startTime: 0, duration: 0, detail: null } as any;
      }
    }
  };
}

import {StrictMode, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import { AuthProvider } from './lib/auth';
import { SubscriptionGate } from './components/SubscriptionGate';
import { LegalHost } from './components/LegalDocs';
import { ManualHost } from './components/UserManual';
import { ProductAppPreview } from './components/ProductAppPreview';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import './index.css';

const App = lazy(() => import('./App.tsx'));

if (typeof document !== 'undefined') {
  document.title = 'Quantum Node';
}

if (typeof window !== 'undefined') {
  registerSW({immediate: true});
}

const isProductPreview =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('preview') === 'app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isProductPreview ? (
      <ProductAppPreview />
    ) : (
      <AuthProvider>
        <LegalHost>
          <ManualHost>
            <SubscriptionGate>
              <Suspense
                fallback={
                  <div className="min-h-screen bg-[#050505] flex items-center justify-center text-gray-400">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                  </div>
                }
              >
                <App />
              </Suspense>
            </SubscriptionGate>
            <PwaInstallPrompt />
          </ManualHost>
        </LegalHost>
      </AuthProvider>
    )}
  </StrictMode>,
);
