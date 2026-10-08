/**
 * URL-state mechanism: every shopper input is registered here once (name, default,
 * parse/serialise) and is then mirrored into the query string, restored from a shared
 * URL, and remembered in browser storage. Later tickets add an input by calling
 * `defineInput` and including it in the registry in `inputs.ts`.
 */

export interface InputDef<T> {
  /** Query-string key. Must be unique across the registry. */
  name: string;
  /** Value used when nothing valid is supplied. Evaluated lazily (may depend on today). */
  defaultValue: () => T;
  /** Parse a raw query value; return `undefined` when invalid so the default is used. */
  parse: (raw: string) => T | undefined;
  /** Turn a value into its query-string form. */
  serialise: (value: T) => string;
}

export function defineInput<T>(def: InputDef<T>): InputDef<T> {
  return def;
}

export type Registry = Record<string, InputDef<any>>;

export type Values<R extends Registry> = {
  [K in keyof R]: R[K] extends InputDef<infer T> ? T : never;
};

/** Does this query string carry at least one registered input? */
export function hasRegisteredInputs(registry: Registry, search: string): boolean {
  const params = new URLSearchParams(search);
  return Object.values(registry).some((def) => params.has(def.name));
}

/** Read one value per registered input; missing, invalid or unknown values become defaults. */
export function readValues<R extends Registry>(registry: R, search: string): Values<R> {
  const params = new URLSearchParams(search);
  const values: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(registry)) {
    const raw = params.get(def.name);
    let parsed: unknown;
    if (raw !== null) {
      try {
        parsed = def.parse(raw);
      } catch {
        parsed = undefined;
      }
    }
    values[key] = parsed === undefined ? def.defaultValue() : parsed;
  }
  return values as Values<R>;
}

/** Query string (with leading `?`) holding every registered input, defaults included. */
export function writeSearch<R extends Registry>(registry: R, values: Values<R>): string {
  const params = new URLSearchParams();
  for (const [key, def] of Object.entries(registry)) {
    params.set(def.name, def.serialise(values[key]));
  }
  return `?${params.toString()}`;
}

export const STORAGE_KEY = 'shop-in-sweden:inputs';

/** Minimal slice of `Storage` we rely on, so tests can substitute a throwing one. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadStored(storage: () => StorageLike): string {
  try {
    return storage().getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveStored(storage: () => StorageLike, search: string): void {
  try {
    storage().setItem(STORAGE_KEY, search);
  } catch {
    // Storage unavailable (private mode, blocked, quota): sharing via URL still works.
  }
}

/**
 * Initial values: the URL wins when it carries any registered input; otherwise the last
 * stored inputs; otherwise defaults.
 */
export function resolveInitialValues<R extends Registry>(
  registry: R,
  search: string,
  storage: () => StorageLike,
): Values<R> {
  if (hasRegisteredInputs(registry, search)) return readValues(registry, search);
  return readValues(registry, loadStored(storage));
}
