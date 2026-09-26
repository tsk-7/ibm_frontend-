import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { DatasetProvider } from './context/DatasetContext';
import './index.css';
import './assistant.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DatasetProvider>
      <App />
    </DatasetProvider>
  </StrictMode>
);
