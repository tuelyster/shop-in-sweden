import { useCallback, useEffect, useRef, useState } from 'react';
import {
  resolveInitialValues,
  saveStored,
  writeSearch,
  type Registry,
  type Values,
} from './url-state';

const browserStorage = () => window.localStorage;

/**
 * Holds every registered input, mirrors changes into the query string (no reload,
 * no history entry) and into browser storage. Call once, near the top of the app.
 */
export function useUrlInputs<R extends Registry>(registry: R) {
  const registryRef = useRef(registry);
  const [values, setValues] = useState<Values<R>>(() =>
    resolveInitialValues(registryRef.current, window.location.search, browserStorage),
  );

  // Also runs on first render, so a restored or default state is shareable straight away.
  useEffect(() => {
    const search = writeSearch(registryRef.current, values);
    if (search !== window.location.search) {
      window.history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`);
    }
    saveStored(browserStorage, search);
  }, [values]);

  const setInput = useCallback(<K extends keyof R>(key: K, value: Values<R>[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { values, setInput };
}
