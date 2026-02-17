
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Critical error during app initialization:", error);
  rootElement.innerHTML = `
    <div style="padding: 40px; color: #ef4444; font-family: 'Inter', sans-serif; text-align: center; background: #0f172a; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div style="background: #1e293b; padding: 32px; border-radius: 16px; border: 1px solid #334155; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <h1 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 10px; color: white;">System Initialization Failed</h1>
        <p style="font-size: 1rem; opacity: 0.8; max-width: 400px; margin-bottom: 24px; color: #94a3b8;">A critical error occurred while loading the DCS-Architect core modules. This is often caused by module resolution conflicts in the browser environment.</p>
        <button onclick="window.location.reload()" style="padding: 12px 32px; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);">Reload Platform</button>
        <div style="margin-top: 32px; text-align: left;">
          <p style="font-size: 0.75rem; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Technical Details</p>
          <pre style="padding: 16px; background: #0f172a; border-radius: 8px; font-size: 0.7rem; color: #f87171; overflow: auto; max-width: 500px; max-height: 200px; border: 1px solid #ef444422;">${error instanceof Error ? error.message : String(error)}</pre>
        </div>
      </div>
    </div>
  `;
}
