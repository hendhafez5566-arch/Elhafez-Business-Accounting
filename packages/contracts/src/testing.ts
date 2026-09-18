/** Shared contract-test assertion: JSON transport must retain every field exactly. */
export function assertContractRoundTrip<T>(contract: T, parser: (input: unknown) => T): T {
  const serialized = JSON.stringify(contract);
  const transported: unknown = JSON.parse(serialized);
  const parsed = parser(transported);
  if (JSON.stringify(parsed) !== serialized) throw new Error('Contract changed during JSON serialization round-trip');
  return parsed;
}
