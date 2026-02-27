import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent "Cannot set property fetch of #<Window> which has only a getter"
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'fetch', {
    value: window.fetch,
    writable: true,
    configurable: true
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
