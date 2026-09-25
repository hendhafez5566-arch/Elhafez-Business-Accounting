import './styles.css';
import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {OwnerControlApp} from './owner-control-app.js';
import {OwnerApiClient} from './owner-client.js';

const root=typeof document==='undefined'?null:document.getElementById('root');
if(root)createRoot(root).render(createElement(OwnerControlApp,{client:new OwnerApiClient('/api')}));

export {OwnerControlApp} from './owner-control-app.js';
export {OwnerApiClient} from './owner-client.js';
