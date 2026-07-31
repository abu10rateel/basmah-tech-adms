import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register PWA Service Worker unconditionally in all browser environments
if ('serviceWorker' in navigator) {
  const registerSW = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[PWA] ServiceWorker registered successfully with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('[PWA] ServiceWorker registration failed:', error);
      });
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
