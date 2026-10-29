import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './state/store';
import { ThemeProvider, readPref, resolveTheme } from './state/theme';
import { registerServiceWorker } from './lib/pwa';
import './styles/global.css';

// ใส่ธีมก่อน React จะ render เพื่อไม่ให้เห็นหน้าขาววาบตอนเปิดในโหมดมืด
document.documentElement.setAttribute('data-theme', resolveTheme(readPref()));

const el = document.getElementById('root');
if (!el) throw new Error('ไม่พบ #root ใน index.html');

createRoot(el).render(
  <StrictMode>
    <ThemeProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ThemeProvider>
  </StrictMode>,
);

registerServiceWorker();
