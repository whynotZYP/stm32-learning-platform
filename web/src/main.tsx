import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('椤甸潰缂哄皯 #root 鎸傝浇鑺傜偣');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
