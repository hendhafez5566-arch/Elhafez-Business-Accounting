import './styles.css';
import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {OwnerControlApp} from './owner-control-app.js';
import {OwnerApiClient} from './owner-client.js';

const root=typeof document==='undefined'?null:document.getElementById('root');
const configured=typeof document==='undefined'?'/api':document.querySelector<HTMLMetaElement>('meta[name="elhafez-api-base"]')?.content?.trim()||'/api';
const base=configured.endsWith('/')?configured.slice(0,-1):configured;
if(root)createRoot(root).render(createElement(OwnerControlApp,{client:new OwnerApiClient(base)}));

export {OwnerControlApp} from './owner-control-app.js';
export {OwnerApiClient} from './owner-client.js';
