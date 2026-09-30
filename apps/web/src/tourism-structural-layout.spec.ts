import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./tourism-operations-page.tsx', import.meta.url), 'utf8');

test('tourism routes own distinct structural surfaces instead of a shared legacy tab shell', () => {
  assert.match(source, /type TourismSurface='programs'\|'bookings'\|'itinerary'/);
  assert.match(source, /data-tourism-surface=\{initialTab\}/);
  assert.match(source, /programs:\{title:'البرامج السياحية',reference:'Master Module Template'/);
  assert.match(source, /bookings:\{title:'الحجوزات السياحية',reference:'Tourism Bookings'/);
  assert.match(source, /itinerary:\{title:'البرنامج اليومي',reference:'Tourism Itinerary Builder'/);
  assert.doesNotMatch(source, /<Tabs\b/);
  assert.doesNotMatch(source, /\bTabs,/);
});

test('tourism child surfaces do not create a second canonical page stack', () => {
  assert.doesNotMatch(source, /className="ui-page-stack"/);
  assert.match(source, /className="ui-flow" aria-label="إدارة البرامج السياحية"/);
});
