import '@fontsource-variable/figtree';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import './shared/styles/tokens.css';
import './shared/styles/components.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root is missing from index.html.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
