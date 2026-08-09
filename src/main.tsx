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

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import { AuthProvider } from './lib/auth';
import { SubscriptionGate } from './components/SubscriptionGate';
import { LegalHost } from './components/LegalDocs';
import './index.css';

if (typeof document !== 'undefined') {
  document.title = 'Quantum Node';
}

// Auto-update service worker so installed PWA stays current
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <LegalHost>
        <SubscriptionGate>
          <App />
        </SubscriptionGate>
      </LegalHost>
    </AuthProvider>
  </StrictMode>,
);

