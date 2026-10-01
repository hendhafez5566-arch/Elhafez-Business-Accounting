import { createRoot } from 'react-dom/client';
import { TenantApplication } from './tenant-app.js';
import { applyUiPreferences, DEFAULT_UI_PREFERENCES } from './ui.js';
import './styles.css';

// Give unauthenticated entry screens the canonical default appearance. Once a user
// session opens, UiPreferencesProvider reapplies that user's persisted preference.
applyUiPreferences(DEFAULT_UI_PREFERENCES);

const root=document.getElementById('root');
if(root)createRoot(root).render(<TenantApplication/>);