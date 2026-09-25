import { createRoot } from 'react-dom/client';
import { browserPathname } from './app-entry-path.js';
import { TenantApplication } from './tenant-entry.js';
import './styles.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<TenantApplication pathname={browserPathname()} />);
