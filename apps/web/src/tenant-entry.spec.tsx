import test from'node:test';import assert from'node:assert/strict';import{createElement}from'react';import{renderToStaticMarkup}from'react-dom/server';import{TenantApplication}from'./tenant-entry.js';

test('unauthenticated application renders canonical Company Code entry instead of business pages',()=>{
 const html=renderToStaticMarkup(createElement(TenantApplication,{pathname:'/'}));
 assert.match(html,/تسجيل الدخول/);assert.match(html,/Company Code/);assert.match(html,/نسيت كلمة المرور/);
});
