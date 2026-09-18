import { createRoot } from 'react-dom/client';
import { AppShell } from './app-shell.js';
import './styles.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<AppShell />);
