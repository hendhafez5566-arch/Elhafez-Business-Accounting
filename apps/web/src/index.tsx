import { createRoot } from 'react-dom/client';
import { TenantApplication } from './tenant-app.js';
import './styles.css';

const root=document.getElementById('root');
if(root)createRoot(root).render(<TenantApplication/>);
