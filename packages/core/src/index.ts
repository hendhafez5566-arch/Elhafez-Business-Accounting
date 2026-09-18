/** Cross-cutting primitives only; never import business modules here. */
export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };
