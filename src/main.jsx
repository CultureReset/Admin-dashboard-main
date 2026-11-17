import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';
// Form-control styles (.ui-input, .ui-field…) are used directly by many
// sections, not only through Field.jsx. Loaded here so a section opened
// first, before any lazy chunk that imports Field.jsx, is not unstyled.
import './ui/Field.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
