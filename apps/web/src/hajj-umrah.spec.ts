import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pages = readFileSync(new URL('./hajj-umrah-pages.tsx', import.meta.url), 'utf8');
const routes = readFileSync(new URL('./routes.tsx', import.meta.url), 'utf8');

test('HU-01 exposes the three focused Arabic routes', () => {
  for (const path of [
    '/hajj-umrah/seasons',
    '/hajj-umrah/programs',
    '/hajj-umrah/program-workspace',
  ]) assert.ok(routes.includes(path), path);
  for (const label of ['المواسم', 'برامج الحج والعمرة', 'مساحة عمل البرنامج']) {
    assert.ok(routes.includes(label), label);
  }
});

test('HU-01 shows approved lifecycle and separate booking availability labels', () => {
  for (const label of [
    'تحت التجهيز',
    'متاح للحجز',
    'الرحلة جارية',
    'منتهي',
    'ملغي',
    'الحجز متاح',
    'الحجز مغلق',
  ]) assert.ok(pages.includes(label), label);
});

test('program workspace covers required HU-01 views and actions', () => {
  for (const label of [
    'البيانات الأساسية',
    'الموسم',
    'التواريخ والسعة',
    'الأسعار',
    'المتطلبات والمكونات',
    'مؤشرات التجهيز',
    'الإصدار الحالي',
    'فتح الحجز',
    'إغلاق الحجز',
  ]) assert.ok(pages.includes(label), label);
});

test('HU-01 action surfaces are permission-aware and avoid browser prompt APIs', () => {
  for (const permission of [
    'hajj_umrah.seasons.manage',
    'hajj_umrah.seasons.lifecycle',
    'hajj_umrah.programs.create',
    'hajj_umrah.programs.edit',
    'hajj_umrah.programs.amend',
    'hajj_umrah.programs.availability',
    'hajj_umrah.programs.lifecycle',
  ]) assert.ok(pages.includes(permission), permission);
  assert.equal(/window\.(prompt|confirm|alert)\s*\(/.test(pages), false);
});
