# Tourism Contract Inventory (AC-11)

Canonical bounded module for tourism contract inventory management.

## Ownership

AC-11 owns:
- Tourism contract inventory
- Capacity management (hotel, flight block, transport, visa quota)
- Contract versioning/amendments
- Reservations and allocations
- Release subject to history blockers
- Internal-first fulfillment
- Inventory evidence for AC-12

## Dependencies

- AC-10 Procurement Finance (public contracts only)
- Cost & Budget Accounting (public contracts only)

## Business Rules Implemented

- BR-052: Multi-dimensional booking capacity
- BR-056: Date-level hotel inventory preventing overbooking
- BR-057: Aggregate flight block consumption across programs
- BR-058: Concurrent-period transport capacity
- BR-059: Cumulative visa quota and date-sensitive stop-sale
- BR-060: Open program coverage protection
- BR-061: Partial allocation change with cost propagation
- BR-062: Version-like contract amendment
- BR-063: Allocation release blocked by financial history
- BR-064: Internal-first fulfillment
- BR-065: No duplicate AP from contracted inventory

## Golden Scenarios

- GS-032: Hotel inventory overbooking prevention
- GS-033: Partial hotel allocation adjustment
- GS-034: Stop sale enforcement
- GS-035: Shared flight block across programs
- GS-036: Transport non-overlap reuse
- GS-037: Internal inventory before external procurement
- GS-038: Duplicate visa batch prevention
- GS-039: Ticket issuance requires real flight segment
