import { createRoot } from 'react-dom/client';
import { TenantApplication } from './tenant-app.js';
import { applyUiPreferences, DEFAULT_UI_PREFERENCES } from './ui.js';
import './styles.css';
import './portal-home-page.css';

applyUiPreferences(DEFAULT_UI_PREFERENCES);

const root = document.getElementById('root');
if (root) createRoot(root).render(<TenantApplication />);
