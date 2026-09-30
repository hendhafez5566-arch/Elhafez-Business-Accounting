import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReactElement } from 'react';
import { foundationRoutes } from './routes.js';
import { ProgramsPage } from './hajj-umrah-pages.js';
import { RoomingPage } from './hajj-umrah-operations-primary-pages.js';
import { TicketingPage, TransportPage, TripOperationsPage } from './hajj-umrah-operations-secondary-pages.js';
import {
  HajjUmrahProgramsBoardPage,
  HajjUmrahRoomingMatrixPage,
  HajjUmrahTicketingCenterPage,
  HajjUmrahTransportFleetPage,
  HajjUmrahTripOperationsCommandPage,
} from './hajj-umrah-structural-pages.js';

const byId = (id: string) => {
  const route = foundationRoutes.find(value => value.id === id);
  assert.ok(route, `missing route ${id}`);
  return route;
};
const elementType = (id: string) => (byId(id).element as ReactElement).type;

test('visible Hajj and Umrah routes use reference-aligned structural workspaces', () => {
  assert.equal(elementType('hajj-umrah-programs'), HajjUmrahProgramsBoardPage);
  assert.equal(byId('hajj-umrah-programs').design.blueprint, 'kanban');
  assert.equal(byId('hajj-umrah-programs').design.reference, 'hajj-umrah-kanban');

  assert.equal(elementType('hajj-umrah-rooming'), HajjUmrahRoomingMatrixPage);
  assert.equal(byId('hajj-umrah-rooming').design.blueprint, 'matrix');
  assert.equal(byId('hajj-umrah-rooming').design.reference, 'rooming-allocation');

  assert.equal(elementType('hajj-umrah-ticketing'), HajjUmrahTicketingCenterPage);
  assert.equal(byId('hajj-umrah-ticketing').design.reference, 'voucher-ticketing-center');

  assert.equal(elementType('hajj-umrah-transport'), HajjUmrahTransportFleetPage);
  assert.equal(byId('hajj-umrah-transport').design.reference, 'fleet-transport');

  assert.equal(elementType('hajj-umrah-trip-operations'), HajjUmrahTripOperationsCommandPage);
  assert.equal(byId('hajj-umrah-trip-operations').design.reference, 'trip-operations');
});

test('transaction owners remain single hidden routes instead of duplicated inside command workspaces', () => {
  const owners = [
    ['hajj-umrah-programs-manage', ProgramsPage],
    ['hajj-umrah-rooming-manage', RoomingPage],
    ['hajj-umrah-ticketing-manage', TicketingPage],
    ['hajj-umrah-transport-manage', TransportPage],
    ['hajj-umrah-trip-operations-manage', TripOperationsPage],
  ] as const;

  for (const [id, owner] of owners) {
    const route = byId(id);
    assert.equal(route.navigation, false, `${id} must stay out of primary navigation`);
    assert.equal((route.element as ReactElement).type, owner, `${id} must keep the existing transaction owner`);
  }
});

test('visible routes never point back to the legacy transaction pages', () => {
  assert.notEqual(elementType('hajj-umrah-programs'), ProgramsPage);
  assert.notEqual(elementType('hajj-umrah-rooming'), RoomingPage);
  assert.notEqual(elementType('hajj-umrah-ticketing'), TicketingPage);
  assert.notEqual(elementType('hajj-umrah-transport'), TransportPage);
  assert.notEqual(elementType('hajj-umrah-trip-operations'), TripOperationsPage);
});
