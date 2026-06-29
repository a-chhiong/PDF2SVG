// ============================================================
// PDF2SVG — Lit-powered SPA Entry Point
// All components are Lit elements with reactive properties
// ============================================================

import './features/app-root.js';
import './features/file/file-drop-zone.js';
import './features/progress/progress-indicator.js';
import './features/viewer/svg-viewer.js';
import './features/viewer/svg-item.js';
import './features/theme/theme-toggle.js';
import './components/app-loader.js';

// --- Restore saved theme on load (light is default) ---
(function initTheme() {
  const root = document.documentElement;
  const saved = localStorage.getItem('pdf2svg-theme');
  if (saved === 'dark' || saved === 'light') {
    root.setAttribute('data-theme', saved);
  } else {
    root.setAttribute('data-theme', 'light');
  }
})();

// --- Listen for system color scheme changes ---
(function watchSystemTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e) => {
    const saved = localStorage.getItem('pdf2svg-theme');
    if (!saved) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  };
  mq.addEventListener('change', handler);
})();

// --- Register service worker for PWA support ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Service worker registration is optional
    });
  });
}

console.log('PDF2SVG Webapp successfully bootstrapped with MuPDF WASM backend.');